import assert from 'node:assert/strict'
import { test, before, after } from 'node:test'
import { createServer } from 'vite'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync } from 'node:fs'

let server, media, stats, ReportPostCard
before(async () => {
  server = await createServer({ configFile:false, server:{middlewareMode:true,hmr:false}, optimizeDeps:{noDiscovery:true} })
  media = await server.ssrLoadModule('/src/lib/reportPostMedia.ts')
  stats = await server.ssrLoadModule('/src/lib/reportStats.ts')
  ;({ ReportPostCard } = await server.ssrLoadModule('/src/components/client/ReportPostCard.tsx'))
})
after(async () => { await server?.close() })

test('only public provider images and platform-matched HTTPS permalinks are eligible', () => {
  const good='https://scontent.example.fbcdn.net/post.jpg?oh=public-signature'
  assert.equal(media.reportPostImageUrl(good),good)
  assert.equal(media.reportPostImageUrl('https://scontent.cdninstagram.com/post.jpg'),'https://scontent.cdninstagram.com/post.jpg')
  for(const url of [null,{},'data:image/svg+xml,x','javascript:alert(1)','/internal.png','https://internal.sharepoint.com/raw.png',
    'http://scontent.fbcdn.net/a','https://fbcdn.net.evil.test/a','https://fbcdn.net@evil.test/a','https://user:password@fbcdn.net/a',
    'https://fbcdn.net:8080/a','https://fbcdn.net/a?access_token=PRIVATE','https://fbcdn.net/a?access%5Ftoken=PRIVATE']) assert.equal(media.reportPostImageUrl(url),null)
  assert.equal(media.reportPostPermalink('https://www.facebook.com/reel/123','facebook'),'https://www.facebook.com/reel/123')
  for(const url of ['javascript:alert(1)','https://evil.test/post','https://facebook.com.evil.test/post','https://www.instagram.com/p/123']) assert.equal(media.reportPostPermalink(url,'facebook'),null)
})

const post={id:'one',platform:'facebook',post_type:'Video',caption:'Actual caption',publish_time:'2026-10-26T12:00:00Z',permalink:'https://www.facebook.com/reel/123',
  impressions:null,reach:null,engagements:95,engagementKnownSubtotal:95,engagementDefinitionLabel:'Facebook direct reactions + comments + shares',
  engagementDefinitionId:'facebook_direct_v1',imageUrl:'https://scontent.fbcdn.net/a.jpg',metaObjectId:'PRIVATE_ID'}

test('public thumbnail survives client projection; old deployments remain valid without it', () => {
  const projected={...post,post_type:'Photo',engagement_known_subtotal:95,image_url:post.imageUrl}
  assert.equal(stats.reportPostToStatsPost(projected).imageUrl,post.imageUrl)
  assert.equal(stats.reportPostToStatsPost({...projected,image_url:undefined}).imageUrl,null)
  assert.equal(stats.reportPostToStatsPost({...projected,image_url:'https://internal.test/a.jpg'}).imageUrl,null)
  assert.equal(stats.reportPostToStatsPost({id:'raw',raw:{full_picture:'https://private.test/file',thumbnail_url:post.imageUrl}}).imageUrl,post.imageUrl)
})

test('compact metrics retain exact definitions once, no duplicate post or claimed video playback', () => {
  const html=renderToStaticMarkup(React.createElement(ReportPostCard,{post,rank:1,rankingMetric:'interactions'}))
  assert.equal((html.match(/Facebook direct reactions \+ comments \+ shares/g)||[]).length,1)
  assert.equal((html.match(/>95</g)||[]).length,1)
  assert.match(html,/Metric details/)
  assert.match(html,/aria-expanded="false"/)
  assert.match(html,/referrerPolicy="no-referrer"/i)
  assert.match(html,/rel="noopener noreferrer"/)
  assert.doesNotMatch(html,/<video|<iframe|PRIVATE_ID|Play video/)
})

test('missing and partial observations never become a fabricated zero or complete interactions', () => {
  const partial=renderToStaticMarkup(React.createElement(ReportPostCard,{post:{...post,engagements:null,engagementKnownSubtotal:8,engagementCoverage:{observed:2,required:3},imageUrl:null}}))
  assert.match(partial,/8 known interactions/);assert.match(partial,/2\/3 fields/)
  assert.doesNotMatch(partial,/>0</)
  const missing=renderToStaticMarkup(React.createElement(ReportPostCard,{post:{...post,engagements:null,engagementKnownSubtotal:null,imageUrl:null,permalink:'javascript:alert(1)'}}))
  assert.match(missing,/Preview unavailable/);assert.match(missing,/Interaction data unavailable/)
  assert.doesNotMatch(missing,/<a |javascript:|>0</)
})

test('narrow SQL extension keeps exact role/publication/exclusion/cutoff and old metrics intact', () => {
  const sql=readFileSync(new URL('../supabase/migrations/20261102113000_client_report_public_post_images.sql',import.meta.url),'utf8')
  const old=readFileSync(new URL('../supabase/migrations/20260922154243_meta_post_engagement_truth.sql',import.meta.url),'utf8')
  const metrics=s=>s.slice(s.indexOf('  return query'),s.indexOf('    exists (select 1 from public.report_content_exclusions'))
  assert.equal(metrics(sql),metrics(old.slice(old.indexOf('create function public.client_published_report_posts('))))
  for(const fragment of ["profile.is_active and profile.role = 'client'","r.status = 'published'",'v_client_id is distinct from public.my_client_id()',"at time zone 'America/Los_Angeles'",'between r.period_start and r.period_end',"p.platform in ('facebook', 'instagram')",'revoke all on function public.client_published_report_posts(uuid) from public, anon']) assert.ok(sql.includes(fragment),fragment)
  assert.doesNotMatch(sql,/grant select|update public|insert into|delete from/i)
  const header=sql.slice(sql.indexOf('returns table'),sql.indexOf('language plpgsql'))
  assert.doesNotMatch(header,/\braw\b|meta_post_id|client_id/)
})
