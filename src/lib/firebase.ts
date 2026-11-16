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
import { getDocFromCache, getDocsFromCache } from 'firebase/firestore';

const app = initializeApp(firebaseConfig);

// Initialize Firestore with robust persistent local cache (IndexedDB multi-tab)
// and safe fallback if the environment blocks IndexedDB
let dbInstance: any;
try {
  dbInstance = initializeFirestore(app, {
    localCache: persistentLocalCache({
      tabManager: persistentMultipleTabManager()
    }),
    experimentalAutoDetectLongPolling: true,
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

// Fast in-memory map + lightweight persistent timestamps in localStorage
const memoryCache = new Map<string, CacheEntry>();
const CACHE_TTL = 15 * 60 * 1000; // 15 minutes TTL for snappy performance and maximum quota conservation
const CACHE_TS_STORAGE_KEY = 'sacil_firestore_cache_ts';
let quotaCooldownUntil = 0;
const QUOTA_COOLDOWN_MS = 15 * 1000; // 15 seconds cooldown before retrying network after quota error

interface PersistedTsEntry {
  ts: number;
  hasDocs?: boolean;
}

function loadPersistedCacheTs(): Record<string, PersistedTsEntry> {
  try {
    const raw = localStorage.getItem(CACHE_TS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function savePersistedCacheTs(map: Record<string, PersistedTsEntry>) {
  try {
    localStorage.setItem(CACHE_TS_STORAGE_KEY, JSON.stringify(map));
  } catch {
    // Ignore storage quota errors
  }
}

function getPersistedCacheEntry(key: string): PersistedTsEntry | null {
  if (!key) return null;
  const map = loadPersistedCacheTs();
  return map[key] || null;
}

function setPersistedCacheEntry(key: string, ts: number, hasDocs?: boolean) {
  if (!key) return;
  const map = loadPersistedCacheTs();
  map[key] = { ts, hasDocs };
  savePersistedCacheTs(map);
}

function clearPersistedCacheTs() {
  try {
    localStorage.removeItem(CACHE_TS_STORAGE_KEY);
  } catch {
    // Ignore
  }
}

export function isQuotaError(error: any): boolean {
  if (!error) return false;
  const code = String(error?.code || '').toLowerCase();
  const message = String(error?.message || error || '').toLowerCase();
  return (
    code === 'resource-exhausted' ||
    message.includes('quota') ||
    message.includes('resource-exhausted') ||
    message.includes('resource_exhausted')
  );
}

function isUnavailableError(error: any): boolean {
  if (!error) return false;
  const code = String(error?.code || '').toLowerCase();
  const message = String(error?.message || error || '').toLowerCase();
  return (
    code === 'unavailable' ||
    message.includes('client is offline') ||
    message.includes('could not reach cloud firestore backend')
  );
}

export function getUpgradeDatabaseUrl(): string {
  const projectId = firebaseConfig.projectId;
  const dbId = (firebaseConfig as any).firestoreDatabaseId || '(default)';
  return `https://console.firebase.google.com/project/${projectId}/firestore/databases/${dbId}/data?openUpgradeDialog=true`;
}

function notifyQuotaExceeded() {
  quotaCooldownUntil = Date.now() + QUOTA_COOLDOWN_MS;
  const usage = getUsage();
  if (typeof window !== 'undefined' && (usage.reads >= QUOTA_READS || usage.writes >= QUOTA_WRITES)) {
    window.dispatchEvent(new CustomEvent('firebase-quota-exceeded'));
  }
}

export function clearCache() {
  memoryCache.clear();
  clearPersistedCacheTs();
  quotaCooldownUntil = 0;
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

function extractFilterValue(val: any): string {
  if (val === null) return 'null';
  if (val === undefined) return '';
  if (typeof val !== 'object') return String(val);
  if ('stringValue' in val) return String(val.stringValue);
  if ('integerValue' in val) return String(val.integerValue);
  if ('doubleValue' in val) return String(val.doubleValue);
  if ('booleanValue' in val) return String(val.booleanValue);
  if ('nullValue' in val) return 'null';
  if ('referenceValue' in val) return String(val.referenceValue);
  if ('timestampValue' in val) return JSON.stringify(val.timestampValue);
  if ('arrayValue' in val && Array.isArray(val.arrayValue?.values)) {
    return `[${val.arrayValue.values.map(extractFilterValue).join('|')}]`;
  }
  if ('internalValue' in val) return extractFilterValue(val.internalValue);
  try {
    return JSON.stringify(val);
  } catch {
    return String(val);
  }
}

function extractFilterKey(f: any): string {
  if (!f) return '';
  if (Array.isArray(f.filters)) {
    return `(${f.op || 'AND'}:${f.filters.map(extractFilterKey).join(',')})`;
  }
  const field =
    f.field?.segments?.join('.') ||
    f.field?.canonicalString?.() ||
    f.field?.toString?.() ||
    '';
  const op = f.op || '';
  const val = extractFilterValue(f.value);
  return `${field}_${op}_${val}`;
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
        const filters = q._query.filters.map(extractFilterKey).join(',');
        key += `:f:[${filters}]`;
      }
      if (q._query.explicitOrderBy && q._query.explicitOrderBy.length > 0) {
        const orders = q._query.explicitOrderBy.map((o: any) => {
          const field = o.field?.segments?.join('.') || o.field?.canonicalString?.() || o.field?.toString?.() || '';
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

function matchesCollectionKey(key: string, collectionName: string): boolean {
  return (
    key.startsWith(`query:${collectionName}`) ||
    key.startsWith(`doc:${collectionName}`) ||
    key.includes(`/${collectionName}`) ||
    key.includes(`:${collectionName}`)
  );
}

function invalidateCacheForPath(ref: any) {
  const path = getQueryCollectionPath(ref);
  if (!path) {
    clearCache();
    return;
  }

  const segments = path.split('/');
  const collectionName = segments[0];

  for (const key of Array.from(memoryCache.keys())) {
    if (matchesCollectionKey(key, collectionName)) {
      memoryCache.delete(key);
    }
  }

  const tsMap = loadPersistedCacheTs();
  let modified = false;
  for (const key of Object.keys(tsMap)) {
    if (matchesCollectionKey(key, collectionName)) {
      delete tsMap[key];
      modified = true;
    }
  }
  if (modified) {
    savePersistedCacheTs(tsMap);
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
    if (now - entry.timestamp < CACHE_TTL || now < quotaCooldownUntil) {
      return entry.data;
    }
  }

  // Check persistent IndexedDB cache first if fresh timestamp exists (survives page refresh with 0 reads)
  const persisted = getPersistedCacheEntry(key);
  if (persisted && (now - persisted.ts < CACHE_TTL || now < quotaCooldownUntil)) {
    try {
      const cachedSnap = await getDocFromCache(reference);
      if (cachedSnap.exists() || persisted.hasDocs === false) {
        if (key) {
          memoryCache.set(key, { data: cachedSnap, timestamp: persisted.ts });
        }
        return cachedSnap;
      }
    } catch {
      // Cache miss in IndexedDB, proceed to server
    }
  }

  if (now < quotaCooldownUntil) {
    try {
      return await getDocFromCache(reference);
    } catch {
      return {
        id: reference.id,
        ref: reference,
        exists: () => false,
        data: () => undefined,
        get: () => undefined,
        metadata: { hasPendingWrites: false, fromCache: true, isEqual: () => false }
      } as any;
    }
  }

  try {
    const snap = await firestore.getDoc(reference);
    trackRead(1);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('firebase-quota-recovered'));
    }
    if (key) {
      memoryCache.set(key, { data: snap, timestamp: now });
      setPersistedCacheEntry(key, now, snap.exists());
    }
    return snap;
  } catch (error: any) {
    console.warn(`Firestore getDoc failed for ${reference.path}:`, error?.message || error);

    if (key && memoryCache.has(key)) {
      return memoryCache.get(key)!.data;
    }

    try {
      const cachedSnap = await getDocFromCache(reference);
      return cachedSnap;
    } catch {
      // IndexedDB cache miss
    }

    if (isQuotaError(error)) {
      console.warn('Gracefully handling quota exceeded for getDoc by returning empty snapshot.');
      notifyQuotaExceeded();
      return {
        id: reference.id,
        ref: reference,
        exists: () => false,
        data: () => undefined,
        get: () => undefined,
        metadata: { hasPendingWrites: false, fromCache: true, isEqual: () => false }
      } as any;
    }

    if (isUnavailableError(error)) {
      return {
        id: reference.id,
        ref: reference,
        exists: () => false,
        data: () => undefined,
        get: () => undefined,
        metadata: { hasPendingWrites: false, fromCache: true, isEqual: () => false }
      } as any;
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
    if (now - entry.timestamp < CACHE_TTL || now < quotaCooldownUntil) {
      return entry.data;
    }
  }

  // Check persistent IndexedDB cache first if fresh timestamp exists (survives page refresh with 0 reads)
  const persisted = getPersistedCacheEntry(key);
  if (persisted && (now - persisted.ts < CACHE_TTL || now < quotaCooldownUntil)) {
    try {
      const cachedRes = await getDocsFromCache(query);
      if (cachedRes.size > 0 || persisted.hasDocs === false) {
        if (key) {
          memoryCache.set(key, { data: cachedRes, timestamp: persisted.ts });
        }
        return cachedRes;
      }
    } catch {
      // Cache miss in IndexedDB, proceed to server
    }
  }

  if (now < quotaCooldownUntil) {
    try {
      return await getDocsFromCache(query);
    } catch {
      return {
        docs: [],
        size: 0,
        empty: true,
        query: query,
        forEach: () => {},
        docChanges: () => [],
        metadata: { hasPendingWrites: false, fromCache: true, isEqual: () => false }
      } as any;
    }
  }

  try {
    const res = await firestore.getDocs(query);
    const count = Math.max(1, res.size);
    trackRead(count);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('firebase-quota-recovered'));
    }
    if (key) {
      memoryCache.set(key, { data: res, timestamp: now });
      setPersistedCacheEntry(key, now, res.size > 0);
    }
    return res;
  } catch (error: any) {
    console.warn(`Firestore getDocs failed:`, error?.message || error);

    if (key && memoryCache.has(key)) {
      return memoryCache.get(key)!.data;
    }

    try {
      const cachedRes = await getDocsFromCache(query);
      return cachedRes;
    } catch {
      // IndexedDB cache miss
    }

    if (isQuotaError(error)) {
      console.warn('Gracefully handling quota exceeded for getDocs by returning empty snapshot.');
      notifyQuotaExceeded();
      return {
        docs: [],
        size: 0,
        empty: true,
        query: query,
        forEach: () => {},
        docChanges: () => [],
        metadata: { hasPendingWrites: false, fromCache: true, isEqual: () => false }
      } as any;
    }

    if (isUnavailableError(error)) {
      return {
        docs: [],
        size: 0,
        empty: true,
        query: query,
        forEach: () => {},
        docChanges: () => [],
        metadata: { hasPendingWrites: false, fromCache: true, isEqual: () => false }
      } as any;
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

  try {
    if (options) {
      return await firestore.setDoc(reference, data, options);
    } else {
      return await firestore.setDoc(reference, data as any);
    }
  } catch (error) {
    if (isQuotaError(error)) notifyQuotaExceeded();
    throw error;
  }
};

export const addDoc = async <AppModelType, DbModelType extends firestore.DocumentData = firestore.DocumentData>(
  reference: firestore.CollectionReference<AppModelType, DbModelType>,
  data: firestore.WithFieldValue<AppModelType>
): Promise<firestore.DocumentReference<AppModelType, DbModelType>> => {
  trackWrite(1);
  invalidateCacheForPath(reference);
  try {
    return await firestore.addDoc(reference, data);
  } catch (error) {
    if (isQuotaError(error)) notifyQuotaExceeded();
    throw error;
  }
};

export const updateDoc = async (
  reference: any,
  ...args: any[]
): Promise<void> => {
  trackWrite(1);
  invalidateCacheForPath(reference);
  try {
    return await (firestore.updateDoc as any)(reference, ...args);
  } catch (error) {
    if (isQuotaError(error)) notifyQuotaExceeded();
    throw error;
  }
};

export const deleteDoc = async (
  reference: any
): Promise<void> => {
  trackWrite(1);
  invalidateCacheForPath(reference);
  try {
    return await firestore.deleteDoc(reference);
  } catch (error) {
    if (isQuotaError(error)) notifyQuotaExceeded();
    throw error;
  }
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
