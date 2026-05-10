// Each template defines cells as {x, y, w, h} in normalized 0-1 units
// relative to the canvas width/height

export const TEMPLATES = [
  {
    id: 'blank',
    label: 'Blank',
    cells: [],
  },
  {
    id: 'single',
    label: 'Single',
    cells: [{ x: 0, y: 0, w: 1, h: 1 }],
  },
  {
    id: 'split-h',
    label: 'Split H',
    cells: [
      { x: 0, y: 0, w: 0.5, h: 1 },
      { x: 0.5, y: 0, w: 0.5, h: 1 },
    ],
  },
  {
    id: 'split-v',
    label: 'Split V',
    cells: [
      { x: 0, y: 0, w: 1, h: 0.5 },
      { x: 0, y: 0.5, w: 1, h: 0.5 },
    ],
  },
  {
    id: 'big-left',
    label: 'Big Left',
    cells: [
      { x: 0, y: 0, w: 0.65, h: 1 },
      { x: 0.65, y: 0, w: 0.35, h: 0.5 },
      { x: 0.65, y: 0.5, w: 0.35, h: 0.5 },
    ],
  },
  {
    id: 'big-right',
    label: 'Big Right',
    cells: [
      { x: 0, y: 0, w: 0.35, h: 0.5 },
      { x: 0, y: 0.5, w: 0.35, h: 0.5 },
      { x: 0.35, y: 0, w: 0.65, h: 1 },
    ],
  },
  {
    id: 'top-big',
    label: 'Top Big',
    cells: [
      { x: 0, y: 0, w: 1, h: 0.65 },
      { x: 0, y: 0.65, w: 0.5, h: 0.35 },
      { x: 0.5, y: 0.65, w: 0.5, h: 0.35 },
    ],
  },
  {
    id: 'grid-4',
    label: 'Grid 4',
    cells: [
      { x: 0, y: 0, w: 0.5, h: 0.5 },
      { x: 0.5, y: 0, w: 0.5, h: 0.5 },
      { x: 0, y: 0.5, w: 0.5, h: 0.5 },
      { x: 0.5, y: 0.5, w: 0.5, h: 0.5 },
    ],
  },
  {
    id: 'three-col',
    label: '3 Col',
    cells: [
      { x: 0, y: 0, w: 0.333, h: 1 },
      { x: 0.333, y: 0, w: 0.334, h: 1 },
      { x: 0.667, y: 0, w: 0.333, h: 1 },
    ],
  },
  {
    id: 'three-row',
    label: '3 Row',
    cells: [
      { x: 0, y: 0, w: 1, h: 0.333 },
      { x: 0, y: 0.333, w: 1, h: 0.334 },
      { x: 0, y: 0.667, w: 1, h: 0.333 },
    ],
  },
]

export const RATIOS = [
  { label: 'Portrait', value: '4:5', w: 1080, h: 1350 },
  { label: 'Portrait', value: '3:4', w: 1080, h: 1440 },
  { label: 'Square', value: '1:1', w: 1080, h: 1080 },
  { label: 'Story', value: '9:16', w: 1080, h: 1920 },
  { label: 'Landscape', value: '1.91:1', w: 1080, h: 566 },
]
