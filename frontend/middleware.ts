import { NextRequest, NextResponse } from 'next/server';

const locales = ['en', 'fr', 'es', 'de'];
const defaultLocale = 'en';

// Get the preferred locale, either from the cookies or from the accept-language header
function getLocale(request: NextRequest) {
  // Check if there is a cookie with the locale
  const cookieLocale = request.cookies.get('NEXT_LOCALE')?.value;
  
  if (cookieLocale && locales.includes(cookieLocale)) {
    return cookieLocale;
  }
  
  // If no cookie is present, use the accept-language header
  const acceptLanguage = request.headers.get('accept-language');
  if (acceptLanguage) {
    // Parse the accept-language header to get the preferred languages
    const preferredLocales = acceptLanguage
      .split(',')
      .map(locale => {
        const [lang, priority = '1'] = locale.trim().split(';q=');
        return { lang: lang.split('-')[0], priority: parseFloat(priority) };
      })
      .sort((a, b) => b.priority - a.priority)
      .map(item => item.lang);
    
    // Find the first preferred locale that is supported
    const preferredLocale = preferredLocales.find(locale => locales.includes(locale));
    if (preferredLocale) {
      return preferredLocale;
    }
  }
  
  // If no preferred locale is found, use the default
  return defaultLocale;
}

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  
  // Check if the pathname already has a locale
  const pathnameHasLocale = locales.some(
    locale => pathname.startsWith(`/${locale}/`) || pathname === `/${locale}`
  );
  
  if (pathnameHasLocale) return;
  
  // Get the preferred locale
  const locale = getLocale(request);
  
  // Redirect to the locale version of the requested page
  const newUrl = new URL(
    `/${locale}${pathname === '/' ? '' : pathname}${request.nextUrl.search}`,
    request.url
  );
  
  // Set a cookie with the locale
  const response = NextResponse.redirect(newUrl);
  response.cookies.set('NEXT_LOCALE', locale, { 
    maxAge: 30 * 24 * 60 * 60, 
    path: '/' 
  });
  
  return response;
}

export const config = {
  // Only run the middleware on the following paths
  matcher: [
    // Exclude static files, api routes, etc.
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
}; 