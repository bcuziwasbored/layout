import { dbGet, dbPut, dbDelete, dbGetAll, dbGetBlob, dbPutBlob, dbDeleteBlob } from './db'
import { blobCache } from './blobCache'
import { renderSlide } from './renderSlide'
import { migrateLayers } from './ratioMigrate'
import { requestPersistentStorage } from './storageHealth'
import { zipSync, unzipSync, strToU8, strFromU8 } from 'fflate'

const THUMB_W = 240

// Full-resolution originals are persisted in the 'blobs' IDB store (as data-URL
// strings, per the iOS-Safari reliability note in db.js), keyed per project+layer.
// The preview `src` stays inline in the project record for fast loads; the layer's
// `srcOriginal` is rewritten to a `blob-ref://` pointer at this key so exports can
// lazily fetch the original after a reload.
const ORIG_REF_PREFIX = 'blob-ref://'
// Cap stored originals at 4096px on the long edge (re-encode JPEG q0.92 when
// larger) to respect iOS storage quotas.
const MAX_ORIGINAL_DIM = 4096

const originalKey = (projectId, layerId) => `orig:${projectId}:${layerId}`

// Collect the IDB blob keys a set of persisted layers references as originals.
function collectOriginalKeys(layers) {
  const keys = new Set()
  for (const l of layers ?? []) {
    if (typeof l?.srcOriginal === 'string' && l.srcOriginal.startsWith(ORIG_REF_PREFIX)) {
      keys.add(l.srcOriginal.slice(ORIG_REF_PREFIX.length))
    }
  }
  return keys
}

// A previously-persisted original ref survives a load→save round-trip unchanged;
// anything else (in-session blob:/data: URL, or absent) is not a stored ref.
function persistedOriginalRef(layer) {
  const so = layer?.srcOriginal
  return (typeof so === 'string' && so.startsWith(ORIG_REF_PREFIX)) ? so : undefined
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function blobToDataURL(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload  = () => resolve(reader.result)
    reader.onerror = () => reject(new Error('FileReader error'))
    reader.readAsDataURL(blob)
  })
}

// Get a Blob from a blob: URL — from blobCache first (avoids fetch on iOS PWA),
// then fetch as fallback, then img+canvas re-export as last resort.
async function blobFromURL(url) {
  const cached = blobCache.get(url)
  if (cached) return cached
  try {
    return await fetch(url).then(r => r.blob())
  } catch {
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => {
        const c = document.createElement('canvas')
        c.width = img.naturalWidth; c.height = img.naturalHeight
        c.getContext('2d').drawImage(img, 0, 0)
        c.toBlob(b => b ? resolve(b) : reject(new Error('toBlob')), 'image/jpeg', 0.92)
      }
      img.onerror = () => reject(new Error('img load failed'))
      img.src = url
    })
  }
}

// ─── Serialization ─────────────────────────────────────────────────────────────
// Convert blob: URLs to data URL strings stored inline in layer.src.
// Data URL strings work reliably in IDB on every platform including iOS.
// The full-res `srcOriginal` is persisted separately in the 'blobs' store and the
// layer keeps only a lightweight `blob-ref://` pointer, so exports still have the
// original after a reload while the project record stays small.

function loadImageEl(src) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('image load failed'))
    img.src = src
  })
}

// Alpha-capable source blob types — re-encode these as PNG on the cap path so a
// transparent original keeps its alpha (issue #67). Photos stay JPEG for size.
const ALPHA_BLOB_TYPES = new Set(['image/png', 'image/webp', 'image/svg+xml', 'image/gif'])

// Data URL for a full-resolution original, capped at MAX_ORIGINAL_DIM on the long
// edge (re-encoded when larger — PNG for alpha sources, else JPEG q0.92).
async function prepareOriginalDataURL(srcUrl) {
  const blob = await blobFromURL(srcUrl)
  const isAlpha = ALPHA_BLOB_TYPES.has(blob.type)
  const dataURL = await blobToDataURL(blob)
  const img = await loadImageEl(dataURL)
  const long = Math.max(img.naturalWidth, img.naturalHeight)
  if (long <= MAX_ORIGINAL_DIM) return dataURL
  const scale = MAX_ORIGINAL_DIM / long
  const w = Math.round(img.naturalWidth * scale)
  const h = Math.round(img.naturalHeight * scale)
  const canvas = document.createElement('canvas')
  canvas.width = w; canvas.height = h
  const ctx = canvas.getContext('2d')
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(img, 0, 0, w, h)
  return isAlpha ? canvas.toDataURL('image/png') : canvas.toDataURL('image/jpeg', 0.92)
}

