import { useId, useRef, useState, type KeyboardEvent } from 'react'

export type PlannerPerson = {
  id: string
  full_name: string
  role: string
  avatar_url?: string | null
  is_active: boolean
}

type PlannerPeoplePickerProps = {
  people: PlannerPerson[]
  value: string[]
  onChange: (personIds: string[]) => void
  label?: string
  placeholder?: string
  disabled?: boolean
  readOnly?: boolean
  className?: string
}

type PlannerAssigneeAvatarsProps = {
  people: PlannerPerson[]
  maxVisible?: number
  size?: 'sm' | 'md'
  className?: string
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  return `${parts[0][0] ?? ''}${parts.length > 1 ? parts.at(-1)?.[0] ?? '' : ''}`.toUpperCase()
}

function PersonAvatar({ person, size = 'md' }: { person: PlannerPerson; size?: 'sm' | 'md' }) {
  const sizeClass = size === 'sm' ? 'h-7 w-7 text-[10px]' : 'h-9 w-9 text-xs'

  return (
    <span
      className={`relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-brand-accent/15 font-bold text-brand-accent ${sizeClass}`}
      title={`${person.full_name}, ${person.role}${person.is_active ? '' : ', inactive'}`}
      aria-hidden="true"
    >
      {initials(person.full_name)}
      {person.avatar_url && (
        <img
          src={person.avatar_url}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
          onError={event => { event.currentTarget.style.display = 'none' }}
        />
      )}
    </span>
  )
}

export function PlannerAssigneeAvatars({
  people,
  maxVisible = 3,
  size = 'sm',
  className = '',
}: PlannerAssigneeAvatarsProps) {
  const visible = people.slice(0, Math.max(0, maxVisible))
  const overflow = Math.max(0, people.length - visible.length)
  const names = people.map(person => person.full_name).join(', ')

  if (people.length === 0) {
    return <span className={`text-xs text-brand-primary/45 ${className}`}>Unassigned</span>
  }

  return (
    <div className={`flex items-center -space-x-1.5 ${className}`} aria-label={`Assigned to ${names}`} title={names}>
      {visible.map(person => <PersonAvatar key={person.id} person={person} size={size} />)}
      {overflow > 0 && (
        <span
          className={`${size === 'sm' ? 'h-7 min-w-7 text-[10px]' : 'h-9 min-w-9 text-xs'} relative inline-flex items-center justify-center rounded-full border border-white/10 bg-[#242424] px-1 font-bold text-white`}
          aria-label={`${overflow} more assignee${overflow === 1 ? '' : 's'}`}
          title={people.slice(visible.length).map(person => person.full_name).join(', ')}
        >
          +{overflow}
        </span>
      )}
    </div>
  )
}

