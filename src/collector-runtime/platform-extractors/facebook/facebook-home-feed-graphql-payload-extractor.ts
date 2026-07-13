import {
  DEFAULT_FACEBOOK_TOP_COMMENT_LIMIT,
  FACEBOOK_EXTRACTOR_PLATFORM,
} from "./facebook-extractor.types";
import type {
  FacebookHomeFeedExtractedContentCandidate,
  FacebookHomeFeedExtractedTopComment,
  FacebookHomeFeedExtractionIssue,
  FacebookHomeFeedExtractionIssueCode,
  FacebookHomeFeedExtractionWarning,
  FacebookHomeFeedExtractionWarningCode,
  FacebookHomeFeedGraphQLExtractionResult,
  FacebookHomeFeedGraphQLPayloadExtractionInput,
  FacebookHomeFeedGraphQLPayloadExtractorOptions,
  FacebookHomeFeedPublisherKind,
  FacebookHomeFeedPublisherObservation,
} from "./facebook-home-feed-extractor.types";

const MAX_TRAVERSAL_DEPTH = 16;
const MAX_OBJECT_VISITS = 2_500;

const POST_ID_KEYS = [
  "externalPostId",
  "postId",
  "post_id",
  "postID",
  "story_fbid",
  "legacy_fbid",
  "legacyId",
  "fbid",
] as const;

const COMMENT_ID_KEYS = [
  "externalCommentId",
  "commentId",
  "comment_id",
  "commentID",
  "legacy_fbid",
  "legacyId",
  "fbid",
] as const;

const PRIMARY_COMMENT_ID_KEYS = [
  "externalCommentId",
  "commentId",
  "comment_id",
  "commentID",
] as const;

const URL_KEYS = [
  "sourceUrl",
  "url",
  "permalinkUrl",
  "permalink_url",
  "shareableUrl",
  "wwwURL",
  "postUrl",
  "externalUrl",
] as const;

const POST_BODY_KEYS = [
  "bodyText",
  "body",
  "message",
  "messageText",
  "postMessage",
  "storyMessage",
] as const;

const COMMENT_BODY_KEYS = [
  "bodyText",
  "body",
  "message",
  "messageText",
  "commentBody",
] as const;

const TITLE_KEYS = ["title", "headline", "summary"] as const;

const AUTHOR_KEYS = [
  "author",
  "actor",
  "actors",
  "owner",
  "profile",
  "user",
  "from",
] as const;

const AUTHOR_DISPLAY_NAME_KEYS = [
  "authorDisplayName",
  "displayName",
  "display_name",
  "name",
  "shortName",
] as const;

const AUTHOR_EXTERNAL_ID_KEYS = [
  "authorExternalId",
  "profileId",
  "profile_id",
  "userId",
  "user_id",
  "externalId",
  "external_id",
  "id",
] as const;

const POST_DATE_KEYS = [
  "postedAt",
  "createdAt",
  "created_time",
  "createdTime",
  "creation_time",
  "creationTime",
  "publish_time",
  "publishTime",
  "timestamp",
] as const;

const REACTION_COUNT_KEYS = [
  "reactionCount",
  "reaction_count",
  "reactionsCount",
  "reactors",
  "reactors_count",
  "likeCount",
  "like_count",
] as const;

const COMMENT_COUNT_KEYS = [
  "commentCount",
  "comment_count",
  "commentsCount",
  "comments_count",
  "totalCommentCount",
] as const;

const SHARE_COUNT_KEYS = [
  "shareCount",
  "share_count",
  "sharesCount",
  "shares_count",
] as const;

const REPLY_COUNT_KEYS = [
  "replyCount",
  "reply_count",
  "repliesCount",
  "replies_count",
] as const;

const POST_BODY_SKIP_KEYS = new Set([
  "actors",
  "author",
  "comments",
  "feedback",
  "media",
  "owner",
  "profile",
  "reactors",
  "replies",
  "user",
]);

const COMMENT_BODY_SKIP_KEYS = new Set([
  "actors",
  "author",
  "feedback",
  "owner",
  "profile",
  "reactors",
  "replies",
  "user",
]);

const POST_COUNT_SKIP_KEYS = new Set([
  "comments",
  "comment",
  "edges",
  "nodes",
  "replies",
]);

const PUBLISHER_RECURSION_SKIP_KEYS = new Set([
  "actors",
  "author",
  "comments",
  "comment",
  "displaycomments",
  "feedback",
  "media",
  "profile",
  "reactors",
  "replies",
  "reply",
  "user",
]);

const SPONSORED_RECURSION_SKIP_KEYS = new Set([
  "actors",
  "author",
  "comments",
  "comment",
  "displaycomments",
  "profile",
  "replies",
  "reply",
  "user",
]);

const SPONSORED_METADATA_KEYS = new Set([
  "ad",
  "adid",
  "addata",
  "admetadata",
  "advertiserinfo",
  "brandedcontent",
  "isad",
  "isbrandedcontent",
  "issponsored",
  "paidpartnership",
  "sponsored",
  "sponsoreddata",
  "sponsoredlabel",
  "sponsoredmetadata",
  "sponsoredstory",
]);

const DIRECT_PUBLISHER_KIND_KEYS = [
  "publisherKind",
  "sourcePublisherKind",
  "source_publisher_kind",
  "publisher_type",
  "publisherType",
] as const;

const PUBLISHER_KIND_KEYS = [
  ...DIRECT_PUBLISHER_KIND_KEYS,
  "kind",
  "entityKind",
  "entity_kind",
  "entityType",
  "entity_type",
  "type",
  "__typename",
  "typename",
] as const;

const GROUP_STABLE_ID_KEYS = [
  "externalPublisherId",
  "stablePublisherId",
  "publisherExternalId",
  "groupId",
  "group_id",
  "groupID",
  "legacyGroupId",
  "legacy_group_id",
  "facebookGroupId",
  "fbGroupId",
] as const;

const PAGE_STABLE_ID_KEYS = [
  "externalPublisherId",
  "stablePublisherId",
  "publisherExternalId",
  "pageId",
  "page_id",
  "pageID",
  "legacyPageId",
  "legacy_page_id",
  "facebookPageId",
  "fbPageId",
] as const;

const PUBLISHER_DISPLAY_NAME_KEYS = [
  "displayName",
  "display_name",
  "name",
  "title",
] as const;

