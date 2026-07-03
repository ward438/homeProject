import { DocumentsWorkspace } from '@/components/documents/documents-workspace'

export default function DocumentsPage() {
  return (
    <div className="h-[calc(100dvh-var(--header-height,3.5rem))] overflow-hidden">
      <DocumentsWorkspace />
    </div>
  )
}
