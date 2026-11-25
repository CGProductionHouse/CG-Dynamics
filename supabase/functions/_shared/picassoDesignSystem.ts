// One model-independent contract for the staff UI, connector and local preflight.
// No network, credentials, rendering or publishing authority in this module.
export const PICASSO_VERSION = '1.0.0'
export const DESIGN_FORMATS = ['still_poster', 'animated_poster', 'video'] as const
export type DesignFormat = typeof DESIGN_FORMATS[number]
export type DesignStage = 'internal_review' | 'approved_final'
type EvidenceKind = 'source' | 'visual' | 'measurement' | 'history' | 'approval'
export interface DesignCheck {
  id: string; area: string; instruction: string; evidence: EvidenceKind
  when?: 'motion' | 'audio' | 'print' | 'final'
}
export const PICASSO_CHECKS: readonly DesignCheck[] = [
  { id: 'authority', area: 'Brief', evidence: 'source', instruction: 'Resolve exact client, brand scope, package, current strategy, feedback, content month and real Client Schedule slot. Missing dates stay proposed; never invent a deliverable ID.' },
  { id: 'relevance', area: 'Brief', evidence: 'source', instruction: 'Explain audience, specific real service/product, reason to post, seasonal/local relevance and desired response. Verify dates, branch, offer, claims and contact details from current approved evidence.' },
  { id: 'brand', area: 'Brand', evidence: 'source', instruction: 'Use this exact reviewed Brand Pack revision: complete logo/variant, font families and weights actually available/licensed, colour roles, voice, shapes, gradients, textures and layout language. Resolve conflicting kit/guideline evidence; never borrow sibling branding.' },
  { id: 'source_rights', area: 'Sources', evidence: 'source', instruction: 'Select genuine suitable originals with OneDrive item/locator and hash; verify rights and any permitted stock. Preserve exact people, products, food, venues and logos; no generative reconstruction or distorted scaling.' },
  { id: 'reuse_social', area: 'Freshness', evidence: 'history', instruction: 'Inspect actual relevant brand social artwork with dates/locators and retain comparison evidence. Captions, sibling feeds and Canva labels are insufficient; insufficient coverage holds even an internal draft send.' },
  { id: 'reuse_queue', area: 'Freshness', evidence: 'history', instruction: 'Check approval messages, queued/scheduled artwork, Canva history and shared human/AI ledger: exact/near image, same shoot, visible people, branch, product/service, headline, concept and mechanism. No reused photo or same person in a cycle without explicit reviewed exception. No biometric database.' },
  { id: 'source_quality', area: 'Photography', evidence: 'visual', instruction: 'Inspect actual source crop at useful resolution: focus, eyes/expression/action, hands/equipment and service relevance. Reject awkward, blurred or unsuitable sources rather than conceal them with effects.' },
  { id: 'photo_finish', area: 'Photography', evidence: 'visual', instruction: 'Compare original, separate edited derivative and final crop: colour-managed exposure, highlights/shadows, face luminance, WB/casts, contrast, texture, detail/noise. Preserve skin/atmosphere; no clipped JPEG recovery claims, plastic skin or body reshaping. Retouch temporary blemishes only.' },
  { id: 'concept', area: 'Craft', evidence: 'visual', instruction: 'Artwork and wording communicate the same clear, interesting concept without needing the caption to explain it. Avoid generic AI filler, invented services and decorative props mistaken for real factual scenes.' },
  { id: 'batch_variety', area: 'Craft', evidence: 'visual', instruction: 'Inspect the rendered batch beside recent approved work: complementary but distinct concepts, sources/crops, hierarchy, logo/CTA placement and mechanisms. Colour/photo swaps or renamed template tags alone do not establish freshness.' },
  { id: 'typography', area: 'Craft', evidence: 'visual', instruction: 'Inspect actual glyphs, exact font/weight, compact intentional line spacing, alignment, emphasis and reading path at phone size. No fallback fonts, awkward wrapping, hard duplicate shadow frames or decorative circles/lines through important text.' },
  { id: 'depth', area: 'Craft', evidence: 'visual', instruction: 'Use purposeful independent photographic planes, masks, graphics, textures, gradients and realistic contact/light effects where the brand/concept needs them. No flat document/footer template, random white logo plates, empty filler or layer-count target. Restrained designs remain possible when supported by the brand.' },
  { id: 'masks', area: 'Craft', evidence: 'visual', instruction: 'Inspect HD mask joins, alpha, functional silhouette and registration: no halos, background wedges, floating objects, double edges, random cut frames or decoration over faces/hands/signs. Preserve accepted source/type overlap and legibility.' },
  { id: 'safe_area', area: 'Edges', evidence: 'measurement', instruction: 'Measure actual important text/logo bounds against documented per-format safe inset and logo clear-space; inspect visible ink/alpha, not just frames. Use a justified brand/platform inset (64px at 1080px is a starting review convention, not a universal rule).' },
  { id: 'bleed', area: 'Edges', evidence: 'visual', instruction: 'Inspect every actual exported edge: backgrounds/footers intended to bleed reach the full frame without hairline slivers, cropped marks or distorted proportions. Intentional inset must look deliberate. Digital safe area and print trim bleed are different checks.' },
  { id: 'layers', area: 'Editable', evidence: 'measurement', instruction: 'Verify independent editable type, exact logos, photo, masks, shapes and effects with stable IDs. Reopen the real editable file. Flat PNG is a preview, not an editable master; a PSD claim requires genuine image/text/mask inspection.' },
  { id: 'amendment', area: 'Editable', evidence: 'measurement', instruction: 'For revisions preserve prior version, follow actual annotation, prove targeted changes and unchanged accepted content. Invalidate old exports/checks after any artwork, caption, pack or rule change; do not regenerate everything for a price/headline fix.' },
  { id: 'working_lane', area: 'Workflow', evidence: 'source', instruction: 'Use the authorised exact-client working master and stable page/scene/timeline IDs. In Canva use the official file/approved continuation and authorised working lanes; Drafts/Posted/Scheduled, dividers and other staff work are read-only. Preserve the established video working-file authority. Confirm uncertain writes before retry; no invented connector limits.' },
  { id: 'caption', area: 'Delivery', evidence: 'source', instruction: 'Use allocated exact unsigned caption with current exact-client footer policy/contacts. No PICASSO/Nolan/agent signature. Verify spelling, price/date/service and artwork agreement; keep caption attached to the correct HD image.' },
  { id: 'export', area: 'Delivery', evidence: 'measurement', instruction: 'Verify genuine current export dimensions, format, colour evidence/conversion, metadata privacy and checksum. A thumbnail/upscale, geometry report or successful tool response is not HD/colour/creative proof.' },
  { id: 'final_visual', area: 'Delivery', evidence: 'visual', instruction: 'Inspect the ACTUAL final output at phone size and HD, plus the whole grid: brand, contrast, photo quality, crispness, hierarchy, edges and all feedback. Record remaining defects honestly. Machine checks do not establish excellent taste or client approval.' },
  { id: 'delivery_plan', area: 'Delivery', evidence: 'source', instruction: 'Send only changed current revisions to the exact authorised group with allocated captions, verified media quality and serialized per-message receipts; re-read uncertain sends before retry. Forward only after all required approvals and authoritative schedule order. Approved finals alone enter the correct month client-portal library, with separate Canva/file naming and real Dynamics links.' },
  { id: 'motion_readability', area: 'Motion', evidence: 'visual', when: 'motion', instruction: 'Play the actual full export: intentional timing/entrance/exit, readable settled headline/CTA frames, safe areas throughout, coherent depth and clean masks under movement. No unreadable kinetic type, accidental clipping, flashing or a repeated motion template.' },
  { id: 'motion_export', area: 'Motion', evidence: 'measurement', when: 'motion', instruction: 'Verify duration, aspect, frame rate, codec, transitions and loop/end behaviour against the brief/platform; retain editable timeline/layers. Do not apply still JPEG output requirements to animation/video.' },
  { id: 'audio', area: 'Motion', evidence: 'source', when: 'audio', instruction: 'Where audio exists verify rights, intentional levels, speech/music balance, captions and actual playback. Silent work may declare audio absent, never invent audio evidence.' },
  { id: 'print', area: 'Print', evidence: 'measurement', when: 'print', instruction: 'Verify printer-specified trim, bleed, physical size, resolution, colour profile and PDF requirements. Never equate social-media safe margins with physical print bleed.' },
  { id: 'human_approval', area: 'Approval', evidence: 'approval', when: 'final', instruction: 'Retain exact current-revision human CG/client approval required by the workflow. Agent self-review, page insertion, a thumbs-up on another version or an internal send is not final approval. Publication/scheduling still needs its own authority.' },
]

