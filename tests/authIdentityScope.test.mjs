import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const auth=readFileSync('src/contexts/AuthContext.tsx','utf8')
test('different auth identities invalidate profile reads and hide old routed data before deferred SDK work',()=>{
  const change=auth.slice(auth.indexOf('// A different identity'),auth.indexOf('return () => {',auth.indexOf('// A different identity')))
  const defer=change.indexOf('setTimeout(')
  assert.ok(defer>0)
  for(const guard of ['++authRequestRef.current','setProfile(null)','setProfileError(null)','setLoading(true)'])assert.ok(change.indexOf(guard)>=0&&change.indexOf(guard)<defer,guard)
  assert.doesNotMatch(change,/silent:|setSession|signIn|\.rpc\(/)
})
test('late initial session success and failure are both fenced by current auth generation',()=>{
  const initial=auth.slice(auth.indexOf('const initialRequestId'),auth.indexOf('const { data: { subscription }'))
  assert.equal(initial.match(/initialRequestId !== authRequestRef\.current/g)?.length,2)
  assert.match(initial,/\.then\([\s\S]*initialRequestId !== authRequestRef\.current[\s\S]*applyUser/)
  assert.match(initial,/\.catch\([\s\S]*initialRequestId !== authRequestRef\.current[\s\S]*setProfile\(null\)/)
})
test('same-user background refresh remains a non-remounting local user update',()=>{
  const same=auth.slice(auth.indexOf('if (initialResolvedRef.current && nextUser?.id'),auth.indexOf('// A different identity'))
  assert.match(same,/nextUser\.id === userIdRef\.current/)
  assert.match(same,/setUser\(nextUser\)\s*return/)
  assert.doesNotMatch(same,/setLoading|setProfile|fetchProfile|applyUser|setSession/)
})

test('profile retry reuses the exact-user reader and never mutates the login session',()=>{
  const retry=auth.slice(auth.indexOf('async function retryProfile()'),auth.indexOf('async function signIn('))
  assert.match(retry,/if \(!userId \|\| user\?\.id !== userId\) return/)
  assert.match(retry,/await fetchProfile\(userId\)/)
  assert.match(retry,/requestId !== authRequestRef\.current \|\| userId !== userIdRef\.current/)
  assert.doesNotMatch(retry,/getSession|setSession|signIn|signOut|\.rpc\(|setInterval|reload/)
})

test('all route guards and home use one sanitized profile failure component',()=>{
  const shared=readFileSync('src/components/AuthProfileError.tsx','utf8')
  assert.match(shared,/role="alert"/)
  assert.match(shared,/<button type="button"/)
  assert.match(shared,/void retryProfile\(\)/)
  assert.doesNotMatch(shared,/profileError|message=|location|\.rpc\(/)
  for(const path of ['src/App.tsx',...['RequireClient','RequireStaff','RequireAdmin','RequireManager'].map(name=>`src/components/guards/${name}.tsx`)]){
    const source=readFileSync(path,'utf8')
    assert.match(source,/if \(profileError\) return <AuthProfileError \/>/,path)
    assert.doesNotMatch(source,/Could not load your profile:|message=\{profileError\}/,path)
  }
})
