import { Suspense } from 'react'
import { getFeatures, getReleases, type FeatureFilters as FilterParams } from '@/lib/db/repository'
import FeatureCard from '@/components/FeatureCard'
import FeatureFilters from '@/components/FeatureFilters'
import SiteHeader from '@/components/SiteHeader'

interface PageProps {
  searchParams: Promise<{
    estado?: string
    disponibilidad?: string
    producto?: string
    priority?: string
    tipo?: string
    release?: string
    q?: string
  }>
}

export default async function LandingPage({ searchParams }: PageProps) {
  const params = await searchParams
  const filters: FilterParams = {
    estado: params.estado,
    disponibilidad: params.disponibilidad,
    producto: params.producto,
    priority: params.priority,
    tipo: params.tipo,
    release: params.release,
    q: params.q,
  }
  const [features, releases] = await Promise.all([getFeatures(filters), getReleases()])

  return (
    <div className="min-h-screen bg-neutral-50">
      <SiteHeader activo="novedades" />

      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="mb-8">
          <h2 className="font-heading text-3xl sm:text-4xl font-extrabold tracking-tight text-neutral-900 mb-2">
            Novedades del producto
          </h2>
          <p className="text-neutral-500 text-base max-w-2xl">
            Explorá los últimos lanzamientos de Cliengo: features, mejoras y fixes — con contexto, estado y material listo para comunicar al cliente.
          </p>
        </div>

        <Suspense>
          <FeatureFilters currentFilters={params} totalCount={features.length} releases={releases} />
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
