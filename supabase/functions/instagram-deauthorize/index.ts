import { instagramCallbackRuntime } from '../_shared/instagramCallbackRuntime.ts'
Deno.serve(instagramCallbackRuntime('deauthorize'))