const PUBLISHER_CANONICAL_URL_KEYS = [
  "canonicalUrl",
  "canonical_url",
  "profileUrl",
  "profile_url",
  "url",
  "wwwURL",
  "permalinkUrl",
  "permalink_url",
] as const;

interface ObjectVisit {
  readonly value: Record<string, unknown>;
  readonly path: string;
}

interface ExtractionContext {
  readonly collectedAt: string;
  readonly topCommentLimit: number;
  readonly warnings: FacebookHomeFeedExtractionWarning[];
}

interface ParsedPostCandidate {
  readonly candidate: FacebookHomeFeedExtractedContentCandidate;
  readonly path: string;
}

interface AuthorMetadata {
  readonly authorDisplayName?: string;
  readonly authorExternalId?: string;
}

type PublisherReferenceKind = FacebookHomeFeedPublisherKind | "PROFILE" | "UNKNOWN";

interface PublisherReference {
  readonly kind: PublisherReferenceKind;
  readonly path: string;
  readonly externalPublisherId?: string;
  readonly displayName?: string;
  readonly canonicalUrl?: string;
  readonly rawKind?: string;
}

type PublisherResolution =
  | {
      readonly status: "resolved";
      readonly observation: FacebookHomeFeedPublisherObservation;
    }
  | {
      readonly status: "excludedPersonalProfile";
      readonly rawKind?: string;
    }
  | {
      readonly status: "warning";
      readonly code:
        | "MISSING_STABLE_PUBLISHER_ID"
        | "UNKNOWN_PUBLISHER_KIND";
      readonly message: string;
      readonly publisherKind?: string;
    };

export class FacebookHomeFeedGraphQLPayloadExtractor {
  public extract(
    input: FacebookHomeFeedGraphQLPayloadExtractionInput,
    options: FacebookHomeFeedGraphQLPayloadExtractorOptions = {},
  ): FacebookHomeFeedGraphQLExtractionResult {
    const issues = validateExtractionInput(input, options);

    if (issues.length > 0) {
      return {
        valid: false,
        issues,
      };
    }

    const context = createExtractionContext(input, options);
    const visits = collectObjectVisits(input.payload);
    const parsedCandidates: ParsedPostCandidate[] = [];

    for (const visit of visits) {
      const parsedCandidate = parsePostCandidate(visit, context);

      if (parsedCandidate !== null) {
        parsedCandidates.push(parsedCandidate);
      }
    }

    if (parsedCandidates.length === 0 && context.warnings.length === 0) {
      context.warnings.push(
        createWarning(
          "UNSUPPORTED_PAYLOAD_SHAPE",
          "No supported Facebook home-feed post candidates were found in the captured payload.",
          { path: "$" },
        ),
      );
    }

    return {
      valid: true,
      candidates: deduplicatePostCandidates(parsedCandidates, context.warnings),
      warnings: context.warnings,
    };
  }
}

export function extractFacebookHomeFeedGraphQLPayload(
  input: FacebookHomeFeedGraphQLPayloadExtractionInput,
  options: FacebookHomeFeedGraphQLPayloadExtractorOptions = {},
): FacebookHomeFeedGraphQLExtractionResult {
  return new FacebookHomeFeedGraphQLPayloadExtractor().extract(input, options);
}

function validateExtractionInput(
  input: FacebookHomeFeedGraphQLPayloadExtractionInput,
  options: FacebookHomeFeedGraphQLPayloadExtractorOptions,
): FacebookHomeFeedExtractionIssue[] {
  const issues: FacebookHomeFeedExtractionIssue[] = [];

  if (
    !(input.capturedAt instanceof Date) ||
    Number.isNaN(input.capturedAt.getTime())
  ) {
    issues.push(
      createIssue(
        "INVALID_CAPTURED_AT",
        "Expected capturedAt to be a valid Date.",
        "capturedAt",
      ),
    );
  }

  if (
    options.topCommentLimit !== undefined &&
    (!Number.isFinite(options.topCommentLimit) || options.topCommentLimit < 0)
  ) {
    issues.push(
      createIssue(
        "INVALID_TOP_COMMENT_LIMIT",
        "Expected topCommentLimit to be a non-negative finite number.",
        "topCommentLimit",
      ),
    );
  }

  return issues;
}

function createExtractionContext(
  input: FacebookHomeFeedGraphQLPayloadExtractionInput,
  options: FacebookHomeFeedGraphQLPayloadExtractorOptions,
): ExtractionContext {
  return {
    collectedAt: input.capturedAt.toISOString(),
    topCommentLimit: normalizeTopCommentLimit(options.topCommentLimit),
    warnings: [],
  };
}

function normalizeTopCommentLimit(limit: number | undefined): number {
  if (limit === undefined) {
    return DEFAULT_FACEBOOK_TOP_COMMENT_LIMIT;
  }

  return Math.floor(limit);
}

