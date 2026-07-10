import { useEffect } from 'react'
import { useStore } from './useStore'
import { initFontReloader } from './fonts'
import HomeScreen from './components/HomeScreen'
import Editor from './components/Editor'
import './index.css'

export default function App() {
  const screen = useStore(s => s.screen)
  // Once-only: bump fontsVersion whenever the browser finishes loading a batch
  // of fonts, so Konva re-rasterizes text that was drawn in the fallback font.
  // Also load the device-global brand kit (issue #64) from IDB into the store —
  // idempotent, so a StrictMode double-invoke just reads the same record twice.
  useEffect(() => {
    initFontReloader(() => useStore.getState().bumpFontsVersion())
    useStore.getState().initBrandKit()
  }, [])
  return screen === 'editor' ? <Editor /> : <HomeScreen />
}