async function serializeLayers(layers, projectId, prevLayers) {
  // Index the previous save's layers by id so an unchanged image can reuse the
  // data URL we already encoded instead of re-fetching + re-encoding its blob on
  // every 2s autosave. Match is gated on imgId (a stable per-image content id
  // minted fresh on every import/replace), so a reused string is guaranteed to be
  // the same image. See #16 (e).
  const prevById = new Map((prevLayers ?? []).map(l => [l.id, l]))
  return Promise.all(
    layers.map(async (layer) => {
      // Resolve what the persisted `srcOriginal` should be.
      let srcOriginalRef = persistedOriginalRef(layer)
      if (!srcOriginalRef) {
        const so = layer.srcOriginal
        // A distinct in-session full-res original (large imports keep the raw
        // blob: URL here; small imports reuse `src`, so there's nothing to store).
        const hasDistinctOriginal =
          typeof so === 'string' && so !== layer.src &&
          (so.startsWith('blob:') || so.startsWith('data:'))
        if (hasDistinctOriginal) {
          try {
            const key = originalKey(projectId, layer.id)
            await dbPutBlob(key, await prepareOriginalDataURL(so))
            srcOriginalRef = ORIG_REF_PREFIX + key
          } catch (e) {
            console.warn('Failed to persist original for layer', layer.id, e)
            srcOriginalRef = undefined  // export falls back to preview src
          }
        }
      }

      if (layer.src?.startsWith('blob:')) {
        // Unchanged image (same imgId) already serialized last save → reuse it.
        const prev = prevById.get(layer.id)
        if (layer.imgId && prev?.imgId === layer.imgId &&
            typeof prev.src === 'string' && prev.src.startsWith('data:')) {
          return { ...layer, src: prev.src, srcOriginal: srcOriginalRef }
        }
        try {
          const blob = await blobFromURL(layer.src)
          const dataURL = await blobToDataURL(blob)
          return { ...layer, src: dataURL, srcOriginal: srcOriginalRef }
        } catch (e) {
          console.warn('Failed to serialize layer', layer.id, e)
          return { ...layer, srcOriginal: srcOriginalRef }
        }
      }
      // Already a data URL or null — keep as-is
      return { ...layer, srcOriginal: srcOriginalRef }
    })
  )
}

// ─── Thumbnail ─────────────────────────────────────────────────────────────────

// Render the project's first slide to a thumbnail data URL. Delegates to the
// canonical slide renderer so thumbnails include everything the editor shows —
// text, shapes, gradient backgrounds, crop shapes, rotation and flips — instead
// of the old image-only pass that left text/gradient projects looking blank.
// Uses the lightweight preview `src` (preferOriginal:false); full-res originals
// aren't worth fetching at thumbnail scale.
async function renderThumbnail(layers, slides, ratio, bgColor, bgGradient) {
  return renderSlide(0, {
    slides, layers, ratio, bgColor, bgGradient,
    scale: THUMB_W / ratio.w,
    quality: 0.75,
    preferOriginal: false,
  })
}

// Cheap signature of everything renderThumbnail draws for slide 0. The thumbnail
// delegates to renderSlide, which draws EVERY layer type (images, text, shapes)
// plus backgrounds and gradients — so the fingerprint must cover all of a
// slide-0 layer's visual props, not just image geometry. We stringify each
// overlapping layer minus its bulky src/srcOriginal strings, using imgId (small,
// stable, re-minted on every import/replace) as the per-image content identity.
// When the fingerprint is unchanged from the last save we reuse the stored
// thumbnail instead of decoding every image and re-rendering. See #16 (e).
function thumbFingerprint(layers, slides, ratio, bgColor, bgGradient) {
  const sliceEnd = ratio.w
  const slide0 = slides[0] ?? {}
  const parts = [
    `${ratio.w}x${ratio.h}`,
    `bg:${slide0.bgColor ?? bgColor}`,
    `grad:${JSON.stringify(slide0.bgGradient ?? bgGradient ?? null)}`,
  ]
  for (const l of layers) {
    if (!(l.x < sliceEnd && l.x + l.w > 0)) continue
    const rest = { ...l }
    delete rest.src
    delete rest.srcOriginal
    if (l.src) rest._img = l.imgId ?? `s${l.src.length}:${l.src.slice(0, 24)}`
    parts.push(JSON.stringify(rest))
  }
  return parts.join('|')
}

