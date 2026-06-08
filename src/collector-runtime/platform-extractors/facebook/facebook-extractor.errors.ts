import type {
  FacebookExtractionIssue,
  FacebookExtractionIssueCode,
  FacebookExtractionWarning,
  FacebookExtractionWarningCode,
} from "./facebook-extractor.types";

export function createFacebookExtractionIssue(
  code: FacebookExtractionIssueCode,
  message: string,
  path?: string,
): FacebookExtractionIssue {
  return withOptionalPath({ code, message }, path);
}

export function createFacebookExtractionWarning(
  code: FacebookExtractionWarningCode,
  message: string,
  path?: string,
): FacebookExtractionWarning {
  return withOptionalPath({ code, message }, path);
}

function withOptionalPath<T extends { readonly code: string; readonly message: string }>(
  value: T,
  path: string | undefined,
): T & { readonly path?: string } {
  if (path === undefined) {
    return value;
  }

  return {
    ...value,
    path,
  };
}
