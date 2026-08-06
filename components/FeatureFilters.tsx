'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback } from 'react'
import {
  ESTADOS,
  PRODUCTOS,
  PRIORIDADES,
  TIPOS,
  ESTADO_LABELS,
  TIPO_LABELS,
  DISPONIBILIDADES,
  DISPONIBILIDAD_LABELS,
} from '@/lib/types'
import type { EstadoDisponibilidad } from '@/lib/types'

interface FeatureFiltersProps {
  currentFilters: {
    estado?: string
    disponibilidad?: string
    producto?: string
    priority?: string
    tipo?: string
    release?: string
    q?: string
  }
  totalCount: number
  releases: { value: string; label: string }[]
}

export default function FeatureFilters({ currentFilters, totalCount, releases }: FeatureFiltersProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const updateFilter = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString())
      if (value) {
        params.set(key, value)
      } else {
        params.delete(key)
      }
      router.push(`/?${params.toString()}`)
    },
    [router, searchParams]
  )

  const clearAll = useCallback(() => {
    router.push('/')
  }, [router])

  const hasFilters = Object.values(currentFilters).some(Boolean)

  return (
    <div className="flex flex-col gap-3">
      {/* Search */}
      <div className="relative">
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          placeholder="Buscar por título, descripción o producto..."
          defaultValue={currentFilters.q ?? ''}
          onChange={e => {
            const val = e.target.value
            const params = new URLSearchParams(searchParams.toString())
            if (val) params.set('q', val)
            else params.delete('q')
            router.replace(`/?${params.toString()}`)
          }}
          className="w-full pl-9 pr-4 py-2 text-sm border border-neutral-200 rounded-lg bg-white text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
        />
      </div>

      {/* Filter row */}
      <div className="flex items-center gap-2 flex-wrap">
        <SelectFilter
          label="Estado"
          value={currentFilters.estado ?? ''}
          onChange={v => updateFilter('estado', v)}
          options={ESTADOS.map(e => ({ value: e, label: ESTADO_LABELS[e as EstadoDisponibilidad] }))}
        />
        <SelectFilter
          label="Disponibilidad"
          value={currentFilters.disponibilidad ?? ''}
          onChange={v => updateFilter('disponibilidad', v)}
          options={DISPONIBILIDADES.map(d => ({ value: d, label: DISPONIBILIDAD_LABELS[d] }))}
        />
        <SelectFilter
          label="Producto"
          value={currentFilters.producto ?? ''}
          onChange={v => updateFilter('producto', v)}
          options={PRODUCTOS.map(p => ({ value: p, label: p }))}
        />
        <SelectFilter
          label="Prioridad"
          value={currentFilters.priority ?? ''}
          onChange={v => updateFilter('priority', v)}
          options={PRIORIDADES.map(p => ({ value: p, label: p }))}
        />
        <SelectFilter
          label="Tipo"
          value={currentFilters.tipo ?? ''}
          onChange={v => updateFilter('tipo', v)}
          options={TIPOS.map(t => ({ value: t, label: TIPO_LABELS[t] ?? t }))}
        />
        <SelectFilter
          label="Release"
          value={currentFilters.release ?? ''}
          onChange={v => updateFilter('release', v)}
          options={releases}
        />

        {hasFilters && (
          <button
            onClick={clearAll}
            className="text-xs text-neutral-500 hover:text-neutral-700 underline underline-offset-2 ml-1"
          >
            Limpiar filtros
          </button>
        )}

        <span className="ml-auto text-xs text-neutral-400 font-medium">
          {totalCount} {totalCount === 1 ? 'feature' : 'features'}
        </span>
      </div>
    </div>
  )
}

interface SelectFilterProps {
  label: string
  value: string
  onChange: (value: string) => void
  options: { value: string; label: string }[]
}

function SelectFilter({ label, value, onChange, options }: SelectFilterProps) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className={`text-sm border rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent cursor-pointer ${
        value
          ? 'border-violet-300 text-violet-700 font-medium'
          : 'border-neutral-200 text-neutral-600'
      }`}
    >
      <option value="">{label}</option>
      {options.map(opt => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  )
}
