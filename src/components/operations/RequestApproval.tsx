import { useState } from 'react'
import type { CommandCentreTask } from '../../lib/commandCentre'
import { formatApprovalMessage, formatApprovedMessage, formatChangesRequestedMessage } from '../../lib/commandCentre'
import { ActionButton } from '../ui/Buttons'

interface RequestApprovalProps {
  task: CommandCentreTask
  onStatusChange: (status: string) => void
}

export function RequestApproval({ task, onStatusChange }: RequestApprovalProps) {
  const [copiedApproval, setCopiedApproval] = useState(false)
  const [copiedApproved, setCopiedApproved] = useState(false)
  const [copiedChanges, setCopiedChanges] = useState(false)
  const [changesNote, setChangesNote] = useState('')
  const [showChangesInput, setShowChangesInput] = useState(false)

  function handleCopy(text: string, setter: (v: boolean) => void) {
    void navigator.clipboard.writeText(text)
    setter(true)
    setTimeout(() => setter(false), 2000)
  }

  const approvalMessage = formatApprovalMessage(task)
  const approvedMessage = formatApprovedMessage(task)

  return (
    <div className="space-y-3">
      <hr className="border-white/10" />
      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-200/60">WhatsApp Approval</p>

      <div className="rounded-lg border border-amber-400/20 bg-amber-400/5 px-3 py-2">
        <p className="text-[10px] font-bold uppercase tracking-wider text-amber-200/70">Copy approval message</p>
        <pre className="mt-1 whitespace-pre-wrap text-[11px] text-white/70">{approvalMessage}</pre>
        <ActionButton
          size="sm"
          variant="outline"
          onClick={() => handleCopy(approvalMessage, setCopiedApproval)}
          className="mt-2"
        >
          {copiedApproval ? 'Copied' : 'Copy approval message'}
        </ActionButton>
      </div>

      <div className="flex flex-wrap gap-2">
        <ActionButton
          size="sm"
          onClick={() => {
            handleCopy(approvedMessage, setCopiedApproved)
            onStatusChange('waiting_client')
          }}
          variant="outline"
        >
          {copiedApproved ? 'Copied' : 'Mark as sent'}
        </ActionButton>

        <ActionButton
          size="sm"
          onClick={() => {
            onStatusChange('waiting_client')
          }}
          variant="outline"
        >
          Mark approved
        </ActionButton>

        <ActionButton
          size="sm"
          onClick={() => setShowChangesInput(!showChangesInput)}
          variant="ghost"
        >
          Changes requested
        </ActionButton>
      </div>

      <p className="text-[11px] text-amber-200/70">
        These buttons only stage the status in the draft below — press <strong>Save</strong> on the task to make it live.
      </p>

      {showChangesInput && (
        <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3">
          <textarea
            value={changesNote}
            onChange={e => setChangesNote(e.target.value)}
            placeholder="Describe the changes requested…"
            rows={3}
            className="w-full rounded border border-white/10 bg-[#111] px-2 py-1.5 text-xs text-white outline-none focus:border-brand-teal/50 resize-y"
          />
          <div className="mt-2 flex gap-2">
            <ActionButton
              size="sm"
              onClick={() => {
                const msg = formatChangesRequestedMessage(task, changesNote || undefined)
                handleCopy(msg, setCopiedChanges)
                onStatusChange('blocked')
                setShowChangesInput(false)
              }}
              disabled={!changesNote.trim()}
            >
              {copiedChanges ? 'Copied' : 'Copy & mark changes'}
            </ActionButton>
            <button
              onClick={() => { setShowChangesInput(false); setChangesNote('') }}
              className="text-xs text-white/40 hover:text-white"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
