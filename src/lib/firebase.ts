import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { 
  initializeFirestore, 
  persistentLocalCache, 
  persistentMultipleTabManager 
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

// Import original firestore operations to wrap them
import * as firestore from 'firebase/firestore';

const app = initializeApp(firebaseConfig);

// Initialize Firestore with robust persistent local cache (IndexedDB multi-tab)
// and safe fallback if the environment blocks IndexedDB
let dbInstance: any;
try {
  dbInstance = initializeFirestore(app, {
    localCache: persistentLocalCache({
      tabManager: persistentMultipleTabManager()
    })
  }, (firebaseConfig as any).firestoreDatabaseId);
} catch (e) {
  console.warn("Falling back to standard getFirestore:", e);
  dbInstance = firestore.getFirestore(app, (firebaseConfig as any).firestoreDatabaseId);
}

export const db = dbInstance;
export const auth = getAuth();

// --- TRACKER LOGIC (RESET AT 14:00 WIB / 2:00 PM DAILY) ---
export interface UsageData {
  cycleId: string; // Format: YYYY-MM-DD_14:00
  cycleStart: string;
  cycleEnd: string;
  reads: number;
  writes: number;
}

export const QUOTA_READS = 50000;
export const QUOTA_WRITES = 20000;

/**
 * Returns the unique ID for the 24-hour cycle resetting every day at 14:00 (14:00 WIB).
 * Example:
 * - If current time is 2026-08-29 10:00 -> cycleId is "2026-08-28_14:00" (started yesterday 14:00, ends today 14:00)
 * - If current time is 2026-08-29 14:05 -> cycleId is "2026-08-29_14:00" (started today 14:00, ends tomorrow 14:00)
 */
export function getCurrentUsageCycleInfo(): { cycleId: string; cycleStart: string; cycleEnd: string; nextReset: Date } {
  const now = new Date();
  const startDate = new Date(now);

  if (now.getHours() < 14) {
    startDate.setDate(startDate.getDate() - 1);
  }
  startDate.setHours(14, 0, 0, 0);

  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + 1);

  const formatCycleDate = (d: Date) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const cycleId = `${formatCycleDate(startDate)}_14:00`;
  const cycleStart = `${formatCycleDate(startDate)} 14:00`;
  const cycleEnd = `${formatCycleDate(endDate)} 14:00`;

  return { cycleId, cycleStart, cycleEnd, nextReset: endDate };
}

export function getUsage(): UsageData {
  const { cycleId, cycleStart, cycleEnd } = getCurrentUsageCycleInfo();
  const stored = localStorage.getItem('firebase_usage_stats_1400');
  
  if (stored) {
    try {
      const data: UsageData = JSON.parse(stored);
      if (data.cycleId === cycleId) {
        return data;
      } else {
        // Daily 14:00 cycle boundary reached! Clear stale in-memory cache
        clearCache();
      }
    } catch (e) {
      console.warn("Error parsing usage stats:", e);
    }
  }
  
  const newData: UsageData = {
    cycleId,
    cycleStart,
    cycleEnd,
    reads: 0,
    writes: 0
  };
  
  try {
    localStorage.setItem('firebase_usage_stats_1400', JSON.stringify(newData));
  } catch (_) {}
  
  return newData;
}

export function trackRead(count: number = 1) {
  const usage = getUsage();
  usage.reads += count;
  try {
    localStorage.setItem('firebase_usage_stats_1400', JSON.stringify(usage));
  } catch (_) {}
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('firebase-usage-updated', { detail: usage }));
  }
}

export function trackWrite(count: number = 1) {
  const usage = getUsage();
  usage.writes += count;
  try {
    localStorage.setItem('firebase_usage_stats_1400', JSON.stringify(usage));
  } catch (_) {}
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('firebase-usage-updated', { detail: usage }));
  }
}

// --- HIGH PERFORMANCE CLIENT-SIDE MEMORY CACHING ---
interface CacheEntry {
  data: any;
  timestamp: number;
}

// Fast in-memory map without blocking synchronous localStorage writes
const memoryCache = new Map<string, CacheEntry>();
const CACHE_TTL = 3 * 60 * 1000; // 3 minutes TTL for snappy performance

export function clearCache() {
  memoryCache.clear();
}

function getQueryCollectionPath(q: any): string {
  if (!q) return '';
  if (typeof q.path === 'string') return q.path;
  if (q._query && q._query.path) {
    if (Array.isArray(q._query.path.segments)) {
      return q._query.path.segments.join('/');
    }
    if (typeof q._query.path.toUtf8String === 'function') {
      return q._query.path.toUtf8String();
    }
  }
  return '';
}

