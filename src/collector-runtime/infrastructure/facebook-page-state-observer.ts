import type { BrowserProviderPage } from "../application";

export const FACEBOOK_PAGE_BLOCKING_STATES = [
  "NONE_DETECTED",
  "LOGIN_REQUIRED",
  "CHECKPOINT_REQUIRED",
] as const;

export type FacebookPageBlockingState =
  (typeof FACEBOOK_PAGE_BLOCKING_STATES)[number];

export interface FacebookPageState {
  readonly pageLoaded: boolean;
  readonly blockingState: FacebookPageBlockingState;
}

export interface FacebookPageStateObserverOptions {
  readonly settleMs?: number;
  readonly pollIntervalMs?: number;
  readonly deadlineAt?: number;
  readonly abortSignal?: AbortSignal;
  readonly now?: () => number;
}

const DEFAULT_SETTLE_MS = 500;
const DEFAULT_POLL_INTERVAL_MS = 100;
const MAX_TIMER_DELAY_MS = 2_147_483_647;

export const FACEBOOK_PAGE_STATE_OBSERVER_SCRIPT = `(() => {
  const marker = "__FGC_FB_PAGE_STATE_OBSERVER__";
  const normalize = (value) => String(value || "").replace(/\\s+/g, " ").trim().toLowerCase();
  const hostname = normalize(window.location?.hostname || "");
  const pathname = normalize(window.location?.pathname || "");
  const href = normalize(window.location?.href || "");
  const isFacebook =
    hostname === "facebook.com" ||
    hostname.endsWith(".facebook.com") ||
    href.includes("facebook.com/");
  const elements = Array.from(document.querySelectorAll("*"));

  const readAttribute = (element, name) => normalize(element.getAttribute?.(name));
  const readText = (element) =>
    normalize([
      element.innerText,
      element.textContent,
      element.getAttribute?.("aria-label"),
      element.getAttribute?.("placeholder"),
      element.getAttribute?.("value")
    ].filter(Boolean).join(" "));
  const tagName = (element) => normalize(element.tagName || element.nodeName || "");
  const inputType = (element) => readAttribute(element, "type") || "text";
  const isInput = (element) => tagName(element) === "input";

  const isElementVisible = (element) => {
    if (!element || element.nodeType !== 1) return false;
    if (element.hidden === true) return false;
    if (readAttribute(element, "aria-hidden") === "true") return false;
    if (isInput(element) && inputType(element) === "hidden") return false;

    const inlineStyle = element.style || {};
    if (
      normalize(inlineStyle.display) === "none" ||
      normalize(inlineStyle.visibility) === "hidden" ||
      normalize(inlineStyle.opacity) === "0"
    ) {
      return false;
    }

    if (typeof window.getComputedStyle === "function") {
      const computed = window.getComputedStyle(element);
      if (
        normalize(computed?.display) === "none" ||
        normalize(computed?.visibility) === "hidden" ||
        normalize(computed?.opacity) === "0"
      ) {
        return false;
      }
    }

    if (typeof element.getClientRects === "function" && element.getClientRects().length > 0) {
      return true;
    }

    if (typeof element.getBoundingClientRect === "function") {
      const rect = element.getBoundingClientRect();
      if ((rect?.width || 0) > 0 || (rect?.height || 0) > 0) {
        return true;
      }
    }

    return true;
  };

  const visibleElements = elements.filter(isElementVisible);
  const visibleText = normalize(visibleElements.map(readText).filter(Boolean).join(" "));
  const hasVisibleText = (values) => values.some((value) => visibleText.includes(value));

  const containsAny = (value, candidates) =>
    candidates.some((candidate) => value.includes(candidate));

  const visiblePasswordInputs = visibleElements.filter((element) => {
    if (!isInput(element)) return false;
    const metadata = normalize([
      inputType(element),
      readAttribute(element, "name"),
      readAttribute(element, "id"),
      readAttribute(element, "autocomplete"),
      readAttribute(element, "aria-label"),
      readAttribute(element, "placeholder")
    ].join(" "));

    return inputType(element) === "password" || containsAny(metadata, ["password", "mật khẩu"]);
  });

  const visibleIdentityInputs = visibleElements.filter((element) => {
    if (!isInput(element)) return false;
    const metadata = normalize([
      inputType(element),
      readAttribute(element, "name"),
      readAttribute(element, "id"),
      readAttribute(element, "autocomplete"),
      readAttribute(element, "aria-label"),
      readAttribute(element, "placeholder")
    ].join(" "));

    return (
      inputType(element) === "email" ||
      inputType(element) === "tel" ||
      containsAny(metadata, [
        "email",
        "phone",
        "username",
        "identifier",
        "login",
        "số điện thoại",
        "dien thoai"
      ])
    );
  });

  const formActionKind = (form) => {
    const action = normalize(form.getAttribute?.("action") || form.action || "");

    if (
      containsAny(action, [
        "/checkpoint",
        "checkpoint",
        "security",
        "identity",
        "confirm"
      ])
    ) {
      return "CHECKPOINT";
    }

    if (containsAny(action, ["/login", "login", "authenticate", "auth/login"])) {
      return "LOGIN";
    }

    return "NONE";
  };

  const visibleForms = visibleElements.filter((element) => tagName(element) === "form");
  const visibleLoginActionForms = visibleForms.filter(
    (element) => formActionKind(element) === "LOGIN",
  );
  const visibleCheckpointForms = visibleForms.filter(
    (element) => formActionKind(element) === "CHECKPOINT",
  );
  const elementContains = (container, candidate) =>
    container === candidate || Boolean(container.contains?.(candidate));
  const formHasPassword = (form) =>
    visiblePasswordInputs.some((input) => elementContains(form, input));
  const formHasIdentity = (form) =>
    visibleIdentityInputs.some((input) => elementContains(form, input));
  const controlTexts = visibleElements
    .filter((element) => {
      const tag = tagName(element);
      return (
        tag === "button" ||
        tag === "a" ||
        tag === "input" ||
        readAttribute(element, "role") === "button"
      );
    })
    .map(readText);
  const visibleLoginControl = controlTexts.some((text) =>
    containsAny(text, ["log in", "login", "đăng nhập", "dang nhap"]),
  );
  const visibleContinueControl = controlTexts.some((text) =>
    containsAny(text, ["continue", "tiếp tục", "tiep tuc"]),
  );
  const visibleAuthenticationForm = visibleForms.some(
    (form) =>
      formHasPassword(form) &&
      (formHasIdentity(form) || visibleLoginControl || formActionKind(form) === "LOGIN"),
  );
  const visibleAuthenticationDialog = visibleElements.some((element) => {
    const role = readAttribute(element, "role");
    const ariaModal = readAttribute(element, "aria-modal");
    if (role !== "dialog" && role !== "alertdialog" && ariaModal !== "true") {
      return false;
    }

    const dialogText = readText(element);
    const hasPassword = visiblePasswordInputs.some((input) => elementContains(element, input));
    const hasIdentity = visibleIdentityInputs.some((input) => elementContains(element, input));
    const hasSupportingText = containsAny(dialogText, [
      "log in",
      "email or phone",
      "password",
      "xem thêm trên facebook",
      "email hoặc số điện thoại",
      "mật khẩu",
      "đăng nhập",
      "tạo tài khoản mới"
    ]);

    return hasPassword && (hasIdentity || visibleLoginControl || hasSupportingText);
  });

  const checkpointTextVisible = hasVisibleText([
    "checkpoint",
    "security check",
    "confirm your identity",
    "identity confirmation",
    "xác minh danh tính",
    "xac minh danh tinh",
    "kiểm tra bảo mật",
    "kiem tra bao mat"
  ]);
  const visibleCheckpointEvidence =
    visibleCheckpointForms.length > 0 ||
    (checkpointTextVisible &&
      (visibleContinueControl ||
        visibleForms.length > 0 ||
        visibleIdentityInputs.length > 0 ||
        visiblePasswordInputs.length > 0));

  const loginTextVisible = hasVisibleText([
    "log into facebook",
    "log in to facebook",
    "you must log in",
    "xem thêm trên facebook",
    "email hoặc số điện thoại",
    "mật khẩu",
    "đăng nhập",
    "tạo tài khoản mới"
  ]);
  const visibleLoginEvidence =
    visibleLoginActionForms.length > 0 ||
    visibleAuthenticationForm ||
    visibleAuthenticationDialog ||
    (visiblePasswordInputs.length > 0 &&
      (visibleIdentityInputs.length > 0 || visibleLoginControl || loginTextVisible)) ||
    (visibleIdentityInputs.length > 0 && visibleLoginControl && loginTextVisible);

  const pageLoaded =
    document.readyState === "interactive" || document.readyState === "complete";

  if (isFacebook && (pathname.includes("/checkpoint") || visibleCheckpointEvidence)) {
    return { marker, pageLoaded, blockingState: "CHECKPOINT_REQUIRED" };
  }

  if (isFacebook && (pathname.includes("/login") || visibleLoginEvidence)) {
    return { marker, pageLoaded, blockingState: "LOGIN_REQUIRED" };
  }

  return { marker, pageLoaded, blockingState: "NONE_DETECTED" };
})()`;

