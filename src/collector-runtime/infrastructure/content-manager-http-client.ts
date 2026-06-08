import { errorToMessage } from "../application";
import type {
  CollectedContentSubmissionInput,
  CollectedContentTopCommentSubmissionInput,
  ContentManagerContentSubmissionPort,
  ContentSubmissionResult,
} from "../application";

const CONTENT_ITEMS_PATH = "collector/content-items";

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

export class ContentManagerHttpClient
  implements ContentManagerContentSubmissionPort {
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
        errorCode: "CONTENT_MANAGER_NETWORK_ERROR",
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

function buildContentItemsUrl(baseUrl: string): string {
  const normalizedBaseUrl = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;

  return new URL(CONTENT_ITEMS_PATH, normalizedBaseUrl).toString();
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
  if (response.json === undefined) {
    return undefined;
  }

  try {
    const body = await response.json();

    if (!isRecord(body) || !isRecord(body.contentItem)) {
      return undefined;
    }

    const id = body.contentItem.id;

    return typeof id === "string" && id.trim().length > 0 ? id : undefined;
  } catch {
    return undefined;
  }
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
