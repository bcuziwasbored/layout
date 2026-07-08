import { useState, useRef, useEffect, useMemo } from 'react'
import { useStore, fitInCell } from '../../useStore'
import { useCanvasPicker } from '../../CanvasContext'
import {
  IconClose,
  IconFront, IconForward, IconBackward, IconBack,
  IconAlignLeft, IconAlignCenterH, IconAlignRight,
  IconAlignTop, IconAlignCenterV, IconAlignBottom,
  IconFillHeight, IconFillWidth, IconFillWidth2x,
  IconFlipH, IconFlipV,
  IconBold, IconItalic,
  IconTextAlignLeft, IconTextAlignCenter, IconTextAlignRight,
  IconShapeRect, IconShapeCircle,
} from '../icons'
import { FONTS, loadFont } from '../../fonts'

// ─── Sub-components ────────────────────────────────────────────────────────────

// Capture-on-start / commit-on-release helper for <input type="color"> scrubbing,
// matching the interaction-scrub pattern in BackgroundPanel. Captures the pre-edit
// state once when the picker opens (pointerdown/focus/first change), applies edits
// live via updateLayer, and on blur commits exactly one history entry — or discards
// it when the value didn't actually change. Fixes the old anti-pattern of pushing a
// snapshot of the POST-change state on blur (which made Undo a no-op).
function useColorScrub() {
  const startRef = useRef(null)
  const start = (initial) => {
    if (startRef.current !== null) return
    startRef.current = initial
    useStore.getState()._captureUndo()
  }
  const end = (finalValue) => {
    if (startRef.current === null) return
    const initial = startRef.current
    startRef.current = null
    if (finalValue === initial) useStore.getState()._discardUndo()
    else useStore.getState()._commitUndo()
  }
  return { start, end }
}

// Discrete one-shot color/style apply (recent-color tap, font tap): push history
// BEFORE the change by capturing then committing around a single updateLayer, so one
// Undo restores the previous value. No-ops when the value is unchanged.
function applyDiscrete(apply, changed) {
  if (!changed) return
  useStore.getState()._captureUndo()
  apply()
  useStore.getState()._commitUndo()
}

function SectionLabel({ children }) {
  return <div className="text-xs text-white/35 uppercase tracking-wider mb-2 mt-1">{children}</div>
}

function RecentColors({ onSelect }) {
  const recentColors = useStore(s => s.recentColors)
  if (!recentColors.length) return null
  return (
    <div className="flex gap-2 flex-wrap mb-3">
      {recentColors.map(c => (
        <button key={c} onClick={() => onSelect(c)}
          className="w-7 h-7 rounded-full border border-white/20 active:scale-90 transition-transform shrink-0"
          style={{ background: c }} />
      ))}
    </div>
  )
}

function IconBtn({ icon, label, onClick, active, danger }) {
  return (
    <button onClick={onClick}
      className={`flex flex-col items-center gap-1.5 py-3 rounded-xl active:opacity-50 ${
        danger ? 'text-red-400' : active ? 'text-blue-400' : 'text-white/70'
      }`}>
      {icon}
      <span className="text-[10px] leading-none">{label}</span>
    </button>
  )
}

// ─── Position tab ──────────────────────────────────────────────────────────────

