import { useEffect } from 'react'
import { useStore } from './useStore'
import { initFontReloader } from './fonts'
import { RATIOS } from './templates'
import HomeScreen from './components/HomeScreen'
import Editor from './components/Editor'
import UpdateToast from './components/UpdateToast'
import './index.css'

// The Android manifest shortcut "New project" launches ./?action=new (issue #85).
// Consume it once and scrub the query string so a later reload — or StrictMode's
// second effect pass — doesn't spawn another project.
function consumeLaunchAction() {
  if (typeof window === 'undefined') return null
  const params = new URLSearchParams(window.location.search)
  const action = params.get('action')
  if (!action) return null
  params.delete('action')
  const qs = params.toString()
  window.history.replaceState({}, '', window.location.pathname + (qs ? `?${qs}` : ''))
  return action
}

export default function App() {
  const screen = useStore(s => s.screen)
  // Once-only: bump fontsVersion whenever the browser finishes loading a batch
  // of fonts, so Konva re-rasterizes text that was drawn in the fallback font.
  // Also load the device-global brand kit (issue #64) from IDB into the store —
  // idempotent, so a StrictMode double-invoke just reads the same record twice.
  useEffect(() => {
    initFontReloader(() => useStore.getState().bumpFontsVersion())
    useStore.getState().initBrandKit()
    if (consumeLaunchAction() === 'new') {
      const ratio = RATIOS.find(r => r.value === '4:5') ?? RATIOS[0]
      useStore.getState().startProject(ratio, null)
    }
  }, [])
  return (
    <>
      {screen === 'editor' ? <Editor /> : <HomeScreen />}
      <UpdateToast />
    </>
  )
}
