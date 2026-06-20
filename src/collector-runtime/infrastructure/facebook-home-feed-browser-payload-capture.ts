import type {
  BrowserProviderPort,
  FacebookHomeFeedPayloadCaptureInput,
  FacebookHomeFeedPayloadCapturePort,
  FacebookPayloadCaptureResult,
  RuntimeProfileConfigurationPort,
} from "../application";
import {
  FacebookBrowserPayloadCaptureAdapter,
  type FacebookBrowserPayloadCaptureAdapterOptions,
} from "./facebook-browser-payload-capture";
import {
  PlaywrightChromiumBrowserProvider,
} from "./browser-providers";

export const FACEBOOK_HOME_FEED_URL = "https://www.facebook.com/?sk=h_chr";

export interface FacebookHomeFeedBrowserPayloadCaptureAdapterOptions {
  readonly runtimeProfileConfigurationPort: RuntimeProfileConfigurationPort;
  readonly browserProvider: BrowserProviderPort;
  readonly abortSignal?: AbortSignal;
  readonly now?: () => Date;
}

export type PlaywrightFacebookHomeFeedBrowserPayloadCaptureAdapterOptions =
  Omit<FacebookHomeFeedBrowserPayloadCaptureAdapterOptions, "browserProvider">;

export class FacebookHomeFeedBrowserPayloadCaptureAdapter
  extends FacebookBrowserPayloadCaptureAdapter
  implements FacebookHomeFeedPayloadCapturePort {
  public constructor(
    options: FacebookHomeFeedBrowserPayloadCaptureAdapterOptions,
  ) {
    const baseOptions: FacebookBrowserPayloadCaptureAdapterOptions = {
      runtimeProfileConfigurationPort: options.runtimeProfileConfigurationPort,
      browserProvider: options.browserProvider,
      ...(options.abortSignal !== undefined
        ? { abortSignal: options.abortSignal }
        : {}),
      ...(options.now !== undefined ? { now: options.now } : {}),
    };
    super(baseOptions);
  }

  public async captureHomeFeedPayloads(
    input: FacebookHomeFeedPayloadCaptureInput,
  ): Promise<FacebookPayloadCaptureResult> {
    const effectiveSignal = combineAbortSignals(
      this.abortSignal,
      input.abortSignal,
    );

    if (effectiveSignal?.aborted === true) {
      return {
        ok: false,
        errorCode: "FACEBOOK_BROWSER_CAPTURE_INTERRUPTED",
        errorMessage:
          "Facebook browser payload capture was interrupted before completion.",
        warnings: [],
      };
    }

    return this.performCaptureWithSignal({
      url: FACEBOOK_HOME_FEED_URL,
      profileId: input.profileId,
      leaseId: input.leaseId,
      maxScrolls: input.maxScrolls,
      maxDurationMs: input.maxDurationMs,
      abortSignal: effectiveSignal,
      navigationFailureCode: "FACEBOOK_HOME_FEED_NAVIGATION_FAILED",
      navigationFailureMessage: (status) =>
        `Facebook home-feed navigation returned HTTP ${status}.`,
    });
  }

  protected async performCaptureWithSignal(input: {
    readonly url: string;
    readonly profileId: string;
    readonly leaseId: string;
    readonly maxScrolls: number;
    readonly maxDurationMs: number;
    readonly abortSignal: AbortSignal | undefined;
    readonly navigationFailureCode: string;
    readonly navigationFailureMessage: (status: number) => string;
  }): Promise<FacebookPayloadCaptureResult> {
    const previousAbortSignal = this.activeAbortSignalOverride;
    this.activeAbortSignalOverride = input.abortSignal;
    try {
      return await this.performCapture({
        url: input.url,
        profileId: input.profileId,
        leaseId: input.leaseId,
        maxScrolls: input.maxScrolls,
        maxDurationMs: input.maxDurationMs,
        navigationFailureCode: input.navigationFailureCode,
        navigationFailureMessage: input.navigationFailureMessage,
      });
    } finally {
      this.activeAbortSignalOverride = previousAbortSignal;
    }
  }
}

function combineAbortSignals(
  constructorSignal: AbortSignal | undefined,
  callSignal: AbortSignal | undefined,
): AbortSignal | undefined {
  if (constructorSignal === undefined && callSignal === undefined) {
    return undefined;
  }

  if (constructorSignal === undefined) {
    return callSignal;
  }

  if (callSignal === undefined) {
    return constructorSignal;
  }

  if (constructorSignal === callSignal) {
    return callSignal;
  }

  const merged = new AbortController();

  const onAbort = (): void => {
    merged.abort();
  };

  if (constructorSignal.aborted || callSignal.aborted) {
    merged.abort();
  } else {
    constructorSignal.addEventListener("abort", onAbort, { once: true });
    callSignal.addEventListener("abort", onAbort, { once: true });
  }

  return merged.signal;
}

export class PlaywrightFacebookHomeFeedBrowserPayloadCaptureAdapter extends FacebookHomeFeedBrowserPayloadCaptureAdapter {
  public constructor(
    options: PlaywrightFacebookHomeFeedBrowserPayloadCaptureAdapterOptions,
  ) {
    super({
      ...options,
      browserProvider: new PlaywrightChromiumBrowserProvider(),
    });
  }
}