function PositionTab({ layer, activeLayerId, ratio, activeSlideIdx, layers, reorderLayer, updateLayerWithHistory, updateLayer, isGroup, isText }) {
  const NUDGE = 1

  // Shared align actions
  const alignActions = isGroup ? (() => {
    const grp = layers.filter(l => l.groupId === layer.groupId)
    const gx = Math.min(...grp.map(l => l.x))
    const gy = Math.min(...grp.map(l => l.y))
    const gw = Math.max(...grp.map(l => l.x + l.w)) - gx
    const gh = Math.max(...grp.map(l => l.y + l.h)) - gy
    const si = activeSlideIdx
    const moveGroup = (dx, dy) => {
      updateLayerWithHistory(grp[0].id, { x: grp[0].x + dx, y: grp[0].y + dy })
      grp.slice(1).forEach(l => updateLayer(l.id, { x: l.x + dx, y: l.y + dy }))
    }
    return [
      { icon: <IconAlignLeft />,    label: 'Left',   fn: () => moveGroup(si * ratio.w - gx, 0) },
      { icon: <IconAlignCenterH />, label: 'Center', fn: () => moveGroup(si * ratio.w + (ratio.w - gw) / 2 - gx, 0) },
      { icon: <IconAlignRight />,   label: 'Right',  fn: () => moveGroup((si + 1) * ratio.w - (gx + gw), 0) },
      { icon: <IconAlignTop />,     label: 'Top',    fn: () => moveGroup(0, -gy) },
      { icon: <IconAlignCenterV />, label: 'Center', fn: () => moveGroup(0, (ratio.h - gh) / 2 - gy) },
      { icon: <IconAlignBottom />,  label: 'Bottom', fn: () => moveGroup(0, ratio.h - gh - gy) },
    ]
  })() : [
    { icon: <IconAlignLeft />,    label: 'Left',   fn: () => updateLayerWithHistory(activeLayerId, { x: activeSlideIdx * ratio.w }) },
    { icon: <IconAlignCenterH />, label: 'Center', fn: () => updateLayerWithHistory(activeLayerId, { x: activeSlideIdx * ratio.w + (ratio.w - layer.w) / 2 }) },
    { icon: <IconAlignRight />,   label: 'Right',  fn: () => updateLayerWithHistory(activeLayerId, { x: (activeSlideIdx + 1) * ratio.w - layer.w }) },
    { icon: <IconAlignTop />,     label: 'Top',    fn: () => updateLayerWithHistory(activeLayerId, { y: 0 }) },
    { icon: <IconAlignCenterV />, label: 'Center', fn: () => updateLayerWithHistory(activeLayerId, { y: (ratio.h - layer.h) / 2 }) },
    { icon: <IconAlignBottom />,  label: 'Bottom', fn: () => updateLayerWithHistory(activeLayerId, { y: ratio.h - layer.h }) },
  ]

  // Nudge handler (group-aware)
  const nudge = (dx, dy) => {
    if (isGroup) {
      const grp = layers.filter(l => l.groupId === layer.groupId)
      updateLayerWithHistory(grp[0].id, { x: grp[0].x + dx, y: grp[0].y + dy })
      grp.slice(1).forEach(l => updateLayer(l.id, { x: l.x + dx, y: l.y + dy }))
    } else {
      updateLayerWithHistory(activeLayerId, { x: layer.x + dx, y: layer.y + dy })
    }
  }

  // Fill actions (regular layers only)
  const fillHeight = () => {
    const nW = layer.naturalW ?? layer.w, nH = layer.naturalH ?? layer.h
    const newH = ratio.h, newW = nW / nH * newH
    const fit = fitInCell(nW, nH, newW, newH)
    updateLayerWithHistory(activeLayerId, {
      x: activeSlideIdx * ratio.w + (ratio.w - newW) / 2, y: 0, w: newW, h: newH, ...fit,
    })
  }
  const fillWidth = () => {
    const nW = layer.naturalW ?? layer.w, nH = layer.naturalH ?? layer.h
    const newW = ratio.w, newH = nH / nW * newW
    const fit = fitInCell(nW, nH, newW, newH)
    updateLayerWithHistory(activeLayerId, {
      x: activeSlideIdx * ratio.w, y: (ratio.h - newH) / 2, w: newW, h: newH, ...fit,
    })
  }
  const fillWidth2x = () => {
    const nW = layer.naturalW ?? layer.w, nH = layer.naturalH ?? layer.h
    // Frame spans exactly 2 pages wide × 1 page tall, left-aligned to current page
    const newW = 2 * ratio.w, newH = ratio.h
    const fit = fitInCell(nW, nH, newW, newH)
    updateLayerWithHistory(activeLayerId, {
      x: activeSlideIdx * ratio.w, y: 0, w: newW, h: newH, ...fit,
    })
  }

  return (
    <div className="px-4 pb-6 pt-2 space-y-1 overflow-y-auto" style={{ maxHeight: '62vh' }}>

      {/* Arrange — regular layers only */}
      {!isGroup && (
        <>
          <SectionLabel>Arrange</SectionLabel>
          <div className="grid grid-cols-4 gap-1 mb-1">
            {[
              { icon: <IconFront />,    label: 'Front',    d: 'front' },
              { icon: <IconForward />,  label: 'Forward',  d: 'forward' },
              { icon: <IconBackward />, label: 'Backward', d: 'backward' },
              { icon: <IconBack />,     label: 'Back',     d: 'back' },
            ].map(({ icon, label, d }) => (
              <IconBtn key={d} icon={icon} label={label} onClick={() => reorderLayer(activeLayerId, d)} />
            ))}
          </div>
          <div className="border-t border-white/8 my-1" />
        </>
      )}

      {/* Nudge */}
      <SectionLabel>Nudge</SectionLabel>
      <div className="grid grid-cols-4 gap-1 mb-1">
        {[
          { label: 'Left',  icon: '←', dx: -NUDGE, dy: 0 },
          { label: 'Right', icon: '→', dx:  NUDGE, dy: 0 },
          { label: 'Up',    icon: '↑', dx: 0, dy: -NUDGE },
          { label: 'Down',  icon: '↓', dx: 0, dy:  NUDGE },
        ].map(({ label, icon, dx, dy }) => (
          <button key={label} onClick={() => nudge(dx, dy)}
            className="flex flex-col items-center gap-1.5 py-3 rounded-xl text-white/70 active:opacity-50">
            <span className="text-xl leading-none">{icon}</span>
            <span className="text-[10px] leading-none">{label}</span>
          </button>
        ))}
      </div>
      <div className="border-t border-white/8 my-1" />

      {/* Align */}
      <SectionLabel>Align</SectionLabel>
      <div className="grid grid-cols-3 gap-1 mb-1">
        {alignActions.map(({ icon, label, fn }, i) => (
          <IconBtn key={i} icon={icon} label={label} onClick={fn} />
        ))}
      </div>
      <div className="border-t border-white/8 my-1" />

      {/* Rotation */}
      <SectionLabel>Rotation</SectionLabel>
      <div className="mb-1">
        <div className="flex items-center gap-3">
          <input type="range" min={-180} max={180} step={1}
            value={layer.freeRotation ?? 0}
            onPointerDown={() => useStore.getState()._captureUndo()}
            onChange={e => updateLayer(activeLayerId, { freeRotation: +e.target.value })}
            onMouseUp={() => useStore.getState()._commitUndo()}
            onTouchEnd={() => useStore.getState()._commitUndo()}
            className="flex-1 accent-white" />
          <div className="bg-white/10 rounded-lg px-2.5 py-1.5 flex items-baseline gap-1 min-w-[64px] justify-end shrink-0">
            <span className="text-white text-sm tabular-nums">{layer.freeRotation ?? 0}</span>
            <span className="text-white/40 text-[11px]">°</span>
          </div>
        </div>
        {(layer.freeRotation ?? 0) !== 0 && (
          <button
            onClick={() => {
              useStore.getState()._pushHistory()
              updateLayer(activeLayerId, { freeRotation: 0 })
            }}
            className="mt-2 text-xs text-white/50 bg-white/8 px-3 py-1 rounded-full active:opacity-60">
            Reset to 0°
          </button>
        )}
      </div>
      <div className="border-t border-white/8 my-1" />

      {/* Fill — regular image layers only */}
      {!isGroup && !isText && (
        <>
          <SectionLabel>Fill</SectionLabel>
          <div className="grid grid-cols-3 gap-1 mb-1">
            <IconBtn icon={<IconFillHeight />} label="Height"   onClick={fillHeight} />
            <IconBtn icon={<IconFillWidth />}  label="Width"    onClick={fillWidth} />
            <IconBtn icon={<IconFillWidth2x />} label="Width 2×" onClick={fillWidth2x} />
          </div>
          <div className="border-t border-white/8 my-1" />

          {/* Flip */}
          <SectionLabel>Flip</SectionLabel>
          <div className="grid grid-cols-4 gap-1">
            <IconBtn icon={<IconFlipH />} label="Horizontal"
              active={layer.flipH}
              onClick={() => updateLayerWithHistory(activeLayerId, { flipH: !layer.flipH })} />
            <IconBtn icon={<IconFlipV />} label="Vertical"
              active={layer.flipV}
              onClick={() => updateLayerWithHistory(activeLayerId, { flipV: !layer.flipV })} />
          </div>
        </>
      )}
    </div>
  )
}

// ─── Style tab ────────────────────────────────────────────────────────────────

function StyleSliderRow({ label, value, min, max, step, display, unit, onChange, onDone }) {
  return (
    <div className="py-4 border-b border-white/8 last:border-0">
      <div className="text-sm font-semibold text-white mb-2.5">{label}</div>
      <div className="flex items-center gap-3">
        <input type="range" min={min} max={max} step={step} value={value}
          onPointerDown={() => useStore.getState()._captureUndo()}
          onChange={e => onChange(parseFloat(e.target.value))}
          onMouseUp={onDone} onTouchEnd={onDone}
          className="flex-1 accent-white" />
        <div className="bg-white/10 rounded-lg px-2.5 py-1.5 flex items-baseline gap-1 min-w-[64px] justify-end shrink-0">
          <span className="text-white text-sm tabular-nums">{display ?? value}</span>
          {unit && <span className="text-white/40 text-[11px]">{unit}</span>}
        </div>
      </div>
    </div>
  )
}

