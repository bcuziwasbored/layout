import { dbGet, dbPut, dbDelete, dbGetAll, dbGetBlob, dbPutBlob, dbDeleteBlob } from './db'
import { blobCache } from './blobCache'
import { renderSlide } from './renderSlide'
import { migrateLayers } from './ratioMigrate'
import { requestPersistentStorage } from './storageHealth'
import { get2dContext } from './colorSpace'
import { detectGainMapInBlob } from './gainMap'
import {
  maybeCaptureVersion, writeVersion, getVersion, resolveVersionLayers,
  deleteVersionsForProject, noteCapture,
} from './versionHistory'

const THUMB_W = 240

// Full-resolution originals are persisted in the 'blobs' IDB store (as data-URL
// strings, per the iOS-Safari reliability note in db.js), keyed per project+layer.
// The preview `src` stays inline in the project record for fast loads; the layer's
// `srcOriginal` is rewritten to a `blob-ref://` pointer at this key so exports can
// lazily fetch the original after a reload.
export const ORIG_REF_PREFIX = 'blob-ref://'
// Cap stored originals at 4096px on the long edge (re-encode JPEG q0.92 when
// larger) to respect iOS storage quotas.
const MAX_ORIGINAL_DIM = 4096
// ...except for gain-map photos (issue #110), where the cap's re-encode would
// destroy the very thing we are trying to preserve: a canvas cannot carry a gain
// map, so a capped original is an SDR original. These keep their bytes verbatim
// up to a hard ceiling, which exists only so one enormous file can't exhaust the
// IDB quota outright. Past it we fall back to the capped SDR original — the
// export simply won't offer the HDR path for that photo.
const MAX_GAIN_MAP_ORIGINAL_BYTES = 40 * 1024 * 1024

export const originalKey = (projectId, layerId) => `orig:${projectId}:${layerId}`

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
export function persistedOriginalRef(layer) {
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
        get2dContext(c).drawImage(img, 0, 0)
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
  // A gain-map photo skips the dimension cap entirely (issue #110). Re-encoding
  // it through a canvas would strip the gain map, so a "safely capped" original
  // would be exactly the SDR file we're trying not to make.
  if (blob.size <= MAX_GAIN_MAP_ORIGINAL_BYTES &&
      (await detectGainMapInBlob(blob)).hasGainMap) {
    return dataURL
  }
  const img = await loadImageEl(dataURL)
  const long = Math.max(img.naturalWidth, img.naturalHeight)
  if (long <= MAX_ORIGINAL_DIM) return dataURL
  const scale = MAX_ORIGINAL_DIM / long
  const w = Math.round(img.naturalWidth * scale)
  const h = Math.round(img.naturalHeight * scale)
  const canvas = document.createElement('canvas')
  canvas.width = w; canvas.height = h
  // Wide-gamut (issue #109): this re-encode is what a reloaded project exports
  // from, so clipping here would throw away P3 colour permanently.
  const ctx = get2dContext(canvas)
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
  const record = {
    id, name, updatedAt: Date.now(), thumbnail, thumbFingerprint: fingerprint,
    slideCount: slides.length,
    // `caption` (issue #71) is plain metadata persisted alongside the project;
    // `?? ''` keeps records written before this field consistent.
    state: { ratio, bgColor, bgGradient, slides, layers: serialized, caption: caption ?? '' },
  }
  await dbPut('projects', record)

  // Version history (#90). This runs on every autosave tick but writes at most
  // one snapshot per 15 minutes of editing — the check itself is a keys-only
  // index read, cached in memory after the first call. Never fails the save.
  try {
    await maybeCaptureVersion(record)
  } catch (e) {
    console.warn('version snapshot failed', e)
  }

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
          } catch { /* corrupted legacy blob — fall through to the null-src path below */ }
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
export function projectSummary(r) {
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
  // GC this project's history snapshots along with it (#90) — they are worthless
  // without the project record their images resolve against.
  try { await deleteVersionsForProject(id) } catch (e) { console.warn('version cleanup failed', id, e) }
  await dbDelete('projects', id)
}

// ─── Version history restore (#90) ─────────────────────────────────────────────

// Overwrite a project with one of its snapshots. The CURRENT state is snapshotted
// first, so a restore is itself reversible from the same list. Image strings come
// from the project's current layers (see versionHistory.resolveVersionLayers) —
// `missing` counts the layers whose photo has since been replaced or deleted and
// therefore comes back empty. Returns { summary, missing } or null.
//
// Deliberately does NOT garbage-collect stored originals: a layer absent from the
// restored state may well come back via another snapshot, and the reference count
// that matters spans versions, not just this write.
export async function restoreVersion(projectId, versionId) {
  const [record, version] = await Promise.all([dbGet('projects', projectId), getVersion(versionId)])
  if (!record || !version?.state) return null

  // Snapshot where we are before overwriting it.
  try { await writeVersion(record, Date.now()) } catch (e) { console.warn('pre-restore snapshot failed', e) }

  const { layers, missing } = resolveVersionLayers(version.state.layers, record.state?.layers)
  const { ratio, bgColor, bgGradient, slides, caption } = version.state
  const thumbnail = await renderThumbnail(layers, slides, ratio, bgColor, bgGradient)
  const fingerprint = thumbFingerprint(layers, slides, ratio, bgColor, bgGradient)

  const updated = {
    ...record,
    updatedAt: Date.now(),
    thumbnail,
    thumbFingerprint: fingerprint,
    slideCount: slides.length,
    state: { ratio, bgColor, bgGradient, slides, caption: caption ?? '', layers },
  }
  await dbPut('projects', updated)
  // A restore is a fresh starting point; don't snapshot again 2s later.
  noteCapture(projectId, Date.now())
  return { summary: projectSummary(updated), missing }
}

// Count the photos a restore would leave empty, without changing anything —
// lets the confirmation say so before the user commits.
export async function previewVersionRestore(projectId, versionId) {
  const [record, version] = await Promise.all([dbGet('projects', projectId), getVersion(versionId)])
  if (!record || !version?.state) return { missing: 0 }
  const { missing } = resolveVersionLayers(version.state.layers, record.state?.layers)
  return { missing }
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

// The portable .layout file reader/writer lives in ./projectArchive.js — it is
// loaded on demand (issue #87) and re-uses the record helpers exported above.
