/**
 * Shared Collector Runtime utilities for Facebook URL canonicalization.
 *
 * These functions are used by Category Browse exercise target selection and
 * Profile-Source Access Check Run target validation.
 */

/**
 * Canonicalize a Facebook HTTPS URL for comparison.
 *
 * Returns a normalized string (host + pathname, credentials and trailing
 * slashes stripped, www/m/web subdomain prefixes removed) when the URL is a
 * valid, credential-free HTTPS Facebook URL. Returns `undefined` for any
 * other input.
 */
export function canonicalizeFacebookUrl(urlString: string): string | undefined {
  try {
    const url = new URL(urlString);
    if (url.protocol !== "https:") {
      return undefined;
    }
    if (url.username || url.password) {
      return undefined;
    }
    const hostname = url.hostname.toLowerCase();
    const isFacebook =
      hostname === "facebook.com" || hostname.endsWith(".facebook.com");
    if (!isFacebook) {
      return undefined;
    }
    let normalizedHost = hostname;
    if (normalizedHost.startsWith("www.")) {
      normalizedHost = normalizedHost.slice(4);
    }
    if (normalizedHost.startsWith("m.")) {
      normalizedHost = normalizedHost.slice(2);
    }
    if (normalizedHost.startsWith("web.")) {
      normalizedHost = normalizedHost.slice(4);
    }

    let pathname = url.pathname;
    while (pathname.endsWith("/")) {
      pathname = pathname.slice(0, -1);
    }

    return `${normalizedHost}${pathname}`;
  } catch {
    return undefined;
  }
}

/**
 * Return true if both strings canonicalize to the same Facebook URL.
 */
export function sameNormalizedUrl(left: string, right: string): boolean {
  const leftCanon = canonicalizeFacebookUrl(left);
  const rightCanon = canonicalizeFacebookUrl(right);

  return (
    leftCanon !== undefined &&
    rightCanon !== undefined &&
    leftCanon === rightCanon
  );
}
