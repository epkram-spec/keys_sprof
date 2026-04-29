import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

import { env } from "@/env";
import type { AppRole } from "@/lib/auth/types";

const privatePrefixes = [
  "/overview",
  "/cases",
  "/marketing",
  "/notifications",
  "/imports",
  "/reports",
  "/settings",
  "/admin",
];

const routeRoles: Array<{
  prefix: string;
  roles: AppRole[];
}> = [
  { prefix: "/admin", roles: ["admin"] },
  { prefix: "/imports", roles: ["admin"] },
  { prefix: "/reports", roles: ["leader", "admin"] },
  { prefix: "/marketing", roles: ["marketing", "leader", "admin"] },
  { prefix: "/cases/new", roles: ["manager", "leader", "admin"] },
];

function matchesPrefix(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({
    request,
  });

  const supabase = createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({
          request,
        });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;
  const isPrivateRoute = privatePrefixes.some((prefix) => matchesPrefix(pathname, prefix));

  if (isPrivateRoute && !user) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    redirectUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(redirectUrl);
  }

  if (isPrivateRoute && user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role,is_active")
      .eq("id", user.id)
      .maybeSingle<{ role: AppRole; is_active: boolean }>();

    if (profile?.is_active === false) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = "/login";
      redirectUrl.searchParams.set("error", "inactive");
      return NextResponse.redirect(redirectUrl);
    }

    const role: AppRole = profile?.role ?? (user.email?.toLowerCase() === "epkram@gmail.com" ? "admin" : "manager");
    const rule = routeRoles.find((item) => matchesPrefix(pathname, item.prefix));

    if (rule && !rule.roles.includes(role)) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = "/overview";
      redirectUrl.search = "";
      return NextResponse.redirect(redirectUrl);
    }
  }

  if (pathname === "/login" && user) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/overview";
    redirectUrl.search = "";
    return NextResponse.redirect(redirectUrl);
  }

  return response;
}
