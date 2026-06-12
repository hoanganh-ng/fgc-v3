import type {
  BrowserProviderName,
  BrowserProviderNavigationInput,
  BrowserProviderNavigationResult,
  BrowserProviderPage,
  BrowserProviderResponse,
  BrowserProviderSession,
} from "../../application";

export interface PlaywrightLikeBrowser {
  close(): Promise<void>;
}

export interface PlaywrightLikeBrowserContext {
  newPage(): Promise<PlaywrightLikePage>;
  close(): Promise<void>;
}

export interface PlaywrightLikePage {
  url(): string;
  goto(
    url: string,
    options: {
      readonly waitUntil: "domcontentloaded";
      readonly timeout: number;
    },
  ): Promise<PlaywrightLikeNavigationResponse | null>;
  evaluate<T = unknown>(script: string): Promise<T>;
  exposeBinding(
    name: string,
    callback: (source: unknown, message: unknown) => void,
  ): Promise<unknown>;
  addInitScript(input: { readonly content: string }): Promise<unknown>;
  on(event: "response", listener: (response: PlaywrightLikeResponse) => void): void;
  once(event: "pageerror", listener: (error: Error) => void): void;
  once(event: "crash", listener: () => void): void;
  off(event: "pageerror", listener: (error: Error) => void): void;
  off(event: "crash", listener: () => void): void;
}

export interface PlaywrightLikeNavigationResponse {
  status(): number;
}

export interface PlaywrightLikeResponse {
  url(): string;
  headers(): Record<string, string | undefined>;
  text(): Promise<string>;
}

export function createPlaywrightLikeBrowserProviderSession(
  providerName: BrowserProviderName,
  browser: PlaywrightLikeBrowser,
  context: PlaywrightLikeBrowserContext,
): BrowserProviderSession {
  return new PlaywrightLikeBrowserProviderSession(
    providerName,
    browser,
    context,
  );
}

class PlaywrightLikeBrowserProviderSession implements BrowserProviderSession {
  public constructor(
    public readonly providerName: BrowserProviderName,
    private readonly browser: PlaywrightLikeBrowser,
    private readonly context: PlaywrightLikeBrowserContext,
  ) {}

  public async newPage(): Promise<BrowserProviderPage> {
    return new PlaywrightLikeBrowserProviderPage(await this.context.newPage());
  }

  public async close(): Promise<void> {
    let closeError: unknown;

    try {
      await this.context.close();
    } catch (error) {
      closeError = error;
    }

    try {
      await this.browser.close();
    } catch (error) {
      closeError ??= error;
    }

    if (closeError !== undefined) {
      throw closeError;
    }
  }
}

class PlaywrightLikeBrowserProviderPage implements BrowserProviderPage {
  public constructor(private readonly page: PlaywrightLikePage) {}

  public url(): string {
    return this.page.url();
  }

  public async goto(
    input: BrowserProviderNavigationInput,
  ): Promise<BrowserProviderNavigationResult | null> {
    const response = await this.page.goto(input.url, {
      waitUntil: input.waitUntil,
      timeout: input.timeoutMs,
    });

    return response === null ? null : { status: response.status() };
  }

  public async evaluate<T = unknown>(script: string): Promise<T> {
    return this.page.evaluate<T>(script);
  }

  public async exposeBinding(
    name: string,
    callback: (message: unknown) => void,
  ): Promise<void> {
    await this.page.exposeBinding(name, (_source, message) => {
      callback(message);
    });
  }

  public async addInitScript(input: { readonly content: string }): Promise<void> {
    await this.page.addInitScript(input);
  }

  public onResponse(listener: (response: BrowserProviderResponse) => void): void {
    this.page.on("response", listener);
  }

  public oncePageError(listener: (error: Error) => void): void {
    this.page.once("pageerror", listener);
  }

  public offPageError(listener: (error: Error) => void): void {
    this.page.off("pageerror", listener);
  }

  public onceCrash(listener: () => void): void {
    this.page.once("crash", listener);
  }

  public offCrash(listener: () => void): void {
    this.page.off("crash", listener);
  }
}
