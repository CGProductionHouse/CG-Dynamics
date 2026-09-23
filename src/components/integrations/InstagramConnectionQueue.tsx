import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Client } from '../../lib/db/clients'
import { exactHandleMatches, instagramFleetEvidenceFor } from '../../lib/instagramConnectionQueue'
import { classifySocialProviderEligibility } from '../../lib/socialProviderEligibility'
import { supabase } from '../../lib/supabase'
import { StatusBadge } from '../ui/Badges'
import { ActionButton } from '../ui/Buttons'
import { PremiumCard, PremiumCardHeader } from '../ui/PremiumCard'

interface LinkedInstagramAsset {
  client_id: string
  facebook_page_id: string | null
  instagram_account_id: string | null
  instagram_not_applicable: boolean
}

interface ProviderPage {
  id: string
  instagramAccount: { id: string; username: string | null } | null
}

interface PendingConnection {
  id: string
  client_id: string
  instagram_account_id: string
  instagram_username: string
  account_type: 'business' | 'creator'
  status: 'pending_review' | 'connected' | 'needs_reauth' | 'revoked' | 'rejected'
  confirmed_asset_id: string | null
  last_connected_at: string
}

interface Props {
  clients: Client[]
  linkedAssets: LinkedInstagramAsset[]
  providerPages: ProviderPage[]
  providerAssetsLoaded: boolean
  onLoadProviderAssets: () => void
  onCanonicalMappingChanged: () => Promise<void>
}