function parsePostCandidate(
  visit: ObjectVisit,
  context: ExtractionContext,
): ParsedPostCandidate | null {
  if (!isLikelyPostObject(visit.value, visit.path)) {
    return null;
  }

  const externalPostId = extractPostId(visit.value);

  if (externalPostId === undefined) {
    context.warnings.push(
      createWarning(
        "SKIPPED_CANDIDATE_WITHOUT_POST_ID",
        "Skipped a Facebook home-feed post candidate because no external post id could be extracted.",
        { path: visit.path },
      ),
    );

    return null;
  }

  if (hasExplicitSponsoredMetadata(visit.value)) {
    context.warnings.push(
      createWarning(
        "EXCLUDED_SPONSORED_POST",
        `Excluded Facebook home-feed post ${externalPostId} because explicit sponsorship or ad metadata was present.`,
        { externalPostId, path: visit.path },
      ),
    );

    return null;
  }

  const publisherResolution = resolvePublisherObservation(
    visit.value,
    context.collectedAt,
  );

  if (publisherResolution.status === "excludedPersonalProfile") {
    context.warnings.push(
      createWarning(
        "EXCLUDED_PERSONAL_PROFILE_POST",
        `Excluded Facebook home-feed post ${externalPostId} because the publishing source was explicitly a personal profile.`,
        {
          externalPostId,
          path: visit.path,
          publisherKind: publisherResolution.rawKind ?? "PROFILE",
        },
      ),
    );

    return null;
  }

  if (publisherResolution.status === "warning") {
    context.warnings.push(
      createWarning(publisherResolution.code, publisherResolution.message, {
        externalPostId,
        path: visit.path,
        ...(publisherResolution.publisherKind !== undefined
          ? { publisherKind: publisherResolution.publisherKind }
          : {}),
      }),
    );

    return null;
  }

  const sourceUrl = extractSourceUrl(visit.value);

  if (sourceUrl === undefined) {
    context.warnings.push(
      createWarning(
        "MISSING_SOURCE_URL",
        `Skipped Facebook home-feed post ${externalPostId} because no post-specific source URL could be extracted.`,
        { externalPostId, path: visit.path },
      ),
    );

    return null;
  }

  const bodyText = extractPostBodyText(visit.value);

  if (bodyText === undefined) {
    context.warnings.push(
      createWarning(
        "SKIPPED_CANDIDATE_WITHOUT_BODY_TEXT",
        `Skipped Facebook home-feed post ${externalPostId} because no body text could be extracted.`,
        { externalPostId, path: visit.path },
      ),
    );

    return null;
  }

  const author = extractAuthorMetadata(visit.value);
  const postedAt = extractDateByKeys(
    visit.value,
    POST_DATE_KEYS,
    POST_COUNT_SKIP_KEYS,
  );
  const topComments = extractTopComments(visit, context);
  const reactionCount =
    extractCountByKeys(visit.value, REACTION_COUNT_KEYS, POST_COUNT_SKIP_KEYS) ??
    0;
  const commentCount =
    extractCountByKeys(visit.value, COMMENT_COUNT_KEYS, POST_COUNT_SKIP_KEYS) ??
    topComments.length;
  const shareCount = extractCountByKeys(
    visit.value,
    SHARE_COUNT_KEYS,
    POST_COUNT_SKIP_KEYS,
  );
  const title = extractTextByDirectKeys(visit.value, TITLE_KEYS);

  if (
    author.authorDisplayName === undefined &&
    author.authorExternalId === undefined
  ) {
    context.warnings.push(
      createWarning(
        "MISSING_OPTIONAL_AUTHOR",
        `Facebook home-feed post ${externalPostId} did not include extractable author metadata.`,
        { externalPostId, path: visit.path },
      ),
    );
  }

  if (postedAt === undefined) {
    context.warnings.push(
      createWarning(
        "MISSING_POSTED_AT",
        `Facebook home-feed post ${externalPostId} did not include an extractable postedAt timestamp.`,
        { externalPostId, path: visit.path },
      ),
    );
  }

  const candidate: FacebookHomeFeedExtractedContentCandidate = {
    platform: FACEBOOK_EXTRACTOR_PLATFORM,
    externalPostId,
    sourceUrl,
    ...(title !== undefined ? { title } : {}),
    bodyText,
    ...(author.authorDisplayName !== undefined
      ? { authorDisplayName: author.authorDisplayName }
      : {}),
    ...(author.authorExternalId !== undefined
      ? { authorExternalId: author.authorExternalId }
      : {}),
    ...(postedAt !== undefined ? { postedAt } : {}),
    collectedAt: context.collectedAt,
    reactionCount,
    commentCount,
    ...(shareCount !== undefined ? { shareCount } : {}),
    topComments,
    publisherObservation: publisherResolution.observation,
  };

  return {
    candidate,
    path: visit.path,
  };
}

function resolvePublisherObservation(
  post: Record<string, unknown>,
  observedAt: string,
): PublisherResolution {
  const references = collectPublisherReferences(post);
  const resolved = references.find(
    (reference) =>
      isHomeFeedPublisherKind(reference.kind) &&
      reference.externalPublisherId !== undefined,
  );

  const resolvedExternalPublisherId = resolved?.externalPublisherId;

  if (
    resolved !== undefined &&
    isHomeFeedPublisherKind(resolved.kind) &&
    resolvedExternalPublisherId !== undefined
  ) {
    return {
      status: "resolved",
      observation: {
        platform: FACEBOOK_EXTRACTOR_PLATFORM,
        kind: resolved.kind,
        externalPublisherId: resolvedExternalPublisherId,
        observedAt,
        ...(resolved.displayName !== undefined
          ? { displayName: resolved.displayName }
          : {}),
        ...(resolved.canonicalUrl !== undefined
          ? { canonicalUrl: resolved.canonicalUrl }
          : {}),
      },
    };
  }

  const personalProfile = references.find(
    (reference) => reference.kind === "PROFILE",
  );

  if (personalProfile !== undefined) {
    return {
      status: "excludedPersonalProfile",
      ...(personalProfile.rawKind !== undefined
        ? { rawKind: personalProfile.rawKind }
        : {}),
    };
  }

  const groupOrPageWithoutStableId = references.find((reference) =>
    isHomeFeedPublisherKind(reference.kind),
  );

  if (groupOrPageWithoutStableId !== undefined) {
    return {
      status: "warning",
      code: "MISSING_STABLE_PUBLISHER_ID",
      message:
        "Skipped Facebook home-feed post because the group/page publisher did not include a stable external publisher id.",
      publisherKind: groupOrPageWithoutStableId.kind,
    };
  }

  const unknownReference = references.find(
    (reference) => reference.kind === "UNKNOWN",
  );

  return {
    status: "warning",
    code: "UNKNOWN_PUBLISHER_KIND",
    message:
      "Skipped Facebook home-feed post because the publisher kind was not explicitly GROUP or PAGE.",
    ...(unknownReference?.rawKind !== undefined
      ? { publisherKind: unknownReference.rawKind }
      : {}),
  };
}

function collectPublisherReferences(
  post: Record<string, unknown>,
): PublisherReference[] {
  const references: PublisherReference[] = [];
  const directKind = extractPublisherKindByKeys(post, DIRECT_PUBLISHER_KIND_KEYS);

  if (directKind !== undefined) {
    references.push(buildPublisherReference(post, "$", directKind));
  }

  collectPublisherReferencesFromValue(post, "$", references, 0);

  return references;
}

