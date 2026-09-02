import { useState } from 'react'
import { downloadOnboardingFile } from './api'
import type { ClientOnboardingState, SafeOnboardingUpload } from './types'

export function BrandAssetLibrary({ state }: { state: ClientOnboardingState }) {
  const logoUploads = state.uploads.filter(u => u.category === 'logo' && u.uploadStatus === 'received')
  const servicesUploads = state.uploads.filter(u => u.category === 'services' && u.uploadStatus === 'received')
  const optionalUploads = state.uploads.filter(u => u.category === 'optional' && u.uploadStatus === 'received')
  const allUploads = [...logoUploads, ...servicesUploads, ...optionalUploads]

  if (allUploads.length === 0) return null

  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-5 sm:p-6">
      <h2 className="text-lg font-bold text-white">Brand assets</h2>
      <p className="mt-1 text-sm text-report-muted">Files shared during onboarding. Download anytime.</p>

      <div className="mt-4 space-y-2">
        {logoUploads.length > 0 && (
          <AssetGroup label="Logo & brand" uploads={logoUploads} />
        )}
        {servicesUploads.length > 0 && (
          <AssetGroup label="Services" uploads={servicesUploads} />
        )}
        {optionalUploads.length > 0 && (
          <AssetGroup label="Additional files" uploads={optionalUploads} />
        )}
      </div>
    </section>
  )
}

function AssetGroup({ label, uploads }: { label: string; uploads: SafeOnboardingUpload[] }) {
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-report-faint">{label}</p>
      <div className="mt-2 divide-y divide-white/[0.06]">
        {uploads.map(upload => (
          <AssetRow key={upload.id} upload={upload} />
        ))}
      </div>
    </div>
  )
}

function AssetRow({ upload }: { upload: SafeOnboardingUpload }) {
  const [downloading, setDownloading] = useState(false)

  async function download() {
    setDownloading(true)
    const { data } = await downloadOnboardingFile(upload.id)
    if (data) {
      const blob = data as Blob
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = upload.originalFilename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    }
    setDownloading(false)
  }

  const icon = fileIcon(upload.mimeType ?? 'application/octet-stream')

  return (
    <div className="flex items-center gap-3 py-2.5">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/[0.06] text-report-faint">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-white">{upload.originalFilename}</p>
        <p className="text-xs text-report-faint">{formatSize(upload.sizeBytes)}</p>
      </div>
      <button
        type="button"
        onClick={() => void download()}
        disabled={downloading}
        className="min-h-9 shrink-0 rounded-lg border border-white/15 px-3 text-xs font-semibold text-report-accent hover:bg-white/[0.05]"
      >
        {downloading ? '...' : 'Download'}
      </button>
    </div>
  )
}

function fileIcon(mimeType: string): string {
  if (mimeType.startsWith('image/')) return 'Image'
  if (mimeType.includes('pdf')) return 'PDF'
  if (mimeType.includes('zip') || mimeType.includes('compressed')) return 'ZIP'
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel') || mimeType.includes('xlsx') || mimeType.includes('csv')) return 'Sheet'
  if (mimeType.includes('document') || mimeType.includes('word') || mimeType.includes('docx')) return 'Doc'
  if (mimeType.includes('presentation') || mimeType.includes('powerpoint') || mimeType.includes('pptx')) return 'Slides'
  return 'File'
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
