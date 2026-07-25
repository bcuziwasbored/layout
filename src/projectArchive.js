// Portable project files (.layout) — export / back-up-all / import.
//
// Split out of projectStorage.js for issue #87: this is the only code that needs
// fflate, and it only runs when the user taps Export file / Back up all / Import
// from the home screen's menus. HomeScreen reaches it through a dynamic import(),
// so neither this module nor fflate is in the initial chunk. Everything below is
// unchanged from its previous home in projectStorage.js.

import { dbGet, dbPut, dbGetAll, dbGetBlob, dbPutBlob } from './db'
import { ORIG_REF_PREFIX, originalKey, persistedOriginalRef, projectSummary } from './projectStorage'
import { zipSync, unzipSync, strToU8, strFromU8 } from 'fflate'

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
