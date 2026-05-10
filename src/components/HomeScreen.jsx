import { useState } from 'react'
import { useStore } from '../useStore'
import { RATIOS } from '../templates'
import { IconClose } from './icons'

export default function HomeScreen() {
  const startProject = useStore(s => s.startProject)
  const [picking, setPicking] = useState(false)

  return (
    <div className="flex flex-col items-center justify-center h-full bg-black text-white gap-8 px-6">
      <div className="text-center">
        <div className="text-4xl font-semibold tracking-tight mb-2">Layout</div>
        <div className="text-sm text-white/40">Instagram carousel & collage editor</div>
      </div>

      <button
        onClick={() => setPicking(true)}
        className="bg-white text-black font-semibold text-base px-8 py-3 rounded-full active:scale-95 transition-transform"
      >
        New Project
      </button>

      {picking && (
        <div className="fixed inset-0 bg-black/80 flex items-end z-50" onClick={() => setPicking(false)}>
          <div
            className="w-full bg-[#1a1a1a] rounded-t-2xl p-6 pb-10"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <span className="text-base font-semibold">New Project</span>
              <button onClick={() => setPicking(false)} className="text-white/50"><IconClose size={18} /></button>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-2">
              {RATIOS.map(r => {
                const previewH = 72
                const previewW = Math.round(previewH * (r.w / r.h))
                return (
                  <button
                    key={r.value}
                    onClick={() => { startProject(r); setPicking(false) }}
                    className="flex flex-col items-center gap-2 shrink-0 active:opacity-70"
                  >
                    <div
                      className="bg-white rounded-lg"
                      style={{ width: previewW, height: previewH }}
                    />
                    <div className="text-xs text-white/60">{r.label}</div>
                    <div className="text-[11px] text-white/30">{r.value}</div>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