function StyleTab({ layer, activeLayerId, layers, updateLayer, isGroup }) {
  const colorRef = useRef()
  const borderScrub = useColorScrub()

  const gap = layer.cellGap ?? 0
  const cr  = layer.cornerRadius ?? 0
  const bw  = layer.borderWidth ?? 0
  const bc  = layer.borderColor ?? '#000000'
  const shape = layer.shape ?? 'rect'  // used to hide corner-radius slider for circle shape

  // Propagate a style prop to all cells in a group, or just to this layer
  const applyProp = (prop, value) => {
    if (isGroup) {
      layers.filter(l => l.groupId === layer.groupId).forEach(l => updateLayer(l.id, { [prop]: value }))
    } else {
      updateLayer(activeLayerId, { [prop]: value })
    }
  }

  const setGap = (v) => {
    if (isGroup) {
      const grp = layers.filter(l => l.groupId === layer.groupId)
      grp.forEach(l => {
        const innerW = l.w - v, innerH = l.h - v
        if (innerW <= 10 || innerH <= 10) return
        if (l.src) updateLayer(l.id, { cellGap: v, ...fitInCell(l.naturalW ?? l.w, l.naturalH ?? l.h, innerW, innerH) })
        else updateLayer(l.id, { cellGap: v })
      })
    } else {
      updateLayer(activeLayerId, { cellGap: v })
    }
  }

  return (
    <div className="px-5 pb-6 pt-1 overflow-y-auto" style={{ maxHeight: '62vh' }}>
      <StyleSliderRow
        label={isGroup ? 'Spacing' : 'Inset'}
        value={gap} min={0} max={80} step={1} display={gap} unit="px"
        onChange={setGap}
        onDone={() => useStore.getState()._commitUndo()} />

      <StyleSliderRow
        label="Opacity"
        value={Math.round((layer.opacity ?? 1) * 100)}
        min={0} max={100} step={1}
        display={Math.round((layer.opacity ?? 1) * 100)} unit="%"
        onChange={v => updateLayer(activeLayerId, { opacity: v / 100 })}
        onDone={() => useStore.getState()._commitUndo()} />

      {/* Corner radius only applies to rectangle shape */}
      {shape !== 'circle' && (
        <StyleSliderRow
          label="Corner Radius"
          value={cr} min={0} max={240} step={1} display={cr} unit="px"
          onChange={v => applyProp('cornerRadius', v)}
          onDone={() => useStore.getState()._commitUndo()} />
      )}

      <StyleSliderRow
        label="Border Thickness"
        value={bw} min={0} max={30} step={1} display={bw} unit="px"
        onChange={v => applyProp('borderWidth', v)}
        onDone={() => useStore.getState()._commitUndo()} />

      {/* Border Color */}
      <div className="py-4">
        <div className="text-sm font-semibold text-white mb-3">Border Color</div>
        <button onClick={() => colorRef.current?.click()}
          className="flex items-center justify-between w-full active:opacity-60">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full border-2 border-white/20 shadow-sm"
              style={{ background: bc }} />
            <span className="text-sm text-white/60">{bc.toUpperCase()}</span>
          </div>
          <span className="text-white/30 text-lg pr-1">›</span>
        </button>
        <input ref={colorRef} type="color" value={bc}
          onPointerDown={() => borderScrub.start(bc)}
          onFocus={() => borderScrub.start(bc)}
          onChange={e => { borderScrub.start(bc); applyProp('borderColor', e.target.value) }}
          onBlur={e => borderScrub.end(e.target.value)}
          className="sr-only" />
      </div>
    </div>
  )
}

// ─── Text panels ──────────────────────────────────────────────────────────────
// (Text content is now edited inline on the canvas via InlineTextEditor in
//  Canvas.jsx — no separate textarea panel needed.)

