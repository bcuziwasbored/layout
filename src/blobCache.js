// In-memory map of blob URL → Blob object.
// Populated when images are processed so serializeLayers can convert the Blob
// to a data URL without re-fetching the blob URL — fetch(blob:) can fail on
// iOS Safari PWA when a service worker is active.
export const blobCache = new Map()
