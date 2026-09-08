import { corsHeaders, jsonResponse } from '../_shared/cors.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { inspectMetaAccessToken } from '../_shared/metaTokenDiagnostics.ts'
import { resolveMetaGraphConfig } from '../_shared/meta.ts'

const REQUIRED_SCOPES = [
  'pages_show_list',
  'pages_read_engagement',
  'read_insights',
  'instagram_basic',
  'instagram_manage_insights',
  'business_management',
]

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  // Verify the caller is authenticated and has staff-level access.
  const authHeader = req.headers.get('Authorization') ?? ''
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ ok: false, error: 'Server configuration error.' }, 500)
  }

  const sb = createClient(supabaseUrl, serviceRoleKey)

  const token = authHeader.replace('Bearer ', '')
  const { data: { user }, error: authError } = await sb.auth.getUser(token)

  if (authError || !user) {
    return jsonResponse({ ok: false, error: 'Authentication required.' }, 401)
  }

  const { data: profile } = await sb
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || !['admin', 'manager'].includes(profile.role)) {
    return jsonResponse({ ok: false, error: 'Admin or manager access required.' }, 403)
  }

  // Count active linked assets (independent of connection status).
  const { count: linkedAssetsCount } = await sb
    .from('meta_client_assets')
    .select('*', { head: true, count: 'exact' })
    .eq('is_active', true)

  const [{ error: oauthStateSchemaError }, { error: tokenSchemaError }, { error: checkpointSchemaError }] = await Promise.all([
    sb.from('meta_oauth_states').select('id', { head: true }).limit(1),
    sb.from('meta_connection_tokens').select('id, validation_state, last_validated_at', { head: true }).limit(1),
    sb.from('meta_asset_sync_checkpoints').select('asset_id, platform', { head: true }).limit(1),
  ])
  const schemaReady = !oauthStateSchemaError && !tokenSchemaError && !checkpointSchemaError

  const { data: verifiedRuns } = await sb
    .from('platform_sync_runs')
    .select('platform, period_month, health_state, finished_at')
    .in('health_state', ['verified', 'verified_partial'])
    .order('finished_at', { ascending: false, nullsFirst: false })
    .limit(1)
  const lastVerifiedInsight = verifiedRuns?.[0] ?? null

  // Read the latest connection ordered by last_connected_at desc nulls last.
  const { data: connections } = await sb
    .from('meta_connections')
    .select('id, meta_business_id, meta_business_name, status, scopes, last_error, last_connected_at')
    .order('last_connected_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(1)

  if (!connections || connections.length === 0) {
    return jsonResponse({
      ok: true,
      connected: false,
      status: 'not_connected',
      message: 'Meta is not connected yet.',
      linkedAssetsCount: linkedAssetsCount ?? 0,
    })
  }

  const latest = connections[0]
  const grantedScopes = Array.isArray(latest.scopes)
    ? latest.scopes.filter((scope): scope is string => typeof scope === 'string')
    : []
  const missingScopes = REQUIRED_SCOPES.filter(scope => !grantedScopes.includes(scope))

  // Statuses that clearly indicate no valid connection.
  const terminalStatuses = ['not_connected', 'needs_reauth', 'revoked', 'error']
  if (terminalStatuses.includes(latest.status)) {
    const messages: Record<string, string> = {
      not_connected: 'Meta is not connected yet.',
      needs_reauth: 'Meta needs to be reconnected.',
      revoked: 'Meta access was revoked.',
      error: 'Meta connection has an error.',
    }
    return jsonResponse({
      ok: true,
      connected: false,
      status: latest.status,
      message: latest.last_error || messages[latest.status] || 'Meta is not connected.',
      missingScopes,
      schemaReady,
      linkedAssetsCount: linkedAssetsCount ?? 0,
    })
  }

  if (missingScopes.length > 0) {
    return jsonResponse({
      ok: true,
      connected: false,
      status: 'needs_reauth',
      message: `Meta needs to be reconnected with: ${missingScopes.join(', ')}.`,
      missingScopes,
      schemaReady,
      linkedAssetsCount: linkedAssetsCount ?? 0,
    })
  }

  // Status is 'connected' — validate lifecycle metadata server-side. The token
  // value and app secret are never returned to the browser.
  let { data: tokenRows, error: tokenReadError } = await sb
    .from('meta_connection_tokens')
    .select('id, encrypted_access_token, token_type, token_expires_at, data_access_expires_at, last_validated_at, validation_state, validation_error_code, validation_error_reason')
    .eq('connection_id', latest.id)
    .limit(1)

  // Keep the status endpoint deploy-safe when code lands before the migration.
  // The UI will say migration required and validation remains unverified.
  if (tokenReadError && !schemaReady) {
    const fallback = await sb.from('meta_connection_tokens')
      .select('id, encrypted_access_token, token_expires_at')
      .eq('connection_id', latest.id)
      .limit(1)
    tokenRows = fallback.data?.map(row => ({
      ...row,
      token_type: null,
      data_access_expires_at: null,
      last_validated_at: null,
      validation_state: 'unverified',
      validation_error_code: 'migration_required',
      validation_error_reason: null,
    })) ?? null
    tokenReadError = fallback.error
  }

  if (tokenReadError || !tokenRows || tokenRows.length === 0) {
    return jsonResponse({
      ok: true,
      connected: false,
      status: 'needs_reauth',
      message: 'Meta needs to be reconnected.',
      linkedAssetsCount: linkedAssetsCount ?? 0,
    })
  }

  const tokenRow = tokenRows[0]
  const validationAge = tokenRow.last_validated_at ? Date.now() - new Date(tokenRow.last_validated_at).getTime() : Number.POSITIVE_INFINITY
  const appId = Deno.env.get('META_APP_ID')
  const appSecret = Deno.env.get('META_APP_SECRET')
  if (schemaReady && tokenRow.encrypted_access_token && appId && appSecret && validationAge >= 24 * 60 * 60 * 1000) {
    let diagnostics
    try {
      diagnostics = await inspectMetaAccessToken({
        graphBaseUrl: resolveMetaGraphConfig().baseUrl,
        appId,
        appSecret,
        accessToken: tokenRow.encrypted_access_token,
      })
    } catch {
      diagnostics = {
        state: 'unverified' as const,
        tokenType: null,
        expiresAt: null,
        dataAccessExpiresAt: null,
        validatedAt: new Date().toISOString(),
        grantedScopes: [],
        errorCode: 'configuration_error',
        errorReason: 'Meta token validation is unavailable because server configuration is incomplete.',
      }
    }
    Object.assign(tokenRow, {
      token_type: diagnostics.tokenType,
      token_expires_at: diagnostics.expiresAt ?? tokenRow.token_expires_at,
      data_access_expires_at: diagnostics.dataAccessExpiresAt,
      last_validated_at: diagnostics.validatedAt,
      validation_state: diagnostics.state,
      validation_error_code: diagnostics.errorCode,
      validation_error_reason: diagnostics.errorReason,
    })
    await sb.from('meta_connection_tokens').update({
      token_type: tokenRow.token_type,
      token_expires_at: tokenRow.token_expires_at,
      data_access_expires_at: tokenRow.data_access_expires_at,
      last_validated_at: tokenRow.last_validated_at,
      validation_state: tokenRow.validation_state,
      validation_error_code: tokenRow.validation_error_code,
      validation_error_reason: tokenRow.validation_error_reason,
    }).eq('id', tokenRow.id)
  }

  const now = Date.now()
  const tokenExpired = Boolean(tokenRow.token_expires_at && new Date(tokenRow.token_expires_at).getTime() <= now)
  const dataAccessExpired = Boolean(tokenRow.data_access_expires_at && new Date(tokenRow.data_access_expires_at).getTime() <= now)
  const tokenInvalid = tokenRow.validation_state === 'invalid' || tokenExpired || dataAccessExpired
  const tokenState = tokenExpired ? 'expired'
    : dataAccessExpired ? 'data_access_expired'
    : tokenRow.validation_state ?? 'unverified'

  if (tokenInvalid) {
    const reason = tokenExpired
      ? 'The Meta access token expired. Reconnect Meta.'
      : dataAccessExpired
        ? 'Meta data access expired. Reconnect Meta.'
        : tokenRow.validation_error_reason || 'Meta reports that this token is invalid. Reconnect Meta.'
    await sb.from('meta_connections').update({ status: 'needs_reauth', last_error: reason }).eq('id', latest.id)
    return jsonResponse({
      ok: true, connected: false, status: 'needs_reauth', message: reason,
      missingScopes: [], schemaReady, linkedAssetsCount: linkedAssetsCount ?? 0,
      tokenLifecycle: {
        state: tokenState, tokenType: tokenRow.token_type, expiresAt: tokenRow.token_expires_at,
        dataAccessExpiresAt: tokenRow.data_access_expires_at, lastValidatedAt: tokenRow.last_validated_at,
        validationErrorCode: tokenRow.validation_error_code,
      },
    })
  }

  const { data: activeAssets } = await sb
    .from('meta_client_assets')
    .select('id, client_id, facebook_page_id, instagram_account_id')
    .eq('is_active', true)
  const assetIds = (activeAssets ?? []).map(asset => asset.id).filter(Boolean)
  const { data: checkpoints } = schemaReady && assetIds.length > 0
    ? await sb.from('meta_asset_sync_checkpoints')
      .select('asset_id, client_id, platform, last_sync_kind, last_status, last_health_state, last_attempted_at, last_successful_at, last_successful_month, high_watermark_at, next_due_at, api_version, connector_version, last_error_code')
      .in('asset_id', assetIds)
    : { data: [] }
  const checkpointByAsset = new Map<string, Record<string, unknown>>()
  for (const checkpoint of checkpoints ?? []) {
    checkpointByAsset.set(`${checkpoint.asset_id}:${checkpoint.platform}`, checkpoint)
  }
  const asRun = (checkpoint: Record<string, unknown> | undefined) => checkpoint ? {
    run_type: checkpoint.last_sync_kind === 'incremental' ? 'scheduled' : checkpoint.last_sync_kind === 'targeted_backfill' ? 'historical_resync' : 'manual',
    period_month: checkpoint.last_successful_month,
    status: checkpoint.last_status === 'complete' ? 'success' : 'failed',
    health_state: checkpoint.last_health_state,
    finished_at: checkpoint.last_status === 'failed' ? checkpoint.last_attempted_at : (checkpoint.last_successful_at ?? checkpoint.last_attempted_at),
    created_at: checkpoint.last_attempted_at,
    high_watermark_at: checkpoint.high_watermark_at,
    next_due_at: checkpoint.next_due_at,
    last_error_code: checkpoint.last_error_code,
  } : null
  const assetHealth = schemaReady ? (activeAssets ?? []).map(asset => ({
    clientId: asset.client_id,
    facebook: asset.facebook_page_id ? asRun(checkpointByAsset.get(`${asset.id}:facebook`)) : null,
    instagram: asset.instagram_account_id ? asRun(checkpointByAsset.get(`${asset.id}:instagram`)) : null,
  })) : null

  return jsonResponse({
    ok: true,
    connected: true,
    status: 'connected',
    message: 'Meta is connected.',
    missingScopes: [],
    schemaReady,
    tokenSecurity: {
      encryptedAtRest: false,
      state: 'server_only_plaintext',
    },
    tokenLifecycle: {
      state: tokenState,
      tokenType: tokenRow.token_type,
      expiresAt: tokenRow.token_expires_at,
      dataAccessExpiresAt: tokenRow.data_access_expires_at,
      lastValidatedAt: tokenRow.last_validated_at,
      validationErrorCode: tokenRow.validation_error_code,
    },
    connection: {
      id: latest.id,
      metaBusinessId: latest.meta_business_id,
      metaBusinessName: latest.meta_business_name,
      lastConnectedAt: latest.last_connected_at,
      grantedScopes,
      lastVerifiedInsight: lastVerifiedInsight ? {
        platform: lastVerifiedInsight.platform,
        periodMonth: lastVerifiedInsight.period_month,
        healthState: lastVerifiedInsight.health_state,
        finishedAt: lastVerifiedInsight.finished_at,
      } : null,
    },
    linkedAssetsCount: linkedAssetsCount ?? 0,
    assetHealth,
  })
})
