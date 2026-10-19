import assert from 'node:assert/strict'
import { test } from 'node:test'
import { syntheticBrandHubPacket } from './fixtures/brandHubSyntheticPacket.mjs'

test('portable Brand Hub fixture is explicitly synthetic, unique and private by default', () => {
  const packet = syntheticBrandHubPacket()
  assert.equal(packet.evidence_kind, 'synthetic_topology_not_live_acceptance')
  assert.equal(packet.clients.length, 61)
  assert.equal(new Set(packet.clients.map(c => c.client_id)).size, 61)
  assert.equal(new Set(packet.clients.map(c => c.root.id)).size, 61)
  assert.equal(new Set(packet.clients.flatMap(c => c.categories.map(x => x.id))).size, 183)
  assert.equal(packet.clients.filter(c => c.root.nested_internal_parent).length, 2)
  for (const client of packet.clients) {
    assert.equal(client.root.enabled, false)
    assert.match(client.client, /^Synthetic/)
    assert.match(client.internal_parent_folder_item_id, /^fixture-/)
    assert.match(client.root.id, /^fixture-/)
    for (const category of client.categories) assert.match(category.id, /^fixture-/)
  }
  assert.doesNotMatch(JSON.stringify(packet), /https?:|!s[0-9a-f]{32}|sharepoint\.com|onedrive\.live\.com/i)
})

test('each synthetic run is independent rather than leaking mutations between journeys', () => {
  const first = syntheticBrandHubPacket()
  first.clients[0].root.enabled = true
  first.clients[0].categories.pop()
  assert.equal(syntheticBrandHubPacket().clients[0].root.enabled, false)
  assert.equal(syntheticBrandHubPacket().clients[0].categories.length, 3)
})
