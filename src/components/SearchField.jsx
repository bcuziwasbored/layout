// The one search field every filtering surface uses (issue #91): the home
// project list and both template pickers.
//
// Behaviour is identical everywhere — type to filter, tap × to clear, Escape
// clears — so it lives in one component; only the skin differs. `variant="home"`
// wears the home redesign's language (#141518 fill, #26272C border, gold focus
// accent), `variant="panel"` wears the editor sheet's translucent white-on-#111.
//
// Nothing here reaches for a keyboard shortcut: the editor's global keydown
// handler (issue #86) already bails on `screen !== 'editor'` and on any focused
// INPUT, so typing in either placement is inert.

import { IconClose, IconSearch } from './icons'

const SKINS = {
  home: {
    wrap:  'flex items-center gap-2.5 h-10 rounded-xl px-3 bg-[#141518] border transition-colors',
    idle:  'border-[#26272C]',
    focus: 'border-[#C6A052]',
    icon:  'text-[#67666C]',
    input: 'flex-1 min-w-0 bg-transparent text-[14px] text-[#F5F4F1] placeholder-[#67666C] outline-none',
    clear: 'shrink-0 w-6 h-6 -mr-1 rounded-lg flex items-center justify-center text-[#67666C] active:text-[#F5F4F1]',
  },
  panel: {
    wrap:  'flex items-center gap-2 h-9 rounded-xl px-3 bg-white/8 border transition-colors',
    idle:  'border-white/10',
    focus: 'border-[#C6A052]',
    icon:  'text-white/35',
    input: 'flex-1 min-w-0 bg-transparent text-[13px] text-white placeholder-white/35 outline-none',
    clear: 'shrink-0 w-6 h-6 -mr-1 rounded-lg flex items-center justify-center text-white/35 active:text-white',
  },
}

export default function SearchField({
  value,
  onChange,
  variant = 'home',
  placeholder = 'Search templates',
  autoFocus = false,
}) {
  const skin = SKINS[variant] ?? SKINS.home
  return (
    <div className={`${skin.wrap} ${value ? skin.focus : skin.idle} focus-within:border-[#C6A052]`}>
      <span className={`shrink-0 flex ${skin.icon}`} aria-hidden>
        <IconSearch size={variant === 'panel' ? 15 : 17} />
      </span>
      <input
        type="search"
        value={value}
        autoFocus={autoFocus}
        onChange={e => onChange(e.target.value)}
        // Escape clears rather than closing the surface behind the field.
        onKeyDown={e => { if (e.key === 'Escape' && value) { e.stopPropagation(); onChange('') } }}
        placeholder={placeholder}
        aria-label={placeholder}
        enterKeyHint="search"
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        className={`${skin.input} [&::-webkit-search-cancel-button]:hidden`}
      />
      {value && (
        <button onClick={() => onChange('')} aria-label="Clear search" className={skin.clear}>
          <IconClose size={13} />
        </button>
      )}
    </div>
  )
}
