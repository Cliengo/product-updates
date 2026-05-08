import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Auth stub — replace with SSO integration when ready.
// Set BYPASS_AUTH=true in .env.local to skip auth in development.
export function proxy(request: NextRequest) {
  if (process.env.BYPASS_AUTH === 'true') {
    return NextResponse.next()
  }

  // TODO: validate session cookie / JWT from your SSO provider here
  // Example with a session cookie:
  // const session = request.cookies.get('session')
  // if (!session?.value) {
  //   return NextResponse.redirect(new URL('/login', request.url))
  // }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!api/sync|_next/static|_next/image|favicon.ico).*)'],
}
