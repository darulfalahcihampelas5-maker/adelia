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
  console.log("Firestore initialized successfully with persistent offline local cache.");
} catch (e) {
  console.warn("Failed to initialize Firestore with persistent cache, falling back to standard getFirestore:", e);
  dbInstance = firestore.getFirestore(app, (firebaseConfig as any).firestoreDatabaseId);
}

export const db = dbInstance;
export const auth = getAuth();

// --- TRACKER LOGIC ---
interface UsageData {
  date: string;
  reads: number;
  writes: number;
}

export const QUOTA_READS = 50000;
export const QUOTA_WRITES = 20000;

function getTodayString(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getUsage(): UsageData {
  const today = getTodayString();
  const stored = localStorage.getItem('firebase_usage_stats');
  if (stored) {
    try {
      const data: UsageData = JSON.parse(stored);
      if (data.date === today) {
        return data;
      } else {
        // Clear the client-side cache when the day changes
        clearCache();
      }
    } catch (e) {
      console.error(e);
    }
  }
  
  const newData: UsageData = {
    date: today,
    reads: 0,
    writes: 0
  };
  localStorage.setItem('firebase_usage_stats', JSON.stringify(newData));
  return newData;
}

export function trackRead(count: number = 1) {
  const usage = getUsage();
  usage.reads += count;
  localStorage.setItem('firebase_usage_stats', JSON.stringify(usage));
  window.dispatchEvent(new CustomEvent('firebase-usage-updated', { detail: usage }));
}

export function trackWrite(count: number = 1) {
  const usage = getUsage();
  usage.writes += count;
  localStorage.setItem('firebase_usage_stats', JSON.stringify(usage));
  window.dispatchEvent(new CustomEvent('firebase-usage-updated', { detail: usage }));
}

// --- CLIENT-SIDE SMART CACHING ---
interface CacheEntry {
  data: any;
  timestamp: number;
}

const cache = new Map<string, CacheEntry>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes in milliseconds

export function clearCache() {
  cache.clear();
  console.log('Firebase Firestore client-side cache cleared successfully.');
}

function getQueryCollectionPath(q: any): string {
  if (!q) return '';
  if (typeof q.path === 'string') {
    return q.path;
  }
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

function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const chr = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + chr;
    hash |= 0;
  }
  return hash;
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
      if (q._query.filters) {
        const filters = q._query.filters.map((f: any) => {
          const field = f.field?.segments?.join('.') || f.field?.toString() || '';
          const op = f.op || '';
          let val = '';
          if (f.value !== undefined && f.value !== null) {
            if (typeof f.value === 'object') {
              val = f.value.stringValue || f.value.integerValue || f.value.booleanValue || f.value.doubleValue || JSON.stringify(f.value);
            } else {
              val = String(f.value);
            }
          }
          return `${field}_${op}_${val}`;
        }).join(',');
        key += `:filters:[${filters}]`;
      }
      if (q._query.explicitOrderBy) {
        const orders = q._query.explicitOrderBy.map((o: any) => {
          const field = o.field?.segments?.join('.') || o.field?.toString() || '';
          const dir = o.dir || 'asc';
          return `${field}_${dir}`;
        }).join(',');
        key += `:orders:[${orders}]`;
      }
      if (q._query.limit) {
        key += `:limit:${q._query.limit}`;
      }
    } catch (e) {
      try {
        const seen = new Set();
        const serializedQuery = JSON.stringify(q._query, (k, v) => {
          if (typeof v === 'object' && v !== null) {
            if (seen.has(v)) return '[Circular]';
            seen.add(v);
          }
          if (k === 'firestore' || k === 'database' || k === 'app' || k === 'client') return undefined;
          return v;
        });
        key += `:fallback-hash:${serializedQuery.length}:${hashCode(serializedQuery)}`;
      } catch (err) {
        key += `:fallback-rand:${Math.random()}`;
      }
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
  const collectionName = segments[0]; // e.g. 'siswa', 'kelas', etc.
  
  for (const key of cache.keys()) {
    if (
      key.startsWith(`query:${collectionName}`) || 
      key.startsWith(`doc:${collectionName}`) ||
      key.includes(`/${collectionName}`) ||
      key.includes(`:${collectionName}`)
    ) {
      cache.delete(key);
    }
  }

  try {
    localStorage.removeItem(`firebase_backup:query:${collectionName}`);
  } catch (err) {
    console.warn("Failed to remove query backup from localStorage:", err);
  }
}

