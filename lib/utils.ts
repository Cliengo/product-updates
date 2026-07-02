import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * URL para <img>. Las imágenes de issues de GitHub (repo privado) necesitan auth,
 * así que las servimos vía el proxy /api/image. El resto (URLs públicas) van directo.
 */
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
