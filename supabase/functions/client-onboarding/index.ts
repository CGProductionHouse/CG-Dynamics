import { createClient, type SupabaseClient, type User } from 'https://esm.sh/@supabase/supabase-js@2'
import { createUploadSession, downloadFile, isUploadAdapterConfigured } from './onedrive-adapter.ts'

const PLATFORMS = new Set(['facebook', 'instagram', 'meta_business', 'linkedin', 'tiktok', 'website', 'google', 'outlook'])
const CHOICES = new Set(['connect_now', 'do_later', 'not_needed'])

const UPLOAD_CATEGORIES = new Set(['logo', 'services', 'optional'])
const ALLOWED_UPLOAD_MIME_TYPES = new Set([
  'application/pdf',
  'image/png', 'image/jpeg', 'image/svg+xml', 'image/webp', 'image/tiff',
  'application/postscript', 'application/illustrator',
  'application/vnd.adobe.photoshop', 'application/x-photoshop',
  'application/zip', 'application/x-zip-compressed',
  'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain', 'text/csv',
])
const MAX_ONBOARDING_FILE_BYTES = 250 * 1024 * 1024
const BLOCKED_EXTENSIONS = new Set([
  'app', 'bat', 'cmd', 'com', 'cpl', 'exe', 'hta', 'js', 'jse', 'msi', 'ps1', 'scr', 'vbs', 'wsf', 'sh', 'bash',
])
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-onboarding-token',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Referrer-Policy': 'no-referrer',
  'Cache-Control': 'no-store',
}

type SessionRow = {
  id: string
  client_id: string
  status: string
  current_step: number
  vector_unavailable: boolean
  enabled_platforms: string[]
  started_at: string | null
  completed_at: string | null
  last_activity_at: string
  token_expires_at: string
  revoked_at: string | null
  clients: { name: string; logo_url: string | null } | Array<{ name: string; logo_url: string | null }>
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

function cleanString(value: unknown, max: number) {
  return typeof value === 'string' ? value.slice(0, max) : ''
}

function cleanStringArray(value: unknown, maxItems: number, maxLength: number) {
  if (!Array.isArray(value)) return []
  return value
    .filter(item => typeof item === 'string')
    .map(item => item.trim().slice(0, maxLength))
    .filter(Boolean)
    .slice(0, maxItems)
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')
}

function randomToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '')
}

function extensionOf(filename: string) {
  const match = /\.([a-z0-9]+)$/i.exec(filename.trim())
  return match?.[1]?.toLowerCase() ?? ''
}

function sanitizeFilename(raw: string) {
  const base = raw.replace(/[^\w.]/g, '_').replace(/_{2,}/g, '_').replace(/^_+|_+$/g, '').slice(0, 120)
  return base || 'upload'
}

function validateUploadFile(file: { name: string; type: string; size: number }): string | null {
  const ext = extensionOf(file.name)
  if (!ext || BLOCKED_EXTENSIONS.has(ext)) return 'This file type is not safe to upload.'
  if (file.size <= 0) return 'This file appears to be empty.'
  if (file.size > MAX_ONBOARDING_FILE_BYTES) return 'This file is larger than 250 MB.'
  if (!ALLOWED_UPLOAD_MIME_TYPES.has(file.type) && !ext) return 'Could not determine the file type.'
  return null
}

function streamResponse(data: ArrayBuffer, mimeType: string, filename: string) {
  return new Response(data, {
    headers: {
      ...corsHeaders,
      'Content-Type': mimeType,
      'Content-Disposition': `attachment; filename="${filename.replace(/"/g, '\\"')}"`,
      'Cache-Control': 'no-store',
    },
  })
}

