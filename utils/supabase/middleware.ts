import { createServerClient } from '@supabase/ssr'
import { type NextRequest, NextResponse } from 'next/server'
import { copySetCookies } from './cookies'

export async function updateSession(request: NextRequest) {
  const isDev = process.env.NODE_ENV === 'development'
  let supabaseResponse = NextResponse.next({
    request,
  })

  const { pathname } = request.nextUrl;

  // Skip middleware completely for the auth callback to prevent cookie interference during PKCE exchange
  if (pathname.startsWith('/auth/callback')) {
    return supabaseResponse;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    if (isDev) {
      console.warn('Missing Supabase environment variables in Middleware.');
    }
    return supabaseResponse;
  }

  const supabase = createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: any) {
          request.cookies.set({
            name,
            value,
            ...options,
          })
          supabaseResponse = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          supabaseResponse.cookies.set({
            name,
            value,
            ...options,
          })
        },
        remove(name: string, options: any) {
          request.cookies.set({
            name,
            value: '',
            ...options,
          })
          supabaseResponse = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          supabaseResponse.cookies.set({
            name,
            value: '',
            ...options,
          })
        },
      },
    }
  )

  const { data, error } = await supabase.auth.getUser()
  const user = data?.user;

  if (isDev) console.log(`[Middleware] Path: ${request.nextUrl.pathname}, User Found: ${!!user}`);
  if (isDev && !user && request.cookies.getAll().length > 0) {
    console.log(`[Middleware] Cookies present but no user!`, request.cookies.getAll().map(c => c.name));
  }

  if (error && error.message !== 'Auth session missing!') {
    console.error('Middleware getUser error:', error.message);

    // If the refresh token is stale/invalid, the cookie is corrupted.
    // Clear it and redirect to the dashboard — otherwise the user gets stuck in an infinite loop.
    if (
      error.message.includes('refresh_token_not_found') ||
      error.message.includes('Invalid Refresh Token') ||
      error.message.includes('does not exist')
    ) {
      const loginUrl = new URL('/dashboard', request.url);
      const response = NextResponse.redirect(loginUrl);
      // Delete the stale auth cookie so the next visit is clean
      const authCookieName = `sb-${supabaseUrl.replace('https://', '').split('.')[0]}-auth-token`;
      response.cookies.delete(authCookieName);
      response.cookies.delete(`${authCookieName}.0`);
      response.cookies.delete(`${authCookieName}.1`);
      return response;
    }
  }

  // pathname is already extracted above

  const publicRoutes = [
    "/sign-up",
    "/sign-in",
    "/verify-otp",
    "/auth/callback",
    "/update-password",
    "/forgot-password",
    "/dashboard/reels",
    "/home",
    "/waiting-list"
  ];
  const publicExactRoutes = ["/dashboard"];
  const authRoutes = ["/sign-up", "/sign-in", "/auth/callback"];
  
  const isPublicRoute = publicRoutes.some(route => pathname.startsWith(route)) || publicExactRoutes.includes(pathname);
  const isAuthRoute = authRoutes.some(route => pathname.startsWith(route));

  // Helper for redirection that preserves cookies exactly
  const redirectWithCookies = (url: URL | string) => {
    const targetUrl = new URL(url, request.url);
    const redirectResponse = NextResponse.redirect(targetUrl);

    copySetCookies(supabaseResponse, redirectResponse)

    if (isDev) console.log(`Middleware Redirecting to ${url} from ${pathname}`);
    return redirectResponse;
  };

  // 1. Not logged in
  if (!user) {
    if (isPublicRoute || pathname === '/' || pathname === '/favicon.ico') return supabaseResponse;
    const redirectUrl = new URL("/dashboard", request.url);
    redirectUrl.searchParams.set("loginRequired", "true");
    redirectUrl.searchParams.set("redirectedFrom", pathname);
    if (isDev) console.log(`No user, redirecting to dashboard from ${pathname}.`);
    return redirectWithCookies(redirectUrl);
  }

  // 2. Fetch profile data (Fail gracefully if Edge timeout)
  let profile = null;
  let submission = null;
  let isApprovedCreator = false;

  try {
    const { data: profileData, error: profileError } = await supabase
      .from("users")
      .select("id, role, verification_status, isAuthorize")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) console.error('Middleware profile fetch error:', profileError);
    profile = profileData;

    // We need to fetch submissions for all users because viewers can submit verification applications
    const { data: submissionData } = await supabase
      .from("verification_submissions")
      .select("status")
      .eq("creator_id", user.id)
      .maybeSingle();
    submission = submissionData;

    if (profile?.role === 'admin') {
      isApprovedCreator = true;
    } else {
      isApprovedCreator = (
        submission?.status?.toLowerCase() === 'approved' ||
        profile?.verification_status?.toLowerCase() === 'approved'
      );
    }
  } catch (err) {
    console.error("Middleware DB Fetch issue:", err);
  }

  // 3. Logged in and on auth pages -> redirect to appropriate dashboard
  // We removed pathname === '/' from here to allow users to see the landing page first
  if (isAuthRoute) {
    const role = profile?.role || 'client';

    // Default target for everyone (including creators) is the main feed
    let target = "/dashboard";

    // Admins go to their specific portal
    if (role === 'admin') target = "/admin";

    if (isDev) console.log(`Auth route ${pathname}. Logged in as ${role}. Redirecting to ${target}`);
    return redirectWithCookies(target);
  }

  // 4. Missing profile safety
  if (!profile) return supabaseResponse;

  // 5. OTP Check for all users except admins and OAuth users
  // OAuth users (Google, GitHub, etc.) are pre-verified by the provider — skip OTP
  // We also allow 'pending' status to bypass OTP because it means they've verified their email
  // but are waiting for admin approval (for creators).
  const isOAuthUser = user?.app_metadata?.provider && user.app_metadata.provider !== 'email';
  const isVerified = profile.verification_status === "approved" || profile.verification_status === "pending";

  if (profile.role !== 'admin' && !isOAuthUser && !isVerified) {
    if (isPublicRoute) return supabaseResponse;
    if (pathname.startsWith("/creator/verify")) return supabaseResponse;
    if (pathname.startsWith("/creator/pending")) return supabaseResponse;

    return redirectWithCookies("/verify-otp");
  }

  // 6. isAuthorize Check
  // If user is not an admin and isAuthorize is false, redirect to /waiting-list
  if (profile.role !== 'admin' && profile.isAuthorize === false) {
    if (pathname !== '/waiting-list' && !isPublicRoute) {
      return redirectWithCookies("/waiting-list");
    }
  }

  // If user is authorized but on waiting-list, redirect to dashboard
  if (profile.isAuthorize === true && pathname === '/waiting-list') {
    return redirectWithCookies("/dashboard");
  }

  // 7. Access Control for /creator-dashboard
  if (pathname.startsWith("/creator-dashboard")) {
    if (!isApprovedCreator) {
      return redirectWithCookies("/dashboard");
    }
  }

  // 7. Access Control for /creator/ (Verify/Pending)
  if (pathname.startsWith("/creator/")) {
    if (isApprovedCreator) {
      return redirectWithCookies("/creator-dashboard");
    }

    if (pathname === "/creator/pending") {
      if (!submission || (submission.status !== "pending" && submission.status !== "approved")) {
        return redirectWithCookies("/creator/verify");
      }
    }
  }

  return supabaseResponse;
}