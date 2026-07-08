// In-memory map of blob URL → Blob object.
// Populated when images are processed so serializeLayers can convert the Blob
// to a data URL without re-fetching the blob URL — fetch(blob:) can fail on
// iOS Safari PWA when a service worker is active.
export const blobCache = new Map()

// In-memory cache: blobId → data URL string.
// Populated the first time each `blob-ref://` image is read from IDB so
// subsequent renders (including after iOS backgrounding) don't hit IDB again.
// Lives here (not in Canvas.jsx) so the store can clear it on project switch.
export const dataURLCache = new Map()

// Clear both session image caches on a project switch (goHome / openProject /
// startProject). Neither cache evicts on its own, so across a session of opening
// several image-heavy projects they accumulate multi-MB entries that outlive the
// project that created them.
//
// Every blobCache key is a blob: URL (a downscaled preview URL, or a raw original
// kept alive as srcOriginal for export); revoking them lets the browser release
// the backing Blob. This is the "revoke all session blob: URLs on project switch"
// scope from issue #16 (c): per-layer revocation on replace/delete is unsafe
// because imageSrcRegistry retains a replaced/deleted image's blob: URL so undo
// can restore it — revoking eagerly would break undo. At a project switch the
// registry AND undo history are cleared together, so the URLs are truly dead.
//
// Safe to revoke here because saveProject has already serialized any in-session
// blob: src to an inline data: URL in IDB before this runs (the Back button
// awaits the save before goHome; the editor is unmounted on the home screen, so
// nothing still renders the previous project's layers).
export function clearImageCaches() {
  for (const key of blobCache.keys()) {
    if (typeof key === 'string' && key.startsWith('blob:')) {
      try { URL.revokeObjectURL(key) } catch { /* already revoked */ }
    }
  }
  blobCache.clear()
  dataURLCache.clear()
}
