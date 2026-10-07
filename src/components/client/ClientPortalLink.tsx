import { Link, type LinkProps } from 'react-router-dom'
import { useOptionalClientPortal } from './ClientPortalContext'
import { portalPreviewPath } from '../../lib/clientPortalPreviewPolicy'

/** Keep client navigation inside an exact, read-only staff preview when present. */
export function ClientPortalLink({ to, ...props }: LinkProps) {
  const previewClientId = useOptionalClientPortal()?.previewClientId
  const target = previewClientId && typeof to === 'string' && (to === '/client' || to.startsWith('/client/'))
    ? portalPreviewPath(previewClientId, to) : to
  return <Link {...props} to={target} />
}
