import { useRef, useEffect, useState, useCallback } from 'react'
import { Stage, Layer, Rect, Image as KImage, Group, Text, Line } from 'react-konva'
import { useStore, fitInCell } from '../useStore'
import useImage from 'use-image'

const SLIDE_GAP = 3 // visual px gap between slides (not in export space)
const HANDLE_SIZE = 10
const BORDER_COLOR = '#3b82f6' // blue-500, visible on any bg

function EmptyCell({ x, y, w, h, scale, slideOffsetPx, onClick }) {
  const cx = (x + slideOffsetPx) * scale
  const cy = y * scale
  const cw = w * scale
  const ch = h * scale
  const r = 20
  return (
    <Group x={cx} y={cy} onClick={onClick} onTap={onClick}>
      <Rect width={cw} height={ch} fill="#e0e0e0" />
      <Rect width={r * 2} height={r * 2} x={cw / 2 - r} y={ch / 2 - r} cornerRadius={r} fill="rgba(0,0,0,0.18)" />
      <Text text="+" fontSize={22} fill="rgba(0,0,0,0.45)" x={cw / 2 - 7} y={ch / 2 - 13} listening={false} />
    </Group>
  )
}

function FilledCell({ layer, scale, slideOffsetPx, isSelected, isCropTarget, onSelect, onDragEnd }) {
  const [img] = useImage(layer.src)
  const x = (layer.x + slideOffsetPx) * scale
  const y = layer.y * scale
  const w = layer.w * scale
  const h = layer.h * scale

  const imgX = (layer.imgX ?? 0) * scale
  const imgY = (layer.imgY ?? 0) * scale
  const imgW = img ? img.naturalWidth * (layer.imgScale ?? 1) * scale : 0
  const imgH = img ? img.naturalHeight * (layer.imgScale ?? 1) * scale : 0

  if (isCropTarget) {
    // In crop mode: show full image faded, clip region at full opacity
    return (
      <Group>
        {/* Faded full image outside clip */}
        {img && (
          <KImage image={img} x={x + imgX} y={y + imgY} width={imgW} height={imgH} opacity={0.2} listening={false} />
        )}
        {/* Full opacity within clip */}
        <Group clipFunc={ctx => ctx.rect(x, y, w, h)} listening={false}>
          {img && <KImage image={img} x={x + imgX} y={y + imgY} width={imgW} height={imgH} opacity={1} />}
        </Group>
        {/* Dashed cell border */}
        <Rect x={x} y={y} width={w} height={h} stroke="white" strokeWidth={1.5} dash={[6, 4]} listening={false} />
      </Group>
    )
  }

  return (
    <Group
      x={x} y={y} width={w} height={h}
      clipFunc={ctx => ctx.rect(0, 0, w, h)}
      draggable
      onClick={onSelect}
      onTap={onSelect}
      onDragStart={onSelect}
      onDragEnd={e => onDragEnd({ x: e.target.x() / scale - slideOffsetPx, y: e.target.y() / scale })}
      opacity={layer.opacity ?? 1}
    >
      {img && <KImage image={img} x={imgX} y={imgY} width={imgW} height={imgH} />}

      {/* Selection border + handles */}
      {isSelected && (
        <>
          <Rect width={w} height={h} stroke={BORDER_COLOR} strokeWidth={2} listening={false} />
          {/* Corner handles */}
          {[[0,0],[w,0],[0,h],[w,h]].map(([hx, hy], i) => (
            <Rect key={i} x={hx - HANDLE_SIZE/2} y={hy - HANDLE_SIZE/2}
              width={HANDLE_SIZE} height={HANDLE_SIZE}
              fill="white" stroke={BORDER_COLOR} strokeWidth={1.5}
              cornerRadius={2} listening={false}
            />
          ))}
        </>
      )}
    </Group>
  )
}