// --- OFFLINE MOCK SNAPSHOTS ---

export class MockDocumentSnapshot {
  public id: string;
  private _data: any;
  public metadata = { fromCache: true, hasPendingWrites: false };

  constructor(id: string, data: any) {
    this.id = id;
    this._data = data;
  }

  public exists(): boolean {
    return this._data !== null && this._data !== undefined;
  }

  public data() {
    return this._data;
  }

  public get(fieldPath: string) {
    return this._data ? this._data[fieldPath] : undefined;
  }
}

export class MockQueryDocumentSnapshot {
  public id: string;
  private _data: any;
  public metadata = { fromCache: true, hasPendingWrites: false };

  constructor(id: string, data: any) {
    this.id = id;
    this._data = data;
  }

  public exists(): boolean {
    return true;
  }

  public data() {
    return this._data;
  }

  public get(fieldPath: string) {
    return this._data ? this._data[fieldPath] : undefined;
  }
}

export class MockQuerySnapshot {
  public docs: MockQueryDocumentSnapshot[];
  public size: number;
  public empty: boolean;
  public metadata = { fromCache: true, hasPendingWrites: false };

  constructor(docsData: { id: string, data: any }[] = []) {
    this.docs = docsData.map(d => new MockQueryDocumentSnapshot(d.id, d.data));
    this.size = this.docs.length;
    this.empty = this.size === 0;
  }

  public forEach(callback: (doc: MockQueryDocumentSnapshot, index: number) => void) {
    this.docs.forEach(callback);
  }
}

// --- WRAPPED FIRESTORE FUNCTIONS ---

export const getDoc = async <AppModelType, DbModelType extends firestore.DocumentData = firestore.DocumentData>(
  reference: firestore.DocumentReference<AppModelType, DbModelType>
): Promise<firestore.DocumentSnapshot<AppModelType, DbModelType>> => {
  const key = generateCacheKey(reference);
  const now = Date.now();
  if (key && cache.has(key)) {
    const entry = cache.get(key)!;
    if (now - entry.timestamp < CACHE_TTL) {
      return entry.data;
    }
  }

  try {
    const snap = await firestore.getDoc(reference);
    trackRead(1);
    if (key) {
      cache.set(key, { data: snap, timestamp: now });
      if (snap.exists()) {
        try {
          localStorage.setItem(`firebase_backup:doc:${reference.path}`, JSON.stringify({
            id: snap.id,
            data: snap.data()
          }));
        } catch (err) {
          console.warn("Failed to write document backup to localStorage:", err);
        }
      }
    }
    return snap;
  } catch (error) {
    console.warn(`Firestore getDoc failed (offline/network). Returning local backup/cache for ${reference.path}:`, error);
    
    // 1. Try our memory cache first (even if expired)
    if (key && cache.has(key)) {
      return cache.get(key)!.data;
    }
    
    // 2. Try localStorage backup
    try {
      const stored = localStorage.getItem(`firebase_backup:doc:${reference.path}`);
      if (stored) {
        const parsed = JSON.parse(stored);
        const mockSnap = new MockDocumentSnapshot(parsed.id, parsed.data);
        return mockSnap as any;
      }
    } catch (err) {
      console.error("Failed to read document backup from localStorage:", err);
    }
    
    // 3. Fallback to an empty mock snapshot
    return new MockDocumentSnapshot(reference.id, null) as any;
  }
};