// ─── Public API ────────────────────────────────────────────────────────────────

export async function saveProject(id, name, storeState) {
  const { ratio, bgColor, bgGradient, slides, layers, caption } = storeState
  const prev = await dbGet('projects', id)
  const serialized = await serializeLayers(layers, id, prev?.state?.layers)

  // Garbage-collect originals no longer referenced by this project (layer deleted,
  // or its image replaced by one without a distinct original). Keys are scoped by
  // project id, so this never touches another project's stored originals.
  const newKeys = collectOriginalKeys(serialized)
  for (const key of collectOriginalKeys(prev?.state?.layers)) {
    if (!newKeys.has(key)) {
      try { await dbDeleteBlob(key) } catch (e) { console.warn('original GC failed', key, e) }
    }
  }

  // Skip the (image-decoding, main-thread) thumbnail re-render when slide 0's
  // content hasn't changed since the last save — common, since autosave also
  // fires for renames and edits on other slides.
  const fingerprint = thumbFingerprint(serialized, slides, ratio, bgColor, bgGradient)
  const thumbnail = (prev?.thumbFingerprint === fingerprint && prev.thumbnail)
    ? prev.thumbnail
    : await renderThumbnail(serialized, slides, ratio, bgColor, bgGradient)
  await dbPut('projects', {
    id, name, updatedAt: Date.now(), thumbnail, thumbFingerprint: fingerprint,
    slideCount: slides.length,
    // `caption` (issue #71) is plain metadata persisted alongside the project;
    // `?? ''` keeps records written before this field consistent.
    state: { ratio, bgColor, bgGradient, slides, layers: serialized, caption: caption ?? '' },
  })

  // First successful save of the session → ask for durable storage (#84). Placed
  // here, after the write lands, because browsers grant persistence far more
  // readily once the origin shows real engagement — and never on app load.
  // requestPersistentStorage self-guards, so later saves are a cached no-op, and
  // it never rejects, so a browser without the Storage API changes nothing.
  requestPersistentStorage()
}

export async function loadProject(id) {
  const record = await dbGet('projects', id)
  if (!record) return null

  const layers = await Promise.all(
    record.state.layers.map(async (layer) => {
      // Preserve any persisted full-res original pointer so exports can lazily
      // fetch it from the blobs store; renderSlide resolves it at render time.
      const srcOriginal = persistedOriginalRef(layer)

      // Current format: data URL inline — use directly
      if (layer.src?.startsWith('data:')) return { ...layer, srcOriginal }

      // Legacy format: ref:// with inline Blob (iOS may have corrupted these)
      if (layer.src?.startsWith('ref://')) {
        const blob = record.blobs?.[layer.src.slice(6)]
        if (blob && blob.size > 0) {
          try {
            return { ...layer, src: await blobToDataURL(blob), srcOriginal }
          } catch {}
        }
        return { ...layer, src: null, srcOriginal }
      }

      // blob-ref:// from intermediate version — keep as-is, useBlobSrc will resolve
      // (only matters if user has projects saved with the blob store approach)
      return { ...layer, srcOriginal }
    })
  )

  return { ...record.state, layers, projectId: record.id, projectName: record.name }
}

export async function listProjects() {
  const all = await dbGetAll('projects')
  return all
    .map(projectSummary)
    .sort((a, b) => b.updatedAt - a.updatedAt)
}

// The lightweight shape the home screen list works with.
function projectSummary(r) {
  return {
    id: r.id, name: r.name, updatedAt: r.updatedAt,
    thumbnail: r.thumbnail,
    slideCount: r.slideCount ?? r.state?.slides?.length ?? 0,
    ratio: r.state?.ratio,
  }
}

// Rename a project in place. The name is the only thing that changes — the
// thumbnail, layers and updatedAt are left untouched so the card keeps its
// position in the Recent list.
export async function renameProject(id, name) {
  const record = await dbGet('projects', id)
  if (!record) return null
  const updated = { ...record, name }
  await dbPut('projects', updated)
  return projectSummary(updated)
}