export default function Canvas({ openPickerRef }) {
  const ratio = useStore(s => s.ratio)
  const bgColor = useStore(s => s.bgColor)
  const slides = useStore(s => s.slides)
  const layers = useStore(s => s.layers)
  const activeSlideIdx = useStore(s => s.activeSlideIdx)
  const activeLayerId = useStore(s => s.activeLayerId)
  const cropMode = useStore(s => s.cropMode)
  const setActiveLayer = useStore(s => s.setActiveLayer)
  const setActiveSlide = useStore(s => s.setActiveSlide)
  const updateLayer = useStore(s => s.updateLayer)
  const updateLayerWithHistory = useStore(s => s.updateLayerWithHistory)
  const addImageLayer = useStore(s => s.addImageLayer)
  const fillCells = useStore(s => s.fillCells)

  const containerRef = useRef()
  const fileRef = useRef()
  const pendingLayerId = useRef(null)
  const pendingSlideIdx = useRef(null)
  const isMulti = useRef(false)
  const [containerSize, setContainerSize] = useState({ w: 300, h: 500 })

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setContainerSize({ w: el.offsetWidth, h: el.offsetHeight }))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const PADDING = 20
  const scaleY = (containerSize.h - PADDING * 2) / ratio.h
  const scaleX = (containerSize.w - PADDING * 2) / ratio.w
  const scale = Math.min(scaleX, scaleY, scaleY) // fit height, allow horizontal scroll

  const slideW = ratio.w * scale
  const slideH = ratio.h * scale
  const totalW = slides.length * slideW + (slides.length - 1) * SLIDE_GAP

  // Visual x offset for slide N on the canvas (accounts for gaps)
  const slideVisualX = (idx) => idx * (slideW + SLIDE_GAP)
  // Export-space offset for slide N (no gaps in export)
  const slideExportOffset = (idx) => -idx * ratio.w

  const handleStageClick = useCallback((e) => {
    if (e.target === e.target.getStage()) setActiveLayer(null)
  }, [setActiveLayer])

  const openPickerForCell = useCallback((layerId, slideIdx, multi = false) => {
    pendingLayerId.current = layerId
    pendingSlideIdx.current = slideIdx
    isMulti.current = multi
    if (fileRef.current) {
      fileRef.current.multiple = multi
      fileRef.current.click()
    }
  }, [])

  useEffect(() => {
    if (openPickerRef) openPickerRef.current = (layerId = null, slideIdx = null, multi = false) =>
      openPickerForCell(layerId, slideIdx ?? activeSlideIdx, multi)
  }, [openPickerRef, openPickerForCell, activeSlideIdx])

  const handleFileChange = (e) => {
    const files = [...e.target.files]
    if (!files.length) return

    if (isMulti.current && files.length > 1) {
      // Multi-select: fill empty cells in order
      fillCells(files)
    } else {
      const file = files[0]
      const url = URL.createObjectURL(file)
      const img = new Image()
      img.onload = () => {
        if (pendingLayerId.current) {
          const layer = useStore.getState().layers.find(l => l.id === pendingLayerId.current)
          if (layer) {
            const fit = fitInCell(img.naturalWidth, img.naturalHeight, layer.w, layer.h)
            updateLayerWithHistory(pendingLayerId.current, { src: url, naturalW: img.naturalWidth, naturalH: img.naturalHeight, ...fit })
          }
          pendingLayerId.current = null
        } else {
          addImageLayer(url, img.naturalWidth, img.naturalHeight, pendingSlideIdx.current ?? activeSlideIdx)
        }
      }
      img.src = url
    }
    e.target.value = ''
  }

  const activeLayer = layers.find(l => l.id === activeLayerId)

  return (
    <div ref={containerRef} className="flex-1 w-full flex flex-col items-center justify-center overflow-hidden">
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />

      {/* Horizontally scrollable canvas area */}
      <div
        className="overflow-x-auto overflow-y-hidden"
        style={{ maxWidth: '100%', width: totalW + PADDING * 2 }}
      >
        <div style={{ padding: PADDING, width: totalW + PADDING * 2 }}>
          <Stage
            width={totalW}
            height={slideH}
            onClick={handleStageClick}
            onTap={handleStageClick}
            style={{ display: 'block', boxShadow: '0 4px 40px rgba(0,0,0,0.5)' }}
          >
            <Layer>
              {/* Slide backgrounds */}
              {slides.map((slide, i) => (
                <Rect
                  key={slide.id}
                  x={slideVisualX(i)} y={0}
                  width={slideW} height={slideH}
                  fill={bgColor}
                  onClick={() => setActiveSlide(i)}
                  onTap={() => setActiveSlide(i)}
                />
              ))}

              {/* Active slide indicator */}
              <Rect
                x={slideVisualX(activeSlideIdx)} y={0}
                width={slideW} height={slideH}
                stroke={BORDER_COLOR} strokeWidth={2}
                listening={false}
              />

              {/* Slide dividers */}
              {slides.slice(1).map((_, i) => (
                <Line
                  key={i}
                  points={[slideVisualX(i + 1) - SLIDE_GAP / 2, 0, slideVisualX(i + 1) - SLIDE_GAP / 2, slideH]}
                  stroke="#333" strokeWidth={SLIDE_GAP}
                  listening={false}
                />
              ))}

              {/* Crop mode dark overlay */}
              {cropMode && (
                <Rect width={totalW} height={slideH} fill="rgba(0,0,0,0.75)" listening={false} />
              )}

              {/* Layers */}
              {layers.map(layer => {
                // Figure out which visual slide offset to use based on layer's global x
                const lSlideIdx = Math.floor(layer.x / ratio.w)
                // Visual offset: gap adjustments for slide index
                const visualOffset = slideVisualX(lSlideIdx) - lSlideIdx * slideW

                if (cropMode && layer.id === activeLayerId) {
                  return (
                    <FilledCell
                      key={layer.id}
                      layer={layer}
                      scale={scale}
                      slideOffsetPx={visualOffset / scale}
                      isSelected={false}
                      isCropTarget={true}
                      onSelect={() => {}}
                      onDragEnd={() => {}}
                    />
                  )
                }
                if (cropMode) return null // hide other layers in crop mode

                return layer.src ? (
                  <FilledCell
                    key={layer.id}
                    layer={layer}
                    scale={scale}
                    slideOffsetPx={visualOffset / scale}
                    isSelected={activeLayerId === layer.id}
                    isCropTarget={false}
                    onSelect={() => setActiveLayer(layer.id)}
                    onDragEnd={pos => updateLayer(layer.id, pos)}
                  />
                ) : (
                  <EmptyCell
                    key={layer.id}
                    x={layer.x} y={layer.y} w={layer.w} h={layer.h}
                    scale={scale}
                    slideOffsetPx={visualOffset / scale}
                    onClick={() => {
                      const si = Math.floor(layer.x / ratio.w)
                      const emptyInSlide = layers.filter(l => !l.src && Math.floor(l.x / ratio.w) === si)
                      openPickerForCell(layer.id, si, emptyInSlide.length > 1)
                    }}
                  />
                )
              })}
            </Layer>
          </Stage>
        </div>
      </div>

      {/* Crop mode controls */}
      {cropMode && activeLayer && (
        <CropControls layer={activeLayer} scale={scale} />
      )}
    </div>
  )
}

