import { createHash } from 'node:crypto'
import { cookies } from 'next/headers'

/**
 * Acceso a la solapa Delivery.
 *
 * Es una CONTRASEÑA COMPARTIDA, el mismo modelo que ya usa la edición del sitio con
 * `EDIT_PASSWORD`. Alcanza para contenido interno y no agrega infraestructura, pero
 * hay que saber qué NO da: no registra quién vio qué, y cuando alguien se va de la
 * empresa hay que rotarla para todos. Si en algún momento hace falta identidad real
 * por persona, eso es Google OAuth con el dominio de Cliengo — otro proyecto, no una
 * variante de esto.
 *
 * Va en una variable APARTE de `EDIT_PASSWORD` a propósito: las audiencias son
 * distintas. Ver Delivery es para admin, operaciones y ventas; editar el contenido es
 * para las pocas personas que lo curan. Con una sola clave, cualquiera que pueda
 * mirar podría además editar.
 */

const COOKIE = 'delivery_ok'

/** Lo que se guarda en la cookie no es la contraseña: es un hash de un solo sentido. */
function marca(password: string): string {
  return createHash('sha256').update(`delivery:${password}`).digest('hex')
}

export type EstadoAcceso = 'ok' | 'sin-clave' | 'sin-configurar'

export async function estadoAcceso(): Promise<EstadoAcceso> {
  const esperada = process.env.DELIVERY_PASSWORD
  if (!esperada) return 'sin-configurar'
  const cookie = (await cookies()).get(COOKIE)?.value
  return cookie === marca(esperada) ? 'ok' : 'sin-clave'
}

export function verificar(password: string): boolean {
  const esperada = process.env.DELIVERY_PASSWORD
  return Boolean(esperada) && password === esperada
}

export function cookieDeAcceso(): { name: string; value: string; options: object } {
  return {
    name: COOKIE,
    value: marca(process.env.DELIVERY_PASSWORD ?? ''),
    options: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
    },
  }
}
