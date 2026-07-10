// Thin IndexedDB wrapper
// Object stores:
//   'projects'      — project metadata + layer refs (no blob data)
//   'blobs'         — image blobs keyed by layer ID, stored separately for fast project loads
//   'hashtagGroups' — GLOBAL (not per-project) reusable hashtag sets (issue #71).
//                     Each record is { id, name, tags } and is read/written through
//                     the generic dbGet/dbPut/dbDelete/dbGetAll helpers below — no
//                     dedicated wrappers needed since a group is just a small record.

let dbPromise = null

function openDB() {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open('layout-app', 3)
    req.onupgradeneeded = e => {
      const db = e.target.result
      if (!db.objectStoreNames.contains('projects')) {
        db.createObjectStore('projects', { keyPath: 'id' })
      }
      // Version 2: dedicated blob store so project records stay small
      if (!db.objectStoreNames.contains('blobs')) {
        db.createObjectStore('blobs', { keyPath: 'id' })
      }
      // Version 3: global hashtag groups (issue #71). Guarded by contains() like
      // the others, so upgrading from either v1 or v2 creates it exactly once.
      if (!db.objectStoreNames.contains('hashtagGroups')) {
        db.createObjectStore('hashtagGroups', { keyPath: 'id' })
      }
    }
    req.onsuccess = e => resolve(e.target.result)
    req.onerror = e => reject(e.target.error)
  })
  return dbPromise
}

export async function dbGet(store, key) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readonly')
    const req = tx.objectStore(store).get(key)
    req.onsuccess = e => resolve(e.target.result)
    req.onerror = e => reject(e.target.error)
  })
}

export async function dbPut(store, value) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite')
    const req = tx.objectStore(store).put(value)
    req.onsuccess = e => resolve(e.target.result)
    req.onerror = e => reject(e.target.error)
  })
}

export async function dbDelete(store, key) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite')
    const req = tx.objectStore(store).delete(key)
    req.onsuccess = e => resolve(e.target.result)
    req.onerror = e => reject(e.target.error)
  })
}

export async function dbGetAll(store) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readonly')
    const req = tx.objectStore(store).getAll()
    req.onsuccess = e => resolve(e.target.result)
    req.onerror = e => reject(e.target.error)
  })
}

// ─── Blob-specific helpers ─────────────────────────────────────────────────────

// Store image data as base64 data URL strings — works reliably on all platforms
// including iOS Safari, which has known bugs with Blob and ArrayBuffer in IDB.
// A data URL is just a string; IDB stores strings perfectly everywhere.

export async function dbGetBlob(id) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('blobs', 'readonly')
    const req = tx.objectStore('blobs').get(id)
    req.onsuccess = e => resolve(e.target.result?.data ?? null)  // returns data URL string or null
    req.onerror = e => reject(e.target.error)
  })
}

export async function dbPutBlob(id, dataURL) {
  // dataURL is a base64 data: string
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('blobs', 'readwrite')
    const req = tx.objectStore('blobs').put({ id, data: dataURL })
    req.onsuccess = () => resolve()
    req.onerror = e => reject(e.target.error)
  })
}

export async function dbDeleteBlob(id) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('blobs', 'readwrite')
    const req = tx.objectStore('blobs').delete(id)
    req.onsuccess = e => resolve()
    req.onerror = e => reject(e.target.error)
  })
}