async function getTokenSession(service: SupabaseClient, request: Request): Promise<SessionRow | null> {
  const token = request.headers.get('x-onboarding-token') ?? ''
  if (token.length < 40 || token.length > 100) return null
  const tokenHash = await sha256(token)
  const { data, error } = await service
    .from('client_onboarding_sessions')
    .select('id, client_id, status, current_step, vector_unavailable, enabled_platforms, started_at, completed_at, last_activity_at, token_expires_at, revoked_at, clients!inner(name, logo_url)')
    .eq('token_hash', tokenHash)
    .is('revoked_at', null)
    .gt('token_expires_at', new Date().toISOString())
    .maybeSingle()
  if (error || !data) return null
  return data as SessionRow
}

async function getAuthorizedUser(service: SupabaseClient, request: Request): Promise<{ user: User; profile: { role: string; client_id: string | null } } | null> {
  const match = /^Bearer\s+(.+)$/i.exec(request.headers.get('Authorization') ?? '')
  if (!match?.[1]) return null
  const { data: { user }, error } = await service.auth.getUser(match[1])
  if (error || !user) return null
  const { data: profile } = await service.from('profiles').select('role, client_id, is_active').eq('id', user.id).eq('is_active', true).maybeSingle()
  if (!profile) return null
  return { user, profile: { role: profile.role, client_id: profile.client_id } }
}

async function safeState(service: SupabaseClient, session: SessionRow, includeInternal = false) {
  const [uploadsResult, servicesResult, accessResult, optionalResult] = await Promise.all([
    service.from('client_onboarding_uploads').select('id, category, original_filename, mime_type, size_bytes, upload_status, uploaded_at').eq('onboarding_session_id', session.id).order('created_at'),
    service.from('client_service_intake').select('typed_description, service_items').eq('onboarding_session_id', session.id).maybeSingle(),
    service.from('client_platform_access').select('platform, client_choice, connection_state, submitted_at, verified_at').eq('onboarding_session_id', session.id).order('platform'),
    service.from('client_onboarding_optional_intake').select('additional_notes').eq('onboarding_session_id', session.id).maybeSingle(),
  ])
  if (uploadsResult.error || servicesResult.error || accessResult.error || optionalResult.error) return null
  const client = Array.isArray(session.clients) ? session.clients[0] : session.clients
  const accessByPlatform = new Map((accessResult.data ?? []).map(row => [row.platform, row]))
  const platformAccess = session.enabled_platforms.map(platform => {
    const row = accessByPlatform.get(platform)
    return {
      platform,
      clientChoice: row?.client_choice ?? null,
      connectionState: row?.connection_state ?? 'not_started',
      submittedAt: row?.submitted_at ?? null,
      verifiedAt: row?.verified_at ?? null,
    }
  })
  const state = {
    clientName: client.name,
    clientLogoUrl: client.logo_url,
    status: session.status,
    currentStep: session.current_step,
    startedAt: session.started_at,
    completedAt: session.completed_at,
    lastActivityAt: session.last_activity_at,
    expiresAt: session.token_expires_at,
    vectorUnavailable: session.vector_unavailable,
    uploads: (uploadsResult.data ?? []).map(row => ({
      id: row.id,
      category: row.category,
      originalFilename: row.original_filename,
      mimeType: row.mime_type,
      sizeBytes: Number(row.size_bytes),
      uploadStatus: row.upload_status,
      uploadedAt: row.uploaded_at,
    })),
    typedDescription: servicesResult.data?.typed_description ?? '',
    serviceItems: servicesResult.data?.service_items ?? [],
    platformAccess,
    additionalNotes: optionalResult.data?.additional_notes ?? '',
  }
  return includeInternal ? { ...state, sessionId: session.id, clientId: session.client_id, revokedAt: session.revoked_at } : state
}

