import { createContext, useContext } from 'react'

export const CanvasContext = createContext(null)

export function useCanvasPicker() {
  return useContext(CanvasContext)
}