function TextStylePanel({ layer, updateLayer, updateLayerWithHistory }) {
  const colorRef  = useRef()
  const textBgRef = useRef()
  const fontPickerRef = useRef()
  const addRecentColor = useStore(s => s.addRecentColor)
  const colorScrub = useColorScrub()
  const textBgScrub = useColorScrub()

  const setFont = (family) => {
    loadFont(family)
    applyDiscrete(() => updateLayer(layer.id, { fontFamily: family }), family !== layer.fontFamily)
  }

  // Group fonts by category for section headers
  const fontGroups = useMemo(() => {
    const categoryOrder = ['sans', 'serif', 'display', 'script']
    const categoryLabel = { sans: 'SANS', serif: 'SERIF', display: 'DISPLAY', script: 'SCRIPT' }
    const groups = []
    let lastCat = null
    for (const f of FONTS) {
      if (f.category !== lastCat) {
        groups.push({ type: 'label', label: categoryLabel[f.category] ?? f.category.toUpperCase() })
        lastCat = f.category
      }
      groups.push({ type: 'font', font: f })
    }
    return groups
  }, [])

  // Scroll active font into view
  useEffect(() => {
    const el = fontPickerRef.current?.querySelector('[data-active="true"]')
    el?.scrollIntoView({ inline: 'center', behavior: 'smooth', block: 'nearest' })
  }, [layer.fontFamily])

  return (
    <div className="px-4 pb-6 pt-2 overflow-y-auto" style={{ maxHeight: '62vh' }}>

      {/* Font family — horizontal scroll */}
      <div className="mb-4">
        <div className="text-xs text-white/35 uppercase tracking-wider mb-2">Font</div>
        <div ref={fontPickerRef} className="flex gap-2 items-center overflow-x-auto pb-1 -mx-1 px-1" style={{ scrollSnapType: 'x mandatory' }}>
          {fontGroups.map((item, idx) => {
            if (item.type === 'label') {
              return (
                <span key={`label-${idx}`}
                  className="text-[9px] text-white/25 uppercase tracking-widest px-1 self-center shrink-0">
                  {item.label}
                </span>
              )
            }
            const f = item.font
            return (
              <button
                key={f.name}
                data-active={layer.fontFamily === f.name}
                onClick={() => setFont(f.name)}
                style={{ fontFamily: f.name, scrollSnapAlign: 'start' }}
                className={`shrink-0 px-3 py-2 rounded-xl text-sm whitespace-nowrap transition-colors ${
                  layer.fontFamily === f.name
                    ? 'bg-white text-black font-medium'
                    : 'bg-white/10 text-white/80 active:bg-white/20'
                }`}
              >
                {f.name}
              </button>
            )
          })}
        </div>
      </div>

      {/* Size */}
      <div className="py-3 border-b border-white/8">
        <div className="text-sm font-semibold text-white mb-2.5">Size</div>
        <div className="flex items-center gap-3">
          <input type="range" min={12} max={400} step={1}
            value={layer.fontSize ?? 72}
            onChange={e => updateLayer(layer.id, { fontSize: +e.target.value })}
            onPointerDown={() => useStore.getState()._captureUndo()}
            onMouseUp={() => useStore.getState()._commitUndo()}
            onTouchEnd={() => useStore.getState()._commitUndo()}
            className="flex-1 accent-white" />
          <div className="bg-white/10 rounded-lg px-2.5 py-1.5 min-w-[56px] text-right shrink-0">
            <span className="text-white text-sm tabular-nums">{layer.fontSize ?? 72}</span>
            <span className="text-white/40 text-[11px] ml-0.5">px</span>
          </div>
        </div>
      </div>

      {/* Style row: Bold · Italic · Align */}
      <div className="py-3 border-b border-white/8">
        <div className="text-sm font-semibold text-white mb-2.5">Style</div>
        <div className="flex items-center gap-2">
          {/* Bold */}
          <button
            onClick={() => updateLayerWithHistory(layer.id, { bold: !layer.bold })}
            className={`flex items-center justify-center w-10 h-10 rounded-xl transition-colors ${
              layer.bold ? 'bg-white text-black' : 'bg-white/10 text-white/70 active:bg-white/20'
            }`}>
            <IconBold size={18} />
          </button>
          {/* Italic */}
          <button
            onClick={() => updateLayerWithHistory(layer.id, { italic: !layer.italic })}
            className={`flex items-center justify-center w-10 h-10 rounded-xl transition-colors ${
              layer.italic ? 'bg-white text-black' : 'bg-white/10 text-white/70 active:bg-white/20'
            }`}>
            <IconItalic size={18} />
          </button>
          <div className="w-px h-6 bg-white/15 mx-1" />
          {/* Align */}
          {[
            { val: 'left',   icon: <IconTextAlignLeft size={20} /> },
            { val: 'center', icon: <IconTextAlignCenter size={20} /> },
            { val: 'right',  icon: <IconTextAlignRight size={20} /> },
          ].map(({ val, icon }) => (
            <button key={val}
              onClick={() => updateLayerWithHistory(layer.id, { align: val })}
              className={`flex items-center justify-center w-10 h-10 rounded-xl transition-colors ${
                (layer.align ?? 'center') === val
                  ? 'bg-white text-black'
                  : 'bg-white/10 text-white/70 active:bg-white/20'
              }`}>
              {icon}
            </button>
          ))}
        </div>
      </div>

      {/* Color */}
      <div className="py-3 border-b border-white/8">
        <div className="text-sm font-semibold text-white mb-2.5">Color</div>
        <RecentColors onSelect={c => { applyDiscrete(() => updateLayer(layer.id, { color: c }), c !== (layer.color ?? '#000000')); addRecentColor(c) }} />
        <button onClick={() => colorRef.current?.click()}
          className="flex items-center gap-3 active:opacity-60">
          <div className="w-8 h-8 rounded-full border-2 border-white/20"
            style={{ background: layer.color ?? '#000000' }} />
          <span className="text-sm text-white/60">{(layer.color ?? '#000000').toUpperCase()}</span>
          <span className="text-white/30 text-lg ml-auto pr-1">›</span>
        </button>
        <input ref={colorRef} type="color" value={layer.color ?? '#000000'}
          onPointerDown={() => colorScrub.start(layer.color ?? '#000000')}
          onFocus={() => colorScrub.start(layer.color ?? '#000000')}
          onChange={e => { colorScrub.start(layer.color ?? '#000000'); updateLayer(layer.id, { color: e.target.value }) }}
          onBlur={e => { colorScrub.end(e.target.value); addRecentColor(e.target.value) }}
          className="sr-only" />
      </div>

      {/* Background */}
      <div className="py-3 border-b border-white/8">
        <div className="text-sm font-semibold text-white mb-2.5">Background</div>
        <div className="flex items-center gap-3 mb-2">
          <button onClick={() => textBgRef.current?.click()}
            className="w-8 h-8 rounded-full border-2 border-white/20 active:opacity-60 relative overflow-hidden"
            style={{ background: layer.textBg ?? 'transparent' }}>
          </button>
          <span className="text-sm text-white/60">{layer.textBg ? layer.textBg.toUpperCase() : 'None'}</span>
          <input ref={textBgRef} type="color" value={layer.textBg ?? '#ffffff'}
            onPointerDown={() => textBgScrub.start(layer.textBg ?? '#ffffff')}
            onFocus={() => textBgScrub.start(layer.textBg ?? '#ffffff')}
            onChange={e => { textBgScrub.start(layer.textBg ?? '#ffffff'); updateLayer(layer.id, { textBg: e.target.value }) }}
            onBlur={e => textBgScrub.end(e.target.value)}
            className="sr-only" />
          <button onClick={() => textBgRef.current?.click()}
            className="text-white/30 text-lg ml-auto pr-1">›</button>
          {layer.textBg && (
            <button onClick={() => updateLayerWithHistory(layer.id, { textBg: null })}
              className="text-xs text-white/50 bg-white/10 px-2.5 py-1 rounded-full active:opacity-60">
              None
            </button>
          )}
        </div>
        {layer.textBg && (
          <div className="flex items-center gap-3 mt-2">
            <input type="range" min={0} max={100} step={1}
              value={Math.round((layer.textBgOpacity ?? 1) * 100)}
              onPointerDown={() => useStore.getState()._captureUndo()}
              onChange={e => updateLayer(layer.id, { textBgOpacity: +e.target.value / 100 })}
              onMouseUp={() => useStore.getState()._commitUndo()}
              onTouchEnd={() => useStore.getState()._commitUndo()}
              className="flex-1 accent-white" />
            <div className="bg-white/10 rounded-lg px-2.5 py-1.5 min-w-[56px] text-right shrink-0">
              <span className="text-white text-sm tabular-nums">{Math.round((layer.textBgOpacity ?? 1) * 100)}</span>
              <span className="text-white/40 text-[11px] ml-0.5">%</span>
            </div>
          </div>
        )}
      </div>

      {/* Letter spacing */}
      <div className="py-3 border-b border-white/8">
        <div className="text-sm font-semibold text-white mb-2.5">Letter Spacing</div>
        <div className="flex items-center gap-3">
          <input type="range" min={-20} max={200} step={1}
            value={layer.letterSpacing ?? 0}
            onChange={e => updateLayer(layer.id, { letterSpacing: +e.target.value })}
            onPointerDown={() => useStore.getState()._captureUndo()}
            onMouseUp={() => useStore.getState()._commitUndo()}
            onTouchEnd={() => useStore.getState()._commitUndo()}
            className="flex-1 accent-white" />
          <div className="bg-white/10 rounded-lg px-2.5 py-1.5 min-w-[56px] text-right shrink-0">
            <span className="text-white text-sm tabular-nums">{layer.letterSpacing ?? 0}</span>
            <span className="text-white/40 text-[11px] ml-0.5">px</span>
          </div>
        </div>
      </div>

      {/* Line height */}
      <div className="py-3 border-b border-white/8">
        <div className="text-sm font-semibold text-white mb-2.5">Line Height</div>
        <div className="flex items-center gap-3">
          <input type="range" min={0.8} max={3.0} step={0.05}
            value={layer.lineHeight ?? 1.2}
            onChange={e => updateLayer(layer.id, { lineHeight: +parseFloat(e.target.value).toFixed(2) })}
            onPointerDown={() => useStore.getState()._captureUndo()}
            onMouseUp={() => useStore.getState()._commitUndo()}
            onTouchEnd={() => useStore.getState()._commitUndo()}
            className="flex-1 accent-white" />
          <div className="bg-white/10 rounded-lg px-2.5 py-1.5 min-w-[56px] text-right shrink-0">
            <span className="text-white text-sm tabular-nums">{(layer.lineHeight ?? 1.2).toFixed(2)}</span>
            <span className="text-white/40 text-[11px] ml-0.5">×</span>
          </div>
        </div>
      </div>

      {/* Opacity */}
      <div className="py-3">
        <div className="text-sm font-semibold text-white mb-2.5">Opacity</div>
        <div className="flex items-center gap-3">
          <input type="range" min={0} max={100} step={1}
            value={Math.round((layer.opacity ?? 1) * 100)}
            onChange={e => updateLayer(layer.id, { opacity: +e.target.value / 100 })}
            onPointerDown={() => useStore.getState()._captureUndo()}
            onMouseUp={() => useStore.getState()._commitUndo()}
            onTouchEnd={() => useStore.getState()._commitUndo()}
            className="flex-1 accent-white" />
          <div className="bg-white/10 rounded-lg px-2.5 py-1.5 min-w-[56px] text-right shrink-0">
            <span className="text-white text-sm tabular-nums">{Math.round((layer.opacity ?? 1) * 100)}</span>
            <span className="text-white/40 text-[11px] ml-0.5">%</span>
          </div>
        </div>
      </div>

    </div>
  )
}

