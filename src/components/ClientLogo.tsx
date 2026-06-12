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
  boxClassName = 'h-12 w-12 rounded-lg',
  padding = 'p-1.5',
  textClassName = 'text-sm font-semibold text-brand-primary',
}: {
  client: ClientLogoClient
  boxClassName?: string
  /** Inner padding so the logo never touches the edges of the box. */
  padding?: string
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

  // Padding lives on the wrapper; the image fills the padded content box and
  // is scaled with object-contain so landscape, square and portrait logos all
  // fit fully (never cropped) and stay centred.
  return (
    <div className={`flex shrink-0 items-center justify-center overflow-hidden border border-brand-muted bg-brand-bg ${boxClassName} ${padding}`}>
      {src ? (
        <img
          key={src}
          src={src}
          alt={`${client.name} logo`}
          onError={() => setIndex(current => current + 1)}
          className="h-full w-full object-contain object-center"
        />
      ) : (
        <span className={textClassName}>{clientInitials(client.name)}</span>
      )}
    </div>
  )
}
