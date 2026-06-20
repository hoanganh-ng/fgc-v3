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
    return this.performCapture({
      url: FACEBOOK_HOME_FEED_URL,
      profileId: input.profileId,
      leaseId: input.leaseId,
      maxScrolls: input.maxScrolls,
      maxDurationMs: input.maxDurationMs,
      navigationFailureCode: "FACEBOOK_HOME_FEED_NAVIGATION_FAILED",
      navigationFailureMessage: (status) =>
        `Facebook home-feed navigation returned HTTP ${status}.`,
    });
  }
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