export function InstagramConnectionQueue({
  clients,
  linkedAssets,
  providerPages,
  providerAssetsLoaded,
  onLoadProviderAssets,
  onCanonicalMappingChanged,
}: Props) {
  const [connections, setConnections] = useState<PendingConnection[]>([])
  const [loading, setLoading] = useState(true)
  const [busyClientId, setBusyClientId] = useState<string | null>(null)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)

  const loadConnections = useCallback(async () => {
    setLoading(true)
    const activeIds = clients
      .filter(client => client.active && classifySocialProviderEligibility(client.package_settings).state === 'eligible')
      .map(client => client.id)
    if (activeIds.length === 0) {
      setConnections([])
      setLoading(false)
      return
    }
    const { data, error } = await supabase
      .from('meta_instagram_connections')
      .select('id, client_id, instagram_account_id, instagram_username, account_type, status, confirmed_asset_id, last_connected_at')
      .in('client_id', activeIds)
    if (error) {
      setMessage({ ok: false, text: 'Standalone Instagram review data is unavailable. Check the reviewed schema before activation.' })
      setConnections([])
    } else {
      setConnections((data ?? []) as PendingConnection[])
    }
    setLoading(false)
  }, [clients])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrate the server-owned review queue when the active-client scope changes
    void loadConnections()
  }, [loadConnections])

  const eligibility = useMemo(() => clients
    .filter(client => client.active)
    .map(client => ({ client, eligibility: classifySocialProviderEligibility(client.package_settings) })), [clients])
  const eligibleCount = eligibility.filter(item => item.eligibility.state === 'eligible').length
  const excludedCount = eligibility.filter(item => item.eligibility.state === 'excluded').length
  const unresolvedCount = eligibility.filter(item => item.eligibility.state === 'unresolved').length

  const queue = useMemo(() => eligibility
    .filter(item => item.eligibility.state === 'eligible')
    .map(item => item.client)
    .filter(client => !linkedAssets.some(asset => asset.client_id === client.id && (asset.instagram_account_id || asset.instagram_not_applicable)))
    .map(client => {
      const evidence = instagramFleetEvidenceFor(client.name)
      const link = linkedAssets.find(asset => asset.client_id === client.id)
      const providerPage = link?.facebook_page_id
        ? providerPages.find(page => page.id === link.facebook_page_id)
        : null
      return {
        client,
        evidence,
        connection: connections.find(item => item.client_id === client.id) ?? null,
        pageLinkedAccount: providerPage?.instagramAccount ?? null,
        hasFacebookPage: Boolean(link?.facebook_page_id),
      }
    }), [eligibility, connections, linkedAssets, providerPages])

  async function startStandalone(client: Client) {
    setBusyClientId(client.id)
    setMessage(null)
    try {
      const { data, error } = await supabase.functions.invoke('instagram-oauth-start', {
        method: 'POST',
        body: { clientId: client.id },
      })
      if (error || !data?.ok || typeof data.url !== 'string') {
        setMessage({ ok: false, text: data?.error ?? error?.message ?? 'Could not start Instagram Login.' })
        return
      }
      window.location.assign(data.url)
    } finally {
      setBusyClientId(null)
    }
  }

  async function confirmConnection(client: Client, connection: PendingConnection) {
    const exactReview = `${client.name} ↔ @${connection.instagram_username} (${connection.account_type})`
    if (!window.confirm(`Confirm this exact standalone Instagram mapping?\n\n${exactReview}\n\nThis makes it the client's canonical Instagram reporting identity.`)) return
    setBusyClientId(client.id)
    setMessage(null)
    try {
      const { data, error } = await supabase.functions.invoke('instagram-connection-confirm', {
        method: 'POST',
        body: {
          connectionId: connection.id,
          clientId: client.id,
          instagramAccountId: connection.instagram_account_id,
          instagramUsername: connection.instagram_username,
        },
      })
      if (error || !data?.ok) {
        setMessage({ ok: false, text: data?.error ?? error?.message ?? 'Could not confirm the exact Instagram mapping.' })
        return
      }
      await Promise.all([loadConnections(), onCanonicalMappingChanged()])
      setMessage({ ok: true, text: `${exactReview} is now the reviewed canonical Instagram mapping.` })
    } finally {
      setBusyClientId(null)
    }
  }

  return (
    <PremiumCard className="mt-6 w-full" padding="md" border>
      <PremiumCardHeader
        eyebrow="Confirmed social scope only"
        title="Instagram connection queue"
        action={<StatusBadge label={loading ? 'Checking…' : `${queue.length} need attention`} variant={queue.length === 0 ? 'published' : 'needs-strategy'} />}
      />
      <div className="max-w-3xl space-y-2 text-sm leading-relaxed text-brand-primary/75">
        <p>Use the Facebook Page-linked account whenever Meta exposes one. Standalone Instagram Login is the fallback for an exact Business or Creator account only.</p>
        <p>Passwords are entered only on Instagram's own consent screen. CG Dynamics stores an encrypted OAuth token, then waits for an exact staff review before creating the canonical mapping.</p>
        <p>{eligibleCount} eligible · {excludedCount} explicitly excluded · {unresolvedCount} held for package/service confirmation. Existing mappings are not changed.</p>
      </div>

      {message && (
        <div className={`mt-4 rounded-xl border px-4 py-3 text-sm ${message.ok ? 'border-brand-teal/25 bg-brand-teal/[0.07] text-brand-teal' : 'border-red-400/25 bg-red-400/[0.07] text-red-300'}`}>
          {message.text}
        </div>
      )}

      {!providerAssetsLoaded && queue.length > 0 && (
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-brand-accent/20 bg-brand-accent/[0.06] p-4">
          <div>
            <p className="font-semibold text-white">Check the preferred Page-linked route first</p>
            <p className="mt-1 text-xs text-brand-primary/65">Load the connected Meta assets before choosing standalone OAuth.</p>
          </div>
          <ActionButton variant="outline" size="sm" onClick={onLoadProviderAssets}>Load Page-linked assets</ActionButton>
        </div>
      )}

      <div className="mt-5 grid gap-3 lg:grid-cols-2">
        {queue.map(({ client, evidence, connection, pageLinkedAccount, hasFacebookPage }) => {
          const expectedMatches = connection && evidence
            ? exactHandleMatches(evidence.verifiedHandle, connection.instagram_username)
            : false
          const pending = connection?.status === 'pending_review'
          const busy = busyClientId === client.id
          const canStartStandalone = providerAssetsLoaded && !pageLinkedAccount && !pending
          return (
            <article key={client.id} className="rounded-2xl border border-white/10 bg-black/15 p-4 sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-white">{client.name}</p>
                  <p className="mt-1 text-xs text-brand-primary/60">
                    {evidence?.verifiedHandle ? `Reviewed official handle: @${evidence.verifiedHandle}` : 'No exact official handle is verified yet'}
                  </p>
                </div>
                <StatusBadge
                  label={pageLinkedAccount ? 'Page-linked available' : pending ? 'Review exact account' : evidence?.verifiedHandle ? 'Standalone candidate' : 'Identity needed'}
                  variant={pageLinkedAccount ? 'published' : pending ? 'ready-to-publish' : 'needs-strategy'}
                />
              </div>

              {pageLinkedAccount ? (
                <div className="mt-4 rounded-xl border border-brand-teal/20 bg-brand-teal/[0.06] p-3 text-sm text-brand-teal">
                  Meta returned {pageLinkedAccount.username ? `@${pageLinkedAccount.username}` : 'an exact linked Instagram account'} for this client's saved Facebook Page. Link that account in the Page workflow above; do not start standalone OAuth.
                </div>
              ) : pending && connection ? (
                <div className="mt-4 space-y-3 rounded-xl border border-amber-300/20 bg-amber-300/[0.05] p-3">
                  <div>
                    <p className="text-sm font-semibold text-white">Provider returned @{connection.instagram_username}</p>
                    <p className="mt-1 text-xs text-brand-primary/65">{connection.account_type === 'business' ? 'Business' : 'Creator'} account · exact client-bound pending review</p>
                  </div>
                  <p className={`text-xs ${expectedMatches ? 'text-brand-teal' : 'text-amber-200'}`}>
                    {expectedMatches
                      ? 'Exact match to the reviewed official handle.'
                      : evidence?.verifiedHandle
                        ? `Does not match reviewed @${evidence.verifiedHandle}; do not confirm until resolved.`
                        : evidence?.reviewNote ?? 'No reviewed identity evidence exists; confirm directly with the client before mapping.'}
                  </p>
                  <ActionButton variant="outline" size="sm" disabled={busy} onClick={() => void confirmConnection(client, connection)}>
                    {busy ? 'Confirming…' : 'Confirm exact mapping'}
                  </ActionButton>
                </div>
              ) : (
                <div className="mt-4 space-y-3">
                  <p className="text-xs leading-relaxed text-brand-primary/65">
                    {hasFacebookPage
                      ? 'The saved Facebook Page did not expose a linked Instagram account in the loaded provider assets.'
                      : 'No saved Facebook Page route is available for this client.'}
                    {' '}{evidence?.reviewNote ?? 'Confirm the exact owner-controlled account before staff approval.'}
                  </p>
                  <ActionButton variant="outline" size="sm" disabled={!canStartStandalone || busy} onClick={() => void startStandalone(client)}>
                    {busy ? 'Opening Instagram…' : providerAssetsLoaded ? 'Connect exact Instagram account' : 'Check Page route first'}
                  </ActionButton>
                </div>
              )}
            </article>
          )
        })}
      </div>

      {!loading && queue.length === 0 && (
        <div className="mt-5 rounded-2xl border border-brand-teal/20 bg-brand-teal/[0.06] p-5 text-sm text-brand-teal">
          Every eligible client currently has a canonical Instagram mapping or an explicit not-applicable decision.
        </div>
      )}
    </PremiumCard>
  )
}
