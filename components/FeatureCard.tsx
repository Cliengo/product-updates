import Link from 'next/link'
import type { FeatureData } from '@/lib/types'
import StatusBadge from './StatusBadge'
import TypeBadge from './TypeBadge'
import PriorityBadge from './PriorityBadge'
import AssetIndicators from './AssetIndicators'
import type { EstadoDisponibilidad } from '@/lib/types'

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleDateString('es-AR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

interface FeatureCardProps {
  feature: FeatureData
}

export default function FeatureCard({ feature }: FeatureCardProps) {
  const isDeprecated = feature.estadoDisponibilidad === 'deprecated'
  const isInDev = feature.estadoDisponibilidad === 'en-desarrollo'

  return (
    <Link href={`/features/${feature.id}`} className="block group">
      <article
        className={`bg-white rounded-xl border transition-all duration-150 hover:shadow-md hover:-translate-y-0.5 h-full flex flex-col ${
          isDeprecated
            ? 'border-red-100 opacity-70'
            : isInDev
            ? 'border-neutral-200 opacity-80'
            : 'border-neutral-200'
        }`}
      >
        <div className="p-5 flex flex-col gap-3 flex-1">
          {/* Header */}
          <div className="flex items-start justify-between gap-2">
            <StatusBadge estado={feature.estadoDisponibilidad as EstadoDisponibilidad} />
            <div className="flex items-center gap-2 flex-shrink-0">
              {feature.priority && <PriorityBadge priority={feature.priority} />}
              <span className="text-xs text-neutral-400">{formatDate(feature.milestoneDate)}</span>
            </div>
          </div>

          {/* Title */}
          <h2
            className={`font-semibold text-neutral-900 leading-snug group-hover:text-indigo-700 transition-colors ${
              isDeprecated ? 'line-through text-neutral-500' : ''
            }`}
          >
            {feature.tituloAmigable}
          </h2>

          {/* Description */}
          {feature.descripcionCliente && (
            <p className="text-sm text-neutral-500 leading-relaxed line-clamp-2">
              {feature.descripcionCliente}
            </p>
          )}

          {/* Footer */}
          <div className="mt-auto pt-3 border-t border-neutral-100 flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              {feature.type && <TypeBadge type={feature.type} />}
              {feature.producto && (
                <span className="text-xs text-neutral-400 border border-neutral-200 rounded-md px-2 py-0.5">
                  {feature.producto}
                </span>
              )}
            </div>
            <AssetIndicators
              video={feature.videoUrl}
              onePager={feature.onePagerUrl}
              screenshots={feature.screenshotsUrl}
            />
          </div>
        </div>
      </article>
    </Link>
  )
}
