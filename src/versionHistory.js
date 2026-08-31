// Per-project version history (issue #90).
//
// ─── Why snapshots don't carry image data ──────────────────────────────────────
// A project record's layers hold their preview image inline as a base64 data URL
// (see projectStorage.js). Those strings are the entire weight of a project — a
// 5-photo project is ~1–2 MB of data URL and a few KB of everything else.
//
// At save time the same JS string is *shared by reference* between the live store
// layers and the previous save (serializeLayers reuses it when imgId is
// unchanged), so a snapshot looks free in memory. It is not: IndexedDB writes go
// through structured clone, which deep-copies every string into every record. Ten
// naive snapshots of a 2 MB project is 20 MB on disk — on a device where the
// browser evicts origins under pressure, that is the opposite of a data-safety
// feature.
//
// So a snapshot stores the project state with each layer's `src` / `srcOriginal`
// STRIPPED, keeping only the layer's `id` and `imgId` (the stable per-image
// content id minted on every import/replace). On restore the image strings are
// resolved from the CURRENT project record — see resolveVersionLayers. A snapshot
// is therefore a few KB of geometry/text plus a ~96px mini thumbnail, and ten of
// them cost ~1–2% of one project instead of 10×.
//
// The honest consequence, which the UI states plainly: restoring recovers the
// LAYOUT of an earlier moment, and it recovers photos that are still somewhere in
// the project today. A photo that was replaced or deleted after a snapshot was
// taken is gone from storage, so that slot comes back empty. Photos added since
// are unaffected — they simply aren't part of the older layout.

import { dbGet, dbPut, dbDelete, dbGetAllByIndex, dbGetAllKeysByIndex } from './db'
import { get2dContext } from './colorSpace'

// Snapshots kept per project. The oldest are pruned past this.
export const VERSION_LIMIT = 10

// Cadence: one snapshot when a project is opened, then at most one per this much
// ACTIVE editing (checked on the autosave path — not per autosave tick).
export const VERSION_INTERVAL_MS = 15 * 60 * 1000

// Mini thumbnail width for the history list. Re-encoding the project's existing
// 240px thumbnail down to this costs one small decode and turns a ~14 KB thumb
// into ~2 KB, which matters more than it looks at 10 snapshots per project.
const VERSION_THUMB_W = 96

// ─── Ids ───────────────────────────────────────────────────────────────────────
// `<projectId>:<zero-padded timestamp>:<rand>` — project ids are base36 with no
// colons, so this parses back cleanly. Padding keeps the primary key's lexical
// order chronological, which is what lets the keys-only listing below double as
// both "when was the last snapshot" and "which are the oldest to prune".

function versionId(projectId, timestamp) {
  return `${projectId}:${String(timestamp).padStart(13, '0')}:${Math.random().toString(36).slice(2, 8)}`
}

function timestampFromId(id) {
  const ts = Number(String(id).split(':')[1])
  return Number.isFinite(ts) ? ts : 0
}

// ─── Snapshot payload ──────────────────────────────────────────────────────────

// Strip the image strings, keep everything else. `_img` marks the layers that DID
// have an image, so a restore can tell "this slot was an empty cell" from "this
// slot's photo is no longer in the project".
export function stripLayersForVersion(layers) {
  return (layers ?? []).map(layer => {
    const out = { ...layer }
    const hadImage = typeof layer.src === 'string' && layer.src.length > 0
    delete out.src
    delete out.srcOriginal
    if (hadImage) out._img = 1
    else delete out._img
    return out
  })
}

// Re-attach image strings from the project's CURRENT layers.
//   1. same layer id AND same imgId  → the photo is untouched; take src + the
//      persisted `blob-ref://` original with it.
//   2. same imgId on any other layer → the photo is still in the project but has
//      moved cells; take its src. The original ref is keyed by the OTHER layer's
//      id, so it is deliberately dropped rather than aliased — exports fall back
//      to the preview src instead of pointing at a blob another layer owns.
//   3. neither                        → the photo was replaced or deleted after
//      this snapshot; restore the slot empty and report it.
// Layers saved before imgId existed have no content identity to check, so a
// same-id match is accepted for them (best effort, and it can only be the same
// image on a project that predates the field).
export function resolveVersionLayers(versionLayers, currentLayers) {
  const byId = new Map((currentLayers ?? []).map(l => [l.id, l]))
  const byImgId = new Map()
  for (const l of currentLayers ?? []) {
    if (l.imgId && typeof l.src === 'string' && !byImgId.has(l.imgId)) byImgId.set(l.imgId, l)
  }

  let missing = 0
  const layers = (versionLayers ?? []).map(v => {
    const out = { ...v }
    const hadImage = out._img === 1
    delete out._img
    if (!hadImage) return out

    const sameId = byId.get(v.id)
    if (sameId && typeof sameId.src === 'string' &&
        (!v.imgId || !sameId.imgId || sameId.imgId === v.imgId)) {
      return { ...out, src: sameId.src, srcOriginal: sameId.srcOriginal }
    }

    const moved = v.imgId ? byImgId.get(v.imgId) : null
    if (moved) return { ...out, src: moved.src, srcOriginal: undefined }

    missing++
    return { ...out, src: null, srcOriginal: undefined }
  })

  return { layers, missing }
}

