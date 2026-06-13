import { errorToMessage } from "../application";
import type {
  CollectedContentSubmissionInput,
  CollectedContentTopCommentSubmissionInput,
  ContentManagerContentSubmissionPort,
  ContentSubmissionResult,
  SourceGroupLookupPort,
  SourceGroupLookupEntryRoute,
  SourceGroupLookupResult,
  SourceGroupLookupSourceGroup,
} from "../application";

const CONTENT_ITEMS_PATH = "collector/content-items";
const SOURCE_GROUPS_PATH = "collector/source-groups";
const CONTENT_MANAGER_HTTP_ERROR = "CONTENT_MANAGER_HTTP_ERROR";
const CONTENT_MANAGER_NETWORK_ERROR = "CONTENT_MANAGER_NETWORK_ERROR";
const CONTENT_MANAGER_RESPONSE_ERROR = "CONTENT_MANAGER_RESPONSE_ERROR";

export interface ContentManagerHttpClientEnvironment {
  readonly CONTENT_MANAGER_BASE_URL?: string;
}

export interface ContentManagerHttpClientConfig {
  readonly baseUrl: string;
}

export interface FetchLikeRequestInit {
  readonly method?: string;
  readonly headers?: Record<string, string>;
  readonly body?: string;
}

export interface FetchLikeResponse {
  readonly status: number;
  json?(): Promise<unknown>;
  text(): Promise<string>;
}

export type FetchLike = (
  input: string,
  init?: FetchLikeRequestInit,
) => Promise<FetchLikeResponse>;

