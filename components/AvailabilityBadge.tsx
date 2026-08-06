import {
  DISPONIBILIDAD_LABELS,
  DISPONIBILIDAD_TOOLTIPS,
  type Disponibilidad,
} from '@/lib/types'

const STYLES: Record<Disponibilidad, string> = {
  todos: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  parcial: 'bg-amber-50 text-amber-700 border-amber-200',
}

const DOTS: Record<Disponibilidad, string> = {
  todos: 'bg-emerald-500',
  parcial: 'bg-amber-500',
}

interface AvailabilityBadgeProps {
  disponibilidad: Disponibilidad | null | undefined
  size?: 'sm' | 'md'
}

/**
 * Alcance del lanzamiento, derivado del Status del board (IN PROD vs ROLLED OUT).
 * No se edita a mano: cambia solo cuando cambia el issue en GitHub.
 */
export default function AvailabilityBadge({ disponibilidad, size = 'sm' }: AvailabilityBadgeProps) {
  if (!disponibilidad) return null

  return (
    <span
      title={DISPONIBILIDAD_TOOLTIPS[disponibilidad]}
      className={`inline-flex items-center gap-1.5 border rounded-full font-medium ${
        STYLES[disponibilidad]
      } ${size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-sm'}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${DOTS[disponibilidad]}`} />
      {DISPONIBILIDAD_LABELS[disponibilidad]}
    </span>
  )
}
