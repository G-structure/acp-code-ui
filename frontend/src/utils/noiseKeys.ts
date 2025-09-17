export type StoredKeyRef = {
  pubKeyJwk: JsonWebKey;
  privateRef: CryptoKey; // non-extractable
};

const DB_NAME = 'rat2e';
const STORE = 'crypto';
const KEY_ID = 'browser_static_noise_key';

async function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbGet<T>(key: string): Promise<T | undefined> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const store = tx.objectStore(STORE);
    const req = store.get(key);
    req.onsuccess = () => resolve(req.result as T | undefined);
    req.onerror = () => reject(req.error);
  });
}

async function idbPut<T>(key: string, value: T): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    const req = store.put(value, key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function getOrCreateBrowserStaticKey(): Promise<StoredKeyRef> {
  const existing = await idbGet<StoredKeyRef>(KEY_ID);
  if (existing) return existing;

  let keyPair: CryptoKeyPair;
  try {
    keyPair = await crypto.subtle.generateKey(
      { name: 'X25519' } as any,
      false,
      ['deriveKey', 'deriveBits']
    );
  } catch (_) {
    keyPair = await crypto.subtle.generateKey(
      { name: 'ECDH', namedCurve: 'X25519' } as any,
      false,
      ['deriveKey', 'deriveBits']
    );
  }

  const pubKeyJwk = await crypto.subtle.exportKey('jwk', keyPair.publicKey);
  const ref: StoredKeyRef = { pubKeyJwk, privateRef: keyPair.privateKey };
  await idbPut(KEY_ID, ref);
  return ref;
}

export async function deleteBrowserStaticKey(): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    const req = store.delete(KEY_ID);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function importNoisePeerPubKey(jwk: JsonWebKey): Promise<CryptoKey> {
  try {
    return await crypto.subtle.importKey('jwk', jwk, { name: 'X25519' } as any, true, []);
  } catch (_) {
    return await crypto.subtle.importKey('jwk', jwk, { name: 'ECDH', namedCurve: 'X25519' } as any, true, []);
  }
}