export interface BrandReference { provider: 'OneDrive' | 'Canva' | 'CG Dynamics' | 'website'; locator: string; observedAt: string; sha256?: string }
export interface DesignBrandScope {
  key: string; name: string; canvaKitId: string
  logos: { variant: string; clearSpace: string; validFor: string; source: BrandReference }[]
  fonts: { family: string; weights: string[]; roles: string; availability: 'verified'; licence: BrandReference }[]
  colours: { hex: string; roles: string; source: BrandReference }[]
  visualLanguage: { typography: string; shapes: string; gradients: string; texture: string; depth: string; photoTreatment: string; motion: string; avoid: string }
  voice: string; claimsAndContacts: BrandReference; photography: BrandReference
  approvedExamples: BrandReference[]; feedback: BrandReference[]
}
export interface DesignBrandPack {
  schemaVersion: 1; clientId: string; revision: string; status: 'draft' | 'reviewed'
  reviewedBy: string; reviewedAt: string; reviewDue: string
  source: BrandReference; scopes: DesignBrandScope[]
}
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
const text = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0
const hash = (v: unknown): v is string => typeof v === 'string' && /^[a-f0-9]{64}$/.test(v)
const date = (v: unknown) => text(v) && Number.isFinite(Date.parse(v))
const ref = (v: unknown) => record(v) && ['OneDrive', 'Canva', 'CG Dynamics', 'website'].includes(String(v.provider)) && text(v.locator) && !/[?&#](?:token|sig|signature|access_token|X-Amz-[^=]*)=/i.test(v.locator) && date(v.observedAt) && (!v.sha256 || hash(v.sha256))
const nonempty = (v: unknown, predicate: (item: unknown) => boolean) => Array.isArray(v) && v.length > 0 && v.every(predicate)

export function validateDesignBrandPack(value: unknown, clientId: string): string[] {
  if (!record(value)) return ['A structured exact-client Brand Pack is required.']
  const problems: string[] = []
  if (value.schemaVersion !== 1 || value.clientId !== clientId || !text(value.revision)) problems.push('Brand Pack schema, exact client or revision is invalid.')
  if (!['draft', 'reviewed'].includes(String(value.status))) problems.push('Brand Pack status is invalid.')
  if (value.status === 'reviewed' && (!text(value.reviewedBy) || !date(value.reviewedAt) || !date(value.reviewDue) || Date.parse(String(value.reviewDue)) <= Date.parse(String(value.reviewedAt)))) problems.push('Reviewed packs require reviewer, review time and a later review-due date.')
  if (!ref(value.source) || !record(value.source) || value.source.provider !== 'OneDrive' || !hash(value.source.sha256)) problems.push('Versioned OneDrive Brand Pack source and SHA-256 are required; no temporary signed links.')
  if (!Array.isArray(value.scopes) || !value.scopes.length) return [...problems, 'At least one explicit brand scope is required.']
  const keys = new Set<string>()
  for (const scope of value.scopes) {
    if (!record(scope)) { problems.push('Invalid brand scope.'); continue }
    const key = String(scope.key)
    if (!text(scope.key) || keys.has(key)) problems.push('Brand scope keys must be explicit and unique.')
    keys.add(key)
    if (!text(scope.name) || !/^[A-Za-z0-9_-]{6,40}$/.test(String(scope.canvaKitId))) problems.push(`${key}: verified name and Canva Kit required.`)
    if (!nonempty(scope.logos, x => record(x) && text(x.variant) && text(x.clearSpace) && text(x.validFor) && ref(x.source) && record(x.source) && x.source.provider === 'OneDrive' && hash(x.source.sha256))) problems.push(`${key}: exact hashed logo variants, validity and clear-space required.`)
    if (!nonempty(scope.fonts, x => record(x) && text(x.family) && nonempty(x.weights, text) && text(x.roles) && x.availability === 'verified' && ref(x.licence))) problems.push(`${key}: actual fonts, weights, roles, availability and licence evidence required.`)
    if (!nonempty(scope.colours, x => record(x) && /^#[a-f0-9]{6}$/i.test(String(x.hex)) && text(x.roles) && ref(x.source))) problems.push(`${key}: exact colours with roles and evidence required.`)
    if (!record(scope.visualLanguage) || !['typography','shapes','gradients','texture','depth','photoTreatment','motion','avoid'].every(k => text((scope.visualLanguage as Record<string, unknown>)?.[k]))) problems.push(`${key}: complete visual language, photo and motion treatment required (an evidenced restriction may be explicit).`)
    if (!text(scope.voice) || !ref(scope.claimsAndContacts) || !ref(scope.photography) || !record(scope.photography) || scope.photography.provider !== 'OneDrive' || !nonempty(scope.approvedExamples, ref) || !nonempty(scope.feedback, ref)) problems.push(`${key}: voice, current claims/contacts, OneDrive photo authority, approved artwork and feedback evidence required.`)
  }
  return problems
}

export function brandPackReadiness(value: unknown, clientId: string, scopeKey: string, now: string) {
  const problems = validateDesignBrandPack(value, clientId)
  const pack = value as DesignBrandPack | null
  if (pack?.status !== 'reviewed') problems.push('Brand Pack is not reviewed; discovery is not approval.')
  if (!date(now) || !date(pack?.reviewDue) || Date.parse(pack!.reviewDue) <= Date.parse(now) || Date.parse(pack!.reviewedAt) > Date.parse(now)) problems.push('Brand Pack review is expired, future-dated or unavailable.')
  const scope = Array.isArray(pack?.scopes) ? pack.scopes.find(s => s?.key === scopeKey) : null
  if (!scope) problems.push('Exact brand scope unavailable; no parent/sibling fallback.')
  return { status: problems.length ? 'hold' : 'ready', problems, scope: problems.length ? null : scope }
}

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`
  if (record(value)) return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${stable(value[k])}`).join(',')}}`
  return JSON.stringify(value) ?? 'null'
}
export async function designFingerprint(value: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(stable(value))
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(b => b.toString(16).padStart(2, '0')).join('')
}
export interface DesignReviewContext {
  clientId: string; scopeKey: string; packRevision: string; packSha256: string; rulesSha256: string; briefSha256: string
  artifactSha256: string; captionSha256: string; format: DesignFormat; stage: DesignStage
  hasAudio: boolean; isPrint: boolean
}
export interface DesignReview {
  systemVersion: string; context: DesignReviewContext; reviewer: string; reviewedAt: string
  checks: { id: string; result: 'pass' | 'fail' | 'hold' | 'na'; reason: string; evidence: { kind: EvidenceKind; locator: string; observation: string; artifactSha256?: string }[] }[]
}
export const applicableCheck = (check: DesignCheck, ctx: DesignReviewContext) => !check.when || (check.when === 'motion' ? ctx.format !== 'still_poster' : check.when === 'audio' ? ctx.hasAudio : check.when === 'print' ? ctx.isPrint : ctx.stage === 'approved_final')

// A receipt checks declarations and evidence bindings, not the truth/taste of an image.
// Readiness is never authority to send, publish or bypass an existing approval gate.
export function evaluateDesignReview(value: unknown, ctx: DesignReviewContext, now: string) {
  const problems: string[] = []
  if (!DESIGN_FORMATS.includes(ctx.format) || !['internal_review','approved_final'].includes(ctx.stage) || !text(ctx.clientId) || !text(ctx.scopeKey) || !text(ctx.packRevision) || typeof ctx.hasAudio !== 'boolean' || typeof ctx.isPrint !== 'boolean' || ![ctx.packSha256,ctx.rulesSha256,ctx.briefSha256,ctx.artifactSha256,ctx.captionSha256].every(hash)) problems.push('Invalid current context or hashes.')
  const review = value as DesignReview | null
  if (!review || review.systemVersion !== PICASSO_VERSION || stable(review.context) !== stable(ctx)) problems.push('Review is missing or stale for this exact artwork, caption, pack, rules, scope, format or stage.')
  if (!text(review?.reviewer) || !date(review?.reviewedAt) || !date(now) || Date.parse(review!.reviewedAt) > Date.parse(now)) problems.push('Named reviewer and valid observed review time required.')
  const checks = Array.isArray(review?.checks) ? review.checks : []
  if (new Set(checks.map(c => c?.id)).size !== checks.length || checks.some(c => !PICASSO_CHECKS.some(d => d.id === c?.id))) problems.push('Duplicate or unknown checklist items.')
  for (const definition of PICASSO_CHECKS) {
    const check = checks.find(c => c?.id === definition.id)
    if (!check || !text(check.reason)) { problems.push(`${definition.id}: explicit result and reason required.`); continue }
    if (!applicableCheck(definition, ctx)) {
      if (check.result !== 'na') problems.push(`${definition.id}: mark not applicable with a reason for this format/stage.`)
      continue
    }
    if (check.result !== 'pass') { problems.push(`${definition.id}: ${check.result ?? 'missing'} blocks readiness.`); continue }
    if (!Array.isArray(check.evidence) || !check.evidence.some(e => e && e.kind === definition.evidence && text(e.locator) && text(e.observation) && (definition.evidence !== 'visual' || e.artifactSha256 === ctx.artifactSha256))) problems.push(`${definition.id}: ${definition.evidence} evidence for the actual revision required.`)
  }
  return { systemVersion: PICASSO_VERSION, status: problems.length ? 'hold' : 'checklist_complete', problems,
    items: PICASSO_CHECKS.map(d => { const c = checks.find(x => x?.id === d.id); return { id: d.id, applicable: applicableCheck(d, ctx), result: c?.result ?? 'missing', reason: c?.reason ?? '', evidence: c?.evidence ?? [] } }),
    checksAreDeclarations: true, creativeApprovalEstablished: false, sendAuthorised: false, publicationAuthorised: false }
}