export function PlannerPeoplePicker({
  people,
  value,
  onChange,
  label = 'Assignees',
  placeholder = 'Search active people',
  disabled = false,
  readOnly = false,
  className = '',
}: PlannerPeoplePickerProps) {
  const inputId = useId()
  const listboxId = `${inputId}-listbox`
  const inputRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const locked = disabled || readOnly
  const selectedPeople = value.flatMap(id => {
    const person = people.find(candidate => candidate.id === id)
    return person ? [person] : []
  })
  const normalizedQuery = query.trim().toLowerCase()
  const options = people.filter(person => (
    person.is_active
    && (!normalizedQuery || person.full_name.toLowerCase().includes(normalizedQuery))
  ))
  const highlightedPerson = options[highlightedIndex]

  function toggle(person: PlannerPerson) {
    if (locked || !person.is_active) return
    onChange(value.includes(person.id)
      ? value.filter(personId => personId !== person.id)
      : [...value, person.id])
    setQuery('')
    setHighlightedIndex(-1)
    inputRef.current?.focus()
  }

  function remove(personId: string) {
    if (!locked) onChange(value.filter(id => id !== personId))
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (locked) return
    if (event.key === 'Escape') {
      event.stopPropagation()
      setOpen(false)
      setQuery('')
      setHighlightedIndex(-1)
      return
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      setOpen(true)
      if (options.length === 0) return
      const direction = event.key === 'ArrowDown' ? 1 : -1
      setHighlightedIndex(current => current === -1
        ? event.key === 'ArrowDown' ? 0 : options.length - 1
        : (current + direction + options.length) % options.length)
      return
    }
    if (event.key === 'Enter' && open && highlightedPerson) {
      event.preventDefault()
      toggle(highlightedPerson)
    }
  }

  return (
    <div
      className={`relative ${className}`}
      onBlur={event => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false)
      }}
    >
      <label htmlFor={inputId} className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-brand-primary/60">
        {label}
      </label>

      <div className="mb-2 flex min-h-9 flex-wrap items-center gap-1.5" aria-live="polite">
        {selectedPeople.length === 0 && <span className="text-sm text-brand-primary/45">Unassigned</span>}
        {selectedPeople.map(person => (
          <span
            key={person.id}
            className={`inline-flex min-h-9 items-center gap-1.5 rounded-full border px-1.5 py-1 pl-1 text-xs font-semibold ${person.is_active ? 'border-brand-teal/25 bg-brand-teal/[0.08] text-white' : 'border-amber-400/25 bg-amber-400/[0.08] text-amber-100'}`}
            title={`${person.full_name}, ${person.role}${person.is_active ? '' : ', inactive'}`}
          >
            <PersonAvatar person={person} size="sm" />
            <span>
              {person.full_name}
              <span className="ml-1 font-normal text-brand-primary/55">{person.role}</span>
              {!person.is_active && <span className="ml-1 font-normal text-amber-300">Inactive</span>}
            </span>
            {!locked && (
              <button
                type="button"
                onClick={() => remove(person.id)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full text-lg leading-none text-brand-primary/60 hover:bg-white/10 hover:text-white focus:outline-none focus:ring-2 focus:ring-brand-accent"
                aria-label={`Remove ${person.full_name}`}
                title={`Remove ${person.full_name}`}
              >
                &times;
              </button>
            )}
          </span>
        ))}
      </div>

      {!readOnly && (
        <input
          ref={inputRef}
          id={inputId}
          type="search"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-activedescendant={open && highlightedPerson ? `${listboxId}-${highlightedPerson.id}` : undefined}
          aria-haspopup="listbox"
          autoComplete="off"
          value={query}
          disabled={disabled}
          placeholder={disabled ? 'Assignment unavailable' : placeholder}
          onFocus={() => {
            if (!disabled) setOpen(true)
          }}
          onChange={event => {
            setQuery(event.target.value)
            setHighlightedIndex(-1)
            setOpen(true)
          }}
          onKeyDown={handleKeyDown}
          className="min-h-11 w-full rounded-lg border border-white/10 bg-[#111111] px-3 py-2.5 text-base text-white placeholder:text-brand-primary/40 focus:outline-none focus:ring-2 focus:ring-brand-accent disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm"
        />
      )}

      {open && !locked && (
        <div
          id={listboxId}
          role="listbox"
          aria-label="Active people"
          aria-multiselectable="true"
          className="absolute z-30 mt-1 max-h-72 w-full overflow-y-auto rounded-lg border border-white/10 bg-[#151515] p-1 shadow-2xl"
        >
          {options.map((person, index) => {
            const selected = value.includes(person.id)
            const highlighted = index === highlightedIndex
            return (
              <button
                key={person.id}
                id={`${listboxId}-${person.id}`}
                type="button"
                role="option"
                aria-selected={selected}
                onMouseDown={event => event.preventDefault()}
                onMouseEnter={() => setHighlightedIndex(index)}
                onClick={() => toggle(person)}
                className={`flex min-h-12 w-full items-center gap-3 rounded-md px-2.5 py-2 text-left transition-colors ${highlighted ? 'bg-brand-teal/[0.1]' : 'hover:bg-white/[0.05]'}`}
                title={`${selected ? 'Remove' : 'Assign'} ${person.full_name}, ${person.role}`}
              >
                <PersonAvatar person={person} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-white">{person.full_name}</span>
                  <span className="block truncate text-xs capitalize text-brand-primary/55">{person.role}</span>
                </span>
                <span className={`text-xs font-semibold ${selected ? 'text-brand-teal' : 'text-brand-primary/45'}`}>
                  {selected ? 'Remove' : 'Add'}
                </span>
              </button>
            )
          })}
          {options.length === 0 && (
            <p className="px-3 py-3 text-sm text-brand-primary/55">No matching active people.</p>
          )}
        </div>
      )}
    </div>
  )
}