// ─── Text quick formatting bar ──────────────────────────────────────────────────
// Always-visible compact row of the most-used text controls. Buttons preventDefault
// on mousedown so tapping them doesn't blur the inline canvas textarea (which would
// exit edit mode). Tap "More" to expand the full TextStylePanel.

function TextQuickBar({ layer, updateLayer, updateLayerWithHistory, moreActive, onToggleMore }) {
  const colorRef = useRef()
  const addRecentColor = useStore(s => s.addRecentColor)
  const colorScrub = useColorScrub()
  const size = layer.fontSize ?? 72
  const align = layer.align ?? 'center'

  // Keep the inline textarea focused when tapping formatting controls
  const keepFocus = e => e.preventDefault()

  const bumpSize = (delta) => updateLayerWithHistory(layer.id, { fontSize: Math.max(8, Math.min(400, size + delta)) })
  const cycleAlign = () => {
    const order = ['left', 'center', 'right']
    updateLayerWithHistory(layer.id, { align: order[(order.indexOf(align) + 1) % 3] })
  }
  const AlignIcon = align === 'left' ? IconTextAlignLeft : align === 'right' ? IconTextAlignRight : IconTextAlignCenter

  const cell = 'flex items-center justify-center h-10 rounded-xl transition-colors shrink-0'
  const toggle = on => on ? 'bg-white text-black' : 'bg-white/10 text-white/75 active:bg-white/20'

  return (
    <div className="flex items-center gap-1.5 px-3 py-2 overflow-x-auto scrollbar-hide">
      <button onMouseDown={keepFocus} onClick={() => updateLayerWithHistory(layer.id, { bold: !layer.bold })}
        className={`${cell} w-10 ${toggle(layer.bold)}`}><IconBold size={18} /></button>
      <button onMouseDown={keepFocus} onClick={() => updateLayerWithHistory(layer.id, { italic: !layer.italic })}
        className={`${cell} w-10 ${toggle(layer.italic)}`}><IconItalic size={18} /></button>

      <div className="w-px h-6 bg-white/15 mx-0.5 shrink-0" />

      {/* Size stepper */}
      <div className="flex items-center bg-white/10 rounded-xl h-10 shrink-0">
        <button onMouseDown={keepFocus} onClick={() => bumpSize(-2)}
          className="w-9 h-10 text-white/75 text-xl leading-none active:bg-white/10 rounded-l-xl">−</button>
        <span className="text-white text-sm tabular-nums w-9 text-center">{size}</span>
        <button onMouseDown={keepFocus} onClick={() => bumpSize(2)}
          className="w-9 h-10 text-white/75 text-xl leading-none active:bg-white/10 rounded-r-xl">+</button>
      </div>

      {/* Color */}
      <button onClick={() => colorRef.current?.click()}
        className={`${cell} w-10 bg-white/10 active:bg-white/20`}>
        <div className="w-5 h-5 rounded-full border-2 border-white/30" style={{ background: layer.color ?? '#000000' }} />
      </button>
      <input ref={colorRef} type="color" value={layer.color ?? '#000000'}
        onPointerDown={() => colorScrub.start(layer.color ?? '#000000')}
        onFocus={() => colorScrub.start(layer.color ?? '#000000')}
        onChange={e => { colorScrub.start(layer.color ?? '#000000'); updateLayer(layer.id, { color: e.target.value }) }}
        onBlur={e => { colorScrub.end(e.target.value); addRecentColor(e.target.value) }}
        className="sr-only" />

      {/* Align cycle */}
      <button onMouseDown={keepFocus} onClick={cycleAlign}
        className={`${cell} w-10 bg-white/10 text-white/75 active:bg-white/20`}><AlignIcon size={20} /></button>

      <div className="w-px h-6 bg-white/15 mx-0.5 shrink-0" />

      {/* More */}
      <button onMouseDown={keepFocus} onClick={onToggleMore}
        className={`${cell} px-3 gap-1 text-xs font-medium ${moreActive ? 'bg-white text-black' : 'bg-white/10 text-white/75 active:bg-white/20'}`}>
        <span className="text-sm font-bold">Aa</span> More
      </button>
    </div>
  )
}

// ─── Shape style panel ────────────────────────────────────────────────────────

