import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // IMPORTANT: Do not write any logic between createServerClient and
  // supabase.auth.getUser(). A simple mistake could make it very hard
  // to debug issues with users being randomly logged out.

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  // Public routes that don't require auth
  const publicRoutes = ['/login', '/auth/callback'];
  const isPublicRoute = publicRoutes.some((route) => pathname.startsWith(route));

  if (!user && !isPublicRoute) {
    // Not logged in + trying to access protected route → redirect to login
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  if (user && pathname === '/login') {
    // Already logged in + on login page → redirect to appropriate dashboard
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    const url = request.nextUrl.clone();
    if (profile?.role === 'admin') {
      url.pathname = '/dashboard';
    } else if (profile?.role === 'manager') {
      url.pathname = '/team';
    } else {
      url.pathname = '/goals';
    }
    return NextResponse.redirect(url);
  }

  // Role-based route protection
  if (user && !isPublicRoute) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    const role = profile?.role;

    // Admin routes — only admin
    if (pathname.startsWith('/dashboard') && role !== 'admin') {
      const url = request.nextUrl.clone();
      url.pathname = role === 'manager' ? '/team' : '/goals';
      return NextResponse.redirect(url);
    }

    // Manager routes — manager and admin
    if (pathname.startsWith('/team') && role === 'employee') {
      const url = request.nextUrl.clone();
      url.pathname = '/goals';
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}
