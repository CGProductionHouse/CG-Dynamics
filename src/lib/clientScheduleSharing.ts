import { supabase } from './supabase'

export interface SchedulePlanRow {
  id: string
  updated_at: string
  scheduled_date: string | null
  client_plan_shared_date: string | null
  deliverable_type: string
  instance_number: number
}

export function planDateIsShared(row: SchedulePlanRow) {
  return row.scheduled_date !== null && row.client_plan_shared_date === row.scheduled_date
}

export function planSharingRows(rows: SchedulePlanRow[], month: string, visible: boolean) {
  return rows.filter(row => visible
    ? row.scheduled_date?.startsWith(`${month}-`) && !planDateIsShared(row)
    : row.client_plan_shared_date !== null)
}

export async function readSchedulePlanRows(clientId: string, month: string): Promise<SchedulePlanRow[]> {
  const { data, error } = await supabase.from('monthly_deliverables')
    .select('id,updated_at,scheduled_date,client_plan_shared_date,deliverable_type,instance_number')
    .eq('client_id', clientId).eq('month', `${month}-01`).is('archived_at', null)
    .in('deliverable_type', ['dp', 'photo', 'video', 'reel']).order('id').limit(201)
  if (error || !Array.isArray(data) || data.length > 200) throw new Error('Could not read the complete plan. Refresh before sharing.')
  return data as SchedulePlanRow[]
}

export async function setSchedulePlanSharing(clientId: string, month: string, visible: boolean, rows: SchedulePlanRow[]) {
  const { error } = await supabase.rpc('set_client_schedule_plan_visibility', {
    p_client_id: clientId, p_month: `${month}-01`, p_visible: visible,
    p_expected_rows: rows.map(row => ({ id: row.id, updated_at: row.updated_at })),
  })
  if (error) throw new Error('The plan may have changed. Refresh and review its current sharing state before trying again.')
}
