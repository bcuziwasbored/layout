import { useState, useRef, useEffect, useCallback } from 'react'
import { useStore } from '../useStore'
import { dbGetAll, dbPut, dbDelete } from '../db'
import { IconClose } from './icons'

// Instagram's hard caption limit, and the point after which IG collapses the
// caption behind a "… more" link in the feed. Surfaced to the user so they can
// front-load the important words (issue #71).
const IG_LIMIT = 2200
const IG_TRUNCATE = 125

const uid = () => Math.random().toString(36).slice(2)

// ─── Hashtag groups (global, IDB-persisted in the 'hashtagGroups' store) ─────────

function normalizeTags(raw) {
  // Accept free text ("travel, wanderlust #beach") and normalize to space-joined
  // #tags. Splits on whitespace/commas, strips leading '#', drops empties.
  return raw
    .split(/[\s,]+/)
    .map(t => t.replace(/^#+/, '').trim())
    .filter(Boolean)
    .map(t => `#${t}`)
    .join(' ')
}

function GroupManager({ groups, onSaved, onDeleted }) {
  const [editingId, setEditingId] = useState(null)
  const [name, setName] = useState('')
  const [tags, setTags] = useState('')

  const reset = () => { setEditingId(null); setName(''); setTags('') }

  const startNew = () => { setEditingId('new'); setName(''); setTags('') }
  const startEdit = (g) => { setEditingId(g.id); setName(g.name); setTags(g.tags) }

  const save = async () => {
    const cleanTags = normalizeTags(tags)
    const cleanName = name.trim()
    if (!cleanName || !cleanTags) return
    const record = { id: editingId === 'new' ? uid() : editingId, name: cleanName, tags: cleanTags }
    await dbPut('hashtagGroups', record)
    reset()
    onSaved()
  }

  const remove = async (id) => {
    await dbDelete('hashtagGroups', id)
    if (editingId === id) reset()
    onDeleted()
  }

  return (
    <div className="mt-1">
      {groups.map(g => (
        <div key={g.id} className="flex items-center gap-2 py-1.5 border-b border-white/5">
          <div className="min-w-0 flex-1">
            <div className="text-sm text-white/85 truncate">{g.name}</div>
            <div className="text-[11px] text-white/40 truncate">{g.tags}</div>
          </div>
          <button
            onClick={() => startEdit(g)}
            className="text-[11px] text-white/50 active:text-white bg-white/10 px-2.5 py-1 rounded-full shrink-0">
            Rename
          </button>
          <button
            onClick={() => remove(g.id)}
            className="text-[11px] text-red-300/80 active:text-red-300 bg-red-500/10 px-2.5 py-1 rounded-full shrink-0">
            Delete
          </button>
        </div>
      ))}

      {editingId ? (
        <div className="mt-3 flex flex-col gap-2">
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Group name (e.g. Travel)"
            className="bg-white/8 text-white text-sm rounded-lg px-3 py-2 outline-none placeholder:text-white/30"
          />
          <input
            value={tags}
            onChange={e => setTags(e.target.value)}
            placeholder="#travel #wanderlust #sunset"
            className="bg-white/8 text-white text-sm rounded-lg px-3 py-2 outline-none placeholder:text-white/30"
          />
          <div className="flex gap-2">
            <button
              onClick={save}
              className="flex-1 py-2 rounded-lg bg-white text-black text-sm font-semibold active:opacity-70">
              {editingId === 'new' ? 'Add group' : 'Save'}
            </button>
            <button
              onClick={reset}
              className="px-4 py-2 rounded-lg bg-white/10 text-white/60 text-sm active:text-white">
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={startNew}
          className="mt-3 w-full py-2 rounded-lg bg-white/8 text-white/70 text-sm active:text-white">
          + New hashtag group
        </button>
      )}
    </div>
  )
}

export default function CaptionSheet({ onClose }) {
  const caption = useStore(s => s.caption)
  const setCaption = useStore(s => s.setCaption)

  const [groups, setGroups] = useState([])
  const [managing, setManaging] = useState(false)
  const textareaRef = useRef(null)

  const loadGroups = useCallback(async () => {
    try {
      const all = await dbGetAll('hashtagGroups')
      setGroups(all.sort((a, b) => a.name.localeCompare(b.name)))
    } catch {
      /* IDB unavailable — groups just stay empty */
    }
  }, [])

  // loadGroups is an async IDB read; its setGroups lands in a later tick, not
  // synchronously.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { loadGroups() }, [loadGroups])

  const len = caption.length
  const over = len > IG_LIMIT
  // Everything after IG_TRUNCATE is what IG hides behind "… more".
  const preview = caption.slice(0, IG_TRUNCATE)
  const hasHidden = len > IG_TRUNCATE

  // Insert a group's tags at the caret (or replace the selection), padding with a
  // space/newline so tags don't glue onto the preceding word. Restores focus and
  // places the caret after the inserted text.
  const insertTags = (tags) => {
    const el = textareaRef.current
    const start = el ? el.selectionStart : caption.length
    const end = el ? el.selectionEnd : caption.length
    const before = caption.slice(0, start)
    const after = caption.slice(end)
    const needsSpace = before.length > 0 && !/\s$/.test(before)
    const insertText = (needsSpace ? ' ' : '') + tags
    const next = before + insertText + after
    setCaption(next)
    const caret = before.length + insertText.length
    requestAnimationFrame(() => {
      if (!el) return
      el.focus()
      el.setSelectionRange(caret, caret)
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end" role="dialog" aria-label="Caption">
      {/* Backdrop */}
      <button
        aria-label="Close caption"
        onClick={onClose}
        className="absolute inset-0 bg-black/60"
      />

      <div
        className="relative bg-[#111] rounded-t-2xl p-5 max-h-[85vh] overflow-y-auto"
        style={{ paddingBottom: 'max(24px, env(safe-area-inset-bottom))' }}
      >
        <div className="flex items-center justify-between mb-4">
          <span className="font-semibold text-base">Caption</span>
          <button onClick={onClose} className="text-white/40 active:text-white"><IconClose size={18} /></button>
        </div>

        {/* Caption textarea */}
        <textarea
          ref={textareaRef}
          value={caption}
          onChange={e => setCaption(e.target.value)}
          placeholder="Write your caption… add hashtags, mentions, and line breaks just like Instagram."
          rows={6}
          className="w-full bg-white/5 text-white text-sm rounded-xl px-4 py-3 outline-none resize-none leading-relaxed placeholder:text-white/30"
        />

        {/* Counter + truncation marker */}
        <div className="flex items-center justify-between mt-2 text-[11px]">
          <span className="text-white/40">
            {hasHidden
              ? <>IG shows the first {IG_TRUNCATE} chars, then <span className="text-white/60">“… more”</span></>
              : `First ${IG_TRUNCATE} chars show in the feed`}
          </span>
          <span className={over ? 'text-red-400 font-semibold' : 'text-white/40'}>
            {len}/{IG_LIMIT}
          </span>
        </div>

        {/* Feed preview: what's visible before the "… more" cut */}
        {caption.trim() && (
          <div className="mt-3 px-3 py-2.5 rounded-xl bg-white/5">
            <div className="text-[10px] uppercase tracking-wide text-white/30 mb-1">Feed preview</div>
            <div className="text-sm text-white/80 whitespace-pre-wrap break-words">
              {preview}
              {hasHidden && <span className="text-white/40">… <span className="text-white/50 font-medium">more</span></span>}
            </div>
          </div>
        )}

        {/* Hashtag group chips — tap to insert at the caret */}
        <div className="flex items-center justify-between mt-5 mb-2">
          <span className="text-sm text-white/70 font-medium">Hashtag groups</span>
          <button
            onClick={() => setManaging(m => !m)}
            className="text-[11px] text-white/50 active:text-white bg-white/10 px-2.5 py-1 rounded-full">
            {managing ? 'Done' : 'Manage'}
          </button>
        </div>

        {groups.length === 0 && !managing && (
          <div className="text-[12px] text-white/35 py-2">
            No hashtag groups yet. Tap Manage to create a reusable set.
          </div>
        )}

        {!managing && groups.length > 0 && (
          <div className="flex gap-2 flex-wrap">
            {groups.map(g => (
              <button
                key={g.id}
                onClick={() => insertTags(g.tags)}
                className="text-xs text-white/80 bg-white/10 px-3 py-1.5 rounded-full active:bg-white/20 active:scale-95 transition-transform">
                {g.name}
              </button>
            ))}
          </div>
        )}

        {managing && (
          <GroupManager
            groups={groups}
            onSaved={loadGroups}
            onDeleted={loadGroups}
          />
        )}
      </div>
    </div>
  )
}