function generateCacheKey(q: any): string {
  if (!q) return '';
  const colPath = getQueryCollectionPath(q);
  
  if (typeof q.path === 'string' && q.path.split('/').length % 2 === 0) {
    return `doc:${q.path}`;
  }
  
  let key = `query:${colPath}`;
  if (q._query) {
    try {
      if (q._query.filters && q._query.filters.length > 0) {
        const filters = q._query.filters.map((f: any) => {
          const field = f.field?.segments?.join('.') || f.field?.toString() || '';
          const op = f.op || '';
          const val = f.value !== undefined ? String(f.value) : '';
          return `${field}_${op}_${val}`;
        }).join(',');
        key += `:f:[${filters}]`;
      }
      if (q._query.explicitOrderBy && q._query.explicitOrderBy.length > 0) {
        const orders = q._query.explicitOrderBy.map((o: any) => {
          const field = o.field?.segments?.join('.') || o.field?.toString() || '';
          const dir = o.dir || 'asc';
          return `${field}_${dir}`;
        }).join(',');
        key += `:o:[${orders}]`;
      }
      if (q._query.limit) {
        key += `:l:${q._query.limit}`;
      }
    } catch (_) {
      key += `:fallback:${colPath}`;
    }
  }
  return key;
}

function invalidateCacheForPath(ref: any) {
  const path = getQueryCollectionPath(ref);
  if (!path) {
    clearCache();
    return;
  }
  
  const segments = path.split('/');
  const collectionName = segments[0];
  
  for (const key of memoryCache.keys()) {
    if (
      key.startsWith(`query:${collectionName}`) || 
      key.startsWith(`doc:${collectionName}`) ||
      key.includes(`/${collectionName}`) ||
      key.includes(`:${collectionName}`)
    ) {
      memoryCache.delete(key);
    }
  }
}

// --- HIGH SPEED WRAPPED FIRESTORE FUNCTIONS ---

export const getDoc = async <AppModelType, DbModelType extends firestore.DocumentData = firestore.DocumentData>(
  reference: firestore.DocumentReference<AppModelType, DbModelType>
): Promise<firestore.DocumentSnapshot<AppModelType, DbModelType>> => {
  const key = generateCacheKey(reference);
  const now = Date.now();
  if (key && memoryCache.has(key)) {
    const entry = memoryCache.get(key)!;
    if (now - entry.timestamp < CACHE_TTL) {
      return entry.data;
    }
  }

  try {
    const snap = await firestore.getDoc(reference);
    trackRead(1);
    if (key) {
      memoryCache.set(key, { data: snap, timestamp: now });
    }
    return snap;
  } catch (error) {
    console.warn(`Firestore getDoc failed for ${reference.path}:`, error);
    if (key && memoryCache.has(key)) {
      return memoryCache.get(key)!.data;
    }
    throw error;
  }
};

export const getDocs = async <AppModelType, DbModelType extends firestore.DocumentData = firestore.DocumentData>(
  query: firestore.Query<AppModelType, DbModelType>
): Promise<firestore.QuerySnapshot<AppModelType, DbModelType>> => {
  const key = generateCacheKey(query);
  const now = Date.now();
  if (key && memoryCache.has(key)) {
    const entry = memoryCache.get(key)!;
    if (now - entry.timestamp < CACHE_TTL) {
      return entry.data;
    }
  }

  try {
    const res = await firestore.getDocs(query);
    const count = Math.max(1, res.size);
    trackRead(count);
    if (key) {
      memoryCache.set(key, { data: res, timestamp: now });
    }
    return res;
  } catch (error) {
    console.warn(`Firestore getDocs failed:`, error);
    if (key && memoryCache.has(key)) {
      return memoryCache.get(key)!.data;
    }
    throw error;
  }
};

export const setDoc = async <AppModelType, DbModelType extends firestore.DocumentData = firestore.DocumentData>(
  reference: firestore.DocumentReference<AppModelType, DbModelType>,
  data: firestore.WithFieldValue<AppModelType>,
  options?: firestore.SetOptions
): Promise<void> => {
  trackWrite(1);
  invalidateCacheForPath(reference);

  if (options) {
    return await firestore.setDoc(reference, data, options);
  } else {
    return await firestore.setDoc(reference, data as any);
  }
};

export const addDoc = async <AppModelType, DbModelType extends firestore.DocumentData = firestore.DocumentData>(
  reference: firestore.CollectionReference<AppModelType, DbModelType>,
  data: firestore.WithFieldValue<AppModelType>
): Promise<firestore.DocumentReference<AppModelType, DbModelType>> => {
  trackWrite(1);
  invalidateCacheForPath(reference);
  return await firestore.addDoc(reference, data);
};

export const updateDoc = async (
  reference: any,
  ...args: any[]
): Promise<void> => {
  trackWrite(1);
  invalidateCacheForPath(reference);
  return await (firestore.updateDoc as any)(reference, ...args);
};

export const deleteDoc = async (
  reference: any
): Promise<void> => {
  trackWrite(1);
  invalidateCacheForPath(reference);
  return await firestore.deleteDoc(reference);
};

// Re-export other standard functions
export {
  collection,
  doc,
  query,
  where,
  orderBy,
  Timestamp,
  serverTimestamp
} from 'firebase/firestore';
