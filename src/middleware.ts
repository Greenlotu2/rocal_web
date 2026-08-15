import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Rutas que NO requieren autenticación
const PUBLIC_ROUTES = ['/login', '/forgot-password']

// Rutas solo para admin
const ADMIN_ROUTES = ['/dashboard/admin', '/dashboard/usuarios']

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Dejar pasar rutas públicas y assets
  if (
    PUBLIC_ROUTES.some((r) => pathname.startsWith(r)) ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api/') ||
    pathname.includes('.')
  ) {
    return NextResponse.next()
  }

  let response = NextResponse.next({
    request: { headers: request.headers },
  })

  // Crear cliente Supabase que lee/escribe cookies
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            request.cookies.set(name, value)
          )
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Obtener sesión (esto también refresca el token automáticamente)
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // ❌ Sin sesión → redirigir a login
  if (!user) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('redirect', pathname) // para volver después de login
    return NextResponse.redirect(loginUrl)
  }

  // 🔒 Rutas de admin → verificar rol en metadata
  if (ADMIN_ROUTES.some((r) => pathname.startsWith(r))) {
    const role = user.user_metadata?.role ?? user.app_metadata?.role

    if (role !== 'admin') {
      // No es admin → mandarlo a su dashboard normal
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
  }

  return response
}

export const config = {
  matcher: [
    // Aplica a todo excepto archivos estáticos y _next internals
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}