function ShapeStylePanel({ layer, updateLayer, updateLayerWithHistory, setElementPanel }) {
  const fillRef   = useRef()
  const strokeRef = useRef()
  const addRecentColor = useStore(s => s.addRecentColor)
  const fillScrub   = useColorScrub()
  const strokeScrub = useColorScrub()

  const sw = layer.strokeWidth ?? 0
  const cr = layer.cornerRadius ?? 0

  return (
    <div className="px-4 pb-6 pt-2 overflow-y-auto" style={{ maxHeight: '62vh' }}>

      {/* Shape type toggle */}
      <div className="mb-4">
        <div className="text-xs text-white/35 uppercase tracking-wider mb-2">Shape</div>
        <div className="flex bg-white/8 rounded-xl p-0.5">
          <button
            onClick={() => updateLayerWithHistory(layer.id, { shapeType: 'rect' })}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-[10px] text-sm font-medium transition-colors ${
              (layer.shapeType ?? 'rect') === 'rect' ? 'bg-white/15 text-white' : 'text-white/45'
            }`}>
            <IconShapeRect size={18} /> Rect
          </button>
          <button
            onClick={() => updateLayerWithHistory(layer.id, { shapeType: 'circle' })}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-[10px] text-sm font-medium transition-colors ${
              layer.shapeType === 'circle' ? 'bg-white/15 text-white' : 'text-white/45'
            }`}>
            <IconShapeCircle size={18} /> Circle
          </button>
        </div>
      </div>

      {/* Fill color */}
      <div className="py-3 border-b border-white/8">
        <div className="text-sm font-semibold text-white mb-2.5">Fill</div>
        <RecentColors onSelect={c => { applyDiscrete(() => updateLayer(layer.id, { fill: c }), c !== (layer.fill ?? '#000000')); addRecentColor(c) }} />
        <button onClick={() => fillRef.current?.click()}
          className="flex items-center gap-3 active:opacity-60">
          <div className="w-8 h-8 rounded-full border-2 border-white/20"
            style={{ background: layer.fill ?? '#000000' }} />
          <span className="text-sm text-white/60">{(layer.fill ?? '#000000').toUpperCase()}</span>
          <span className="text-white/30 text-lg ml-auto pr-1">›</span>
        </button>
        <input ref={fillRef} type="color" value={layer.fill ?? '#000000'}
          onPointerDown={() => fillScrub.start(layer.fill ?? '#000000')}
          onFocus={() => fillScrub.start(layer.fill ?? '#000000')}
          onChange={e => { fillScrub.start(layer.fill ?? '#000000'); updateLayer(layer.id, { fill: e.target.value }) }}
          onBlur={e => { fillScrub.end(e.target.value); addRecentColor(e.target.value) }}
          className="sr-only" />
      </div>

      {/* Corner radius — rect only */}
      {(layer.shapeType ?? 'rect') !== 'circle' && (
        <div className="py-3 border-b border-white/8">
          <div className="text-sm font-semibold text-white mb-2.5">Corner Radius</div>
          <div className="flex items-center gap-3">
            <input type="range" min={0} max={240} step={1} value={cr}
              onPointerDown={() => useStore.getState()._captureUndo()}
              onChange={e => updateLayer(layer.id, { cornerRadius: +e.target.value })}
              onMouseUp={() => useStore.getState()._commitUndo()}
              onTouchEnd={() => useStore.getState()._commitUndo()}
              className="flex-1 accent-white" />
            <div className="bg-white/10 rounded-lg px-2.5 py-1.5 min-w-[64px] text-right shrink-0">
              <span className="text-white text-sm tabular-nums">{cr}</span>
              <span className="text-white/40 text-[11px] ml-0.5">px</span>
            </div>
          </div>
        </div>
      )}

      {/* Stroke width */}
      <div className="py-3 border-b border-white/8">
        <div className="text-sm font-semibold text-white mb-2.5">Stroke Width</div>
        <div className="flex items-center gap-3">
          <input type="range" min={0} max={30} step={1} value={sw}
            onChange={e => updateLayer(layer.id, { strokeWidth: +e.target.value })}
            onPointerDown={() => useStore.getState()._captureUndo()}
            onMouseUp={() => useStore.getState()._commitUndo()}
            onTouchEnd={() => useStore.getState()._commitUndo()}
            className="flex-1 accent-white" />
          <div className="bg-white/10 rounded-lg px-2.5 py-1.5 min-w-[64px] text-right shrink-0">
            <span className="text-white text-sm tabular-nums">{sw}</span>
            <span className="text-white/40 text-[11px] ml-0.5">px</span>
          </div>
        </div>
      </div>

      {/* Stroke color — only when stroke width > 0 */}
      {sw > 0 && (
        <div className="py-3 border-b border-white/8">
          <div className="text-sm font-semibold text-white mb-2.5">Stroke Color</div>
          <button onClick={() => strokeRef.current?.click()}
            className="flex items-center gap-3 active:opacity-60">
            <div className="w-8 h-8 rounded-full border-2 border-white/20"
              style={{ background: layer.stroke ?? '#000000' }} />
            <span className="text-sm text-white/60">{(layer.stroke ?? '#000000').toUpperCase()}</span>
            <span className="text-white/30 text-lg ml-auto pr-1">›</span>
          </button>
          <input ref={strokeRef} type="color" value={layer.stroke ?? '#000000'}
            onPointerDown={() => strokeScrub.start(layer.stroke ?? '#000000')}
            onFocus={() => strokeScrub.start(layer.stroke ?? '#000000')}
            onChange={e => { strokeScrub.start(layer.stroke ?? '#000000'); updateLayer(layer.id, { stroke: e.target.value }) }}
            onBlur={e => strokeScrub.end(e.target.value)}
            className="sr-only" />
        </div>
      )}

      {/* Opacity */}
      <div className="py-3">
        <div className="text-sm font-semibold text-white mb-2.5">Opacity</div>
        <div className="flex items-center gap-3">
          <input type="range" min={0} max={100} step={1}
            value={Math.round((layer.opacity ?? 1) * 100)}
            onChange={e => updateLayer(layer.id, { opacity: +e.target.value / 100 })}
            onPointerDown={() => useStore.getState()._captureUndo()}
            onMouseUp={() => useStore.getState()._commitUndo()}
            onTouchEnd={() => useStore.getState()._commitUndo()}
            className="flex-1 accent-white" />
          <div className="bg-white/10 rounded-lg px-2.5 py-1.5 min-w-[56px] text-right shrink-0">
            <span className="text-white text-sm tabular-nums">{Math.round((layer.opacity ?? 1) * 100)}</span>
            <span className="text-white/40 text-[11px] ml-0.5">%</span>
          </div>
        </div>
      </div>

    </div>
  )
}

// ─── Adjust panel ─────────────────────────────────────────────────────────────

