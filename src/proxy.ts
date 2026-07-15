import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { ROOT_DOMAIN } from "@/lib/domains";

function restaurantSlugFromHost(host: string | null) {
  const hostname = host?.split(":", 1)[0]?.toLowerCase().replace(/\.$/, "");
  const suffix = `.${ROOT_DOMAIN}`;
  if (!hostname?.endsWith(suffix)) return undefined;

  const slug = hostname.slice(0, -suffix.length);
  if (!slug || slug.includes(".")) return undefined;
  return /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(slug) ? slug : undefined;
}

export function proxy(request: NextRequest) {
  const slug = restaurantSlugFromHost(request.headers.get("host"));
  if (!slug) return NextResponse.next();

  const url = request.nextUrl.clone();
  if (slug === "www") {
    url.hostname = ROOT_DOMAIN;
    return NextResponse.redirect(url, 308);
  }

  if (url.pathname !== "/") {
    url.pathname = "/";
    return NextResponse.redirect(url, 308);
  }

  url.pathname = `/${slug}`;
  return NextResponse.rewrite(url);
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)",
  ],
};
