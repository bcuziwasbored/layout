// Durable storage + storage-pressure helpers (issue #84).
//
// Everything a user makes lives in IndexedDB, which a browser may evict when the
// device gets tight on space. Two mitigations live here:
//
//   1. `navigator.storage.persist()` — asks the browser to exempt this origin from
//      eviction. Requested once per session, on the FIRST successful project save,
//      because engagement makes browsers far more likely to grant it (Chrome uses
//      installed/engagement heuristics; Firefox prompts; Safari grants silently
//      based on its own rules). Never requested on app load.
//   2. `navigator.storage.estimate()` — read on home-screen load to spot pressure
//      and nudge the user toward the existing "Back up all" flow.
//
// The whole Storage API surface is optional here: Safari's support is partial and
// older/embedded WebViews have none of it. Every entry point is feature-detected
// and resolves to a neutral value instead of throwing, so a browser that lacks
// the API simply gets no banner and no behaviour change.

// Show the pressure banner above this fraction of the quota.
export const PRESSURE_RATIO = 0.8

// The nudge only makes sense once the user has enough work to lose.
export const NUDGE_MIN_PROJECTS = 3

// One-time flag for the "persistence denied" backup nudge.
export const NUDGE_SEEN_KEY = 'layout.backupNudgeSeen'

// ─── Feature detection ─────────────────────────────────────────────────────────

// `navigator.storage` or null. Wrapped because touching `navigator` can throw in
// exotic sandboxed contexts, and the module is also imported by node-run tests.
function storageManager() {
  try {
    const nav = typeof navigator === 'undefined' ? null : navigator
    const sm = nav?.storage
    return sm && typeof sm === 'object' ? sm : null
  } catch {
    return null
  }
}

function hasFn(obj, name) {
  return !!obj && typeof obj[name] === 'function'
}

// ─── persist() ─────────────────────────────────────────────────────────────────

// Session-scoped guard: at most one persist() request per page load, result cached.
let persistAttempted = false
let persistOutcome = null   // true granted · false denied · null unknown/unsupported

// Ask the browser for durable storage. Safe to call from any save path — the
// second and later calls are a cached no-op. Resolves to true (persisted), false
// (denied) or null (API unavailable / errored); never rejects.
export async function requestPersistentStorage() {
  if (persistAttempted) return persistOutcome
  persistAttempted = true

  const sm = storageManager()
  if (!hasFn(sm, 'persist')) return persistOutcome   // stays null — unsupported

  try {
    // Already durable (a previous session was granted) — don't re-ask.
    if (hasFn(sm, 'persisted') && await sm.persisted() === true) {
      persistOutcome = true
      return persistOutcome
    }
    persistOutcome = await sm.persist() === true
  } catch {
    persistOutcome = null
  }
  return persistOutcome
}

// True/false if the browser can tell us, null if it can't.
export async function isPersisted() {
  const sm = storageManager()
  if (!hasFn(sm, 'persisted')) return null
  try {
    return await sm.persisted() === true
  } catch {
    return null
  }
}

// ─── estimate() ────────────────────────────────────────────────────────────────

// { usage, quota, ratio } when the browser reports usable numbers, else null.
export async function getStorageEstimate() {
  const sm = storageManager()
  if (!hasFn(sm, 'estimate')) return null
  try {
    const { usage, quota } = await sm.estimate() ?? {}
    if (!Number.isFinite(usage) || !Number.isFinite(quota) || quota <= 0) return null
    return { usage, quota, ratio: usage / quota }
  } catch {
    return null
  }
}

// ─── Banner decision ───────────────────────────────────────────────────────────

// Pure decision so the rule is testable without any browser API:
//   'pressure' — usage is past PRESSURE_RATIO of the quota (higher priority)
//   'nudge'    — storage is NOT durable and the user has real work to lose,
//                shown at most once ever
//   null       — healthy storage: no UI noise at all
export function pickStorageBanner({ estimate, persisted, projectCount, nudgeSeen }) {
  if (estimate && estimate.ratio >= PRESSURE_RATIO) return 'pressure'
  if (persisted === false && !nudgeSeen && projectCount >= NUDGE_MIN_PROJECTS) return 'nudge'
  return null
}

// ─── localStorage flag (private mode / disabled storage safe) ──────────────────

export function nudgeSeen() {
  try {
    return localStorage.getItem(NUDGE_SEEN_KEY) === '1'
  } catch {
    return false
  }
}

export function markNudgeSeen() {
  try {
    localStorage.setItem(NUDGE_SEEN_KEY, '1')
  } catch { /* private mode — the nudge may reappear next session, harmless */ }
}

// ─── Home-screen entry point ───────────────────────────────────────────────────

// Read the browser's storage health and decide which (if any) banner to show.
// Resolves to { kind, estimate } with kind null when nothing should be shown.
// Never rejects — an unsupported or failing API degrades to no banner.
export async function checkStorageHealth(projectCount) {
  const [estimate, persisted] = await Promise.all([getStorageEstimate(), isPersisted()])
  const kind = pickStorageBanner({ estimate, persisted, projectCount, nudgeSeen: nudgeSeen() })
  return { kind, estimate }
}

// Human-readable "1.8 GB of 2 GB used" for the pressure banner.
export function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) return ''
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let value = bytes
  let i = 0
  while (value >= 1024 && i < units.length - 1) { value /= 1024; i++ }
  const rounded = value >= 100 || i === 0 ? Math.round(value) : Math.round(value * 10) / 10
  return `${rounded} ${units[i]}`
}
