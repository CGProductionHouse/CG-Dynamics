import { createClient } from 'jsr:@supabase/supabase-js@2'
import { createWebsiteIntakeHandler, intakeResponse } from '../_shared/websiteEnquiryIntake.ts'

Deno.serve(async (req) => {
  // OFF until separate protected activation. No DB or provider work while OFF.
  if (Deno.env.get('WEBSITE_ENQUIRY_INTAKE_ENABLED') !== 'true') {
    return intakeResponse({ accepted: false, error: 'intake_unavailable' }, 503)
  }
  const url = Deno.env.get('SUPABASE_URL')
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !key) return intakeResponse({ accepted: false, error: 'intake_unavailable' }, 503)
  const admin = createClient(url, key, { auth: { persistSession: false } })
  return createWebsiteIntakeHandler({ enabled: true, rpc: async (name, args) => {
    const { data, error } = await admin.rpc(name, args)
    return { data, error }
  } })(req)
})
