import { NextRequest, NextResponse } from 'next/server';
import createMiddleware from 'next-intl/middleware';
import { routing } from './src/i18n/routing';

const intlMiddleware = createMiddleware(routing);

export default async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Extract locale from pathname (e.g. /ar/admin or /en/vendor/dashboard)
  const segments = pathname.split('/').filter(Boolean);
  const locale = routing.locales.includes(segments[0] as any) ? segments[0] : routing.defaultLocale;
  const pathWithoutLocale = routing.locales.includes(segments[0] as any) 
    ? '/' + segments.slice(1).join('/')
    : pathname;

  // Supabase Auth tokens & role cookies
  const supabaseToken = 
    req.cookies.get('sb-access-token')?.value || 
    req.cookies.get('supabase-auth-token')?.value ||
    req.cookies.get('souq_supabase_auth_token')?.value;

  const userRole = req.cookies.get('sb-user-role')?.value;

  // 1. Super Admin Route Protection: /admin/... (except /admin/login)
  if (pathWithoutLocale.startsWith('/admin') && !pathWithoutLocale.startsWith('/admin/login')) {
    if (!supabaseToken) {
      const loginUrl = new URL(`/${locale}/admin/login`, req.url);
      loginUrl.searchParams.set('redirect', pathname);
      return addSecurityHeaders(NextResponse.redirect(loginUrl));
    }

    if (userRole && userRole !== 'super_admin') {
      const loginUrl = new URL(`/${locale}/admin/login`, req.url);
      loginUrl.searchParams.set('error', 'unauthorized_role');
      return addSecurityHeaders(NextResponse.redirect(loginUrl));
    }
  }

  // 2. Vendor Portal Protection: /vendor/dashboard
  if (
    pathWithoutLocale.startsWith('/vendor/dashboard') || 
    (pathWithoutLocale.startsWith('/vendor') && 
     !pathWithoutLocale.startsWith('/vendor/login') && 
     !pathWithoutLocale.startsWith('/vendor/signup') && 
     !pathWithoutLocale.startsWith('/vendor/register'))
  ) {
    if (!supabaseToken) {
      const vendorLoginUrl = new URL(`/${locale}/vendor/login`, req.url);
      vendorLoginUrl.searchParams.set('redirect', pathname);
      return addSecurityHeaders(NextResponse.redirect(vendorLoginUrl));
    }

    if (userRole && userRole !== 'vendor' && userRole !== 'super_admin') {
      const vendorLoginUrl = new URL(`/${locale}/vendor/login`, req.url);
      vendorLoginUrl.searchParams.set('error', 'unauthorized');
      return addSecurityHeaders(NextResponse.redirect(vendorLoginUrl));
    }
  }

  // 3. Delegate to next-intl for localized routing and attach Security Headers
  const response = intlMiddleware(req);
  return addSecurityHeaders(response);
}

// Security Headers Helper
function addSecurityHeaders(response: NextResponse): NextResponse {
  response.headers.set('X-Frame-Options', 'SAMEORIGIN');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  return response;
}

export const config = {
  // Match dynamic locale paths and protect application routes
  matcher: [
    '/',
    '/(ar|en)/:path*',
    '/((?!api|_next|_vercel|.*\\..*).*)'
  ]
};
