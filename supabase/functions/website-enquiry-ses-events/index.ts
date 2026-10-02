// Issue #405: Amazon SES delivery/bounce/complaint events via an SNS HTTPS subscription.
//
// Gateway: `verify_jwt = false` (supabase/config.toml). SNS cannot send a Supabase JWT; the
// SNS message signature (AWS-hosted certificate) plus the configured topic ARN are the sole
// authority, verified in the shared handler before anything is stored or confirmed.
// Config: WEBSITE_ENQUIRY_SES_SNS_TOPIC_ARN (unset/invalid -> 503, nothing processed).
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { handleSesSnsRequest } from '../_shared/websiteEnquirySesEvents.ts'
import { isTrustedSnsCertUrl, isTrustedSnsSubscribeUrl, isValidSnsTopicArn } from '../_shared/websiteEnquirySes.ts'

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const admin = supabaseUrl && serviceRoleKey
  ? createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } })
  : null
const certificates = new Map<string, string>()

Deno.serve((req) => {
  const topicArn = Deno.env.get('WEBSITE_ENQUIRY_SES_SNS_TOPIC_ARN')?.trim() ?? ''
  return handleSesSnsRequest(req, {
    topicArn: admin && isValidSnsTopicArn(topicArn) ? topicArn : '',
    log: (entry) => console.log(JSON.stringify(entry)),
    fetchCertificate: async (url) => {
      if (!isTrustedSnsCertUrl(url)) throw new Error('untrusted')
      const cached = certificates.get(url)
      if (cached) return cached
      const response = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(5000) })
      if (!response.ok) throw new Error('certificate fetch failed')
      const pem = await response.text()
      certificates.set(url, pem)
      return pem
    },
    confirmSubscription: async (url) => {
      if (!isTrustedSnsSubscribeUrl(url)) return false
      const response = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(5000) })
      return response.ok
    },
    findReconcileJob: async (deliveryKey) => {
      const { data, error } = await admin!.from('website_enquiry_delivery_jobs').select('id')
        .eq('delivery_key', deliveryKey).eq('provider', 'ses').eq('delivery_state', 'reconcile').maybeSingle()
      if (error) throw new Error('lookup failed')
      return data?.id ?? null
    },
    resolveFound: async (jobId, messageId) => {
      const { data, error } = await admin!.rpc('resolve_website_enquiry_delivery_reconcile', {
        p_job_id: jobId, p_resolution: 'found', p_provider_message_id: messageId,
      })
      if (error) throw new Error('resolve failed')
      return Boolean(data?.applied)
    },
    applyEvent: async ({ eventId, messageId, event, occurredAt }) => {
      const { data, error } = await admin!.rpc('apply_website_enquiry_delivery_event', {
        p_provider: 'ses', p_provider_event_id: eventId, p_provider_message_id: messageId,
        p_event: event, p_occurred_at: occurredAt,
      })
      if (error) throw new Error('apply failed')
      return { stored: data?.stored === true }
    },
  })
})