function collectPublisherReferencesFromValue(
  value: unknown,
  path: string,
  references: PublisherReference[],
  depth: number,
): void {
  if (depth > MAX_TRAVERSAL_DEPTH) {
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      collectPublisherReferencesFromValue(
        item,
        `${path}[${index}]`,
        references,
        depth + 1,
      );
    });
    return;
  }

  if (!isRecord(value)) {
    return;
  }

  for (const [key, child] of Object.entries(value)) {
    const normalizedKey = normalizeKey(key);

    if (PUBLISHER_RECURSION_SKIP_KEYS.has(normalizedKey)) {
      continue;
    }

    const implicitKind = publisherKindFromContainerKey(normalizedKey);
    const childPath = `${path}.${key}`;

    if (
      isPublisherContainerKey(normalizedKey) ||
      implicitKind !== undefined ||
      isFixtureDemonstratedGroupPublisherPath(normalizedKey)
    ) {
      collectPublisherReferenceFromContainer(
        child,
        childPath,
        references,
        implicitKind,
      );
    }

    collectPublisherReferencesFromValue(
      child,
      childPath,
      references,
      depth + 1,
    );
  }
}

function collectPublisherReferenceFromContainer(
  value: unknown,
  path: string,
  references: PublisherReference[],
  implicitKind: PublisherReferenceKind | undefined,
): void {
  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      collectPublisherReferenceFromContainer(
        item,
        `${path}[${index}]`,
        references,
        implicitKind,
      );
    });
    return;
  }

  if (!isRecord(value)) {
    return;
  }

  const kind = implicitKind ?? extractPublisherKindByKeys(value, PUBLISHER_KIND_KEYS);

  if (kind !== undefined) {
    references.push(buildPublisherReference(value, path, kind));
  }
}

function buildPublisherReference(
  record: Record<string, unknown>,
  path: string,
  kind: PublisherReferenceKind,
): PublisherReference {
  const externalPublisherId = isHomeFeedPublisherKind(kind)
    ? extractStablePublisherId(record, kind)
    : undefined;
  const displayName = extractTextByDirectKeys(record, PUBLISHER_DISPLAY_NAME_KEYS);
  const canonicalUrl = getUrlByKeys(record, PUBLISHER_CANONICAL_URL_KEYS);
  const rawKind = getScalarStringByKeys(record, PUBLISHER_KIND_KEYS);

  return {
    kind,
    path,
    ...(externalPublisherId !== undefined ? { externalPublisherId } : {}),
    ...(displayName !== undefined ? { displayName } : {}),
    ...(canonicalUrl !== undefined ? { canonicalUrl } : {}),
    ...(rawKind !== undefined ? { rawKind } : {}),
  };
}

function extractStablePublisherId(
  record: Record<string, unknown>,
  kind: FacebookHomeFeedPublisherKind,
): string | undefined {
  const stableId = getScalarStringByKeys(
    record,
    kind === "GROUP" ? GROUP_STABLE_ID_KEYS : PAGE_STABLE_ID_KEYS,
  );

  if (stableId !== undefined) {
    return stableId;
  }

  // Accept GraphQL `id` only from an object explicitly type-qualified as Group
  // (e.g. fixture-demonstrated paths `to` or `comet_sections.action_link.group`).
  // Do not accept arbitrary object ids, actor/user ids, or unqualified
  // `target_group.id` without independent Group type qualification.
  if (kind === "GROUP" && isExplicitlyTypeQualifiedGroup(record)) {
    return getScalarStringByKeys(record, ["id"]);
  }

  return undefined;
}

function isExplicitlyTypeQualifiedGroup(
  record: Record<string, unknown>,
): boolean {
  const typeName = getTypeName(record);

  if (typeName === undefined) {
    return false;
  }

  return normalizeKey(typeName) === "group";
}

function isHomeFeedPublisherKind(
  kind: PublisherReferenceKind,
): kind is FacebookHomeFeedPublisherKind {
  return kind === "GROUP" || kind === "PAGE";
}

function extractPublisherKindByKeys(
  record: Record<string, unknown>,
  keys: readonly string[],
): PublisherReferenceKind | undefined {
  for (const key of keys) {
    const rawKind = getScalarStringByKeys(record, [key]);
    const kind = normalizePublisherKind(rawKind);

    if (kind !== undefined) {
      return kind;
    }
  }

  return undefined;
}

function normalizePublisherKind(
  rawKind: string | undefined,
): PublisherReferenceKind | undefined {
  if (rawKind === undefined) {
    return undefined;
  }

  const normalizedKind = normalizeKey(rawKind);

  if (normalizedKind === "group" || normalizedKind.endsWith("group")) {
    return "GROUP";
  }

  if (normalizedKind === "page" || normalizedKind.endsWith("page")) {
    return "PAGE";
  }

  if (
    normalizedKind === "profile" ||
    normalizedKind === "personalprofile" ||
    normalizedKind === "user" ||
    normalizedKind === "person"
  ) {
    return "PROFILE";
  }

  return "UNKNOWN";
}

function publisherKindFromContainerKey(
  normalizedKey: string,
): PublisherReferenceKind | undefined {
  if (
    normalizedKey === "group" ||
    normalizedKey === "sourcegroup" ||
    normalizedKey === "publishergroup"
  ) {
    return "GROUP";
  }

  if (
    normalizedKey === "page" ||
    normalizedKey === "sourcepage" ||
    normalizedKey === "publisherpage"
  ) {
    return "PAGE";
  }

  return undefined;
}

function isFixtureDemonstratedGroupPublisherPath(
  normalizedKey: string,
): boolean {
  // Story destination `to` is a fixture-demonstrated publisher path. Collect
  // it only when the child is explicitly type-qualified as Group (handled in
  // collectPublisherReferenceFromContainer via extractPublisherKindByKeys).
  return normalizedKey === "to";
}

function isPublisherContainerKey(normalizedKey: string): boolean {
  return (
    normalizedKey === "sourcepublisher" ||
    normalizedKey === "publisher" ||
    normalizedKey === "publisheridentity" ||
    normalizedKey === "originpublisher" ||
    normalizedKey === "owningpublisher" ||
    normalizedKey === "postingentity" ||
    normalizedKey === "publishingentity" ||
    normalizedKey === "community"
  );
}

function hasExplicitSponsoredMetadata(record: Record<string, unknown>): boolean {
  return findExplicitSponsoredMetadata(record, 0);
}

function findExplicitSponsoredMetadata(value: unknown, depth: number): boolean {
  if (depth > MAX_TRAVERSAL_DEPTH) {
    return false;
  }

  if (Array.isArray(value)) {
    return value.some((item) => findExplicitSponsoredMetadata(item, depth + 1));
  }

  if (!isRecord(value)) {
    return false;
  }

  for (const [key, child] of Object.entries(value)) {
    const normalizedKey = normalizeKey(key);

    if (
      SPONSORED_METADATA_KEYS.has(normalizedKey) &&
      isPresentSponsoredMetadata(child)
    ) {
      return true;
    }

    if (SPONSORED_RECURSION_SKIP_KEYS.has(normalizedKey)) {
      continue;
    }

    if (findExplicitSponsoredMetadata(child, depth + 1)) {
      return true;
    }
  }

  return false;
}

