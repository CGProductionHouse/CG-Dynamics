import { supabase } from '../supabase'
import { validateDesignBrandPack, type DesignBrandPack } from '../picassoDesignSystem'

// Separate reads keep Nolan's existing profile panel working before rollout.
export async function getDesignBrandPack(clientId: string) {
  const { data, error } = await supabase.from('client_brand_profiles')
    .select('client_id,design_pack,updated_at').eq('client_id', clientId).maybeSingle()
  return {
    pack: (data?.design_pack ?? null) as DesignBrandPack | null,
    updatedAt: data?.updated_at as string | undefined,
    error: error ? (['42703','PGRST204','42P01','PGRST205'].includes(error.code)
      ? 'Structured Brand Packs are not available on this database yet. Keep work on hold; the prepared extension needs a separately approved rollout.'
      : 'Could not verify this client’s Brand Pack. Try again before production.') : null,
  }
}

export async function saveDesignBrandPack(clientId: string, pack: unknown, expectedUpdatedAt: string) {
  const problems = validateDesignBrandPack(pack, clientId)
  if (problems.length) return { error: problems.join('\n') }
  // Update only an existing exact-client profile; never a guessed upsert or
  // overwriting a profile another manager changed during this review.
  const { data, error } = await supabase.from('client_brand_profiles').update({ design_pack: pack })
    .eq('client_id', clientId).eq('updated_at', expectedUpdatedAt).select('client_id').maybeSingle()
  return { error: error ? 'Could not save. Check manager access and rollout availability.' : !data ? 'Profile changed or is missing. Reload and reconcile before saving.' : null }
}
