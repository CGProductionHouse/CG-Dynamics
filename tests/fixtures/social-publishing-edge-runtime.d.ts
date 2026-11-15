// Type-check the new Edge entrypoints against the installed Supabase SDK in
// environments without Deno. This is a typing bridge, not Edge runtime acceptance.
declare const Deno: {
  env: { get(name: string): string | undefined }
  serve(handler: (request: Request) => Response | Promise<Response>): void
}
declare module 'https://esm.sh/@supabase/supabase-js@2' {
  export const createClient: typeof import('@supabase/supabase-js').createClient
  export type SupabaseClient = import('@supabase/supabase-js').SupabaseClient
  export type User = import('@supabase/supabase-js').User
}
