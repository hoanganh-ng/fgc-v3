import type { infer as zInfer } from "zod";
import type { SourcePublisherKind } from "./source-publisher-kind";
import type { SourcePublisherStatus } from "./source-publisher-status";
import type {
  ExternalPublisherIdSchema,
  SourcePublisherIdSchema,
  SourcePublisherSchema,
} from "./source-publisher.schemas";

export type ExternalPublisherId = zInfer<typeof ExternalPublisherIdSchema>;
export type SourcePublisherId = zInfer<typeof SourcePublisherIdSchema>;
export type SourcePublisher = zInfer<typeof SourcePublisherSchema>;

export type { SourcePublisherKind, SourcePublisherStatus };

export interface SourcePublisherIdentity {
  readonly platform: SourcePublisher["platform"];
  readonly kind: SourcePublisherKind;
  readonly externalPublisherId: ExternalPublisherId;
}

export interface ObserveSourcePublisherInput {
  readonly id: SourcePublisherId;
  readonly identity: SourcePublisherIdentity;
  readonly observedAt: SourcePublisher["lastObservedAt"];
  readonly displayName?: SourcePublisher["displayName"];
  readonly canonicalUrl?: SourcePublisher["canonicalUrl"];
}

export interface ObserveSourcePublisherOptions {
  readonly updatedAt: SourcePublisher["updatedAt"];
}

export function createInitialSourcePublisher(
  input: ObserveSourcePublisherInput,
  options: ObserveSourcePublisherOptions,
): SourcePublisher {
  return {
    id: input.id,
    platform: input.identity.platform,
    kind: input.identity.kind,
    externalPublisherId: input.identity.externalPublisherId,
    ...(input.displayName !== undefined ? { displayName: input.displayName } : {}),
    ...(input.canonicalUrl !== undefined
      ? { canonicalUrl: input.canonicalUrl }
      : {}),
    status: "DISCOVERED",
    firstObservedAt: input.observedAt,
    lastObservedAt: input.observedAt,
    observationCount: 1,
    createdAt: options.updatedAt,
    updatedAt: options.updatedAt,
  };
}

export function applySourcePublisherObservation(
  existing: SourcePublisher,
  input: Omit<ObserveSourcePublisherInput, "id">,
  options: ObserveSourcePublisherOptions,
): SourcePublisher {
  const observedAt = input.observedAt;
  const observedAtIsNewer =
    Date.parse(observedAt) > Date.parse(existing.lastObservedAt);
  const monotonicLastObservedAt = observedAtIsNewer
    ? observedAt
    : existing.lastObservedAt;

  const incomingDisplayName =
    input.displayName !== undefined && observedAtIsNewer
      ? input.displayName
      : undefined;
  const incomingCanonicalUrl =
    input.canonicalUrl !== undefined && observedAtIsNewer
      ? input.canonicalUrl
      : undefined;

  return {
    ...existing,
    ...(incomingDisplayName !== undefined
      ? { displayName: incomingDisplayName }
      : {}),
    ...(incomingCanonicalUrl !== undefined
      ? { canonicalUrl: incomingCanonicalUrl }
      : {}),
    observationCount: existing.observationCount + 1,
    lastObservedAt: monotonicLastObservedAt,
    updatedAt: options.updatedAt,
  };
}

export function observeSourcePublisher(
  existing: SourcePublisher | null,
  input: ObserveSourcePublisherInput,
  options: ObserveSourcePublisherOptions,
): SourcePublisher {
  if (existing === null) {
    return createInitialSourcePublisher(input, options);
  }

  return applySourcePublisherObservation(
    existing,
    {
      identity: input.identity,
      observedAt: input.observedAt,
      ...(input.displayName !== undefined
        ? { displayName: input.displayName }
        : {}),
      ...(input.canonicalUrl !== undefined
        ? { canonicalUrl: input.canonicalUrl }
        : {}),
    },
    options,
  );
}

export function applySourcePublisherStatusUpdate(
  existing: SourcePublisher,
  status: SourcePublisherStatus,
  options: ObserveSourcePublisherOptions,
): SourcePublisher {
  if (existing.status === status) {
    return existing;
  }

  return {
    ...existing,
    status,
    updatedAt: options.updatedAt,
  };
}

export function sourcePublishersShareIdentity(
  left: SourcePublisher,
  right: SourcePublisherIdentity,
): boolean {
  return (
    left.platform === right.platform &&
    left.kind === right.kind &&
    left.externalPublisherId === right.externalPublisherId
  );
}
