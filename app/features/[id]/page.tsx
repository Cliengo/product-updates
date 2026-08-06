import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getFeatureById } from '@/lib/db/repository'
import StatusBadge from '@/components/StatusBadge'
import AvailabilityBadge from '@/components/AvailabilityBadge'
import TypeBadge from '@/components/TypeBadge'
import PriorityBadge from '@/components/PriorityBadge'
import CopyButton from '@/components/CopyButton'
import { imageSrc, releaseLabel } from '@/lib/utils'
import {
  DISPONIBILIDAD_LABELS,
  DISPONIBILIDAD_TOOLTIPS,
  type EstadoDisponibilidad,
} from '@/lib/types'

interface PageProps {
  params: Promise<{ id: string }>
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('es-AR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-neutral-200 p-6">
      <h3 className="text-sm font-semibold text-neutral-500 uppercase tracking-wide mb-4">{title}</h3>
      {children}
    </div>
  )
}

export default async function FeatureDetailPage({ params }: PageProps) {
  const { id } = await params
  const feature = await getFeatureById(id)
  if (!feature) notFound()

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-neutral-200 bg-white/95 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center gap-3">
          <Link
            href="/"
            className="flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-800 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Product Updates
          </Link>
          <span className="text-neutral-300">/</span>
          <span className="text-sm text-neutral-700 font-medium truncate max-w-xs">{feature.tituloAmigable}</span>
          <Link
            href={`/features/${feature.id}/edit`}
            className="ml-auto flex items-center gap-1.5 text-sm text-neutral-500 hover:text-violet-700 transition-colors flex-shrink-0"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            Editar
          </Link>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8 space-y-6">
        {/* Hero */}
        <div className="bg-white rounded-xl border border-neutral-200 p-8">
          <div className="flex flex-wrap items-center gap-2 mb-4">
            {feature.type && <TypeBadge type={feature.type} />}
            <AvailabilityBadge disponibilidad={feature.disponibilidad} size="md" />
            {feature.estadoDisponibilidad !== 'rolled-out' && (
              <StatusBadge estado={feature.estadoDisponibilidad as EstadoDisponibilidad} size="md" />
            )}
            {feature.priority && (
              <span className="inline-flex items-center gap-1.5 text-sm text-neutral-500">
                <PriorityBadge priority={feature.priority} />
                <span>{feature.priority}</span>
              </span>
            )}
          </div>

          <h1 className="font-heading text-2xl sm:text-3xl font-extrabold tracking-tight text-neutral-900 mb-3">{feature.tituloAmigable}</h1>

          {feature.descripcionCliente && (
            <p className="text-neutral-600 leading-relaxed text-base">{feature.descripcionCliente}</p>
          )}

          {/* El tooltip del badge no se ve en mobile: la aclaración va también acá. */}
          {feature.disponibilidad === 'parcial' && (
            <p className="mt-4 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
              {DISPONIBILIDAD_TOOLTIPS.parcial} Cuando el rollout termine, esta ficha se
              actualiza sola.
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Screenshot preview */}
            {imageSrc(feature.screenshotsUrl) && (
              <a href={imageSrc(feature.screenshotsUrl)!} target="_blank" rel="noopener noreferrer" className="block">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imageSrc(feature.screenshotsUrl)!}
                  alt={`Captura de ${feature.tituloAmigable}`}
                  className="w-full rounded-xl border border-neutral-200 bg-neutral-50"
                />
              </a>
            )}

            {/* Material para equipos */}
            {(feature.mensajeSugerido || feature.videoUrl || feature.onePagerUrl) && (
              <Section title="Material para equipos cara a cliente">
                <div className="space-y-5">
                  {feature.mensajeSugerido && (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-neutral-700">Mensaje sugerido</span>
                        <CopyButton text={feature.mensajeSugerido} />
                      </div>
                      <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-4 text-sm text-neutral-700 leading-relaxed whitespace-pre-wrap">
                        {feature.mensajeSugerido}
                      </div>
                    </div>
                  )}

                  {(feature.videoUrl || feature.onePagerUrl) && (
                    <div>
                      <span className="text-sm font-medium text-neutral-700 block mb-2">Assets</span>
                      <div className="flex flex-wrap gap-2">
                        {feature.videoUrl && (
                          <a
                            href={feature.videoUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 text-sm text-violet-700 bg-violet-50 border border-violet-200 px-3 py-1.5 rounded-lg hover:bg-violet-100 transition-colors"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            Video demo
                          </a>
                        )}
                        {feature.onePagerUrl && (
                          <a
                            href={feature.onePagerUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 text-sm text-violet-700 bg-violet-50 border border-violet-200 px-3 py-1.5 rounded-lg hover:bg-violet-100 transition-colors"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            One-pager
                          </a>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </Section>
            )}

          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* Stats */}
            <Section title="Detalles">
              <dl className="space-y-3">
                <StatRow label="Producto" value={feature.producto} />
                {feature.companyId && (
                  <div className="flex justify-between items-start gap-2">
                    <dt className="text-xs text-neutral-400 flex-shrink-0">Company ID</dt>
                    <dd className="text-xs text-neutral-700 font-mono text-right break-all">{feature.companyId}</dd>
                  </div>
                )}
                <StatRow label="Aplica a" value={feature.aQuienAplica} />
                <StatRow label="En producción" value={formatDate(feature.milestoneDate)} />
                <StatRow
                  label="Alcance"
                  value={
                    feature.disponibilidad ? DISPONIBILIDAD_LABELS[feature.disponibilidad] : null
                  }
                />
                {feature.rolledOutAt && (
                  <StatRow label="Para todos desde" value={formatDate(feature.rolledOutAt)} />
                )}
                <StatRow label="Release" value={releaseLabel(feature.milestone, feature.milestoneDate)} />
                <StatRow label="Repositorio" value={feature.repo === 'roadmap' ? 'Roadmap' : 'RAP'} />
              </dl>
            </Section>

            {/* Links técnicos */}
            <Section title="Links técnicos">
              <div className="space-y-2">
                <a
                  href={feature.issueUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-violet-700 hover:text-violet-800 transition-colors"
                >
                  <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
                  </svg>
                  Issue #{feature.issueNumber}
                </a>
                {feature.featureFlag && feature.featureFlag !== 'no-flag' && (
                  <div className="flex items-center gap-2 text-sm text-neutral-600">
                    <svg className="w-4 h-4 text-neutral-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
                    </svg>
                    <span className="font-mono text-xs bg-neutral-100 px-2 py-0.5 rounded">{feature.featureFlag}</span>
                  </div>
                )}
              </div>
            </Section>
          </div>
        </div>
      </main>
    </div>
  )
}

function StatRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex justify-between items-start gap-2">
      <dt className="text-xs text-neutral-400 flex-shrink-0">{label}</dt>
      <dd className="text-xs text-neutral-700 font-medium text-right">{value ?? '—'}</dd>
    </div>
  )
}
