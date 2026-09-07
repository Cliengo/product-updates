import Link from 'next/link'

/**
 * Header con la navegación entre solapas. Antes el header estaba escrito adentro de
 * `app/page.tsx`; se extrajo acá cuando apareció la segunda solapa (Delivery) para
 * que las dos muestren lo mismo.
 */
export default function SiteHeader({ activo }: { activo: 'novedades' | 'delivery' }) {
  const solapas = [
    { id: 'novedades', label: 'Novedades', href: '/' },
    { id: 'delivery', label: 'Delivery', href: '/delivery' },
  ] as const

  return (
    <header className="sticky top-0 z-10 border-b border-neutral-200 bg-white/95 backdrop-blur-sm">
      <div className="max-w-7xl mx-auto px-6 py-4">
        <div className="flex items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-violet-600 flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div>
              <h1 className="font-heading text-base font-bold text-neutral-900 leading-tight">Product Updates</h1>
              <p className="text-xs text-neutral-400">Cliengo · Uso interno</p>
            </div>
          </div>

          <nav className="flex items-center gap-1" aria-label="Secciones">
            {solapas.map(s => (
              <Link
                key={s.id}
                href={s.href}
                aria-current={activo === s.id ? 'page' : undefined}
                className={
                  activo === s.id
                    ? 'rounded-lg bg-violet-50 px-3 py-1.5 text-sm font-semibold text-violet-700'
                    : 'rounded-lg px-3 py-1.5 text-sm font-medium text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900'
                }
              >
                {s.label}
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </header>
  )
}
