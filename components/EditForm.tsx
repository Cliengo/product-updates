'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ESTADOS, ESTADO_LABELS, type FeatureData } from '@/lib/types'

interface EditFormProps {
  feature: FeatureData
}

const inputCls =
  'w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm text-neutral-800 focus:border-violet-500 focus:ring-1 focus:ring-violet-500 outline-none'

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-neutral-700 mb-1">{label}</label>
      {hint && <p className="text-xs text-neutral-400 mb-1.5">{hint}</p>}
      {children}
    </div>
  )
}

export default function EditForm({ feature }: EditFormProps) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [form, setForm] = useState({
    tituloAmigable: feature.tituloAmigable ?? '',
    descripcionCliente: feature.descripcionCliente ?? '',
    aQuienAplica: feature.aQuienAplica ?? '',
    mensajeSugerido: feature.mensajeSugerido ?? '',
    estadoDisponibilidad: feature.estadoDisponibilidad,
    featureFlag: feature.featureFlag ?? '',
    screenshotsUrl: feature.screenshotsUrl ?? '',
  })

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const stored = typeof window !== 'undefined' ? localStorage.getItem('edit-password') : null
    const password = stored || window.prompt('Contraseña de edición:') || ''
    if (!password) return

    setSaving(true)
    try {
      const res = await fetch(`/api/features/${feature.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-edit-password': password },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) {
        if (res.status === 401) localStorage.removeItem('edit-password')
        throw new Error(data.error || 'Error al guardar')
      }
      localStorage.setItem('edit-password', password)
      router.push(`/features/${feature.id}`)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar')
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-neutral-50">
      <header className="sticky top-0 z-10 border-b border-neutral-200 bg-white/95 backdrop-blur-sm">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center gap-3">
          <Link href={`/features/${feature.id}`} className="flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-800 transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Volver
          </Link>
          <span className="text-neutral-300">/</span>
          <span className="text-sm text-neutral-700 font-medium">Editar</span>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8">
        <h1 className="text-xl font-bold text-neutral-900 mb-1">Editar product update</h1>
        <p className="text-sm text-neutral-500 mb-6">Issue #{feature.issueNumber} · {feature.repo === 'roadmap' ? 'Roadmap' : 'RAP'}</p>

        <form onSubmit={handleSubmit} className="space-y-5 bg-white rounded-xl border border-neutral-200 p-6">
          <Field label="Título amigable">
            <input className={inputCls} value={form.tituloAmigable} onChange={set('tituloAmigable')} required />
          </Field>

          <Field label="Descripción para cliente">
            <textarea className={inputCls} rows={3} value={form.descripcionCliente} onChange={set('descripcionCliente')} />
          </Field>

          <Field label="A quién aplica" hint="Usuarios / planes a los que aplica.">
            <input className={inputCls} value={form.aQuienAplica} onChange={set('aQuienAplica')} />
          </Field>

          <Field label="Mensaje sugerido para cliente" hint="Texto listo para que CS/Ventas comunique.">
            <textarea className={inputCls} rows={3} value={form.mensajeSugerido} onChange={set('mensajeSugerido')} />
          </Field>

          <Field label="Estado">
            <select className={inputCls} value={form.estadoDisponibilidad} onChange={set('estadoDisponibilidad')}>
              {ESTADOS.map(e => (
                <option key={e} value={e}>{ESTADO_LABELS[e]}</option>
              ))}
            </select>
          </Field>

          <Field label="Feature flag (LaunchDarkly)" hint="Opcional, solo si aplica.">
            <input className={inputCls} value={form.featureFlag} onChange={set('featureFlag')} placeholder="nombre-del-flag" />
          </Field>

          <Field label="Captura (URL)" hint="Sugerida desde el issue. Podés reemplazarla o dejarla vacía.">
            <input className={inputCls} value={form.screenshotsUrl} onChange={set('screenshotsUrl')} placeholder="https://..." />
          </Field>

          {error && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>
          )}

          <div className="flex items-center gap-3 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 bg-violet-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-violet-700 transition-colors disabled:opacity-50"
            >
              {saving ? 'Guardando…' : 'Guardar cambios'}
            </button>
            <Link href={`/features/${feature.id}`} className="text-sm text-neutral-500 hover:text-neutral-800">
              Cancelar
            </Link>
          </div>
        </form>
      </main>
    </div>
  )
}
