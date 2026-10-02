import { readFileSync,writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { capture,compareReceipts,databaseQuery,logsQuery } from './lib/freshnessObserver.mjs'

// Offline plan is the default. Capture performs fixed reads; compare is offline.
const [mode='plan',...args]=process.argv.slice(2)
try {
  if (!['plan','capture','compare'].includes(mode) || args.length%2) throw new Error('INVALID_ARGUMENTS')
  const allowed=mode==='compare' ? ['--before','--after'] : ['--from','--to',...(mode==='capture' ? ['--phase','--out'] : [])]
  const options={}
  for (let i=0;i<args.length;i+=2) {
    if (!allowed.includes(args[i]) || options[args[i]] || !args[i+1]) throw new Error('INVALID_ARGUMENTS')
    options[args[i]]=args[i+1]
  }
  if (mode==='plan') console.log(JSON.stringify({readOnly:true,sql:databaseQuery(options['--from'],options['--to']),logsSql:logsQuery},null,2))
  else if (mode==='compare') console.log(JSON.stringify(compareReceipts(JSON.parse(readFileSync(options['--before'],'utf8')),JSON.parse(readFileSync(options['--after'],'utf8'))),null,2))
  else {
    if (!options['--out']) throw new Error('PRIVATE_RECEIPT_PATH_REQUIRED')
    const sourceSha=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim()
    const receipt=await capture({from:options['--from'],to:options['--to'],phase:options['--phase'],sourceSha,accessToken:process.env.SUPABASE_ACCESS_TOKEN})
    writeFileSync(options['--out'],JSON.stringify(receipt,null,2)+'\n',{flag:'wx',mode:0o600})
    console.log(JSON.stringify({receiptHash:receipt.receiptHash,observedAt:receipt.db.observed_at,readOnly:true}))
  }
} catch {
  // Provider payloads/exception text may contain credentials; never echo them.
  console.error('OBSERVER_BLOCKED: invalid arguments, receipt, access/schema or transport. No fallback, retry or write was attempted.')
  process.exitCode=1
}