export const getDocs = async <AppModelType, DbModelType extends firestore.DocumentData = firestore.DocumentData>(
  query: firestore.Query<AppModelType, DbModelType>
): Promise<firestore.QuerySnapshot<AppModelType, DbModelType>> => {
  const key = generateCacheKey(query);
  const now = Date.now();
  if (key && cache.has(key)) {
    const entry = cache.get(key)!;
    if (now - entry.timestamp < CACHE_TTL) {
      return entry.data;
    }
  }

  try {
    const res = await firestore.getDocs(query);
    const count = Math.max(1, res.size);
    trackRead(count);
    if (key) {
      cache.set(key, { data: res, timestamp: now });
      const colPath = getQueryCollectionPath(query);
      if (colPath) {
        try {
          const docsData = res.docs.map(doc => ({ id: doc.id, data: doc.data() }));
          localStorage.setItem(`firebase_backup:query:${colPath}`, JSON.stringify(docsData));
        } catch (err) {
          console.warn("Failed to write query backup to localStorage:", err);
        }
      }
    }
    return res;
  } catch (error) {
    const colPath = getQueryCollectionPath(query);
    console.warn(`Firestore getDocs failed (offline/network). Returning local backup/cache for ${colPath}:`, error);
    
    // 1. Try memory cache (even if expired)
    if (key && cache.has(key)) {
      return cache.get(key)!.data;
    }
    
    // 2. Try localStorage backup
    if (colPath) {
      try {
        const stored = localStorage.getItem(`firebase_backup:query:${colPath}`);
        if (stored) {
          const parsed = JSON.parse(stored);
          return new MockQuerySnapshot(parsed) as any;
        }
      } catch (err) {
        console.error("Failed to read query backup from localStorage:", err);
      }
    }
    
    // 3. Fallback to empty mock query snapshot
    return new MockQuerySnapshot([]) as any;
  }
};

export const setDoc = async <AppModelType, DbModelType extends firestore.DocumentData = firestore.DocumentData>(
  reference: firestore.DocumentReference<AppModelType, DbModelType>,
  data: firestore.WithFieldValue<AppModelType>,
  options?: firestore.SetOptions
): Promise<void> => {
  trackWrite(1);
  invalidateCacheForPath(reference);
  
  // Optimistically backup locally
  try {
    localStorage.setItem(`firebase_backup:doc:${reference.path}`, JSON.stringify({
      id: reference.id,
      data: data
    }));
  } catch (err) {
    console.warn(err);
  }

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
  
  const result = await firestore.addDoc(reference, data);
  try {
    localStorage.setItem(`firebase_backup:doc:${result.path}`, JSON.stringify({
      id: result.id,
      data: data
    }));
  } catch (err) {
    console.warn(err);
  }
  return result;
};

export const updateDoc = async (
  reference: any,
  ...args: any[]
): Promise<void> => {
  trackWrite(1);
  invalidateCacheForPath(reference);
  
  // Extract key-value changes to optimistically update localStorage doc if available
  try {
    const stored = localStorage.getItem(`firebase_backup:doc:${reference.path}`);
    if (stored) {
      const parsed = JSON.parse(stored);
      const updatedData = { ...parsed.data };
      if (args.length === 1 && typeof args[0] === 'object') {
        Object.assign(updatedData, args[0]);
      } else {
        for (let i = 0; i < args.length; i += 2) {
          if (typeof args[i] === 'string') {
            updatedData[args[i]] = args[i + 1];
          }
        }
      }
      localStorage.setItem(`firebase_backup:doc:${reference.path}`, JSON.stringify({
        id: reference.id || parsed.id,
        data: updatedData
      }));
    }
  } catch (err) {
    console.warn(err);
  }

  return await (firestore.updateDoc as any)(reference, ...args);
};

export const deleteDoc = async (
  reference: any
): Promise<void> => {
  trackWrite(1);
  invalidateCacheForPath(reference);
  
  try {
    localStorage.removeItem(`firebase_backup:doc:${reference.path}`);
  } catch (err) {
    console.warn(err);
  }
  
  return await firestore.deleteDoc(reference);
};

// Re-export other unmodified functions for compatibility
export {
  collection,
  doc,
  query,
  where,
  orderBy,
  Timestamp,
  serverTimestamp
} from 'firebase/firestore';
