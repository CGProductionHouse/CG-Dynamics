// CG Hours vehicle/mileage/fuel contract — pure helper
// Derived from CG Hours truth: CG Hours is the source of truth for payroll, finance, commissions.
// Vehicle/mileage/fuel entries are reimbursable expense items staff submit to CG Hours.
// This module defines the canonical shape and validation. No side effects. No external deps.

export type VehicleEntryType = 'mileage' | 'fuel' | 'vehicle_expense'

export interface VehicleMileageFuelEntry {
  id?: string
  staff_id: string
  client_id: string | null
  date: string // YYYY-MM-DD
  type: VehicleEntryType
  // mileage
  distance_km?: number
  rate_per_km?: number
  // fuel
  litres?: number
  cost_per_litre?: number
  // vehicle_expense (parking, tolls, repairs, etc.)
  description?: string
  amount?: number
  // common
  notes?: string
  receipt_url?: string
  status: 'draft' | 'submitted' | 'approved' | 'rejected'
  created_at: string
  updated_at: string
}

export interface VehicleMileageFuelDraft {
  client_id: string | null
  date: string
  type: VehicleEntryType
  distance_km?: number
  rate_per_km?: number
  litres?: number
  cost_per_litre?: number
  description?: string
  amount?: number
  notes?: string
  receipt_url?: string
}

export const VEHICLE_ENTRY_TYPES: readonly VehicleEntryType[] = ['mileage', 'fuel', 'vehicle_expense'] as const

export const MILEAGE_REQUIRED_FIELDS: readonly (keyof VehicleMileageFuelDraft)[] = ['distance_km', 'rate_per_km']
export const FUEL_REQUIRED_FIELDS: readonly (keyof VehicleMileageFuelDraft)[] = ['litres', 'cost_per_litre']
export const VEHICLE_EXPENSE_REQUIRED_FIELDS: readonly (keyof VehicleMileageFuelDraft)[] = ['description', 'amount']

export function validateVehicleMileageFuelDraft(draft: VehicleMileageFuelDraft): string[] {
  const errors: string[] = []

  if (!draft.date || !/^\d{4}-\d{2}-\d{2}$/.test(draft.date)) {
    errors.push('date must be YYYY-MM-DD')
  }

  if (!VEHICLE_ENTRY_TYPES.includes(draft.type)) {
    errors.push(`type must be one of: ${VEHICLE_ENTRY_TYPES.join(', ')}`)
    return errors
  }

  const requiredFields = {
    mileage: MILEAGE_REQUIRED_FIELDS,
    fuel: FUEL_REQUIRED_FIELDS,
    vehicle_expense: VEHICLE_EXPENSE_REQUIRED_FIELDS,
  }[draft.type]

  for (const field of requiredFields) {
    const value = draft[field]
    if (value === undefined || value === null || (typeof value === 'number' && !Number.isFinite(value))) {
      errors.push(`${field} is required for ${draft.type}`)
    } else if (typeof value === 'number' && value < 0) {
      errors.push(`${field} must be non-negative`)
    }
  }

  if (draft.type === 'mileage' && draft.distance_km !== undefined && draft.distance_km > 2000) {
    errors.push('distance_km exceeds reasonable daily maximum (2000 km)')
  }

  if (draft.type === 'fuel' && draft.litres !== undefined && draft.litres > 200) {
    errors.push('litres exceeds reasonable single-fill maximum (200 L)')
  }

  if (draft.amount !== undefined && draft.amount < 0) {
    errors.push('amount must be non-negative')
  }

  return errors
}

export function calculateMileageAmount(distanceKm: number, ratePerKm: number): number {
  if (distanceKm < 0 || ratePerKm < 0) return 0
  return Number((distanceKm * ratePerKm).toFixed(2))
}

export function calculateFuelAmount(litres: number, costPerLitre: number): number {
  if (litres < 0 || costPerLitre < 0) return 0
  return Number((litres * costPerLitre).toFixed(2))
}

export function isDraftSubmittable(draft: VehicleMileageFuelDraft): boolean {
  return validateVehicleMileageFuelDraft(draft).length === 0
}

export function createEntryFromDraft(
  draft: VehicleMileageFuelDraft,
  staffId: string,
  nowIso = new Date().toISOString()
): VehicleMileageFuelEntry {
  const errors = validateVehicleMileageFuelDraft(draft)
  if (errors.length > 0) {
    throw new Error(`Invalid draft: ${errors.join('; ')}`)
  }

  let calculatedAmount: number | undefined
  if (draft.type === 'mileage' && draft.distance_km !== undefined && draft.rate_per_km !== undefined) {
    calculatedAmount = calculateMileageAmount(draft.distance_km, draft.rate_per_km)
  } else if (draft.type === 'fuel' && draft.litres !== undefined && draft.cost_per_litre !== undefined) {
    calculatedAmount = calculateFuelAmount(draft.litres, draft.cost_per_litre)
  } else if (draft.type === 'vehicle_expense' && draft.amount !== undefined) {
    calculatedAmount = draft.amount
  }

  return {
    staff_id: staffId,
    client_id: draft.client_id,
    date: draft.date,
    type: draft.type,
    distance_km: draft.distance_km,
    rate_per_km: draft.rate_per_km,
    litres: draft.litres,
    cost_per_litre: draft.cost_per_litre,
    description: draft.description,
    amount: calculatedAmount ?? draft.amount,
    notes: draft.notes,
    receipt_url: draft.receipt_url,
    status: 'draft',
    created_at: nowIso,
    updated_at: nowIso,
  }
}