function isPresentSponsoredMetadata(value: unknown): boolean {
  if (value === null || value === undefined || value === false) {
    return false;
  }

  if (typeof value === "string") {
    const text = cleanString(value);

    return text !== undefined && !["false", "0", "none"].includes(text);
  }

  if (typeof value === "number") {
    return Number.isFinite(value) && value !== 0;
  }

  if (Array.isArray(value)) {
    return value.length > 0;
  }

  if (isRecord(value)) {
    return Object.keys(value).length > 0;
  }

  return value === true;
}

function deduplicatePostCandidates(
  candidates: readonly ParsedPostCandidate[],
  warnings: FacebookHomeFeedExtractionWarning[],
): FacebookHomeFeedExtractedContentCandidate[] {
  const byPostId = new Map<string, ParsedPostCandidate>();

  for (const parsedCandidate of candidates) {
    const existing = byPostId.get(parsedCandidate.candidate.externalPostId);

    if (existing === undefined) {
      byPostId.set(parsedCandidate.candidate.externalPostId, parsedCandidate);
      continue;
    }

    warnings.push(
      createWarning(
        "DUPLICATE_POST_CANDIDATE",
        `Duplicate Facebook home-feed post ${parsedCandidate.candidate.externalPostId} was deduplicated inside the captured payload.`,
        {
          externalPostId: parsedCandidate.candidate.externalPostId,
          path: parsedCandidate.path,
        },
      ),
    );

    if (
      scoreCandidateRichness(parsedCandidate.candidate) >
      scoreCandidateRichness(existing.candidate)
    ) {
      byPostId.set(parsedCandidate.candidate.externalPostId, parsedCandidate);
    }
  }

  return [...byPostId.values()].map(
    (parsedCandidate) => parsedCandidate.candidate,
  );
}

function scoreCandidateRichness(
  candidate: FacebookHomeFeedExtractedContentCandidate,
): number {
  return (
    candidate.bodyText.length +
    candidate.reactionCount +
    candidate.commentCount +
    candidate.topComments.length * 25 +
    (candidate.shareCount ?? 0) +
    (candidate.title !== undefined ? 10 : 0) +
    (candidate.authorDisplayName !== undefined ? 10 : 0) +
    (candidate.authorExternalId !== undefined ? 10 : 0) +
    (candidate.postedAt !== undefined ? 10 : 0) +
    (candidate.publisherObservation.displayName !== undefined ? 10 : 0) +
    (candidate.publisherObservation.canonicalUrl !== undefined ? 10 : 0)
  );
}

function extractTopComments(
  postVisit: ObjectVisit,
  context: ExtractionContext,
): FacebookHomeFeedExtractedTopComment[] {
  const comments: FacebookHomeFeedExtractedTopComment[] = [];
  const visits = collectObjectVisits(postVisit.value, postVisit.path);

  for (const visit of visits) {
    if (visit.value === postVisit.value) {
      continue;
    }

    if (!isLikelyCommentObject(visit.value, visit.path)) {
      continue;
    }

    const comment = parseComment(visit, context);

    if (comment !== null) {
      comments.push(comment);
    }
  }

  return deduplicateComments(comments)
    .sort(compareTopComments)
    .slice(0, context.topCommentLimit);
}

function parseComment(
  visit: ObjectVisit,
  context: ExtractionContext,
): FacebookHomeFeedExtractedTopComment | null {
  const externalCommentId = extractCommentId(visit.value, visit.path);

  if (externalCommentId === undefined) {
    context.warnings.push(
      createWarning(
        "SKIPPED_COMMENT_WITHOUT_ID",
        "Skipped a Facebook home-feed comment candidate because no external comment id could be extracted.",
        { path: visit.path },
      ),
    );

    return null;
  }

  const bodyText = extractCommentBodyText(visit.value);

  if (bodyText === undefined) {
    context.warnings.push(
      createWarning(
        "SKIPPED_COMMENT_WITHOUT_BODY_TEXT",
        `Skipped Facebook home-feed comment ${externalCommentId} because no body text could be extracted.`,
        { path: visit.path },
      ),
    );

    return null;
  }

  const author = extractAuthorMetadata(visit.value);
  const reactionCount =
    extractCountByKeys(visit.value, REACTION_COUNT_KEYS, new Set(["replies"])) ??
    0;
  const replyCount = extractCountByKeys(
    visit.value,
    REPLY_COUNT_KEYS,
    new Set(["comments"]),
  );
  const postedAt = extractDateByKeys(visit.value, POST_DATE_KEYS, new Set());

  return {
    externalCommentId,
    bodyText,
    ...(author.authorDisplayName !== undefined
      ? { authorDisplayName: author.authorDisplayName }
      : {}),
    ...(author.authorExternalId !== undefined
      ? { authorExternalId: author.authorExternalId }
      : {}),
    reactionCount,
    ...(replyCount !== undefined ? { replyCount } : {}),
    ...(postedAt !== undefined ? { postedAt } : {}),
    collectedAt: context.collectedAt,
  };
}

function deduplicateComments(
  comments: readonly FacebookHomeFeedExtractedTopComment[],
): FacebookHomeFeedExtractedTopComment[] {
  const byCommentId = new Map<string, FacebookHomeFeedExtractedTopComment>();

  for (const comment of comments) {
    const existing = byCommentId.get(comment.externalCommentId);

    if (
      existing === undefined ||
      scoreCommentRichness(comment) > scoreCommentRichness(existing)
    ) {
      byCommentId.set(comment.externalCommentId, comment);
    }
  }

  return [...byCommentId.values()];
}

function scoreCommentRichness(
  comment: FacebookHomeFeedExtractedTopComment,
): number {
  return (
    comment.bodyText.length +
    comment.reactionCount +
    (comment.replyCount ?? 0) +
    (comment.authorDisplayName !== undefined ? 10 : 0) +
    (comment.authorExternalId !== undefined ? 10 : 0) +
    (comment.postedAt !== undefined ? 10 : 0)
  );
}