async function savePatch(service: SupabaseClient, session: SessionRow, patch: Record<string, unknown>) {
  const now = new Date().toISOString()
  const sessionPatch: Record<string, unknown> = { last_activity_at: now }
  if (session.status === 'not_started') {
    sessionPatch.status = 'in_progress'
    sessionPatch.started_at = now
  }
  if (Number.isInteger(patch.currentStep) && Number(patch.currentStep) >= 0 && Number(patch.currentStep) <= 5) sessionPatch.current_step = Number(patch.currentStep)
  if (typeof patch.vectorUnavailable === 'boolean') sessionPatch.vector_unavailable = patch.vectorUnavailable
  const { error: sessionError } = await service.from('client_onboarding_sessions').update(sessionPatch).eq('id', session.id)
  if (sessionError) return 'Could not save onboarding progress.'

  if ('typedDescription' in patch || 'serviceItems' in patch) {
    const typedDescription = cleanString(patch.typedDescription, 10000)
    const serviceItems = cleanStringArray(patch.serviceItems, 100, 200)
    const { data: uploads, error: uploadLookupError } = await service.from('client_onboarding_uploads').select('id').eq('onboarding_session_id', session.id).eq('category', 'services').eq('upload_status', 'received').limit(1)
    if (uploadLookupError) return 'Could not save services.'
    const methods = [typedDescription ? 'typed' : '', serviceItems.length ? 'list' : '', uploads?.length ? 'upload' : ''].filter(Boolean)
    const { error } = await service.from('client_service_intake').upsert({
      client_id: session.client_id,
      onboarding_session_id: session.id,
      typed_description: typedDescription,
      service_items: serviceItems,
      source_type: methods.length > 1 ? 'mixed' : methods[0] || null,
      submitted_at: methods.length ? now : null,
      updated_at: now,
    }, { onConflict: 'onboarding_session_id' })
    if (error) return 'Could not save services.'
  }

  if (Array.isArray(patch.platformAccess)) {
    for (const raw of patch.platformAccess.slice(0, 8)) {
      if (!raw || typeof raw !== 'object') continue
      const item = raw as Record<string, unknown>
      const platform = cleanString(item.platform, 30)
      const choice = cleanString(item.clientChoice, 30)
      if (!PLATFORMS.has(platform) || !session.enabled_platforms.includes(platform) || !CHOICES.has(choice)) continue
      const clientConfirmed = item.clientConfirmed === true && platform !== 'instagram'
      const connectionState = choice === 'connect_now'
        ? clientConfirmed ? 'awaiting_verification' : 'instructions_opened'
        : 'submitted'
      const { error } = await service.from('client_platform_access').upsert({
        client_id: session.client_id,
        onboarding_session_id: session.id,
        platform,
        client_choice: choice,
        connection_state: connectionState,
        submitted_at: choice !== 'connect_now' || clientConfirmed ? now : null,
        verified_at: null,
        verified_by: null,
        updated_at: now,
      }, { onConflict: 'onboarding_session_id,platform' })
      if (error) return 'Could not save account access.'
    }
  }

  if ('additionalNotes' in patch) {
    const { error } = await service.from('client_onboarding_optional_intake').upsert({
      client_id: session.client_id,
      onboarding_session_id: session.id,
      additional_notes: cleanString(patch.additionalNotes, 10000),
      updated_at: now,
    }, { onConflict: 'onboarding_session_id' })
    if (error) return 'Could not save additional information.'
  }
  return null
}

