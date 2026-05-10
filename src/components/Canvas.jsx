import { useRef, useEffect, useState, useCallback } from 'react'
import { Stage, Layer, Rect, Image as KImage, Group, Text } from 'react-konva'
import { useStore } from '../useStore'
import useImage from 'use-image'

function EmptyCell({ x, y, w, h, scale, onClick }) {
  const cw = w * scale
  const ch = h * scale
  const circleR = 20
  return (
    <Group x={x * scale} y={y * scale} onClick={onClick} onTap={onClick}>
      <Rect width={cw} height={ch} fill="#e0e0e0" />
      <Rect
        width={circleR * 2} height={circleR * 2}
        x={cw / 2 - circleR} y={ch / 2 - circleR}
        cornerRadius={circleR}
        fill="rgba(0,0,0,0.18)"
      />
      <Text
        text="+"
        fontSize={22}
        fill="rgba(0,0,0,0.45)"
        x={cw / 2 - 7}
        y={ch / 2 - 13}
        listening={false}
      />
    </Group>
  )
}

function FilledCell({ layer, scale, isSelected, onSelect, onDragEnd }) {
  const [img] = useImage(layer.src)
  const x = layer.x * scale
  const y = layer.y * scale
  const w = layer.w * scale
  const h = layer.h * scale

  return (
    <Group
      x={x} y={y} width={w} height={h}
      clipFunc={ctx => { ctx.rect(0, 0, w, h) }}
      draggable
      onClick={onSelect}
      onTap={onSelect}
      onDragStart={onSelect}
      onDragEnd={e => onDragEnd({ x: e.target.x() / scale, y: e.target.y() / scale })}
      opacity={layer.opacity ?? 1}
    >
      {img && (
        <KImage
          image={img}
          x={(layer.imgX ?? 0) * scale}
          y={(layer.imgY ?? 0) * scale}
          width={img.naturalWidth * (layer.imgScale ?? 1) * scale}
          height={img.naturalHeight * (layer.imgScale ?? 1) * scale}
        />
      )}
      {isSelected && (
        <Rect width={w} height={h} stroke="white" strokeWidth={2} listening={false} />
      )}
    </Group>
  )
}

export default function Canvas({ openPickerRef }) {
  const ratio = useStore(s => s.ratio)
  const bgColor = useStore(s => s.bgColor)
  const slides = useStore(s => s.slides)
  const activeSlideId = useStore(s => s.activeSlideId)
  const activeLayerId = useStore(s => s.activeLayerId)
  const setActiveLayer = useStore(s => s.setActiveLayer)
  const updateLayer = useStore(s => s.updateLayer)
  const updateLayerWithHistory = useStore(s => s.updateLayerWithHistory)
  const addImageLayer = useStore(s => s.addImageLayer)

  const containerRef = useRef()
  const fileRef = useRef()
  const pendingLayerId = useRef(null)
  const [containerSize, setContainerSize] = useState({ w: 300, h: 500 })

  const activeSlide = slides.find(s => s.id === activeSlideId)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(() => {
      setContainerSize({ w: el.offsetWidth, h: el.offsetHeight })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const PADDING = 20
  const scaleX = (containerSize.w - PADDING * 2) / ratio.w
  const scaleY = (containerSize.h - PADDING * 2) / ratio.h
  const scale = Math.min(scaleX, scaleY)
  const canvasW = ratio.w * scale
  const canvasH = ratio.h * scale

  const handleStageClick = useCallback((e) => {
    if (e.target === e.target.getStage()) setActiveLayer(null)
  }, [setActiveLayer])

  const openPickerForCell = useCallback((layerId) => {
    pendingLayerId.current = layerId
    fileRef.current?.click()
  }, [])

  // Expose picker to AddPanel and LayerToolbar
  useEffect(() => {
    if (openPickerRef) openPickerRef.current = (layerId = null) => openPickerForCell(layerId)
  }, [openPickerRef, openPickerForCell])

  const handleFileChange = (e) => {
    const file = e.target.files[0]
    if (!file) return
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      if (pendingLayerId.current) {
        const layer = activeSlide?.layers.find(l => l.id === pendingLayerId.current)
        const fitScale = layer
          ? Math.max(layer.w / img.naturalWidth, layer.h / img.naturalHeight)
          : 1
        updateLayerWithHistory(pendingLayerId.current, {
          src: url,
          naturalW: img.naturalWidth,
          naturalH: img.naturalHeight,
          imgScale: fitScale,
          imgX: 0,
          imgY: 0,
        })
        pendingLayerId.current = null
      } else {
        addImageLayer(url, img.naturalWidth, img.naturalHeight)
      }
    }
    img.src = url
    e.target.value = ''
  }

  return (
    <div ref={containerRef} className="flex-1 w-full flex items-center justify-center overflow-hidden">
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
      <div style={{ width: canvasW, height: canvasH, boxShadow: '0 4px 40px rgba(0,0,0,0.6)' }}>
        <Stage width={canvasW} height={canvasH} onClick={handleStageClick} onTap={handleStageClick}>
          <Layer>
            <Rect width={canvasW} height={canvasH} fill={bgColor} />
            {activeSlide?.layers.map(layer =>
              layer.src ? (
                <FilledCell
                  key={layer.id}
                  layer={layer}
                  scale={scale}
                  isSelected={activeLayerId === layer.id}
                  onSelect={() => setActiveLayer(layer.id)}
                  onDragEnd={pos => updateLayer(layer.id, pos)}
                />
              ) : (
                <EmptyCell
                  key={layer.id}
                  x={layer.x} y={layer.y} w={layer.w} h={layer.h}
                  scale={scale}
                  onClick={() => openPickerForCell(layer.id)}
                />
              )
            )}
          </Layer>
        </Stage>
      </div>
    </div>
  )
}
