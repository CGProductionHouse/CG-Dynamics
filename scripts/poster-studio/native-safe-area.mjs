import { readFileSync, writeFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'

/** Conservative native-frame containment, not glyph, alpha, crop or taste approval.
 * Logo IDs must come from visual/source review; this does not discover logos.
 */
export function auditNativeSafeArea(snapshot, specification) {
  const { pageIds, logoElementIds, insetPx } = specification
  if (!Array.isArray(pageIds) || !pageIds.length || new Set(pageIds).size !== pageIds.length) throw new Error('Explicit unique pageIds required')
  if (!Array.isArray(logoElementIds) || new Set(logoElementIds).size !== logoElementIds.length) throw new Error('Explicit unique reviewed logoElementIds required')
  if (!Number.isFinite(insetPx) || insetPx < 0) throw new Error('Finite nonnegative insetPx required')
  const selected = pageIds.map(id => {
    const found = snapshot.pages.filter(p => p.page_id === id)
    if (found.length !== 1) throw new Error(`Unknown or ambiguous page: ${id}`)
    const page = found[0]
    const { width, height } = page.dimension ?? {}
    if (![width, height].every(v => Number.isFinite(v) && v > 2 * insetPx)) throw new Error(`Invalid page dimensions: ${id}`)
    return page
  })
  const byIndex = new Map(selected.map(p => [p.page_number, p]))
  const records = (snapshot.richtexts ?? []).filter(x => byIndex.has(x.page_index) && x.regions?.some(r => typeof r.text === 'string' && r.text.trim())).map(x => ({ ...x, kind: 'text' }))
  for (const id of logoElementIds) {
    const found = (snapshot.fills ?? []).filter(x => x.element_id === id)
    if (found.length !== 1 || !byIndex.has(found[0].page_index)) throw new Error(`Unknown, ambiguous or out-of-scope logo: ${id}`)
    records.push({ ...found[0], kind: 'logo' })
  }
  const measurements = records.map(x => {
    const page = byIndex.get(x.page_index)
    const { left, top } = x.containerElement?.position ?? {}
    const { width, height } = x.containerElement?.dimension ?? {}
    if (![left, top, width, height].every(Number.isFinite) || width <= 0 || height <= 0) throw new Error(`Invalid important frame: ${x.element_id}`)
    const edges = { left, top, right: page.dimension.width - left - width, bottom: page.dimension.height - top - height }
    const minimumInsetPx = Math.min(...Object.values(edges))
    return { pageId: page.page_id, pageIndex: page.page_number, elementId: x.element_id, kind: x.kind, edges, minimumInsetPx, passes: minimumInsetPx + 0.01 >= insetPx }
  })
  return {
    schemaVersion: 1, insetPx, pageCount: selected.length,
    textCount: measurements.filter(x => x.kind === 'text').length,
    logoCount: logoElementIds.length,
    passes: measurements.every(x => x.passes),
    findings: measurements.filter(x => !x.passes), measurements,
    limitations: ['Measures native frames, not rendered glyphs or image alpha.', 'Logo inventory is explicitly supplied from review, not automatically certified.', 'Background bleed and photographic crop are excluded; inspect actual previews/exports.', 'Does not establish alignment, absence of overlap, brand accuracy or creative approval.'],
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const [snapshotPath, specificationPath, flag, outputPath] = process.argv.slice(2)
    if (!snapshotPath || !specificationPath || flag !== '--out' || !outputPath) throw new Error('Usage: native-safe-area.mjs snapshot.json specification.json --out receipt.json')
    const target = resolve(outputPath).toLowerCase()
    if ([snapshotPath, specificationPath].some(p => resolve(p).toLowerCase() === target)) throw new Error('Report must not overwrite an input')
    const report = auditNativeSafeArea(JSON.parse(readFileSync(snapshotPath, 'utf8')), JSON.parse(readFileSync(specificationPath, 'utf8')))
    writeFileSync(outputPath, JSON.stringify(report, null, 2) + '\n')
    console.log(JSON.stringify({ passes: report.passes, pages: report.pageCount, texts: report.textCount, logos: report.logoCount, findings: report.findings.length }))
    if (!report.passes) process.exitCode = 1
  } catch (error) {
    console.error(error.message)
    process.exitCode = 1
  }
}
