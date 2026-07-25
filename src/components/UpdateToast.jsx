// Service-worker update prompt (issue #85).
//
// With registerType: 'prompt' a freshly deployed SW installs and then parks in
// `waiting` — an installed PWA would otherwise keep running the old bundle
// until every tab is closed, which on iOS can be weeks. registerSW hands us an
// onNeedRefresh callback; we surface it as a tap-to-reload toast in the same
// dark pill language as the home screen's transient toasts.

import { useEffect, useState } from 'react'
import { registerSW } from 'virtual:pwa-register'

// Registration lives at module scope, not in an effect: it must happen exactly
// once per page load, and StrictMode double-invokes effects in dev.
let updateSW = null
let needRefresh = false          // latched, so a late mount still sees the event
const listeners = new Set()

function announce() {
  needRefresh = true
  listeners.forEach(fn => fn())
}

if (typeof window !== 'undefined') {
  updateSW = registerSW({ immediate: true, onNeedRefresh: announce })
  // Dev affordance: there is no SW in `vite dev`, so expose a manual trigger to
  // eyeball the toast without deploying a build.
  if (import.meta.env.DEV) window.__layoutNeedRefresh = announce
}

export default function UpdateToast() {
  const [show, setShow] = useState(needRefresh)

  useEffect(() => {
    const fn = () => setShow(true)
    listeners.add(fn)
    return () => listeners.delete(fn)
  }, [])

  if (!show) return null

  // updateSW(true) posts SKIP_WAITING to the waiting worker and reloads once it
  // takes control. Hide the toast immediately so a double-tap can't stack.
  const reload = () => {
    setShow(false)
    updateSW?.(true)
  }

  return (
    <div
      className="font-inter fixed left-1/2 -translate-x-1/2 bottom-8 z-[80] max-w-[90%]"
      style={{ marginBottom: 'env(safe-area-inset-bottom)' }}
      role="status"
    >
      <button
        onClick={reload}
        className="flex items-center gap-2 whitespace-nowrap text-[14px] font-medium px-4 py-2.5 rounded-full shadow-lg active:brightness-125"
        style={{ background: '#16171B', border: '1px solid #2E2F36', color: '#F5F4F1' }}
      >
        <span className="shrink-0" style={{ width: 6, height: 6, borderRadius: '50%', background: '#C6A052' }} />
        Update available
        <span style={{ color: '#C6A052' }}>· Reload</span>
      </button>
    </div>
  )
}
