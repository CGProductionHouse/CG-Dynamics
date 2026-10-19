// Synthetic topology only. Never import live provider inventories into tests.
export function syntheticBrandHubPacket() {
  const names = ['Synthetic Studio', 'Synthetic & Co', 'Synthetic-Works']
  return {
    evidence_kind: 'synthetic_topology_not_live_acceptance',
    drive_id: 'fixture-drive',
    clients: Array.from({ length: 61 }, (_, index) => {
      const number = String(index + 1).padStart(2, '0')
      const client = `${names[index % names.length]} ${number}`
      const slug = client.replace(/[^A-Za-z0-9]+/g, '_')
      return {
        client,
        client_id: `11111111-1111-4111-8111-${String(index + 1).padStart(12, '0')}`,
        internal_parent_folder_item_id: `fixture-bound-${number}`,
        root: {
          id: `fixture-root-${number}`, name: `A_ClientPortal_${slug}`,
          nested_internal_parent: index >= 59, enabled: false,
        },
        categories: ['Brand Identity', 'Graphic Design', 'Video'].map((name, category) => ({
          id: `fixture-category-${number}-${category}`, name,
          category: ['brand_identity', 'graphic_design', 'video'][category],
        })),
      }
    }),
  }
}
