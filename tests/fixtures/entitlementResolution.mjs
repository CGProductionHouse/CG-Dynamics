// Approved ready examples from #389. Local test inputs only, never seed data.
export const keys = ['linkedin','google_ads','meta_ads','instagram','tiktok','google_business_profile','website_digital_experience']
const source = 'https://github.com/CGProductionHouse/CG-Dynamics/issues/504#issuecomment-5796095876'
function approved(snippet) {
  const settings = Object.fromEntries(['professional_videos_per_month','reels_per_month','photo_posts_per_month','design_posters_per_month','animated_posters_per_month','campaign_management_included','monthly_campaign_budget','shoot_days_per_month','website_updates_per_month','package_notes','package_exclusions'].map(key => [key,null]))
  settings.other_agreed_deliverables = snippet
  return { ...settings, verification: { status:'confirmed',version:2,confirmed_at:'2026-10-02T10:00:00Z',confirmed_by_profile_id:'local-reviewer',evidence_note:'Approved exact package review evidence',inference_note:'No platform scope inferred',source_references:[source],field_states:Object.fromEntries(Object.entries(settings).map(([key,value]) => [key,value === null ? 'unknown' : 'known'])) } }
}
export function resolutionFixtures() {
  return [
    ['cdb11a82-339e-4b46-9b09-bde1a23efeaf','Red Oak','Posters are supplied as requested. Daily specials are published to Instagram Story and as an actual Facebook post.'],
    ['dfa47255-875d-43cf-8a22-cfe1a6247fb7','The Staffordshire','Posters are supplied on request. Daily specials are published to Instagram Story and as an actual Facebook post.'],
    ['ac4c5e0c-c5d3-4512-8472-fe59192abeca','Rusoord Farmstay','Website service only; monthly website-update quantity is not specified.'],
    ['00000000-0000-0000-0000-000000000001','Local unresolved fixture',null],
  ].map(([client_id,client_name,snippet]) => ({ client_id,client_name,package_settings:snippet ? approved(snippet) : null,
    entitlements:[],connections:keys.map(service_key => ({service_key,connection:service_key === 'instagram' ? 'connected' : 'unavailable'})) })).sort((a,b) => a.client_id.localeCompare(b.client_id))
}
