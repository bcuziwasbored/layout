import { useStore } from './useStore'
import HomeScreen from './components/HomeScreen'
import Editor from './components/Editor'
import './index.css'

export default function App() {
  const screen = useStore(s => s.screen)
  return screen === 'editor' ? <Editor /> : <HomeScreen />
}
