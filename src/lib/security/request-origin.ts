export function isAllowedRequestOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return true;

  try {
    const parsedOrigin = new URL(origin);
    if (
      !["http:", "https:"].includes(parsedOrigin.protocol) ||
      parsedOrigin.origin !== origin
    )
      return false;

    // Browser metadata retains the public origin behind the hosting proxy.
    const fetchSite = request.headers.get("sec-fetch-site");
    if (fetchSite === "same-origin") return true;
    if (fetchSite === "cross-site" || fetchSite === "same-site") return false;

    const requestUrl = new URL(request.url);
    if (origin === requestUrl.origin) return true;
    const host =
      request.headers.get("x-forwarded-host")?.split(",")[0]?.trim() ||
      request.headers.get("host");
    const protocol =
      request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() ||
      requestUrl.protocol.slice(0, -1);
    if (!host || !["http", "https"].includes(protocol)) return false;
    const publicUrl = new URL(`${protocol}://${host}`);
    return (
      publicUrl.origin === origin &&
      publicUrl.pathname === "/" &&
      !publicUrl.search &&
      !publicUrl.hash &&
      !publicUrl.username &&
      !publicUrl.password
    );
  } catch {
    return false;
  }
}
