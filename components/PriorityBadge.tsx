const PRIORITY_STYLES: Record<string, string> = {
  Alta: 'text-orange-600',
  Media: 'text-yellow-600',
  Baja: 'text-neutral-400',
}

const PRIORITY_ICONS: Record<string, string> = {
  Alta: '▲▲▲',
  Media: '▲▲',
  Baja: '▲',
}

interface PriorityBadgeProps {
  priority: string
}

export default function PriorityBadge({ priority }: PriorityBadgeProps) {
  const style = PRIORITY_STYLES[priority] ?? 'text-neutral-400'
  const icon = PRIORITY_ICONS[priority] ?? '▲'

  return (
    <span className={`text-xs font-medium ${style}`} title={`Prioridad: ${priority}`}>
      {icon}
    </span>
  )
}
