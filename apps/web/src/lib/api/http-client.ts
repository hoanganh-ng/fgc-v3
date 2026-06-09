import type { ZodType } from "zod";

export type HttpMethod = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";

export interface ApiPage {
  readonly limit: number;
  readonly offset: number;
  readonly total?: number;
}

export interface ApiErrorIssue {
  readonly path: string;
  readonly message: string;
}

export type ApiQueryValue = string | number | boolean | null | undefined;

export type ApiClientError =
  | {
      readonly kind: "network";
      readonly message: string;
    }
  | {
      readonly kind: "http";
      readonly status: number;
      readonly code: string;
      readonly message: string;
      readonly issues?: readonly ApiErrorIssue[];
      readonly reasons?: readonly unknown[];
    }
  | {
      readonly kind: "invalid_response";
      readonly message: string;
    };

export type ApiResult<TData> =
  | {
      readonly ok: true;
      readonly data: TData;
    }
  | {
      readonly ok: false;
      readonly error: ApiClientError;
    };

export class ApiResultError extends Error {
  public readonly error: ApiClientError;

  public constructor(error: ApiClientError) {
    super(apiErrorToMessage(error));
    this.name = "ApiResultError";
    this.error = error;
  }
}

export interface HttpClient {
  request<TResponse, TBody = unknown>(
    options: ApiRequestOptions<TResponse, TBody>,
  ): Promise<ApiResult<TResponse>>;
}

export interface HttpClientOptions {
  readonly baseUrl: string;
  readonly fetchImpl?: typeof fetch | undefined;
}

export interface ApiRequestOptions<TResponse, TBody = unknown> {
  readonly path: string;
  readonly method?: HttpMethod | undefined;
  readonly query?: Readonly<Record<string, ApiQueryValue>> | undefined;
  readonly body?: TBody | undefined;
  readonly responseSchema: ZodType<TResponse>;
}

export function createHttpClient(options: HttpClientOptions): HttpClient {
  const fetchImpl = options.fetchImpl ?? fetch;
  const baseUrl = normalizeBaseUrl(options.baseUrl);

  return {
    async request<TResponse, TBody = unknown>(
      requestOptions: ApiRequestOptions<TResponse, TBody>,
    ): Promise<ApiResult<TResponse>> {
      const url = buildUrl(baseUrl, requestOptions.path, requestOptions.query);
      const init: RequestInit = {
        method: requestOptions.method ?? "GET",
        headers: {
          Accept: "application/json",
        },
      };

      if (requestOptions.body !== undefined) {
        init.headers = {
          ...init.headers,
          "Content-Type": "application/json",
        };
        init.body = JSON.stringify(requestOptions.body);
      }

      let response: Response;

      try {
        response = await fetchImpl(url, init);
      } catch (error) {
        return {
          ok: false,
          error: {
            kind: "network",
            message: errorToMessage(error),
          },
        };
      }

      const payloadResult = await readJsonPayload(response);

      if (!payloadResult.ok) {
        return payloadResult;
      }

      if (!response.ok) {
        const errorBody = parseErrorBody(payloadResult.data);

        return {
          ok: false,
          error: {
            kind: "http",
            status: response.status,
            code: errorBody.code,
            message: errorBody.message,
            ...(errorBody.issues !== undefined
              ? { issues: errorBody.issues }
              : {}),
            ...(errorBody.reasons !== undefined
              ? { reasons: errorBody.reasons }
              : {}),
          },
        };
      }

      const parsed = requestOptions.responseSchema.safeParse(payloadResult.data);

      if (!parsed.success) {
        return {
          ok: false,
          error: {
            kind: "invalid_response",
            message: parsed.error.message,
          },
        };
      }

      return {
        ok: true,
        data: parsed.data,
      };
    },
  };
}

export function unwrapApiResult<TData>(result: ApiResult<TData>): TData {
  if (result.ok) {
    return result.data;
  }

  throw new ApiResultError(result.error);
}

export function isApiResultError(error: unknown): error is ApiResultError {
  return error instanceof ApiResultError;
}

export function apiErrorToMessage(error: ApiClientError): string {
  if (error.kind === "network") {
    return `Unable to reach the API. ${error.message}`;
  }

  if (error.kind === "invalid_response") {
    return `The API returned an unexpected response. ${error.message}`;
  }

  return error.message;
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.trim().replace(/\/+$/, "");
}

function buildUrl(
  baseUrl: string,
  path: string,
  query: Readonly<Record<string, ApiQueryValue>> | undefined,
): string {
  const normalizedPath = `/${path.replace(/^\/+/, "")}`;
  const url = `${baseUrl}${normalizedPath}`;
  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== null) {
      searchParams.set(key, String(value));
    }
  }

  const queryString = searchParams.toString();

  return queryString.length > 0 ? `${url}?${queryString}` : url;
}

async function readJsonPayload(response: Response): Promise<ApiResult<unknown>> {
  const bodyText = await response.text();

  if (bodyText.length === 0) {
    return {
      ok: true,
      data: null,
    };
  }

  try {
    return {
      ok: true,
      data: JSON.parse(bodyText) as unknown,
    };
  } catch {
    return {
      ok: false,
      error: {
        kind: "invalid_response",
        message: "API response was not valid JSON.",
      },
    };
  }
}

function parseErrorBody(payload: unknown): {
  code: string;
  message: string;
  issues?: readonly ApiErrorIssue[];
  reasons?: readonly unknown[];
} {
  if (
    typeof payload === "object" &&
    payload !== null &&
    "error" in payload &&
    typeof payload.error === "object" &&
    payload.error !== null
  ) {
    const error = payload.error as Record<string, unknown>;
    const code = typeof error.code === "string" ? error.code : "HTTP_ERROR";
    const message =
      typeof error.message === "string"
        ? error.message
        : "The API returned an error.";
    const issues = parseErrorIssues(error.issues);
    const reasons = Array.isArray(error.reasons) ? error.reasons : undefined;

    return {
      code,
      message,
      ...(issues !== undefined ? { issues } : {}),
      ...(reasons !== undefined ? { reasons } : {}),
    };
  }

  return {
    code: "HTTP_ERROR",
    message: "The API returned an error.",
  };
}

function parseErrorIssues(value: unknown): readonly ApiErrorIssue[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const issues = value.flatMap((issue): ApiErrorIssue[] => {
    if (
      typeof issue === "object" &&
      issue !== null &&
      "path" in issue &&
      "message" in issue &&
      typeof issue.path === "string" &&
      typeof issue.message === "string"
    ) {
      return [
        {
          path: issue.path,
          message: issue.message,
        },
      ];
    }

    return [];
  });

  return issues.length > 0 ? issues : undefined;
}

function errorToMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return "Unable to reach the API.";
}
