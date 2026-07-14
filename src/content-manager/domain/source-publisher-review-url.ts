import type { SourcePublisher } from "./source-publisher";
import type { SourcePublisherKind } from "./source-publisher-kind";

const SAFE_FACEBOOK_HOST = "www.facebook.com";

export interface SourcePublisherReviewIdentity {
  readonly platform: SourcePublisher["platform"];
  readonly kind: SourcePublisherKind;
  readonly externalPublisherId: string;
  readonly canonicalUrl?: string | undefined;
}

/**
 * Computes a read-only safe Facebook review destination for operator inspection.
 * Does not replace persisted `canonicalUrl` and is not an identity key.
 */
export function resolveSourcePublisherReviewUrl(
  identity: SourcePublisherReviewIdentity,
): string | undefined {
  const fromCanonical =
    identity.canonicalUrl !== undefined
      ? normalizeSafeFacebookCanonicalUrl(identity.canonicalUrl)
      : undefined;

  if (fromCanonical !== undefined) {
    return fromCanonical;
  }

  if (identity.platform === "FACEBOOK" && identity.kind === "GROUP") {
    return deriveFacebookGroupReviewUrl(identity.externalPublisherId);
  }

  return undefined;
}

function normalizeSafeFacebookCanonicalUrl(rawUrl: string): string | undefined {
  let parsed: URL;

  try {
    parsed = new URL(rawUrl);
  } catch {
    return undefined;
  }

  if (parsed.protocol !== "https:") {
    return undefined;
  }

  if (parsed.username.length > 0 || parsed.password.length > 0) {
    return undefined;
  }

  const host = parsed.hostname.toLowerCase();
  if (host !== SAFE_FACEBOOK_HOST && host !== "facebook.com") {
    return undefined;
  }

  const path = parsed.pathname.length > 0 ? parsed.pathname : "/";
  const normalizedPath = path.endsWith("/") ? path : `${path}/`;

  return `https://${SAFE_FACEBOOK_HOST}${normalizedPath}`;
}

function deriveFacebookGroupReviewUrl(externalPublisherId: string): string {
  const encoded = encodeURIComponent(externalPublisherId);
  return `https://${SAFE_FACEBOOK_HOST}/groups/${encoded}/`;
}
