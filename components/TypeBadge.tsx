import { TIPO_LABELS } from '@/lib/types'

const TIPO_STYLES: Record<string, string> = {
  Story: 'bg-violet-50 text-violet-700 border-violet-200',
  'Bug Cliente': 'bg-orange-50 text-orange-700 border-orange-200',
  'Bug Producto': 'bg-rose-50 text-rose-700 border-rose-200',
  RAP: 'bg-teal-50 text-teal-700 border-teal-200',
}

interface TypeBadgeProps {
  type: string
}

export default function TypeBadge({ type }: TypeBadgeProps) {
  const styles = TIPO_STYLES[type] ?? 'bg-neutral-100 text-neutral-500 border-neutral-200'
  const label = TIPO_LABELS[type] ?? type

  return (
    <span
      className={`inline-flex items-center border rounded-md px-2 py-0.5 text-xs font-medium ${styles}`}
    >
      {label}
    </span>
  )
}
