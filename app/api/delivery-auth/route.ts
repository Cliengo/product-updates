import { NextResponse } from 'next/server'
import { cookieDeAcceso, verificar } from '@/lib/delivery-auth'

/** Valida la clave de la solapa Delivery y deja la cookie de acceso. */
export async function POST(request: Request) {
  const form = await request.formData()
  const password = String(form.get('password') ?? '')

  if (!process.env.DELIVERY_PASSWORD) {
    return NextResponse.redirect(new URL('/delivery?e=config', request.url), 303)
  }
  if (!verificar(password)) {
    return NextResponse.redirect(new URL('/delivery?e=1', request.url), 303)
  }

  const res = NextResponse.redirect(new URL('/delivery', request.url), 303)
  const { name, value, options } = cookieDeAcceso()
  res.cookies.set(name, value, options)
  return res
}
