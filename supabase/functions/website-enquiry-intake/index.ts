// Issue #624 (#405 M2C): website enquiry intake — server-to-server only.
//
// Gateway: `verify_jwt = false` (supabase/config.toml). Website server routes never hold a
// Supabase JWT or service-role key; the per-endpoint intake key in `x-cg-intake-key` is
// the sole authority and is validated by the canonical M2A transaction. The service-role
// key stays inside this function and is used only to call `submit_website_enquiry`.
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { handleIntakeRequest, type IntakeLogEntry, type SubmitArgs } from '../_shared/websiteEnquiryIntake.ts'

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const admin = supabaseUrl && serviceRoleKey
  ? createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } })
  : null

// Outcome categories and status only — never the key, body, answers or contact details.
const log = (entry: IntakeLogEntry) => console.log(JSON.stringify(entry))

Deno.serve((req) => handleIntakeRequest(req, {
  log,
  submit: async (args: SubmitArgs) => {
    if (!admin) return { error: { code: 'config', message: 'Server configuration missing' } }
    const { data, error } = await admin.rpc('submit_website_enquiry', args)
    return { data, error: error ? { code: error.code, message: error.message } : null }
  },
}))
