import { ESTADO_LABELS, type EstadoDisponibilidad } from '@/lib/types'

const ESTADO_STYLES: Record<EstadoDisponibilidad, string> = {
  'rolled-out': 'bg-emerald-50 text-emerald-700 border-emerald-200',
  flag: 'bg-blue-50 text-blue-700 border-blue-200',
  'beta-privada': 'bg-amber-50 text-amber-700 border-amber-200',
  'beta-publica': 'bg-yellow-50 text-yellow-700 border-yellow-200',
  'on-demand': 'bg-violet-50 text-violet-700 border-violet-200',
  'en-desarrollo': 'bg-neutral-100 text-neutral-500 border-neutral-200',
  deprecated: 'bg-red-50 text-red-600 border-red-200',
}

const ESTADO_DOTS: Record<EstadoDisponibilidad, string> = {
  'rolled-out': 'bg-emerald-500',
  flag: 'bg-blue-500',
  'beta-privada': 'bg-amber-500',
  'beta-publica': 'bg-yellow-500',
  'on-demand': 'bg-violet-500',
  'en-desarrollo': 'bg-neutral-400',
  deprecated: 'bg-red-500',
}

interface StatusBadgeProps {
  estado: EstadoDisponibilidad
  size?: 'sm' | 'md'
}

export default function StatusBadge({ estado, size = 'sm' }: StatusBadgeProps) {
  const styles = ESTADO_STYLES[estado] ?? 'bg-neutral-100 text-neutral-500 border-neutral-200'
  const dot = ESTADO_DOTS[estado] ?? 'bg-neutral-400'
  const label = ESTADO_LABELS[estado] ?? estado

  return (
    <span
      className={`inline-flex items-center gap-1.5 border rounded-full font-medium ${styles} ${
        size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-sm'
      }`}
    >
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dot}`} />
      {label}
    </span>
  )
}