export class MissingContentManagerHttpClientConfigError extends Error {
  public constructor(public readonly key: keyof ContentManagerHttpClientEnvironment) {
    super(`${key} is required for Content Manager HTTP client configuration.`);
    this.name = "MissingContentManagerHttpClientConfigError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export function loadContentManagerHttpClientConfig(
  environment: ContentManagerHttpClientEnvironment = process.env,
): ContentManagerHttpClientConfig {
  const baseUrl = environment.CONTENT_MANAGER_BASE_URL?.trim();

  if (baseUrl === undefined || baseUrl === "") {
    throw new MissingContentManagerHttpClientConfigError(
      "CONTENT_MANAGER_BASE_URL",
    );
  }

  return {
    baseUrl,
  };
}

export interface ContentManagerHttpClientOptions {
  readonly fetchImplementation?: FetchLike;
}

export type ContentManagerSourceGroup = SourceGroupLookupSourceGroup;
export type ContentManagerSourceGroupLookupResult = SourceGroupLookupResult;

interface ContentManagerHttpFailure {
  readonly statusCode: number;
  readonly errorCode: string;
  readonly errorMessage: string;
}

export class ContentManagerHttpClient
  implements ContentManagerContentSubmissionPort, SourceGroupLookupPort {
  private readonly baseUrl: string;
  private readonly fetchImplementation: FetchLike;

  public constructor(
    config: ContentManagerHttpClientConfig,
    options: ContentManagerHttpClientOptions = {},
  ) {
    this.baseUrl = config.baseUrl.trim();
    this.fetchImplementation =
      options.fetchImplementation ?? createGlobalFetchAdapter();
  }

  public async submitCollectedContent(
    input: CollectedContentSubmissionInput,
  ): Promise<ContentSubmissionResult> {
    try {
      const response = await this.fetchImplementation(
        buildContentItemsUrl(this.baseUrl),
        {
          method: "POST",
          headers: {
            accept: "application/json",
            "content-type": "application/json",
          },
          body: JSON.stringify(toContentManagerRequestBody(input)),
        },
      );

      if (isSuccessStatusCode(response.status)) {
        const contentItemId = await readContentItemId(response);

        return {
          ok: true,
          statusCode: response.status,
          ...(contentItemId !== undefined ? { contentItemId } : {}),
        };
      }

      return {
        ok: false,
        statusCode: response.status,
        errorCode: "CONTENT_MANAGER_HTTP_ERROR",
        errorMessage: await readFailureMessage(response),
      };
    } catch (error) {
      return {
        ok: false,
        errorCode: CONTENT_MANAGER_NETWORK_ERROR,
        errorMessage: errorToMessage(error),
      };
    }
  }

  public async getSourceGroup(
    sourceGroupId: string,
  ): Promise<ContentManagerSourceGroupLookupResult> {
    try {
      const response = await this.fetchImplementation(
        buildSourceGroupUrl(this.baseUrl, sourceGroupId),
        {
          method: "GET",
          headers: jsonHeaders(),
        },
      );

      if (!isSuccessStatusCode(response.status)) {
        return toSourceGroupLookupFailure(await readHttpFailure(response));
      }

      const sourceGroup = toSourceGroupLookupResult(
        await readJsonBody(response),
      );

      if (sourceGroup !== undefined) {
        return {
          ok: true,
          statusCode: response.status,
          sourceGroup,
        };
      }

      return {
        ok: false,
        statusCode: response.status,
        errorCode: CONTENT_MANAGER_RESPONSE_ERROR,
        errorMessage: "Content Manager source group response is invalid.",
      };
    } catch (error) {
      return {
        ok: false,
        errorCode: CONTENT_MANAGER_NETWORK_ERROR,
        errorMessage: errorToMessage(error),
      };
    }
  }
}

export function createContentManagerHttpClientFromEnv(
  environment: ContentManagerHttpClientEnvironment = process.env,
  options: ContentManagerHttpClientOptions = {},
): ContentManagerHttpClient {
  return new ContentManagerHttpClient(
    loadContentManagerHttpClientConfig(environment),
    options,
  );
}

function createGlobalFetchAdapter(): FetchLike {
  return async (input, init) => {
    const globalFetch = (globalThis as { readonly fetch?: FetchLike }).fetch;

    if (globalFetch === undefined) {
      throw new Error("A fetch implementation is required.");
    }

    return globalFetch(input, init);
  };
}

function jsonHeaders(): Record<string, string> {
  return {
    accept: "application/json",
    "content-type": "application/json",
  };
}

function buildContentItemsUrl(baseUrl: string): string {
  return buildUrl(baseUrl, CONTENT_ITEMS_PATH);
}

function buildSourceGroupUrl(baseUrl: string, sourceGroupId: string): string {
  return buildUrl(
    baseUrl,
    `${SOURCE_GROUPS_PATH}/${encodeURIComponent(sourceGroupId)}`,
  );
}

function buildUrl(baseUrl: string, path: string): string {
  const normalizedBaseUrl = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;

  return new URL(path, normalizedBaseUrl).toString();
}

function isSuccessStatusCode(statusCode: number): boolean {
  return statusCode >= 200 && statusCode <= 299;
}

function toContentManagerRequestBody(
  input: CollectedContentSubmissionInput,
): CollectedContentSubmissionInput {
  return {
    platform: input.platform,
    sourceGroupId: input.sourceGroupId,
    externalPostId: input.externalPostId,
    sourceUrl: input.sourceUrl,
    ...(input.title !== undefined ? { title: input.title } : {}),
    bodyText: input.bodyText,
    ...(input.authorDisplayName !== undefined
      ? { authorDisplayName: input.authorDisplayName }
      : {}),
    ...(input.authorExternalId !== undefined
      ? { authorExternalId: input.authorExternalId }
      : {}),
    ...(input.postedAt !== undefined ? { postedAt: input.postedAt } : {}),
    collectedAt: input.collectedAt,
    reactionCount: input.reactionCount,
    commentCount: input.commentCount,
    ...(input.shareCount !== undefined ? { shareCount: input.shareCount } : {}),
    topComments: input.topComments.map(toContentManagerTopCommentRequestBody),
    ...(input.rawPayloadRef !== undefined
      ? { rawPayloadRef: input.rawPayloadRef }
      : {}),
  };
}

function toContentManagerTopCommentRequestBody(
  comment: CollectedContentTopCommentSubmissionInput,
): CollectedContentTopCommentSubmissionInput {
  return {
    externalCommentId: comment.externalCommentId,
    bodyText: comment.bodyText,
    ...(comment.authorDisplayName !== undefined
      ? { authorDisplayName: comment.authorDisplayName }
      : {}),
    ...(comment.authorExternalId !== undefined
      ? { authorExternalId: comment.authorExternalId }
      : {}),
    reactionCount: comment.reactionCount,
    ...(comment.replyCount !== undefined ? { replyCount: comment.replyCount } : {}),
    ...(comment.postedAt !== undefined ? { postedAt: comment.postedAt } : {}),
    collectedAt: comment.collectedAt,
  };
}

async function readContentItemId(
  response: FetchLikeResponse,
): Promise<string | undefined> {
  const body = await readJsonBody(response);

  if (!isRecord(body) || !isRecord(body.contentItem)) {
    return undefined;
  }

  const id = body.contentItem.id;

  return typeof id === "string" && id.trim().length > 0 ? id : undefined;
}

async function readFailureMessage(response: FetchLikeResponse): Promise<string> {
  const fallbackMessage = `Content Manager responded with HTTP ${response.status}.`;

  try {
    const responseText = (await response.text()).trim();

    if (responseText.length === 0) {
      return fallbackMessage;
    }

    const parsedBody: unknown = JSON.parse(responseText);

    if (
      isRecord(parsedBody) &&
      isRecord(parsedBody.error) &&
      typeof parsedBody.error.message === "string" &&
      parsedBody.error.message.trim().length > 0
    ) {
      return parsedBody.error.message;
    }

    return responseText;
  } catch {
    return fallbackMessage;
  }
}

async function readHttpFailure(
  response: FetchLikeResponse,
): Promise<ContentManagerHttpFailure> {
  const fallbackMessage = `Content Manager responded with HTTP ${response.status}.`;

  try {
    const responseText = (await response.text()).trim();

    if (responseText.length === 0) {
      return {
        statusCode: response.status,
        errorCode: CONTENT_MANAGER_HTTP_ERROR,
        errorMessage: fallbackMessage,
      };
    }

    const parsedBody: unknown = JSON.parse(responseText);

    if (isRecord(parsedBody) && isRecord(parsedBody.error)) {
      const errorCode = parsedBody.error.code;
      const errorMessage = parsedBody.error.message;

      return {
        statusCode: response.status,
        errorCode:
          typeof errorCode === "string" && errorCode.trim().length > 0
            ? errorCode
            : CONTENT_MANAGER_HTTP_ERROR,
        errorMessage:
          typeof errorMessage === "string" && errorMessage.trim().length > 0
            ? errorMessage
            : fallbackMessage,
      };
    }

    return {
      statusCode: response.status,
      errorCode: CONTENT_MANAGER_HTTP_ERROR,
      errorMessage: responseText,
    };
  } catch {
    return {
      statusCode: response.status,
      errorCode: CONTENT_MANAGER_HTTP_ERROR,
      errorMessage: fallbackMessage,
    };
  }
}

async function readJsonBody(response: FetchLikeResponse): Promise<unknown> {
  if (response.json !== undefined) {
    try {
      return await response.json();
    } catch {
      return undefined;
    }
  }

  try {
    return JSON.parse(await response.text());
  } catch {
    return undefined;
  }
}

function toSourceGroupLookupResult(
  body: unknown,
): ContentManagerSourceGroup | undefined {
  if (!isRecord(body) || !isRecord(body.sourceGroup)) {
    return undefined;
  }

  const id = body.sourceGroup.id;
  const platform = body.sourceGroup.platform;
  const status = body.sourceGroup.status;
  const url = body.sourceGroup.url;
  const entryRoutes = toSourceGroupEntryRoutes(body.sourceGroup.entryRoutes);

  if (
    typeof id !== "string" ||
    id.trim().length === 0 ||
    typeof platform !== "string" ||
    platform.trim().length === 0 ||
    typeof status !== "string" ||
    status.trim().length === 0 ||
    typeof url !== "string" ||
    url.trim().length === 0
  ) {
    return undefined;
  }

  return {
    id,
    platform,
    status,
    url,
    entryRoutes,
  };
}

function toSourceGroupEntryRoutes(
  value: unknown,
): readonly SourceGroupLookupEntryRoute[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const entryRoutes: SourceGroupLookupEntryRoute[] = [];

  for (const entryRoute of value) {
    if (!isRecord(entryRoute)) {
      return [];
    }

    const id = entryRoute.id;
    const type = entryRoute.type;
    const url = entryRoute.url;
    const riskLevel = entryRoute.riskLevel;
    const isDefault = entryRoute.isDefault;

    if (
      typeof id !== "string" ||
      id.trim().length === 0 ||
      typeof type !== "string" ||
      type.trim().length === 0 ||
      typeof url !== "string" ||
      url.trim().length === 0 ||
      typeof riskLevel !== "string" ||
      riskLevel.trim().length === 0 ||
      typeof isDefault !== "boolean"
    ) {
      return [];
    }

    entryRoutes.push({
      id,
      type,
      url,
      riskLevel,
      isDefault,
    });
  }

  return entryRoutes;
}

function toSourceGroupLookupFailure(
  failure: ContentManagerHttpFailure,
): Extract<ContentManagerSourceGroupLookupResult, { readonly ok: false }> {
  return {
    ok: false,
    statusCode: failure.statusCode,
    errorCode: failure.errorCode,
    errorMessage: failure.errorMessage,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