async function refreshedSession(service: SupabaseClient, id: string) {
  const { data, error } = await service
    .from('client_onboarding_sessions')
    .select('id, client_id, status, current_step, vector_unavailable, enabled_platforms, started_at, completed_at, last_activity_at, token_expires_at, revoked_at, clients!inner(name, logo_url)')
    .eq('id', id)
    .single()
  return error || !data ? null : data as SessionRow
}

Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return json({ ok: false, error: 'Not found.' }, 404)
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceRoleKey) return json({ ok: false, error: 'Service unavailable.' }, 503)
  const service = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })

  let body: Record<string, unknown>
  try { body = await request.json() } catch { return json({ ok: false, error: 'Invalid request.' }, 400) }
  const action = cleanString(body.action, 40)

  if (action === 'load' || action === 'save' || action === 'complete') {
    const session = await getTokenSession(service, request)
    if (!session) return json({ ok: false, error: 'This welcome link is no longer available.' }, 404)
    if (action === 'save') {
      const saveError = await savePatch(service, session, body.patch && typeof body.patch === 'object' ? body.patch as Record<string, unknown> : {})
      if (saveError) return json({ ok: false, error: saveError }, 503)
    }
    if (action === 'complete') {
      const [logoResult, servicesResult, serviceUploadResult] = await Promise.all([
        service.from('client_onboarding_uploads').select('id').eq('onboarding_session_id', session.id).eq('category', 'logo').eq('upload_status', 'received').limit(1),
        service.from('client_service_intake').select('typed_description, service_items').eq('onboarding_session_id', session.id).maybeSingle(),
        service.from('client_onboarding_uploads').select('id').eq('onboarding_session_id', session.id).eq('category', 'services').eq('upload_status', 'received').limit(1),
      ])
      if (logoResult.error || servicesResult.error || serviceUploadResult.error) return json({ ok: false, error: 'Could not verify onboarding requirements.' }, 503)
      const servicesReady = Boolean(servicesResult.data?.typed_description?.trim()) || Boolean(servicesResult.data?.service_items?.some((item: string) => item.trim())) || Boolean(serviceUploadResult.data?.length)
      if (!logoResult.data?.length || !servicesReady) return json({ ok: false, error: 'Please add your logo and services before finishing.' }, 409)
      const now = new Date().toISOString()
      const { error: completeError } = await service.from('client_onboarding_sessions').update({ status: 'completed', current_step: 4, completed_at: now, last_activity_at: now, started_at: session.started_at ?? now }).eq('id', session.id)
      if (completeError) return json({ ok: false, error: 'Could not complete onboarding.' }, 503)
    }
    const current = await refreshedSession(service, session.id)
    if (!current) return json({ ok: false, error: 'Onboarding state is unavailable.' }, 503)
    const responseState = await safeState(service, current)
    if (!responseState) return json({ ok: false, error: 'Onboarding state is unavailable.' }, 503)
    return json({ ok: true, data: responseState })
  }

  const authorized = await getAuthorizedUser(service, request)
  if (!authorized) return json({ ok: false, error: 'Authentication required.' }, 401)

  if (action === 'portal_load') {
    if (authorized.profile.role !== 'client' || !authorized.profile.client_id) return json({ ok: false, error: 'Client access required.' }, 403)
    const { data } = await service
      .from('client_onboarding_sessions')
      .select('id, client_id, status, current_step, vector_unavailable, enabled_platforms, started_at, completed_at, last_activity_at, token_expires_at, revoked_at, clients!inner(name, logo_url)')
      .eq('client_id', authorized.profile.client_id)
      .order('last_activity_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (!data) return json({ ok: false, error: 'Setup is not available yet.' }, 404)
    const responseState = await safeState(service, data as SessionRow)
    if (!responseState) return json({ ok: false, error: 'Setup is unavailable.' }, 503)
    return json({ ok: true, data: responseState })
  }

  const isStaff = ['admin', 'manager', 'staff', 'team'].includes(authorized.profile.role)
  if (!isStaff) return json({ ok: false, error: 'Staff access required.' }, 403)

  if (action === 'staff_list') {
    if (!['admin', 'manager'].includes(authorized.profile.role)) return json({ ok: false, error: 'Manager access required.' }, 403)
    const { data, error } = await service
      .from('client_onboarding_sessions')
      .select('id, client_id, status, current_step, vector_unavailable, enabled_platforms, started_at, completed_at, last_activity_at, token_expires_at, revoked_at, clients!inner(name, logo_url)')
      .order('last_activity_at', { ascending: false })
    if (error) return json({ ok: false, error: 'Onboarding status is unavailable.' }, 503)
    const states = await Promise.all((data as SessionRow[]).map(session => safeState(service, session, true)))
    if (states.some(state => state === null)) return json({ ok: false, error: 'Onboarding status is unavailable.' }, 503)
    return json({ ok: true, data: states })
  }

  if (action === 'staff_generate') {
    if (authorized.profile.role !== 'admin') return json({ ok: false, error: 'Admin access required.' }, 403)
    if (Deno.env.get('CLIENT_ONBOARDING_UPLOADS_ENABLED') !== 'true') {
      return json({ ok: false, error: 'Onboarding links stay disabled until secure file transfer is connected.' }, 409)
    }
    const clientId = cleanString(body.clientId, 50)
    const platforms = [...new Set(cleanStringArray(body.platforms, 8, 30).filter(platform => PLATFORMS.has(platform)))]
    const { data: client } = await service.from('clients').select('id').eq('id', clientId).eq('active', true).maybeSingle()
    if (!client) return json({ ok: false, error: 'Select an active client.' }, 400)
    const token = randomToken()
    const tokenHash = await sha256(token)
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
    const { data: sessionId, error: reissueError } = await service.rpc('reissue_client_onboarding_session', {
      p_client_id: clientId,
      p_token_hash: tokenHash,
      p_token_expires_at: expiresAt,
      p_enabled_platforms: platforms,
      p_actor_id: authorized.user.id,
    })
    if (reissueError || !sessionId) return json({ ok: false, error: 'Could not generate the link.' }, 503)
    return json({ ok: true, data: { token, expiresAt } })
  }

  if (action === 'staff_update_access') {
    if (!['admin', 'manager'].includes(authorized.profile.role)) return json({ ok: false, error: 'Manager access required.' }, 403)
    const sessionId = cleanString(body.sessionId, 50)
    const platform = cleanString(body.platform, 30)
    const state = cleanString(body.state, 20)
    if (!PLATFORMS.has(platform) || !['verified', 'failed'].includes(state)) return json({ ok: false, error: 'Invalid access update.' }, 400)
    const now = new Date().toISOString()
    const update = state === 'verified'
      ? { connection_state: state, verified_at: now, verified_by: authorized.user.id, updated_at: now }
      : { connection_state: state, verified_at: null, verified_by: null, updated_at: now }
    const { data: updated, error } = await service.from('client_platform_access').update(update).eq('onboarding_session_id', sessionId).eq('platform', platform).select('id').maybeSingle()
    if (error || !updated) return json({ ok: false, error: 'Could not update access status.' }, error ? 503 : 404)
    const current = await refreshedSession(service, sessionId)
    if (!current) return json({ ok: false, error: 'Onboarding status is unavailable.' }, 503)
    const responseState = await safeState(service, current, true)
    if (!responseState) return json({ ok: false, error: 'Onboarding status is unavailable.' }, 503)
    return json({ ok: true, data: responseState })
  }

  // ── Upload actions (public token + staff portal) ──────────────────────

  if (action === 'upload_init' || action === 'upload_init_staff') {
    const session = action === 'upload_init_staff'
      ? null // staff uses staff_session_id below
      : await getTokenSession(service, request)

    if (action === 'upload_init_staff') {
      const sessionId = cleanString(body.sessionId, 50)
      const { data: staffSession } = await service
        .from('client_onboarding_sessions')
        .select('id, client_id, status, current_step, vector_unavailable, enabled_platforms, started_at, completed_at, last_activity_at, token_expires_at, revoked_at, clients!inner(name, logo_url)')
        .eq('id', sessionId)
        .maybeSingle()
      if (!staffSession) return json({ ok: false, error: 'Session not found.' }, 404)
      const staffState = staffSession as SessionRow

      const category = cleanString(body.category, 20)
      if (!UPLOAD_CATEGORIES.has(category)) return json({ ok: false, error: 'Invalid upload category.' }, 400)

      const originalFilename = cleanString(body.filename, 255)
      const mimeType = cleanString(body.mimeType, 100)
      const sizeBytes = Number(body.sizeBytes)
      if (!originalFilename || !Number.isFinite(sizeBytes) || sizeBytes <= 0) return json({ ok: false, error: 'Missing file details.' }, 400)

      const validationError = validateUploadFile({ name: originalFilename, type: mimeType, size: sizeBytes })
      if (validationError) return json({ ok: false, error: validationError }, 400)

      if (!isUploadAdapterConfigured()) return json({ ok: false, error: 'Secure file transfer is not configured yet.' }, 503)

      const safeFilename = sanitizeFilename(originalFilename)
      const sessionResult = await createUploadSession({
        clientId: staffState.client_id,
        filename: safeFilename,
        fileSize: sizeBytes,
        mimeType,
      })
      if (!sessionResult) return json({ ok: false, error: 'Could not prepare the upload. Check that the client has a mapped Brand Identity folder.' }, 503)

      const { data: uploadRow, error: insertError } = await service.from('client_onboarding_uploads').insert({
        client_id: staffState.client_id,
        onboarding_session_id: staffState.id,
        category,
        original_filename: originalFilename,
        mime_type: mimeType || null,
        size_bytes: sizeBytes,
        upload_status: 'pending',
        storage_provider: 'onedrive',
        storage_drive_id: sessionResult.driveId,
        storage_item_id: sessionResult.itemId,
        storage_web_url: null,
        storage_original_reference: `Brand Identity/${safeFilename}`,
        source: 'staff',
        upload_session_id: sessionResult.uploadUrl,
        upload_session_expires_at: sessionResult.expiresAt,
      }).select('id').maybeSingle()

      if (insertError || !uploadRow) return json({ ok: false, error: 'Could not record the upload.' }, 503)

      return json({ ok: true, data: { uploadId: uploadRow.id, uploadUrl: sessionResult.uploadUrl, expiresAt: sessionResult.expiresAt } })
    }

    if (!session) return json({ ok: false, error: 'This welcome link is no longer available.' }, 404)

    const category = cleanString(body.category, 20)
    if (!UPLOAD_CATEGORIES.has(category)) return json({ ok: false, error: 'Invalid upload category.' }, 400)

    const originalFilename = cleanString(body.filename, 255)
    const mimeType = cleanString(body.mimeType, 100)
    const sizeBytes = Number(body.sizeBytes)
    if (!originalFilename || !Number.isFinite(sizeBytes) || sizeBytes <= 0) return json({ ok: false, error: 'Missing file details.' }, 400)

    const validationError = validateUploadFile({ name: originalFilename, type: mimeType, size: sizeBytes })
    if (validationError) return json({ ok: false, error: validationError }, 400)

    if (!isUploadAdapterConfigured()) return json({ ok: false, error: 'Secure file transfer is not configured yet. Your file was not uploaded.' }, 503)

    const safeFilename = sanitizeFilename(originalFilename)
    const sessionResult = await createUploadSession({
      clientId: session.client_id,
      filename: safeFilename,
      fileSize: sizeBytes,
      mimeType,
    })
    if (!sessionResult) return json({ ok: false, error: 'Could not prepare the upload. Please try again.' }, 503)

    const { data: uploadRow, error: insertError } = await service.from('client_onboarding_uploads').insert({
      client_id: session.client_id,
      onboarding_session_id: session.id,
      category,
      original_filename: originalFilename,
      mime_type: mimeType || null,
      size_bytes: sizeBytes,
      upload_status: 'pending',
      storage_provider: 'onedrive',
      storage_drive_id: sessionResult.driveId,
      storage_item_id: sessionResult.itemId,
      storage_web_url: null,
      storage_original_reference: `Brand Identity/${safeFilename}`,
      source: 'welcome_link',
      upload_session_id: sessionResult.uploadUrl,
      upload_session_expires_at: sessionResult.expiresAt,
    }).select('id').maybeSingle()

    if (insertError || !uploadRow) return json({ ok: false, error: 'Could not record the upload.' }, 503)

    const current = await refreshedSession(service, session.id)
    if (current) await savePatch(service, current, {})

    return json({ ok: true, data: { uploadId: uploadRow.id, uploadUrl: sessionResult.uploadUrl, expiresAt: sessionResult.expiresAt } })
  }

  if (action === 'upload_complete') {
    const session = await getTokenSession(service, request)
    if (!session) return json({ ok: false, error: 'This welcome link is no longer available.' }, 404)

    const uploadId = cleanString(body.uploadId, 50)
    if (!uploadId) return json({ ok: false, error: 'Missing upload reference.' }, 400)

    const now = new Date().toISOString()
    const { data: updated, error } = await service
      .from('client_onboarding_uploads')
      .update({
        upload_status: 'received',
        uploaded_at: now,
        upload_session_id: null,
        upload_session_expires_at: null,
      })
      .eq('id', uploadId)
      .eq('onboarding_session_id', session.id)
      .eq('upload_status', 'pending')
      .select('id, category')
      .maybeSingle()

    if (error || !updated) return json({ ok: false, error: 'Could not confirm the upload.' }, error ? 503 : 404)

    const current = await refreshedSession(service, session.id)
    if (!current) return json({ ok: false, error: 'Onboarding state is unavailable.' }, 503)
    const responseState = await safeState(service, current)
    if (!responseState) return json({ ok: false, error: 'Onboarding state is unavailable.' }, 503)
    return json({ ok: true, data: responseState })
  }

  if (action === 'upload_cancel') {
    const session = await getTokenSession(service, request)
    if (!session) return json({ ok: false, error: 'This welcome link is no longer available.' }, 404)

    const uploadId = cleanString(body.uploadId, 50)
    if (!uploadId) return json({ ok: false, error: 'Missing upload reference.' }, 400)

    const { data: deleted, error } = await service
      .from('client_onboarding_uploads')
      .delete()
      .eq('id', uploadId)
      .eq('onboarding_session_id', session.id)
      .eq('upload_status', 'pending')
      .select('id')
      .maybeSingle()

    if (error || !deleted) return json({ ok: false, error: 'Could not cancel the upload.' }, error ? 503 : 404)
    return json({ ok: true, data: null })
  }

  // ── Download actions (server-mediated proxy) ──────────────────────────

  if (action === 'download_file' || action === 'portal_download') {
    const authorizedUser = await getAuthorizedUser(service, request)
    if (!authorizedUser) return json({ ok: false, error: 'Authentication required.' }, 401)

    const uploadId = cleanString(body.uploadId, 50)
    if (!uploadId) return json({ ok: false, error: 'Missing upload reference.' }, 400)

    const { data: upload, error: lookupError } = await service
      .from('client_onboarding_uploads')
      .select('id, client_id, original_filename, mime_type, storage_drive_id, storage_item_id, upload_status')
      .eq('id', uploadId)
      .maybeSingle()

    if (lookupError || !upload) return json({ ok: false, error: 'Upload not found.' }, 404)
    if (upload.upload_status !== 'received') return json({ ok: false, error: 'File is not available for download.' }, 409)

    if (action === 'portal_download') {
      if (authorizedUser.profile.role !== 'client' || authorizedUser.profile.client_id !== upload.client_id) {
        return json({ ok: false, error: 'Access denied.' }, 403)
      }
    } else {
      if (!['admin', 'manager', 'staff', 'team'].includes(authorizedUser.profile.role)) {
        return json({ ok: false, error: 'Staff access required.' }, 403)
      }
    }

    if (!upload.storage_drive_id || !upload.storage_item_id) return json({ ok: false, error: 'File reference is incomplete.' }, 500)
    if (!isUploadAdapterConfigured()) return json({ ok: false, error: 'File download is not configured yet.' }, 503)

    const result = await downloadFile(upload.storage_drive_id, upload.storage_item_id)
    if (!result) return json({ ok: false, error: 'Could not retrieve the file.' }, 503)

    const buffer = await result.stream.arrayBuffer()
    return streamResponse(buffer, upload.mime_type ?? result.mimeType, upload.original_filename)
  }

  return json({ ok: false, error: 'Not found.' }, 404)
})