// Deep-copy a project under a fresh id. Persisted originals (PR #30) are stored
// in the 'blobs' store under keys scoped to the OLD project id
// (`orig:<oldId>:<layerId>`), so a naive copy of the record would leave the
// duplicate's layers pointing at the original's blobs — a later GC or delete of
// the original would then strip the copy's originals too. We instead copy each
// referenced blob to a key scoped to the NEW project id and rewrite the layer's
// `blob-ref://` pointer, so the duplicate owns an independent set of originals.
export async function duplicateProject(id) {
  const record = await dbGet('projects', id)
  if (!record) return null

  const newId = Math.random().toString(36).slice(2)

  const layers = await Promise.all(
    (record.state?.layers ?? []).map(async (layer) => {
      const ref = persistedOriginalRef(layer)
      if (!ref) return { ...layer }
      const oldKey = ref.slice(ORIG_REF_PREFIX.length)
      const newKey = originalKey(newId, layer.id)
      try {
        const data = await dbGetBlob(oldKey)
        if (data) {
          await dbPutBlob(newKey, data)
          return { ...layer, srcOriginal: ORIG_REF_PREFIX + newKey }
        }
      } catch (e) {
        console.warn('Failed to copy original for duplicated layer', layer.id, e)
      }
      // Original missing/unreadable — drop the ref so exports fall back to the
      // inline preview src rather than pointing at the source project's blob.
      return { ...layer, srcOriginal: undefined }
    })
  )

  const duplicate = {
    ...record,
    id: newId,
    name: `${record.name} copy`,
    updatedAt: Date.now(),
    state: { ...record.state, layers },
  }
  await dbPut('projects', duplicate)
  return projectSummary(duplicate)
}

export async function deleteProject(id) {
  const record = await dbGet('projects', id)
  for (const key of collectOriginalKeys(record?.state?.layers)) {
    try { await dbDeleteBlob(key) } catch (e) { console.warn('original cleanup failed', key, e) }
  }
  await dbDelete('projects', id)
}

// ─── Duplicate in another format (Magic-Resize lite, #68) ───────────────────────

// Duplicate a project AND retarget it to a new ratio, without opening it in the
// editor. Reuses duplicateProject (#39) for the deep copy + independent-originals
// re-keying, then runs the SAME fraction-preserving migration setRatio uses
// (ratioMigrate.migrateLayers) so the copy lays out like an in-editor ratio change.
// The source project is left untouched.
export async function duplicateProjectInFormat(id, newRatio) {
  const original = await dbGet('projects', id)
  if (!original) return null

  // duplicateProject copies referenced originals to NEW-id-scoped blob keys and
  // rewrites the pointers, so the retargeted copy owns an independent set.
  const dupSummary = await duplicateProject(id)
  if (!dupSummary) return null

  const record = await dbGet('projects', dupSummary.id)
  const oldRatio = record.state.ratio
  const { slides, bgColor, bgGradient } = record.state
  const layers = migrateLayers(record.state.layers, oldRatio, newRatio)

  // Regenerate the thumbnail at the new aspect (the copied one is the old shape).
  let thumbnail = record.thumbnail
  try {
    thumbnail = await renderThumbnail(layers, slides, newRatio, bgColor, bgGradient)
  } catch (e) {
    console.warn('format-duplicate thumbnail render failed', e)
  }
  const fingerprint = thumbFingerprint(layers, slides, newRatio, bgColor, bgGradient)

  const updated = {
    ...record,
    name: `${original.name} (${newRatio.value})`,
    updatedAt: Date.now(),
    thumbnail,
    thumbFingerprint: fingerprint,
    slideCount: slides.length,
    state: { ...record.state, ratio: newRatio, layers },
  }
  await dbPut('projects', updated)
  return projectSummary(updated)
}

// ─── Portable project files (.layout) ───────────────────────────────────────────
//
// A `.layout` file is a zip:
//   project.json            — { formatVersion, app, name, exportedAt, thumbnail,
//                               slideCount, state } where state.layers reference
//                               their images by zip path instead of embedding them.
//   images/<layerId>-src.<ext>   — the preview image bytes (raw, not base64).
//   images/<layerId>-orig.<ext>  — the full-res original bytes from the blobs store.
//
// A "back up all" archive additionally has a top-level `backup.json` manifest and
// nests each project under a `<projectId>/` folder. Images are stored as raw bytes
// (data-URL → bytes on export, reverse on import) so files stay small.

export const LAYOUT_FORMAT_VERSION = 1
const LAYOUT_APP = 'layout'

function mimeFromDataURL(url) {
  const m = /^data:([^;,]+)/.exec(url)
  return m ? m[1].split(';')[0] : 'application/octet-stream'
}

