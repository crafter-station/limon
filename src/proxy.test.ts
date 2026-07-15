import { describe, expect, test } from "bun:test";
import {
  getRedirectUrl,
  getRewrittenUrl,
  isRewrite,
  unstable_doesMiddlewareMatch,
} from "next/experimental/testing/server";
import { NextRequest } from "next/server";
import { config, proxy } from "./proxy";

function request(host: string, pathname = "/") {
  return new NextRequest(`https://${host}${pathname}`, {
    headers: { host },
  });
}

describe("wildcard restaurant routing", () => {
  test("rewrites a first-level restaurant subdomain to its slug route", () => {
    const response = proxy(request("palmeras.limon.lat"));

    expect(isRewrite(response)).toBe(true);
    expect(getRewrittenUrl(response)).toBe(
      "https://palmeras.limon.lat/palmeras",
    );
  });

  test("leaves the apex and unrelated hosts unchanged", () => {
    expect(proxy(request("limon.lat")).headers.get("x-middleware-next")).toBe(
      "1",
    );
    expect(
      proxy(request("limon-ten.vercel.app")).headers.get("x-middleware-next"),
    ).toBe("1");
    expect(
      proxy(request("nested.palmeras.limon.lat")).headers.get(
        "x-middleware-next",
      ),
    ).toBe("1");
  });

  test("redirects www and tenant paths to their canonical URLs", () => {
    const wwwResponse = proxy(request("www.limon.lat", "/about"));
    const tenantResponse = proxy(request("palmeras.limon.lat", "/another"));

    expect(wwwResponse.status).toBe(308);
    expect(getRedirectUrl(wwwResponse)).toBe("https://limon.lat/about");
    expect(tenantResponse.status).toBe(308);
    expect(getRedirectUrl(tenantResponse)).toBe("https://palmeras.limon.lat/");
  });

  test("does not run for application internals", () => {
    expect(
      unstable_doesMiddlewareMatch({
        config,
        nextConfig: {},
        url: "/_next/static/app.js",
      }),
    ).toBe(false);
    expect(
      unstable_doesMiddlewareMatch({
        config,
        nextConfig: {},
        url: "/api/generations/example",
      }),
    ).toBe(false);
  });
});