function compareTopComments(
  left: FacebookHomeFeedExtractedTopComment,
  right: FacebookHomeFeedExtractedTopComment,
): number {
  if (left.reactionCount !== right.reactionCount) {
    return right.reactionCount - left.reactionCount;
  }

  const idComparison = left.externalCommentId.localeCompare(
    right.externalCommentId,
  );

  if (idComparison !== 0) {
    return idComparison;
  }

  const collectedAtComparison = left.collectedAt.localeCompare(right.collectedAt);

  if (collectedAtComparison !== 0) {
    return collectedAtComparison;
  }

  return left.bodyText.localeCompare(right.bodyText);
}

function isLikelyPostObject(
  record: Record<string, unknown>,
  path: string,
): boolean {
  if (isLikelyCommentObject(record, path)) {
    return false;
  }

  if (isRendererPluginOrMetaFragment(record, path)) {
    return false;
  }

  const typeName = getTypeName(record);

  if (typeName !== undefined && isLikelyPostTypeName(typeName)) {
    return true;
  }

  if (hasDirectKey(record, POST_ID_KEYS) && hasPostContentEvidence(record)) {
    return true;
  }

  const url = getUrlByKeys(record, URL_KEYS);

  if (url !== undefined && extractPostIdFromUrl(url) !== undefined) {
    return true;
  }

  return false;
}

function isLikelyCommentObject(
  record: Record<string, unknown>,
  path: string,
): boolean {
  const typeName = getTypeName(record);

  if (typeName !== undefined && isLikelyCommentTypeName(typeName)) {
    return true;
  }

  if (hasDirectKey(record, PRIMARY_COMMENT_ID_KEYS)) {
    return true;
  }

  if (
    getScalarStringByKeys(record, ["legacy_fbid", "legacyId", "fbid"]) !==
      undefined &&
    extractCommentBodyText(record) !== undefined
  ) {
    return true;
  }

  return (
    normalizeKey(path).includes("comment") &&
    getScalarStringByKeys(record, ["id"]) !== undefined &&
    extractCommentBodyText(record) !== undefined
  );
}

function getTypeName(record: Record<string, unknown>): string | undefined {
  return (
    getScalarStringByKeys(record, ["__typename"]) ??
    getScalarStringByKeys(record, ["typename"]) ??
    getScalarStringByKeys(record, ["type"])
  );
}

function isLikelyPostTypeName(typeName: string): boolean {
  const normalizedTypeName = normalizeKey(typeName);

  if (containsAny(normalizedTypeName, ["meta", "renderer", "plugin"])) {
    return false;
  }

  if (normalizedTypeName === "story") {
    return true;
  }

  if (normalizedTypeName.endsWith("story")) {
    return !containsAny(normalizedTypeName, ["section", "renderer", "plugin"]);
  }

  return (
    normalizedTypeName.includes("post") &&
    !containsAny(normalizedTypeName, ["composer", "plugin", "renderer", "meta"])
  );
}

function isLikelyCommentTypeName(typeName: string): boolean {
  const normalizedTypeName = normalizeKey(typeName);

  return (
    normalizedTypeName === "comment" || normalizedTypeName.endsWith("comment")
  );
}

function hasPostContentEvidence(record: Record<string, unknown>): boolean {
  return (
    getValueByNormalizedKey(record, "feedback") !== undefined ||
    extractPostBodyText(record) !== undefined
  );
}

function isRendererPluginOrMetaFragment(
  record: Record<string, unknown>,
  path: string,
): boolean {
  const typeName = getTypeName(record);
  const normalizedTypeName =
    typeName !== undefined ? normalizeKey(typeName) : "";
  const normalizedPath = normalizeKey(path);

  return (
    containsAny(normalizedTypeName, ["renderer", "plugin", "composer", "meta"]) ||
    containsAny(normalizedPath, [
      "renderer",
      "plugin",
      "plugins",
      "metadata",
      "metagen",
    ])
  );
}

function extractPostId(record: Record<string, unknown>): string | undefined {
  const directId = getScalarStringByKeys(record, POST_ID_KEYS);

  if (directId !== undefined) {
    return directId;
  }

  const sourceUrl = extractSourceUrl(record);
  const urlId =
    sourceUrl !== undefined ? extractPostIdFromUrl(sourceUrl) : undefined;

  if (urlId !== undefined) {
    return urlId;
  }

  return undefined;
}

function extractCommentId(
  record: Record<string, unknown>,
  path: string,
): string | undefined {
  return (
    getScalarStringByKeys(record, COMMENT_ID_KEYS) ??
    (isLikelyCommentObject(record, path)
      ? getScalarStringByKeys(record, ["id"])
      : undefined)
  );
}