function extFromMime(mime) {
  switch (mime) {
    case 'image/png':  return 'png'
    case 'image/jpeg': return 'jpg'
    case 'image/webp': return 'webp'
    case 'image/gif':  return 'gif'
    default:           return 'bin'
  }
}

const MIME_BY_EXT = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
  webp: 'image/webp', gif: 'image/gif',
}
function mimeFromPath(path) {
  const ext = path.slice(path.lastIndexOf('.') + 1).toLowerCase()
  return MIME_BY_EXT[ext] ?? 'application/octet-stream'
}

// data: URL → raw bytes (Uint8Array). Handles base64 and plain (percent-encoded).
function dataURLToBytes(dataURL) {
  const comma = dataURL.indexOf(',')
  const meta = dataURL.slice(5, comma)      // between "data:" and ","
  const data = dataURL.slice(comma + 1)
  if (/;base64/i.test(meta)) {
    const bin = atob(data)
    const bytes = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
    return bytes
  }
  return strToU8(decodeURIComponent(data))
}

// Raw bytes → base64 data: URL. Chunked to avoid blowing the call stack on large
// originals (String.fromCharCode.apply is capped by the arg count).
function bytesToDataURL(bytes, mime) {
  let bin = ''
  const CHUNK = 0x8000
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK))
  }
  return `data:${mime};base64,${btoa(bin)}`
}

