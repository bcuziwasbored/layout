import { createContext, useContext, useRef } from 'react'

export const CanvasContext = createContext(null)

export function useCanvasPicker() {
  return useContext(CanvasContext)
}