function CropControls({ layer, scale }) {
  const updateLayer = useStore(s => s.updateLayer)
  const updateLayerWithHistory = useStore(s => s.updateLayerWithHistory)
  const setCropMode = useStore(s => s.setCropMode)

  const maxPanX = layer.w * 0.9
  const maxPanY = layer.h * 0.9

  return (
    <div className="w-full bg-black/90 px-5 pt-3 pb-4">
      <div className="flex items-center justify-between mb-3">
        <button onClick={() => setCropMode(false)} className="text-white/50 text-sm">Cancel</button>
        <span className="text-xs text-white/40 uppercase tracking-wider">Crop & Position</span>
        <button
          onClick={() => { updateLayerWithHistory(layer.id, {}); setCropMode(false) }}
          className="text-white text-sm font-semibold"
        >Done</button>
      </div>
      <div className="space-y-3">
        <SliderRow label="Scale" min={0.1} max={5} step={0.01} value={layer.imgScale}
          onChange={v => updateLayer(layer.id, { imgScale: v })}
          onDone={() => updateLayerWithHistory(layer.id, {})}
          display={`${layer.imgScale.toFixed(2)}×`}
        />
        <SliderRow label="Pan X" min={-maxPanX} max={maxPanX} step={1} value={layer.imgX ?? 0}
          onChange={v => updateLayer(layer.id, { imgX: v })}
          onDone={() => updateLayerWithHistory(layer.id, {})}
        />
        <SliderRow label="Pan Y" min={-maxPanY} max={maxPanY} step={1} value={layer.imgY ?? 0}
          onChange={v => updateLayer(layer.id, { imgY: v })}
          onDone={() => updateLayerWithHistory(layer.id, {})}
        />
      </div>
    </div>
  )
}

function SliderRow({ label, min, max, step, value, onChange, onDone, display }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-white/50 w-12 shrink-0">{label}</span>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        onMouseUp={onDone} onTouchEnd={onDone}
        className="flex-1 accent-blue-500"
      />
      {display && <span className="text-xs text-white/40 w-12 text-right shrink-0">{display}</span>}
    </div>
  )
}