// Filesystem-friendly base for the download/share filename.
function safeName(name) {
  const cleaned = (name ?? 'project').replace(/[/\\?%*:|"<>]/g, '').trim()
  return cleaned || 'project'
}

// Externalize a record's layer images into `files` (keyed by zip path, prefixed
// for back-up-all folders) and return json-safe layers that reference them by
// path. Full-res originals are fetched from the blobs store here.
async function externalizeLayers(record, files, prefix) {
  return Promise.all((record.state?.layers ?? []).map(async (layer) => {
    const out = { ...layer }

    if (typeof layer.src === 'string' && layer.src.startsWith('data:')) {
      const mime = mimeFromDataURL(layer.src)
      const path = `${prefix}images/${layer.id}-src.${extFromMime(mime)}`
      files[path] = dataURLToBytes(layer.src)
      out.src = path
    }

    const ref = persistedOriginalRef(layer)
    if (ref) {
      try {
        const dataURL = await dbGetBlob(ref.slice(ORIG_REF_PREFIX.length))
        if (dataURL) {
          const mime = mimeFromDataURL(dataURL)
          const path = `${prefix}images/${layer.id}-orig.${extFromMime(mime)}`
          files[path] = dataURLToBytes(dataURL)
          out.srcOriginal = path
        } else {
          out.srcOriginal = undefined
        }
      } catch (e) {
        console.warn('export: original unreadable for layer', layer.id, e)
        out.srcOriginal = undefined
      }
    } else {
      // Not a portable persisted ref (in-session blob:/data: or absent).
      out.srcOriginal = undefined
    }
    return out
  }))
}

function bundleDoc(record, layers) {
  return {
    formatVersion: LAYOUT_FORMAT_VERSION,
    app: LAYOUT_APP,
    name: record.name,
    exportedAt: Date.now(),
    thumbnail: record.thumbnail ?? null,
    slideCount: record.slideCount ?? record.state?.slides?.length ?? 0,
    state: { ...record.state, layers },
  }
}

// Export a single project as a portable `.layout` file.
// Returns { blob, filename } for delivery (share sheet / <a download>).
export async function exportProject(id) {
  const record = await dbGet('projects', id)
  if (!record) throw new Error('Project not found')
  const files = {}
  const layers = await externalizeLayers(record, files, '')
  files['project.json'] = strToU8(JSON.stringify(bundleDoc(record, layers)))
  const zipped = zipSync(files, { level: 6 })
  const blob = new Blob([zipped], { type: 'application/zip' })
  return { blob, filename: `${safeName(record.name)}.layout` }
}

// Back up EVERY project into one `.layout` archive (a folder per project). Built
// sequentially to bound peak memory on iOS; a very large library is best-effort,
// since zipSync still holds the whole archive in memory before delivery.
export async function backupAllProjects() {
  const all = await dbGetAll('projects')
  if (!all.length) throw new Error('No projects to back up')
  const files = {}
  const projects = []
  for (const record of all) {
    const prefix = `${record.id}/`
    const layers = await externalizeLayers(record, files, prefix)
    files[`${prefix}project.json`] = strToU8(JSON.stringify(bundleDoc(record, layers)))
    projects.push({ id: record.id, name: record.name, dir: record.id })
  }
  files['backup.json'] = strToU8(JSON.stringify({
    formatVersion: LAYOUT_FORMAT_VERSION,
    app: LAYOUT_APP,
    kind: 'backup-all',
    exportedAt: Date.now(),
    projects,
  }))
  const zipped = zipSync(files, { level: 6 })
  const blob = new Blob([zipped], { type: 'application/zip' })
  const stamp = new Date().toISOString().slice(0, 10)
  return { blob, filename: `layout-backup-${stamp}.layout` }
}

function validateFormat(doc) {
  if (!doc || doc.app !== LAYOUT_APP) {
    throw new Error('Unrecognized file — not a Layout export')
  }
  if (typeof doc.formatVersion !== 'number' || doc.formatVersion > LAYOUT_FORMAT_VERSION) {
    throw new Error(`Unsupported file version (${doc?.formatVersion}). Update the app and try again.`)
  }
}

// Recreate one project (from its parsed project.json + zip entries) under a FRESH
// id. Originals are written into the blobs store under NEW-id-scoped keys —
// exactly the re-keying convention duplicateProject (#39) uses — so the imported
// project owns an independent set of originals with no cross-references.
async function importOneProject(doc, entries, prefix) {
  const newId = Math.random().toString(36).slice(2)

  const layers = await Promise.all((doc.state?.layers ?? []).map(async (layer) => {
    const out = { ...layer }

    // Preview src: rehydrate from its zip entry (older files may inline a data URL).
    if (typeof layer.src === 'string' && !layer.src.startsWith('data:')) {
      const bytes = entries[prefix + layer.src] ?? entries[layer.src]
      out.src = bytes ? bytesToDataURL(bytes, mimeFromPath(layer.src)) : null
    }

    // Full-res original: rehydrate into the blobs store under a NEW-id key and
    // point the layer at it (the #39 re-keying, applied to file-sourced bytes).
    if (typeof layer.srcOriginal === 'string' && !layer.srcOriginal.startsWith(ORIG_REF_PREFIX)) {
      const bytes = entries[prefix + layer.srcOriginal] ?? entries[layer.srcOriginal]
      if (bytes) {
        const newKey = originalKey(newId, layer.id)
        await dbPutBlob(newKey, bytesToDataURL(bytes, mimeFromPath(layer.srcOriginal)))
        out.srcOriginal = ORIG_REF_PREFIX + newKey
      } else {
        out.srcOriginal = undefined
      }
    } else {
      out.srcOriginal = undefined
    }
    return out
  }))

  const record = {
    id: newId,
    name: doc.name || 'Imported project',
    updatedAt: Date.now(),
    thumbnail: doc.thumbnail ?? null,
    thumbFingerprint: null,   // force a fresh render on first save
    slideCount: doc.slideCount ?? doc.state?.slides?.length ?? 0,
    state: { ...doc.state, layers },
  }
  await dbPut('projects', record)
  return projectSummary(record)
}

// Import a `.layout` file (single project OR a back-up-all archive). Accepts an
// ArrayBuffer/Uint8Array of the file bytes. Every imported project gets a new id
// and independently re-keyed originals. Returns an array of project summaries.
export async function importProjectFile(buffer) {
  const u8 = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer)
  let entries
  try {
    entries = unzipSync(u8)
  } catch {
    throw new Error("Couldn't read this file — it isn't a valid .layout file.")
  }

  // Back-up-all archive: import each project listed in the manifest.
  if (entries['backup.json']) {
    const manifest = JSON.parse(strFromU8(entries['backup.json']))
    validateFormat(manifest)
    const created = []
    for (const p of manifest.projects ?? []) {
      const dir = `${p.dir ?? p.id}/`
      const jsonEntry = entries[`${dir}project.json`]
      if (!jsonEntry) continue
      const doc = JSON.parse(strFromU8(jsonEntry))
      validateFormat(doc)
      created.push(await importOneProject(doc, entries, dir))
    }
    if (!created.length) throw new Error('Backup archive contained no projects.')
    return created
  }

  // Single-project file.
  const jsonEntry = entries['project.json']
  if (!jsonEntry) throw new Error('Missing project.json — not a Layout export.')
  const doc = JSON.parse(strFromU8(jsonEntry))
  validateFormat(doc)
  return [await importOneProject(doc, entries, '')]
}
