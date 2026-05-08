import { Suspense } from 'react'
import { getFeatures, type FeatureFilters } from '@/lib/db/repository'
import FeatureCard from '@/components/FeatureCard'
import FeatureFilters from '@/components/FeatureFilters'

interface PageProps {
  searchParams: Promise<{
    estado?: string
    producto?: string
    priority?: string
    tipo?: string
    q?: string
  }>
}

export default async function LandingPage({ searchParams }: PageProps) {
  const params = await searchParams
  const filters: FeatureFilters = {
    estado: params.estado,
    producto: params.producto,
    priority: params.priority,
    tipo: params.tipo,
    q: params.q,
  }
  const features = await getFeatures(filters)

  return (
    <div className="min-h-screen bg-neutral-50">
      <header className="sticky top-0 z-10 border-b border-neutral-200 bg-white/95 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div>
              <h1 className="text-base font-semibold text-neutral-900 leading-tight">Product Updates</h1>
              <p className="text-xs text-neutral-400">Cliengo · Uso interno</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-neutral-900 mb-1">Novedades del producto</h2>
          <p className="text-neutral-500 text-sm">
            Features lanzados, en beta y en desarrollo — con contexto, estado real y material para comunicar al cliente.
          </p>
        </div>

        <Suspense>
          <FeatureFilters currentFilters={params} totalCount={features.length} />
        </Suspense>

        {features.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-4xl mb-3">🔍</div>
            <p className="text-neutral-500 font-medium">No hay features con esos filtros.</p>
            <p className="text-neutral-400 text-sm mt-1">Probá cambiando o limpiando los filtros.</p>
          </div>
        ) : (
          <div className="mt-6 grid gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
            {features.map(feature => (
              <FeatureCard key={feature.id} feature={feature} />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
