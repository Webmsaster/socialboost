import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  // --- CSRF Protection: Origin header verification for API mutations ---
  const method = request.method;
  const pathname = request.nextUrl.pathname;
  const isMutationMethod = method === "POST" || method === "PATCH" || method === "DELETE";
  const isApiRoute = pathname.startsWith("/api/");
  const isWebhook = pathname === "/api/stripe/webhook";
  // The public v1 API is authenticated via Bearer API keys and is meant to
  // be called from external clients (curl, server-to-server), which never
  // send an Origin header. Skipping CSRF here is safe because the API key
  // itself is the credential and cookie-based auth is not used on /api/v1.
  const isPublicApi = pathname.startsWith("/api/v1/");

  if (isApiRoute && isMutationMethod && !isWebhook && !isPublicApi) {
    const origin = request.headers.get("origin");
    const referer = request.headers.get("referer");
    const requestOrigin = request.nextUrl.origin;

    const allowedOrigins = new Set<string>([requestOrigin]);
    if (process.env.NEXT_PUBLIC_APP_URL) {
      allowedOrigins.add(process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, ""));
    }
    if (process.env.NEXT_PUBLIC_SITE_URL) {
      allowedOrigins.add(process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, ""));
    }

    let isValid = false;

    if (origin) {
      isValid = allowedOrigins.has(origin);
    } else if (referer) {
      try {
        const refererOrigin = new URL(referer).origin;
        isValid = allowedOrigins.has(refererOrigin);
      } catch {
        isValid = false;
      }
    }

    if (!isValid) {
      return NextResponse.json(
        { error: "CSRF validation failed" },
        { status: 403 }
      );
    }
  }

  let supabaseResponse = NextResponse.next({ request });

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    console.error("Supabase environment variables are not configured");
    return new NextResponse("Service unavailable", { status: 503 });
  }

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
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const protectedPaths = ["/dashboard", "/create", "/history", "/calendar", "/accounts", "/settings"];
  const isProtected = protectedPaths.some((path) =>
    request.nextUrl.pathname.startsWith(path)
  );

  if (isProtected && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  const authPaths = ["/login", "/signup"];
  const isAuthPage = authPaths.some((path) =>
    request.nextUrl.pathname.startsWith(path)
  );

  if (isAuthPage && user) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
