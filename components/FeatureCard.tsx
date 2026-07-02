import Link from 'next/link'
import type { FeatureData } from '@/lib/types'
import StatusBadge from './StatusBadge'
import TypeBadge from './TypeBadge'
import PriorityBadge from './PriorityBadge'
import AssetIndicators from './AssetIndicators'
import { imageSrc, releaseLabel } from '@/lib/utils'
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
            <div className="flex items-center gap-2 flex-wrap">
              {feature.type && <TypeBadge type={feature.type} />}
              {/* El estado solo se muestra si NO es "Disponible" (beta, deprecado, etc.) */}
              {feature.estadoDisponibilidad !== 'rolled-out' && (
                <StatusBadge estado={feature.estadoDisponibilidad as EstadoDisponibilidad} />
              )}
            </div>
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

          {/* Screenshot preview */}
          {imageSrc(feature.screenshotsUrl) && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imageSrc(feature.screenshotsUrl)!}
              alt={`Captura de ${feature.tituloAmigable}`}
              loading="lazy"
              className="w-full h-40 object-cover object-top rounded-lg border border-neutral-100 bg-neutral-50"
            />
          )}

          {/* Footer */}
          <div className="mt-auto pt-3 border-t border-neutral-100 flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              {feature.producto && (
                <span className="text-xs text-neutral-400 border border-neutral-200 rounded-md px-2 py-0.5">
                  {feature.producto}
                </span>
              )}
              {feature.milestone && (
                <span className="text-xs text-violet-700 bg-violet-50 border border-violet-200 rounded-md px-2 py-0.5">
                  {releaseLabel(feature.milestone, feature.milestoneDate)}
                </span>
              )}
              {feature.companyId && (
                <span
                  className="text-[11px] font-mono text-neutral-500 bg-neutral-100 rounded-md px-2 py-0.5"
                  title="Company ID del cliente afectado"
                >
                  🏢 {feature.companyId}
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
