import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * URL para <img>. Las imágenes de issues de GitHub (repo privado) necesitan auth,
 * así que las servimos vía el proxy /api/image. El resto (URLs públicas) van directo.
 */
/**
 * Etiqueta de release con año: "CF 29/06" + año real (de la fecha de producción)
 * → "CF 29/06/2026". Si ya trae año o no hay fecha, devuelve el milestone tal cual.
 */
export function releaseLabel(
  milestone: string | null | undefined,
  dateStr?: string | null
): string {
  if (!milestone) return ''
  if (/\/\d{4}\b/.test(milestone)) return milestone
  if (!dateStr) return milestone
  const year = new Date(dateStr).getUTCFullYear()
  return Number.isNaN(year) ? milestone : `${milestone}/${year}`
}

export function imageSrc(url: string | null | undefined): string | null {
  if (!url) return null
  try {
    const u = new URL(url)
    if (u.hostname === 'github.com' && u.pathname.startsWith('/user-attachments/')) {
      return `/api/image?u=${encodeURIComponent(url)}`
    }
    return url
  } catch {
    return null
  }
}