// Shrink the project's stored thumbnail for the history list. Falls back to the
// original string on any failure (and outside a DOM, e.g. the vite-node suites).
async function miniThumbnail(dataURL) {
  if (typeof dataURL !== 'string' || !dataURL || typeof document === 'undefined') {
    return dataURL ?? null
  }
  try {
    const img = await new Promise((resolve, reject) => {
      const el = new Image()
      el.onload = () => resolve(el)
      el.onerror = () => reject(new Error('thumb load failed'))
      el.src = dataURL
    })
    if (!img.naturalWidth || img.naturalWidth <= VERSION_THUMB_W) return dataURL
    const scale = VERSION_THUMB_W / img.naturalWidth
    const canvas = document.createElement('canvas')
    canvas.width = VERSION_THUMB_W
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale))
    // Wide-gamut (issue #109) — the mini is a downscale of an already-P3 export,
    // so an sRGB context here would make the history strip disagree with it.
    const ctx = get2dContext(canvas)
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    return canvas.toDataURL('image/jpeg', 0.6)
  } catch {
    return dataURL
  }
}

// ─── Cadence bookkeeping ───────────────────────────────────────────────────────
// Last snapshot time per project, in memory. Seeded from the keys-only index read
// the first time a project is checked, so the 2s autosave never pays for more
// than a key list (and usually not even that).

const lastCaptureAt = new Map()

export function noteCapture(projectId, timestamp) {
  lastCaptureAt.set(projectId, timestamp)
}

async function latestCaptureAt(projectId) {
  if (lastCaptureAt.has(projectId)) return lastCaptureAt.get(projectId)
  const keys = await dbGetAllKeysByIndex('versions', 'projectId', projectId)
  return keys.length ? timestampFromId(keys[keys.length - 1]) : null
}

// ─── Writing ───────────────────────────────────────────────────────────────────

async function pruneVersions(projectId) {
  const keys = await dbGetAllKeysByIndex('versions', 'projectId', projectId)
  if (keys.length <= VERSION_LIMIT) return
  // Ids sort chronologically, so the head of the list is the oldest.
  for (const key of keys.slice(0, keys.length - VERSION_LIMIT)) {
    try { await dbDelete('versions', key) } catch (e) { console.warn('version prune failed', key, e) }
  }
}

// Snapshot a project RECORD (the shape stored in the 'projects' store), so both
// the autosave path and the home screen can capture without a live editor state.
export async function writeVersion(record, timestamp = Date.now()) {
  if (!record?.id || !record.state) return null
  const version = {
    id: versionId(record.id, timestamp),
    projectId: record.id,
    timestamp,
    // The source record's updatedAt, used to skip re-snapshotting a project that
    // hasn't changed since its last snapshot.
    sourceUpdatedAt: record.updatedAt ?? timestamp,
    name: record.name,
    thumbnail: await miniThumbnail(record.thumbnail),
    state: { ...record.state, layers: stripLayersForVersion(record.state.layers) },
  }
  await dbPut('versions', version)
  noteCapture(record.id, timestamp)
  await pruneVersions(record.id)
  return version
}

// Autosave hook. Captures at most one snapshot per VERSION_INTERVAL_MS of active
// editing; a project with no history yet just starts the clock (a brand-new
// project doesn't need a snapshot of its own empty first save — its first
// meaningful snapshot comes from the next open, or 15 minutes of work).
export async function maybeCaptureVersion(record, now = Date.now()) {
  if (!record?.id) return null
  const last = await latestCaptureAt(record.id)
  if (last == null) { noteCapture(record.id, now); return null }
  if (now - last < VERSION_INTERVAL_MS) return null
  return writeVersion(record, now)
}

// Project-open snapshot: the state as it was BEFORE this session can autosave
// over it. Skipped when the newest snapshot already holds this exact saved state
// (opening and closing a project repeatedly shouldn't stack identical entries).
export async function captureOpenVersion(projectId) {
  const record = await dbGet('projects', projectId)
  if (!record?.state) return null
  const keys = await dbGetAllKeysByIndex('versions', 'projectId', projectId)
  if (keys.length) {
    const newest = await dbGet('versions', keys[keys.length - 1])
    if (newest && newest.sourceUpdatedAt === record.updatedAt) {
      // Nothing changed since that snapshot — restart the cadence clock instead.
      noteCapture(projectId, Date.now())
      return null
    }
  }
  return writeVersion(record, Date.now())
}

// ─── Reading / deleting ────────────────────────────────────────────────────────

// Newest first, WITHOUT the state payload — this feeds the history list, which
// only needs a timestamp and a thumbnail.
export async function listVersions(projectId) {
  const all = await dbGetAllByIndex('versions', 'projectId', projectId)
  return all
    .map(v => ({ id: v.id, projectId: v.projectId, timestamp: v.timestamp, thumbnail: v.thumbnail }))
    .sort((a, b) => b.timestamp - a.timestamp)
}

export function getVersion(id) {
  return dbGet('versions', id)
}

// GC on project delete. Keys-only listing, so no payload is deserialized.
export async function deleteVersionsForProject(projectId) {
  const keys = await dbGetAllKeysByIndex('versions', 'projectId', projectId)
  for (const key of keys) {
    try { await dbDelete('versions', key) } catch (e) { console.warn('version cleanup failed', key, e) }
  }
  lastCaptureAt.delete(projectId)
}

// Total bytes a project's snapshots occupy, approximated by their serialized
// length. Used by the storage measurement in the PR and handy for debugging.
export async function measureVersionBytes(projectId) {
  const all = await dbGetAllByIndex('versions', 'projectId', projectId)
  const bytes = all.reduce((sum, v) => sum + JSON.stringify(v).length, 0)
  return { count: all.length, bytes }
}
