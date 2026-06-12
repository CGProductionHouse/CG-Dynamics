import { useEffect, useMemo, useState } from 'react'
import { clientInitials, clientLogoCandidates } from '../lib/clientLogo'

export interface ClientLogoClient {
  name: string
  logo_url?: string | null
}

// Renders a client logo, trying clients.logo_url, then local
// /client-logos/<slug>.<ext> for each supported extension, then falling back
// to the client's initials. Each failed image advances to the next candidate.
export function ClientLogo({
  client,
  boxClassName = 'h-10 w-10 rounded-lg',
  imgClassName = 'p-1.5',
  textClassName = 'text-xs font-semibold text-brand-primary',
}: {
  client: ClientLogoClient
  boxClassName?: string
  imgClassName?: string
  textClassName?: string
}) {
  const candidates = useMemo(() => clientLogoCandidates(client), [client.name, client.logo_url])
  const [index, setIndex] = useState(0)

  // Restart the candidate walk whenever the client (and therefore its
  // candidate list) changes.
  useEffect(() => {
    setIndex(0)
  }, [candidates])

  const src = index < candidates.length ? candidates[index] : null

  return (
    <div className={`flex shrink-0 items-center justify-center overflow-hidden border border-brand-muted bg-brand-bg ${boxClassName}`}>
      {src ? (
        <img
          key={src}
          src={src}
          alt={`${client.name} logo`}
          onError={() => setIndex(current => current + 1)}
          className={`h-full w-full object-contain ${imgClassName}`}
        />
      ) : (
        <span className={textClassName}>{clientInitials(client.name)}</span>
      )}
    </div>
  )
}
