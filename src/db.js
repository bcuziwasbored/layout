// Thin IndexedDB wrapper
// Object stores:
//   'projects' — project metadata + layer refs (no blob data)
//   'blobs'    — image blobs keyed by layer ID, stored separately for fast project loads

let dbPromise = null

function openDB() {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open('layout-app', 2)
    req.onupgradeneeded = e => {
      const db = e.target.result
      if (!db.objectStoreNames.contains('projects')) {
        db.createObjectStore('projects', { keyPath: 'id' })
      }
      // Version 2: dedicated blob store so project records stay small
      if (!db.objectStoreNames.contains('blobs')) {
        db.createObjectStore('blobs', { keyPath: 'id' })
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

export async function dbGetBlob(id) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('blobs', 'readonly')
    const req = tx.objectStore('blobs').get(id)
    req.onsuccess = e => resolve(e.target.result?.data ?? null)
    req.onerror = e => reject(e.target.error)
  })
}

export async function dbPutBlob(id, data) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('blobs', 'readwrite')
    const req = tx.objectStore('blobs').put({ id, data })
    req.onsuccess = e => resolve()
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