function AdjustPanel({ layer, updateLayer, updateLayerWithHistory, setElementPanel }) {
  const b = layer.brightness ?? 0
  const c = layer.contrast   ?? 0
  const s = layer.saturation ?? 0
  const hasAdjustment = b !== 0 || c !== 0 || s !== 0

  return (
    <div className="border-t border-white/10">
      <div className="flex items-center justify-between px-4 pt-3 pb-0">
        <span className="text-[11px] text-white/35 uppercase tracking-wider">Adjust</span>
        <div className="flex items-center gap-3">
          {hasAdjustment && (
            <button
              onClick={() => updateLayerWithHistory(layer.id, { brightness: 0, contrast: 0, saturation: 0 })}
              className="text-white text-sm font-semibold active:opacity-60 bg-white/10 px-3 py-1 rounded-full">
              Reset
            </button>
          )}
          <button onClick={() => setElementPanel(null)} className="text-white/40">
            <IconClose size={18} />
          </button>
        </div>
      </div>
      <div className="px-5 pb-6 pt-2 space-y-0">
        {[
          { label: 'Brightness', key: 'brightness', val: b },
          { label: 'Contrast',   key: 'contrast',   val: c },
          { label: 'Saturation', key: 'saturation', val: s },
        ].map(({ label, key, val }) => (
          <div key={key} className="py-3 border-b border-white/8 last:border-0">
            <div className="text-sm font-semibold text-white mb-2.5">{label}</div>
            <div className="flex items-center gap-3">
              <input type="range" min={-100} max={100} step={1} value={val}
                onPointerDown={() => useStore.getState()._captureUndo()}
                onChange={e => updateLayer(layer.id, { [key]: +e.target.value })}
                onMouseUp={() => useStore.getState()._commitUndo()}
                onTouchEnd={() => useStore.getState()._commitUndo()}
                className="flex-1 accent-white" />
              <div className="bg-white/10 rounded-lg px-2.5 py-1.5 min-w-[64px] text-right shrink-0">
                <span className="text-white text-sm tabular-nums">{val > 0 ? `+${val}` : val}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Tabbed position panel ─────────────────────────────────────────────────────

function PositionPanel({ layer, activeLayerId, ratio, activeSlideIdx, layers, reorderLayer,
  updateLayer, updateLayerWithHistory, setElementPanel, isGroup, hideStyleTab, isText }) {
  const [tab, setTab] = useState('position')

  return (
    <div className="border-t border-white/10">
      {/* Tab bar */}
      <div className="flex items-center gap-2 px-4 pt-3 pb-0">
        {hideStyleTab ? (
          <div className="flex flex-1 items-center">
            <span className="text-[11px] text-white/35 uppercase tracking-wider">Position</span>
          </div>
        ) : (
          <div className="flex flex-1 bg-white/8 rounded-xl p-0.5">
            <button onClick={() => setTab('position')}
              className={`flex-1 py-1.5 rounded-[10px] text-sm font-medium transition-colors ${
                tab === 'position' ? 'bg-white/15 text-white' : 'text-white/45'
              }`}>Position</button>
            <button onClick={() => setTab('style')}
              className={`flex-1 py-1.5 rounded-[10px] text-sm font-medium transition-colors ${
                tab === 'style' ? 'bg-white/15 text-white' : 'text-white/45'
              }`}>Style</button>
          </div>
        )}
        <button onClick={() => setElementPanel(null)} className="text-white/40 pl-1">
          <IconClose size={18} />
        </button>
      </div>

      {(hideStyleTab || tab === 'position') ? (
        <PositionTab
          layer={layer} activeLayerId={activeLayerId} ratio={ratio}
          activeSlideIdx={activeSlideIdx} layers={layers}
          reorderLayer={reorderLayer} updateLayer={updateLayer}
          updateLayerWithHistory={updateLayerWithHistory} isGroup={isGroup} isText={isText} />
      ) : (
        <StyleTab
          layer={layer} activeLayerId={activeLayerId} layers={layers}
          updateLayer={updateLayer}
          isGroup={isGroup} />
      )}
    </div>
  )
}

// ─── Main toolbar ──────────────────────────────────────────────────────────────

export default function LayerToolbar() {
  const activeLayerId  = useStore(s => s.activeLayerId)
  const activeCellId   = useStore(s => s.activeCellId)
  const layers         = useStore(s => s.layers)
  const ratio          = useStore(s => s.ratio)
  const activeSlideIdx = useStore(s => s.activeSlideIdx)
  const deleteLayer    = useStore(s => s.deleteLayer)
  const deleteGroup    = useStore(s => s.deleteGroup)
  const updateLayer    = useStore(s => s.updateLayer)
  const updateLayerWithHistory = useStore(s => s.updateLayerWithHistory)
  const elementPanel   = useStore(s => s.elementPanel)
  const setElementPanel = useStore(s => s.setElementPanel)
  const reorderLayer   = useStore(s => s.reorderLayer)
  const setCropMode    = useStore(s => s.setCropMode)
  const cropMode       = useStore(s => s.cropMode)
  const setActiveCellId = useStore(s => s.setActiveCellId)
  const textEditId     = useStore(s => s.textEditId)
  const setTextEditId  = useStore(s => s.setTextEditId)
  const openPickerRef  = useCanvasPicker()

  const layer = layers.find(l => l.id === activeLayerId)
  if (!layer || cropMode) return null

  // ── Cell edit mode ────────────────────────────────────────────────────────
  if (activeCellId) {
    const cell = layers.find(l => l.id === activeCellId)
    const gap = cell ? (cell.cellGap ?? 0) : 0
    const innerW = cell ? cell.w - gap : 1
    const innerH = cell ? cell.h - gap : 1
    const minScale = cell
      ? Math.max(innerW / (cell.naturalW ?? 1), innerH / (cell.naturalH ?? 1))
      : 0.1
    const CellBtn = ({ label, active, onClick, primary }) => (
      <button onClick={onClick}
        className={`flex flex-col items-center gap-1 px-3 py-2 rounded-xl text-xs transition-colors active:opacity-60 ${
          primary ? 'text-white font-medium' : active ? 'text-blue-400' : 'text-white/60'
        }`}>
        {label}
      </button>
    )
    return (
      <div className="bg-black border-t border-white/10">
        {/* Top row: Done + label + actions */}
        <div className="flex items-center justify-between px-3 py-2">
          <button onClick={() => setActiveCellId(null)}
            className="text-white/50 text-sm active:text-white px-2">Done</button>
          <div className="flex items-center gap-1">
            {cell?.src && (
              <CellBtn label="Replace"
                primary
                onClick={() => openPickerRef?.current?.(activeCellId)} />
            )}
            {cell?.src && (
              <CellBtn label="Adjust"
                active={elementPanel === 'adjust'}
                onClick={() => setElementPanel('adjust')} />
            )}
            {!cell?.src && (
              <CellBtn label="Add photo"
                primary
                onClick={() => openPickerRef?.current?.(activeCellId)} />
            )}
          </div>
        </div>

        {/* Zoom slider (when image is set and no panel open) */}
        {cell?.src && !elementPanel && (
          <div className="px-4 pb-3 pt-1 border-t border-white/10">
            <div className="flex items-center gap-3">
              <span className="text-xs text-white/50 w-12 shrink-0">Zoom</span>
              <input type="range" min={minScale} max={minScale * 4} step={0.001}
                value={cell.imgScale ?? minScale}
                onChange={e => {
                  const newScale = parseFloat(e.target.value)
                  const curScale = cell.imgScale ?? minScale
                  const imgPtX = (innerW / 2 - (cell.imgX ?? 0)) / curScale
                  const imgPtY = (innerH / 2 - (cell.imgY ?? 0)) / curScale
                  const minImgX = Math.min(0, innerW - (cell.naturalW ?? cell.w) * newScale)
                  const minImgY = Math.min(0, innerH - (cell.naturalH ?? cell.h) * newScale)
                  const newImgX = Math.max(minImgX, Math.min(0, innerW / 2 - imgPtX * newScale))
                  const newImgY = Math.max(minImgY, Math.min(0, innerH / 2 - imgPtY * newScale))
                  updateLayer(activeCellId, { imgScale: newScale, imgX: newImgX, imgY: newImgY })
                }}
                onPointerDown={() => useStore.getState()._captureUndo()}
                onMouseUp={() => useStore.getState()._commitUndo()}
                onTouchEnd={() => useStore.getState()._commitUndo()}
                className="flex-1 accent-blue-500" />
              <span className="text-xs text-white/40 w-12 text-right shrink-0">
                {Math.round((cell.imgScale ?? minScale) / minScale * 100)}%
              </span>
            </div>
            <p className="text-[10px] text-white/30 text-center mt-2">Drag image to reposition</p>
          </div>
        )}

        {/* Adjust panel (brightness/contrast/saturation) */}
        {cell?.src && elementPanel === 'adjust' && (
          <AdjustPanel
            layer={cell} updateLayer={updateLayer}
            updateLayerWithHistory={updateLayerWithHistory}
            setElementPanel={setElementPanel} />
        )}
      </div>
    )
  }

  const Btn = ({ label, active, onClick, danger }) => (
    <button onClick={onClick}
      className={`flex flex-col items-center gap-1 px-2 py-2 rounded-xl text-xs transition-colors active:opacity-60 ${
        danger ? 'text-red-400' : active ? 'text-blue-400' : 'text-white/60'
      }`}>
      {label}
    </button>
  )

  // ── Group mode ────────────────────────────────────────────────────────────
  if (layer.locked) {
    const groupCells = layers.filter(l => l.groupId === layer.groupId)
    const emptyCount = groupCells.filter(l => !l.src).length
    const totalCount = groupCells.length
    // If there are empty cells, picker fills empties (count = empty).
    // If all cells are filled, picker replaces all (count = total).
    const replaceMode = emptyCount === 0
    const pickCount = replaceMode ? totalCount : emptyCount
    const pickLabel = replaceMode ? `Replace All (${totalCount})` : `Add Photos (${emptyCount})`

    return (
      <div className="bg-black border-t border-white/10">
        {/* Discoverability hint for per-cell editing */}
        {!elementPanel && (
          <div className="text-center text-[11px] text-white/40 px-3 pt-2 pb-0">
            Tap any photo to replace or edit it · {pickCount === 1 ? 'pick 1 photo' : `pick ${pickCount} photos`} below to fill all
          </div>
        )}
        <div className="flex items-center justify-between px-1 py-1">
          <Btn label={pickLabel} onClick={() => openPickerRef?.current?.(layer.id, null, true, replaceMode)} />
          <Btn label="Position" active={elementPanel === 'position'} onClick={() => setElementPanel('position')} />
          <Btn label="Delete" danger onClick={() => deleteGroup(layer.groupId)} />
          <button onClick={() => useStore.getState().setActiveLayer(null)} className="text-white/40 px-2">
            <IconClose size={18} />
          </button>
        </div>

        {elementPanel === 'position' && (
          <PositionPanel
            layer={layer} activeLayerId={activeLayerId} ratio={ratio}
            activeSlideIdx={activeSlideIdx} layers={layers}
            reorderLayer={reorderLayer} updateLayer={updateLayer}
            updateLayerWithHistory={updateLayerWithHistory}
            setElementPanel={setElementPanel} isGroup />
        )}
      </div>
    )
  }

  // ── Text layer ────────────────────────────────────────────────────────────
  if (layer.type === 'text') {
    const styleActive = elementPanel === 'text-style'
    const posActive   = elementPanel === 'position'

    const toggleStyle = () => setElementPanel(styleActive ? null : 'text-style')
    const togglePos   = () => setElementPanel(posActive ? null : 'position')

    return (
      <div className="bg-black border-t border-white/10">
        {/* Action row */}
        <div className="flex items-center justify-between px-1 pt-1">
          <Btn label="Position" active={posActive} onClick={togglePos} />
          <Btn label="Delete" danger onClick={() => deleteLayer(activeLayerId)} />
          <button
            onClick={() => { setTextEditId(null); useStore.getState().setActiveLayer(null) }}
            className="text-white/55 text-sm font-medium px-3 active:text-white">
            Done
          </button>
        </div>

        {/* Compact formatting bar — always visible */}
        {!posActive && (
          <TextQuickBar
            layer={layer}
            updateLayer={updateLayer}
            updateLayerWithHistory={updateLayerWithHistory}
            moreActive={styleActive}
            onToggleMore={toggleStyle}
          />
        )}

        {/* Expanded "More" panel */}
        {styleActive && !posActive && (
          <div className="border-t border-white/10">
            <TextStylePanel layer={layer} updateLayer={updateLayer} updateLayerWithHistory={updateLayerWithHistory} />
          </div>
        )}

        {posActive && (
          <PositionPanel
            layer={layer} activeLayerId={activeLayerId} ratio={ratio}
            activeSlideIdx={activeSlideIdx} layers={layers}
            reorderLayer={reorderLayer} updateLayer={updateLayer}
            updateLayerWithHistory={updateLayerWithHistory}
            setElementPanel={setElementPanel} isGroup={false}
            hideStyleTab isText />
        )}
      </div>
    )
  }

  // ── Shape layer ───────────────────────────────────────────────────────────
  if (layer.type === 'shape') {
    const shapeStyleActive = elementPanel === 'shape-style'
    const posActive        = elementPanel === 'position'

    const toggleShapeStyle = () => {
      if (shapeStyleActive) setElementPanel(null)
      else setElementPanel('shape-style')
    }
    const togglePos = () => {
      if (posActive) setElementPanel(null)
      else setElementPanel('position')
    }

    return (
      <div className="bg-black border-t border-white/10">
        <div className="flex items-center justify-between px-1 py-1">
          <Btn label="Style"    active={shapeStyleActive} onClick={toggleShapeStyle} />
          <Btn label="Position" active={posActive}         onClick={togglePos} />
          <Btn label="Delete"   danger onClick={() => deleteLayer(activeLayerId)} />
          <button onClick={() => useStore.getState().setActiveLayer(null)} className="text-white/40 px-2">
            <IconClose size={18} />
          </button>
        </div>

        {shapeStyleActive && (
          <div className="border-t border-white/10">
            <div className="flex items-center justify-between px-4 pt-3 pb-0">
              <span className="text-[11px] text-white/35 uppercase tracking-wider">Shape Style</span>
              <button onClick={() => setElementPanel(null)} className="text-white/40">
                <IconClose size={18} />
              </button>
            </div>
            <ShapeStylePanel
              layer={layer} updateLayer={updateLayer}
              updateLayerWithHistory={updateLayerWithHistory}
              setElementPanel={setElementPanel} />
          </div>
        )}

        {posActive && (
          <PositionPanel
            layer={layer} activeLayerId={activeLayerId} ratio={ratio}
            activeSlideIdx={activeSlideIdx} layers={layers}
            reorderLayer={reorderLayer} updateLayer={updateLayer}
            updateLayerWithHistory={updateLayerWithHistory}
            setElementPanel={setElementPanel} isGroup={false}
            hideStyleTab isText />
        )}
      </div>
    )
  }

  // ── Regular layer ─────────────────────────────────────────────────────────
  return (
    <div className="bg-black border-t border-white/10">
      <div className="flex items-center justify-between px-1 py-1">
        <Btn label="Replace" onClick={() => openPickerRef?.current?.(activeLayerId)} />
        <Btn label="Adjust" active={elementPanel === 'adjust'} onClick={() => setElementPanel('adjust')} />
        <Btn label="Position" active={elementPanel === 'position'} onClick={() => setElementPanel('position')} />
        <Btn label="Crop" onClick={() => setCropMode(true)} />
        <Btn label="Delete" danger onClick={() => deleteLayer(activeLayerId)} />
        <button onClick={() => useStore.getState().setActiveLayer(null)} className="text-white/40 px-2">
          <IconClose size={18} />
        </button>
      </div>

      {elementPanel === 'adjust' && (
        <AdjustPanel
          layer={layer} updateLayer={updateLayer}
          updateLayerWithHistory={updateLayerWithHistory}
          setElementPanel={setElementPanel} />
      )}

      {elementPanel === 'position' && (
        <PositionPanel
          layer={layer} activeLayerId={activeLayerId} ratio={ratio}
          activeSlideIdx={activeSlideIdx} layers={layers}
          reorderLayer={reorderLayer} updateLayer={updateLayer}
          updateLayerWithHistory={updateLayerWithHistory}
          setElementPanel={setElementPanel} isGroup={false} />
      )}
    </div>
  )
}
