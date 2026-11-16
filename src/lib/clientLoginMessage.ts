import type { ClientPortalAccessRow } from './clientPortalAccess'

type AccessReader = () => Promise<{ data: ClientPortalAccessRow[]; error: Error | null }>

// Use the issued Phase 1 convention only. Never reset/provision an account as a
// side effect of copying, or derive a username from a client name.
export async function readClientLoginMessage(clientId: string, read: AccessReader): Promise<string> {
  const result = await read()
  if (result.error) throw new Error('Client access could not be checked. Try again.')
  const matches = result.data.filter(row => row.client_id === clientId)
  const row = matches.length === 1 ? matches[0] : null
  if (!row?.provisioned || !row.enabled || !row.username || !/^[a-z0-9]{3,64}$/.test(row.username)) {
    throw new Error('This client needs access setup. Open Client Access to check it.')
  }
  return `Hi ${row.client_name},\n\nYour CG Dynamics client portal is ready.\n\nLogin: https://www.cgdynamics.co.za/login\nUsername: ${row.username}\nPassword: ${row.username}_cg$\n\nYou can view your reports, strategy and content plan after signing in.\n\nCG Production House`
}

export async function copyClientLoginMessage(clientId: string, read: AccessReader): Promise<void> {
  // Start the clipboard operation inside the click, before the network read
  // completes. Safari/iPhone otherwise loses its user-activation permission.
  if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
    const content = readClientLoginMessage(clientId, read).then(text => new Blob([text], { type: 'text/plain' }))
    await navigator.clipboard.write([new ClipboardItem({ 'text/plain': content })])
  } else if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(await readClientLoginMessage(clientId, read))
  } else {
    throw new Error('Clipboard is unavailable. Open Dynamics in your normal browser and try again.')
  }
}
