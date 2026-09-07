import Link from 'next/link'
import SiteHeader from '@/components/SiteHeader'
import { getDeliveryRows } from '@/lib/db/repository'
import { estadoAcceso } from '@/lib/delivery-auth'
import { evaluar, type Requisito } from '@/lib/delivery'

export const metadata = { title: 'Delivery · Product Updates' }

interface PageProps {
  searchParams: Promise<{ ver?: string; e?: string }>
}

export default async function DeliveryPage({ searchParams }: PageProps) {
  const params = await searchParams
  const acceso = await estadoAcceso()

  if (acceso !== 'ok') {
    return (
      <div className="min-h-screen bg-neutral-50">
        <SiteHeader activo="delivery" />
        <main className="max-w-md mx-auto px-6 py-20">
          <h2 className="font-heading text-2xl font-extrabold tracking-tight text-neutral-900 mb-2">
            Delivery
          </h2>
          <p className="text-neutral-500 text-sm mb-6">
            Esta sección todavía está en armado, así que pide clave. La comparte el equipo de
            Producto.
          </p>

          {acceso === 'sin-configurar' ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              Falta configurar <code className="font-mono text-xs">DELIVERY_PASSWORD</code> en las
              variables de entorno del sitio. Hasta que esté, nadie puede entrar.
            </div>
          ) : (
            <form action="/api/delivery-auth" method="post" className="space-y-3">
              <label htmlFor="password" className="block text-sm font-medium text-neutral-700">
                Clave
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-200"
              />
              {params.e === '1' && (
                <p className="text-sm text-red-600">La clave no coincide. Probá de nuevo.</p>
              )}
              <button
                type="submit"
                className="w-full rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700"
              >
                Entrar
              </button>
            </form>
          )}
        </main>
      </div>
    )
  }

  const rows = await getDeliveryRows()
  const evaluadas = rows
    .map(r => ({ row: r, req: evaluar(r) }))
    .filter(x => x.req.instructivo.estado !== 'no-aplica' || x.req.chargebee.estado !== 'no-aplica')

  const conPendientes = evaluadas.filter(x => x.req.pendientes > 0)
  const soloPendientes = params.ver !== 'todos'
  const visibles = soloPendientes ? conPendientes : evaluadas

  return (
    <div className="min-h-screen bg-neutral-50">
      <SiteHeader activo="delivery" />

      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="mb-6">
          <h2 className="font-heading text-3xl sm:text-4xl font-extrabold tracking-tight text-neutral-900 mb-2">
            Delivery
          </h2>
          <p className="text-neutral-500 text-base max-w-3xl">
            El board dice <strong>dónde está</strong> cada cosa y <strong>a quién le llega</strong>.
            Acá está la tercera pregunta: <strong>qué falta</strong> para poder explicarlo, venderlo
            o cobrarlo. No se carga a mano — se lee de los campos de cada feature.
          </p>
        </div>

        <div className="mb-6 flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl border border-neutral-200 bg-white px-5 py-4">
          <p className="text-sm text-neutral-600">
            <strong className="font-heading text-xl font-bold text-neutral-900 tabular-nums">
              {conPendientes.length}
            </strong>{' '}
            de {evaluadas.length} features que requieren algo tienen algo pendiente
          </p>
          <div className="flex items-center gap-1 text-sm">
            <Link
              href="/delivery"
              className={
                soloPendientes
                  ? 'rounded-lg bg-violet-50 px-3 py-1 font-semibold text-violet-700'
                  : 'rounded-lg px-3 py-1 text-neutral-500 hover:bg-neutral-100'
              }
            >
              Pendientes
            </Link>
            <Link
              href="/delivery?ver=todos"
              className={
                !soloPendientes
                  ? 'rounded-lg bg-violet-50 px-3 py-1 font-semibold text-violet-700'
                  : 'rounded-lg px-3 py-1 text-neutral-500 hover:bg-neutral-100'
              }
            >
              Todas
            </Link>
          </div>
        </div>

        {visibles.length === 0 ? (
          <div className="rounded-xl border border-neutral-200 bg-white py-16 text-center">
            <div className="mb-3 text-4xl">✅</div>
            <p className="font-medium text-neutral-600">No hay nada pendiente.</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-200 bg-neutral-50 text-left">
                  <Th>Feature</Th>
                  <Th>Estado</Th>
                  <Th>Instructivo</Th>
                  <Th>Material</Th>
                  <Th>
                    Chargebee <Nota>sugerido</Nota>
                  </Th>
                </tr>
              </thead>
              <tbody>
                {visibles.map(({ row, req }) => (
                  <tr key={row.id} className="border-b border-neutral-100 last:border-0 align-top">
                    <td className="px-4 py-3">
                      <Link
                        href={`/features/${row.id}`}
                        className="font-medium text-neutral-900 hover:text-violet-700"
                      >
                        {row.tituloAmigable}
                      </Link>
                      <p className="mt-0.5 text-xs text-neutral-400">
                        <a
                          href={row.issueUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:text-neutral-600"
                        >
                          #{row.issueNumber}
                        </a>
                        {row.producto ? ` · ${row.producto}` : ''}
                        {row.type ? ` · ${row.type}` : ''}
                      </p>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-neutral-500">
                      <div>{row.githubStatus ?? '—'}</div>
                      <div className="mt-0.5 text-neutral-400">
                        {row.disponibilidad === 'todos'
                          ? 'para todos'
                          : row.disponibilidad === 'parcial'
                            ? 'rollout parcial'
                            : '—'}
                      </div>
                    </td>
                    <Celda req={req.instructivo} />
                    <Celda req={req.material} />
                    <Celda req={req.chargebee} />
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-6 space-y-2 text-xs leading-relaxed text-neutral-500">
          <p>
            <strong>Chargebee no se puede verificar todavía.</strong> La API se lee sin problema,
            pero para saber si un feature está configurado hace falta saber qué ítem de Chargebee le
            corresponde, y ese vínculo no existe en ningún campo. Es la convención de SKU pendiente
            con Finanzas. Mientras no esté, la columna dice <em>sin verificar</em> en vez de inventar
            un ✓ o un ✗.
          </p>
          <p>
            <strong>La columna Chargebee marca &laquo;sugerido&raquo;</strong> porque el
            &laquo;requiere / no requiere&raquo; sale de una regla sobre el producto, el tipo y el
            título — no es un dato que alguien haya cargado.
          </p>
          <p>
            Los requisitos se completan editando la feature (botón <em>Editar</em> en su ficha). Las
            fechas indican desde cuándo lo vemos cumplido: las que se cumplieron antes de que
            empezáramos a medir no tienen fecha.
          </p>
        </div>
      </main>
    </div>
  )
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-neutral-500">
      {children}
    </th>
  )
}

function Nota({ children }: { children: React.ReactNode }) {
  return (
    <span className="ml-1 rounded bg-neutral-200 px-1.5 py-0.5 text-[10px] font-medium normal-case tracking-normal text-neutral-600">
      {children}
    </span>
  )
}

const ESTILO = {
  cumplido: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  pendiente: 'bg-amber-50 text-amber-800 border-amber-200',
  'sin-verificar': 'bg-sky-50 text-sky-700 border-sky-200',
  'no-aplica': 'bg-neutral-50 text-neutral-400 border-neutral-200',
} as const

const ETIQUETA = {
  cumplido: 'Listo',
  pendiente: 'Falta',
  'sin-verificar': 'Sin verificar',
  'no-aplica': 'No aplica',
} as const

function Celda({ req }: { req: Requisito }) {
  return (
    <td className="px-4 py-3">
      <span
        className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${ESTILO[req.estado]}`}
      >
        {ETIQUETA[req.estado]}
      </span>
      {req.faltan.length > 0 && (
        <p className="mt-1 text-xs text-neutral-500">{req.faltan.join(' · ')}</p>
      )}
      {req.desde && (
        <p className="mt-1 text-xs tabular-nums text-neutral-400">
          {new Date(req.desde).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}
        </p>
      )}
    </td>
  )
}
