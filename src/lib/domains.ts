export const ROOT_DOMAIN = "limon.lat";

export function isLimonHost(host: string | null) {
  const hostname = host?.split(":", 1)[0]?.toLowerCase().replace(/\.$/, "");
  return (
    hostname === ROOT_DOMAIN || hostname?.endsWith(`.${ROOT_DOMAIN}`) === true
  );
}

export function restaurantUrl(slug: string) {
  return `https://${slug}.${ROOT_DOMAIN}`;
}