export async function observeFacebookPageState(
  page: BrowserProviderPage,
  options: FacebookPageStateObserverOptions = {},
): Promise<FacebookPageState> {
  const now = options.now ?? (() => Date.now());
  const settleMs = normalizeNonNegativeInteger(
    options.settleMs,
    DEFAULT_SETTLE_MS,
  );
  const pollIntervalMs = normalizePositiveInteger(
    options.pollIntervalMs,
    DEFAULT_POLL_INTERVAL_MS,
  );
  const startedAt = now();
  const settleDeadlineAt = startedAt + settleMs;
  let latest = await observeOnce(page);

  if (latest.blockingState !== "NONE_DETECTED") {
    return latest;
  }

  while (true) {
    throwIfAborted(options.abortSignal);

    const currentTime = now();
    const deadlineAt = minDefined(settleDeadlineAt, options.deadlineAt);

    if (currentTime >= deadlineAt) {
      return latest;
    }

    await delay(
      Math.min(pollIntervalMs, deadlineAt - currentTime),
      options.abortSignal,
    );
    latest = await observeOnce(page);

    if (latest.blockingState !== "NONE_DETECTED") {
      return latest;
    }
  }
}

async function observeOnce(page: BrowserProviderPage): Promise<FacebookPageState> {
  return normalizePageStateResult(
    await page.evaluate<unknown>(FACEBOOK_PAGE_STATE_OBSERVER_SCRIPT),
  );
}

