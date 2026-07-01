import { useEffect, useMemo, useState } from 'react'
import { listActiveClients, type ClientOption } from '../lib/commandCentre'

type ClientPickerProps = {
  value: string | null
  label?: string | null
  onChange: (client: ClientOption | null) => void
  placeholder?: string
}

export function ClientPicker({
  value,
  label,
  onChange,
  placeholder = 'Search clients',
}: ClientPickerProps) {
  const [clients, setClients] = useState<ClientOption[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState(label ?? '')
  const [open, setOpen] = useState(false)

  useEffect(() => {
    let active = true
    setLoading(true)
    listActiveClients().then(({ data }) => {
      if (!active) return
      setClients(data ?? [])
      setLoading(false)
    }).catch(() => {
      if (active) setLoading(false)
    })
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (!value) {
      setQuery(label ?? '')
      return
    }
    const selected = clients.find(client => client.id === value)
    if (selected) setQuery(selected.name)
  }, [clients, label, value])

  const selected = clients.find(client => client.id === value) ?? null
  const filtered = useMemo(() => {
    const search = query.trim().toLowerCase()
    if (!search) return clients.slice(0, 8)
    return clients.filter(client => client.name.toLowerCase().includes(search)).slice(0, 8)
  }, [clients, query])

  function choose(client: ClientOption | null) {
    onChange(client)
    setQuery(client?.name ?? '')
    setOpen(false)
  }

  return (
    <div className="relative">
      {selected && (
        <div className="mb-2 flex items-center gap-2">
          <span className="rounded-full border border-brand-teal/25 bg-brand-teal/[0.08] px-2.5 py-0.5 text-xs font-semibold text-[#2dd4bf]">
            {selected.name}
          </span>
          <button
            type="button"
            onClick={() => choose(null)}
            className="text-xs text-brand-primary/55 transition-colors hover:text-white"
          >
            Clear
          </button>
        </div>
      )}
      <input
        value={query}
        onChange={event => {
          setQuery(event.target.value)
          setOpen(true)
          if (!event.target.value.trim()) onChange(null)
        }}
        onFocus={() => setOpen(true)}
        placeholder={loading ? 'Loading clients...' : placeholder}
        className="w-full rounded-lg border border-white/10 bg-[#111111] px-3 py-2 text-sm text-white placeholder:text-brand-primary/40 focus:outline-none focus:ring-1 focus:ring-brand-accent"
      />
      {open && !loading && (
        <div className="absolute z-30 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-white/10 bg-[#151515] p-1 shadow-2xl">
          <button
            type="button"
            onMouseDown={event => event.preventDefault()}
            onClick={() => choose(null)}
            className="block w-full rounded-md px-2.5 py-2 text-left text-sm text-brand-primary/65 hover:bg-white/[0.05] hover:text-white"
          >
            No client
          </button>
          {filtered.map(client => (
            <button
              key={client.id}
              type="button"
              onMouseDown={event => event.preventDefault()}
              onClick={() => choose(client)}
              className="block w-full rounded-md px-2.5 py-2 text-left text-sm text-white/80 hover:bg-brand-teal/[0.08] hover:text-white"
            >
              {client.name}
            </button>
          ))}
          {filtered.length === 0 && (
            <p className="px-2.5 py-2 text-sm text-amber-200">No matching active client.</p>
          )}
        </div>
      )}
    </div>
  )
}
