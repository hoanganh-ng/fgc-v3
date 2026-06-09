import { chromium } from "playwright";
import type {
  Browser,
  BrowserContext,
  BrowserContextOptions,
  Page,
} from "playwright";
import type {
  ProvisioningBrowserCookie,
  ProvisioningCapturedSessionState,
  ProvisioningConfiguration,
  ProvisioningCookieSameSite,
  ProvisioningLocalStorageEntry,
  ProvisioningProxyRouting,
} from "./provisioning-http-client";
import type {
  ProvisioningBrowserLauncher,
  ProvisioningBrowserSession,
} from "./provisioning-runner";

const FACEBOOK_LOGIN_URL = "https://www.facebook.com/login";
const FACEBOOK_LOCAL_STORAGE_ORIGINS = [
  "https://www.facebook.com",
  "https://m.facebook.com",
] as const;

interface CapturedLocalStorageValue {
  readonly key: string;
  readonly value: string;
}

interface PlaywrightCookieShape {
  readonly name: string;
  readonly value: string;
  readonly domain: string;
  readonly path: string;
  readonly expires: number;
  readonly httpOnly: boolean;
  readonly secure: boolean;
  readonly sameSite?: string;
}

interface PlaywrightProxySettings {
  readonly server: string;
  readonly username?: string;
  readonly password?: string;
}

export class PlaywrightProvisioningBrowserLauncher
  implements ProvisioningBrowserLauncher {
  public async launch(
    configuration: ProvisioningConfiguration,
  ): Promise<ProvisioningBrowserSession> {
    const browser = await chromium.launch({
      headless: false,
    });
    const context = await browser.newContext(
      toBrowserContextOptions(configuration),
    );

    return new PlaywrightProvisioningBrowserSession(browser, context);
  }
}

class PlaywrightProvisioningBrowserSession
  implements ProvisioningBrowserSession {
  private loginPage: Page | undefined;
  private closed = false;

  public constructor(
    private readonly browser: Browser,
    private readonly context: BrowserContext,
  ) {}

  public async openLoginPage(): Promise<void> {
    this.loginPage = await this.context.newPage();
    await this.loginPage.goto(FACEBOOK_LOGIN_URL, {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });
  }

  public async captureSessionState(): Promise<ProvisioningCapturedSessionState> {
    const cookies = (
      await this.context.cookies([...FACEBOOK_LOCAL_STORAGE_ORIGINS])
    )
      .map(toProvisioningBrowserCookie)
      .filter(
        (cookie): cookie is ProvisioningBrowserCookie => cookie !== undefined,
      );
    const localStorage = await captureLocalStorageForOrigins(this.context);

    return {
      cookies,
      localStorage,
    };
  }

  public async close(): Promise<void> {
    if (this.closed) {
      return;
    }

    this.closed = true;

    try {
      await this.context.close();
    } finally {
      await this.browser.close();
    }
  }
}

function toBrowserContextOptions(
  configuration: ProvisioningConfiguration,
): BrowserContextOptions {
  const { hardwareFingerprint, networkContext } = configuration;
  const firstLanguage = hardwareFingerprint.languages[0];
  const proxy = toPlaywrightProxySettings(networkContext.proxy);

  return {
    userAgent: hardwareFingerprint.userAgent,
    viewport: {
      width: Math.round(hardwareFingerprint.viewport.width),
      height: Math.round(hardwareFingerprint.viewport.height),
    },
    ...(hardwareFingerprint.viewport.deviceScaleFactor !== undefined
      ? {
          deviceScaleFactor: hardwareFingerprint.viewport.deviceScaleFactor,
        }
      : {}),
    ...(firstLanguage !== undefined ? { locale: firstLanguage } : {}),
    ...(hardwareFingerprint.timezone !== undefined
      ? { timezoneId: hardwareFingerprint.timezone }
      : {}),
    ...(hardwareFingerprint.languages.length > 0
      ? {
          extraHTTPHeaders: {
            "Accept-Language": hardwareFingerprint.languages.join(","),
          },
        }
      : {}),
    ...(proxy !== undefined ? { proxy } : {}),
  };
}

function toPlaywrightProxySettings(
  proxy: ProvisioningProxyRouting | null,
): PlaywrightProxySettings | undefined {
  if (proxy === null) {
    return undefined;
  }

  const credentials = proxy.credentials ?? undefined;

  return {
    server: `${toProxyScheme(proxy.protocol)}://${proxy.host}:${proxy.port}`,
    ...(credentials !== undefined
      ? {
          username: credentials.username,
          password: credentials.password,
        }
      : {}),
  };
}

function toProxyScheme(protocol: ProvisioningProxyRouting["protocol"]): string {
  if (protocol === "SOCKS5") {
    return "socks5";
  }

  return protocol.toLowerCase();
}

async function captureLocalStorageForOrigins(
  context: BrowserContext,
): Promise<readonly ProvisioningLocalStorageEntry[]> {
  const entries: ProvisioningLocalStorageEntry[] = [];

  for (const origin of FACEBOOK_LOCAL_STORAGE_ORIGINS) {
    entries.push(...(await captureLocalStorageForOrigin(context, origin)));
  }

  return entries;
}

async function captureLocalStorageForOrigin(
  context: BrowserContext,
  origin: string,
): Promise<readonly ProvisioningLocalStorageEntry[]> {
  const page = await context.newPage();

  try {
    await page.goto(origin, {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });

    const values = (await page.evaluate(`(() => {
      const entries = [];

      for (let index = 0; index < window.localStorage.length; index += 1) {
        const key = window.localStorage.key(index);

        if (key !== null && key.length > 0) {
          entries.push({
            key,
            value: window.localStorage.getItem(key) ?? "",
          });
        }
      }

      return entries;
    })()`)) as readonly CapturedLocalStorageValue[];

    return values.map((value) => ({
      origin,
      key: value.key,
      value: value.value,
    }));
  } finally {
    await page.close();
  }
}

function toProvisioningBrowserCookie(
  cookie: PlaywrightCookieShape,
): ProvisioningBrowserCookie | undefined {
  if (
    cookie.name.trim().length === 0 ||
    cookie.domain.trim().length === 0 ||
    cookie.path.trim().length === 0
  ) {
    return undefined;
  }

  const sameSite = toProvisioningSameSite(cookie.sameSite);

  return {
    name: cookie.name,
    value: cookie.value,
    domain: cookie.domain,
    path: cookie.path,
    expiresAt:
      Number.isFinite(cookie.expires) && cookie.expires > 0
        ? new Date(cookie.expires * 1000).toISOString()
        : null,
    httpOnly: cookie.httpOnly,
    secure: cookie.secure,
    ...(sameSite !== undefined ? { sameSite } : {}),
  };
}

function toProvisioningSameSite(
  value: string | undefined,
): ProvisioningCookieSameSite | undefined {
  if (value === "Strict") {
    return "STRICT";
  }

  if (value === "Lax") {
    return "LAX";
  }

  if (value === "None") {
    return "NONE";
  }

  return undefined;
}
