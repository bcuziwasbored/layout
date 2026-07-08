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
  useEffect(() => {
    initFontReloader(() => useStore.getState().bumpFontsVersion())
  }, [])
  return screen === 'editor' ? <Editor /> : <HomeScreen />
}