function normalizePageStateResult(value: unknown): FacebookPageState {
  if (!isRecord(value)) {
    return {
      pageLoaded: false,
      blockingState: "NONE_DETECTED",
    };
  }

  const blockingState = readBlockingState(value.blockingState);

  if (blockingState !== undefined) {
    return {
      pageLoaded: value.pageLoaded === true,
      blockingState,
    };
  }

  if (value.checkpointDetected === true) {
    return {
      pageLoaded: value.pageLoaded === true,
      blockingState: "CHECKPOINT_REQUIRED",
    };
  }

  if (value.loginRequired === true) {
    return {
      pageLoaded: value.pageLoaded === true,
      blockingState: "LOGIN_REQUIRED",
    };
  }

  return {
    pageLoaded: value.pageLoaded === true,
    blockingState: "NONE_DETECTED",
  };
}

function readBlockingState(value: unknown): FacebookPageBlockingState | undefined {
  if (
    value === "NONE_DETECTED" ||
    value === "LOGIN_REQUIRED" ||
    value === "CHECKPOINT_REQUIRED"
  ) {
    return value;
  }

  return undefined;
}

function normalizeNonNegativeInteger(
  value: number | undefined,
  fallback: number,
): number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0
    ? value
    : fallback;
}

function normalizePositiveInteger(
  value: number | undefined,
  fallback: number,
): number {
  return typeof value === "number" && Number.isInteger(value) && value > 0
    ? value
    : fallback;
}

function minDefined(left: number, right: number | undefined): number {
  return right === undefined ? left : Math.min(left, right);
}

async function delay(
  milliseconds: number,
  abortSignal: AbortSignal | undefined,
): Promise<void> {
  throwIfAborted(abortSignal);

  await new Promise<void>((resolve, reject) => {
    let timeout: ReturnType<typeof setTimeout> | undefined;
    let onAbort: (() => void) | undefined;

    timeout = setTimeout(
      () => {
        cleanup();
        resolve();
      },
      Math.min(Math.max(0, milliseconds), MAX_TIMER_DELAY_MS),
    );

    if (abortSignal !== undefined) {
      onAbort = () => {
        cleanup();
        reject(new FacebookPageStateObservationAbortedError());
      };
      abortSignal.addEventListener("abort", onAbort, { once: true });
    }

    function cleanup(): void {
      if (timeout !== undefined) {
        clearTimeout(timeout);
      }
      if (onAbort !== undefined) {
        abortSignal?.removeEventListener("abort", onAbort);
      }
    }
  });
}

function throwIfAborted(abortSignal: AbortSignal | undefined): void {
  if (abortSignal?.aborted === true) {
    throw new FacebookPageStateObservationAbortedError();
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export class FacebookPageStateObservationAbortedError extends Error {
  public constructor() {
    super("Facebook page state observation was aborted.");
    this.name = "FacebookPageStateObservationAbortedError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