function extractPostIdFromUrl(url: string): string | undefined {
  const candidates = [
    /\/posts\/([^/?#]+)/u,
    /\/permalink\/([^/?#]+)/u,
    /[?&]story_fbid=([^&#]+)/u,
    /[?&]fbid=([^&#]+)/u,
  ];

  for (const candidate of candidates) {
    const match = candidate.exec(url);
    const rawId = match?.[1];
    const id =
      rawId !== undefined ? cleanString(decodeURIComponent(rawId)) : undefined;

    if (id !== undefined) {
      return id;
    }
  }

  return undefined;
}

function extractSourceUrl(record: Record<string, unknown>): string | undefined {
  const directUrl = getUrlByKeys(record, URL_KEYS);

  if (directUrl !== undefined) {
    return directUrl;
  }

  return findNestedUrl(
    record,
    new Set(["actors", "author", "comments", "owner", "profile", "replies", "user"]),
  );
}

function extractPostBodyText(
  record: Record<string, unknown>,
): string | undefined {
  return (
    extractTextByDirectKeys(record, POST_BODY_KEYS) ??
    findNestedText(record, POST_BODY_SKIP_KEYS)
  );
}

function extractCommentBodyText(
  record: Record<string, unknown>,
): string | undefined {
  return (
    extractTextByDirectKeys(record, COMMENT_BODY_KEYS) ??
    findNestedText(record, COMMENT_BODY_SKIP_KEYS)
  );
}

function extractAuthorMetadata(
  record: Record<string, unknown>,
): AuthorMetadata {
  const directDisplayName = getScalarStringByKeys(record, ["authorDisplayName"]);
  const directExternalId = getScalarStringByKeys(record, ["authorExternalId"]);
  const directAuthor: AuthorMetadata = {
    ...(directDisplayName !== undefined
      ? { authorDisplayName: directDisplayName }
      : {}),
    ...(directExternalId !== undefined
      ? { authorExternalId: directExternalId }
      : {}),
  };

  if (
    directAuthor.authorDisplayName !== undefined ||
    directAuthor.authorExternalId !== undefined
  ) {
    return directAuthor;
  }

  for (const key of AUTHOR_KEYS) {
    const value = getValueByNormalizedKey(record, key);
    const author = extractAuthorFromValue(value);

    if (
      author.authorDisplayName !== undefined ||
      author.authorExternalId !== undefined
    ) {
      return author;
    }
  }

  return {};
}

function extractAuthorFromValue(value: unknown): AuthorMetadata {
  if (Array.isArray(value)) {
    for (const item of value) {
      const author = extractAuthorFromValue(item);

      if (
        author.authorDisplayName !== undefined ||
        author.authorExternalId !== undefined
      ) {
        return author;
      }
    }

    return {};
  }

  if (!isRecord(value)) {
    return {};
  }

  const displayName = getScalarStringByKeys(value, AUTHOR_DISPLAY_NAME_KEYS);
  const externalId = getScalarStringByKeys(value, AUTHOR_EXTERNAL_ID_KEYS);

  return {
    ...(displayName !== undefined ? { authorDisplayName: displayName } : {}),
    ...(externalId !== undefined ? { authorExternalId: externalId } : {}),
  };
}

function extractDateByKeys(
  record: Record<string, unknown>,
  keys: readonly string[],
  skipKeys: ReadonlySet<string>,
): string | undefined {
  for (const key of keys) {
    const directDate = normalizeDate(getValueByNormalizedKey(record, key));

    if (directDate !== undefined) {
      return directDate;
    }
  }

  return findNestedDate(record, keys, skipKeys);
}

function extractCountByKeys(
  record: Record<string, unknown>,
  keys: readonly string[],
  skipKeys: ReadonlySet<string>,
): number | undefined {
  for (const key of keys) {
    const directCount = normalizeCount(getValueByNormalizedKey(record, key));

    if (directCount !== undefined) {
      return directCount;
    }
  }

  return findNestedCount(record, keys, skipKeys);
}

function extractTextByDirectKeys(
  record: Record<string, unknown>,
  keys: readonly string[],
): string | undefined {
  for (const key of keys) {
    const directText = extractText(getValueByNormalizedKey(record, key));

    if (directText !== undefined) {
      return directText;
    }
  }

  return undefined;
}

function getScalarStringByKeys(
  record: Record<string, unknown>,
  keys: readonly string[],
): string | undefined {
  for (const key of keys) {
    const value = getValueByNormalizedKey(record, key);
    const text = scalarToString(value);

    if (text !== undefined) {
      return text;
    }
  }

  return undefined;
}

function getUrlByKeys(
  record: Record<string, unknown>,
  keys: readonly string[],
): string | undefined {
  for (const key of keys) {
    const value = getValueByNormalizedKey(record, key);
    const url = normalizeUrl(value);

    if (url !== undefined) {
      return url;
    }
  }

  return undefined;
}

function getValueByNormalizedKey(
  record: Record<string, unknown>,
  key: string,
): unknown {
  const normalizedTargetKey = normalizeKey(key);

  for (const [entryKey, entryValue] of Object.entries(record)) {
    if (normalizeKey(entryKey) === normalizedTargetKey) {
      return entryValue;
    }
  }

  return undefined;
}

function hasDirectKey(
  record: Record<string, unknown>,
  keys: readonly string[],
): boolean {
  return keys.some((key) => getValueByNormalizedKey(record, key) !== undefined);
}

function findNestedText(
  value: unknown,
  skipKeys: ReadonlySet<string>,
  depth = 0,
): string | undefined {
  if (depth > MAX_TRAVERSAL_DEPTH) {
    return undefined;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const text = findNestedText(item, skipKeys, depth + 1);

      if (text !== undefined) {
        return text;
      }
    }

    return undefined;
  }

  if (!isRecord(value)) {
    return undefined;
  }

  for (const [key, child] of Object.entries(value)) {
    const normalizedKey = normalizeKey(key);

    if (skipKeys.has(normalizedKey)) {
      continue;
    }

    if (
      isTextFieldKey(normalizedKey) ||
      containsAny(normalizedKey, ["body", "message"])
    ) {
      const text = extractText(child);

      if (text !== undefined) {
        return text;
      }
    }

    const nestedText = findNestedText(child, skipKeys, depth + 1);

    if (nestedText !== undefined) {
      return nestedText;
    }
  }

  return undefined;
}

function findNestedUrl(
  value: unknown,
  skipKeys: ReadonlySet<string>,
  depth = 0,
): string | undefined {
  if (depth > MAX_TRAVERSAL_DEPTH) {
    return undefined;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const url = findNestedUrl(item, skipKeys, depth + 1);

      if (url !== undefined) {
        return url;
      }
    }

    return undefined;
  }

  if (!isRecord(value)) {
    return undefined;
  }

  for (const [key, child] of Object.entries(value)) {
    const normalizedKey = normalizeKey(key);

    if (skipKeys.has(normalizedKey)) {
      continue;
    }

    if (containsAny(normalizedKey, ["url", "permalink", "shareable"])) {
      const url = normalizeUrl(child);

      if (url !== undefined) {
        return url;
      }
    }

    const nestedUrl = findNestedUrl(child, skipKeys, depth + 1);

    if (nestedUrl !== undefined) {
      return nestedUrl;
    }
  }

  return undefined;
}

function findNestedDate(
  value: unknown,
  keys: readonly string[],
  skipKeys: ReadonlySet<string>,
  depth = 0,
): string | undefined {
  if (depth > MAX_TRAVERSAL_DEPTH) {
    return undefined;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const date = findNestedDate(item, keys, skipKeys, depth + 1);

      if (date !== undefined) {
        return date;
      }
    }

    return undefined;
  }

  if (!isRecord(value)) {
    return undefined;
  }

  for (const [key, child] of Object.entries(value)) {
    const normalizedKey = normalizeKey(key);

    if (skipKeys.has(normalizedKey)) {
      continue;
    }

    if (keys.some((dateKey) => normalizeKey(dateKey) === normalizedKey)) {
      const date = normalizeDate(child);

      if (date !== undefined) {
        return date;
      }
    }

    const nestedDate = findNestedDate(child, keys, skipKeys, depth + 1);

    if (nestedDate !== undefined) {
      return nestedDate;
    }
  }

  return undefined;
}

function findNestedCount(
  value: unknown,
  keys: readonly string[],
  skipKeys: ReadonlySet<string>,
  depth = 0,
): number | undefined {
  if (depth > MAX_TRAVERSAL_DEPTH) {
    return undefined;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const count = findNestedCount(item, keys, skipKeys, depth + 1);

      if (count !== undefined) {
        return count;
      }
    }

    return undefined;
  }

  if (!isRecord(value)) {
    return undefined;
  }

  for (const [key, child] of Object.entries(value)) {
    const normalizedKey = normalizeKey(key);

    if (skipKeys.has(normalizedKey)) {
      continue;
    }

    if (keys.some((countKey) => normalizeKey(countKey) === normalizedKey)) {
      const count = normalizeCount(child);

      if (count !== undefined) {
        return count;
      }
    }

    const nestedCount = findNestedCount(child, keys, skipKeys, depth + 1);

    if (nestedCount !== undefined) {
      return nestedCount;
    }
  }

  return undefined;
}

function extractText(value: unknown, depth = 0): string | undefined {
  if (depth > MAX_TRAVERSAL_DEPTH) {
    return undefined;
  }

  if (typeof value === "string") {
    return cleanString(value);
  }

  if (Array.isArray(value)) {
    const fragments = value
      .map((item) => extractText(item, depth + 1))
      .filter((item): item is string => item !== undefined);

    return cleanString(fragments.join(" "));
  }

  if (!isRecord(value)) {
    return undefined;
  }

  for (const key of [
    "text",
    "plainText",
    "bodyText",
    "messageText",
    "content",
  ]) {
    const text = extractText(getValueByNormalizedKey(value, key), depth + 1);

    if (text !== undefined) {
      return text;
    }
  }

  for (const key of ["fragments", "ranges", "nodes", "parts", "children"]) {
    const fragmentsText = extractText(
      getValueByNormalizedKey(value, key),
      depth + 1,
    );

    if (fragmentsText !== undefined) {
      return fragmentsText;
    }
  }

  return undefined;
}

function normalizeDate(value: unknown): string | undefined {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? undefined : value.toISOString();
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    const timestamp = value < 1_000_000_000_000 ? value * 1_000 : value;
    const date = new Date(timestamp);

    return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
  }

  if (typeof value === "string") {
    const text = cleanString(value);

    if (text === undefined) {
      return undefined;
    }

    const numericValue = Number(text);
    const date =
      Number.isFinite(numericValue) && text.length >= 10
        ? new Date(
            numericValue < 1_000_000_000_000
              ? numericValue * 1_000
              : numericValue,
          )
        : new Date(text);

    return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
  }

  if (isRecord(value)) {
    return (
      normalizeDate(getValueByNormalizedKey(value, "timestamp")) ??
      normalizeDate(getValueByNormalizedKey(value, "time")) ??
      normalizeDate(getValueByNormalizedKey(value, "isoString"))
    );
  }

  return undefined;
}

function normalizeCount(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
    return Math.floor(value);
  }

  if (typeof value === "string") {
    const numericValue = Number(value.replace(/,/gu, "").trim());

    if (Number.isFinite(numericValue) && numericValue >= 0) {
      return Math.floor(numericValue);
    }
  }

  if (isRecord(value)) {
    for (const key of ["count", "totalCount", "total_count", "value"]) {
      const count = normalizeCount(getValueByNormalizedKey(value, key));

      if (count !== undefined) {
        return count;
      }
    }
  }

  return undefined;
}

function normalizeUrl(value: unknown): string | undefined {
  const text = scalarToString(value);

  if (text === undefined) {
    return undefined;
  }

  return /^https?:\/\//iu.test(text) ? text : undefined;
}

function scalarToString(value: unknown): string | undefined {
  if (typeof value === "string") {
    return cleanString(value);
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return cleanString(String(Math.floor(value)));
  }

  return undefined;
}

function cleanString(value: string): string | undefined {
  const text = value.replace(/\u00a0/gu, " ").replace(/\s+/gu, " ").trim();

  return text.length > 0 ? text : undefined;
}

function isTextFieldKey(key: string): boolean {
  return key === "text" || key === "plaintext" || key === "bodytext";
}

function containsAny(value: string, fragments: readonly string[]): boolean {
  const normalizedValue = normalizeKey(value);

  return fragments.some((fragment) =>
    normalizedValue.includes(normalizeKey(fragment)),
  );
}

function normalizeKey(key: string): string {
  return key.replace(/[^a-z0-9]/giu, "").toLowerCase();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    !(value instanceof Date)
  );
}

function collectObjectVisits(value: unknown, rootPath = "$"): ObjectVisit[] {
  const visits: ObjectVisit[] = [];
  const seen = new WeakSet<object>();

  function visit(node: unknown, path: string, depth: number): void {
    if (visits.length >= MAX_OBJECT_VISITS || depth > MAX_TRAVERSAL_DEPTH) {
      return;
    }

    if (Array.isArray(node)) {
      node.forEach((item, index) => {
        visit(item, `${path}[${index}]`, depth + 1);
      });
      return;
    }

    if (!isRecord(node)) {
      return;
    }

    if (seen.has(node)) {
      return;
    }

    seen.add(node);
    visits.push({ value: node, path });

    for (const [key, child] of Object.entries(node)) {
      visit(child, `${path}.${key}`, depth + 1);
    }
  }

  visit(value, rootPath, 0);

  return visits;
}

function createIssue(
  code: FacebookHomeFeedExtractionIssueCode,
  message: string,
  path?: string,
): FacebookHomeFeedExtractionIssue {
  return {
    code,
    message,
    ...(path !== undefined ? { path } : {}),
  };
}

function createWarning(
  code: FacebookHomeFeedExtractionWarningCode,
  message: string,
  options: {
    readonly path?: string;
    readonly externalPostId?: string;
    readonly publisherKind?: string;
  } = {},
): FacebookHomeFeedExtractionWarning {
  return {
    code,
    message,
    ...(options.path !== undefined ? { path: options.path } : {}),
    ...(options.externalPostId !== undefined
      ? { externalPostId: options.externalPostId }
      : {}),
    ...(options.publisherKind !== undefined
      ? { publisherKind: options.publisherKind }
      : {}),
  };
}
