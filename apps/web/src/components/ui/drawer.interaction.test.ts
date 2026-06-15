import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { chromium, type Browser, type LaunchOptions, type Page } from "playwright";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";
import { createServer, type ViteDevServer } from "vite";

const appRoot = fileURLToPath(new URL("../../..", import.meta.url));
const fixturePath = "/src/components/ui/drawer-interaction-fixture.html";

describe("Drawer keyboard interactions", () => {
  let server: ViteDevServer;
  let browser: Browser;
  let page: Page;
  let baseUrl: string;

  beforeAll(async () => {
    server = await createServer({
      configFile: fileURLToPath(new URL("../../../vite.config.ts", import.meta.url)),
      root: appRoot,
      server: {
        host: "127.0.0.1",
        port: 0,
      },
    });
    await server.listen();

    const localUrl = server.resolvedUrls?.local[0];
    if (localUrl === undefined) {
      throw new Error("Vite test server did not expose a local URL.");
    }
    baseUrl = localUrl;

    const launchOptions: LaunchOptions = existsSync("/usr/bin/google-chrome")
      ? { executablePath: "/usr/bin/google-chrome" }
      : {};
    browser = await chromium.launch(launchOptions);
  });

  beforeEach(async () => {
    page = await browser.newPage();
    await page.goto(new URL(fixturePath, baseUrl).toString());
  });

  afterEach(async () => {
    await page.close();
  });

  afterAll(async () => {
    await browser?.close();
    await server?.close();
  });

  it("moves initial focus into the drawer close button", async () => {
    await openRunOneDrawer(page);

    await expectActiveElement(page, "Close run detail drawer");
  });

  it("wraps Tab from the final drawer focus target to the first", async () => {
    await openRunOneDrawer(page);

    await page.locator("#drawer-switch-run").focus();
    await page.keyboard.press("Tab");

    await expectActiveElement(page, "Close run detail drawer");
  });

  it("wraps Shift+Tab from the first drawer focus target to the final", async () => {
    await openRunOneDrawer(page);

    await page.keyboard.press("Shift+Tab");

    await expectActiveElement(page, "drawer-switch-run");
  });

  it("keeps focus on the close button when it is the only focusable element", async () => {
    await page.locator("#details-run-single").click();
    expect(await page.locator("[role='dialog']").count()).toBe(1);

    await page.keyboard.press("Tab");
    await expectActiveElement(page, "Close run detail drawer");

    await page.keyboard.press("Shift+Tab");
    await expectActiveElement(page, "Close run detail drawer");
  });

  it("closes on Escape and restores focus to the triggering details button", async () => {
    await openRunOneDrawer(page);

    await page.keyboard.press("Escape");

    expect(await page.locator("[role='dialog']").count()).toBe(0);
    await expectActiveElement(page, "details-run-1");
  });

  it("closes on backdrop click and restores focus", async () => {
    await openRunOneDrawer(page);

    await page.getByLabel("Close drawer backdrop").click();

    expect(await page.locator("[role='dialog']").count()).toBe(0);
    await expectActiveElement(page, "details-run-1");
  });

  it("closes on the close button and restores focus", async () => {
    await openRunOneDrawer(page);

    await page.getByLabel("Close run detail drawer").click();

    expect(await page.locator("[role='dialog']").count()).toBe(0);
    await expectActiveElement(page, "details-run-1");
  });

  it("updates selected run content without stacking drawers", async () => {
    await openRunOneDrawer(page);

    await page.locator("#drawer-switch-run").click();

    expect(await page.locator("[role='dialog']").count()).toBe(1);
    expect(await page.locator("[role='dialog']").textContent()).toContain("run-2");

    await page.getByLabel("Close run detail drawer").click();
    await expectActiveElement(page, "details-run-1");
  });

  it("keeps background controls out of normal Tab navigation while open", async () => {
    await openRunOneDrawer(page);

    expect(await page.locator("#root").getAttribute("inert")).toBe("");
    expect(await page.locator("#root").getAttribute("aria-hidden")).toBe("true");

    for (let index = 0; index < 8; index += 1) {
      await page.keyboard.press("Tab");
      await expectFocusedElementInsideDrawer(page);
    }
  });
});

async function openRunOneDrawer(page: Page): Promise<void> {
  await page.locator("#details-run-1").click();
  expect(await page.locator("[role='dialog']").count()).toBe(1);
}

async function expectActiveElement(
  page: Page,
  expectedIdentifier: string,
): Promise<void> {
  await expect
    .poll(async () => activeElementIdentifier(page))
    .toBe(expectedIdentifier);
}

async function activeElementIdentifier(page: Page): Promise<string> {
  return page.evaluate(() => {
    const activeElement = document.activeElement;
    return (
      activeElement?.id ||
      activeElement?.getAttribute("aria-label") ||
      activeElement?.tagName ||
      ""
    );
  });
}

async function expectFocusedElementInsideDrawer(page: Page): Promise<void> {
  await expect.poll(async () =>
    page.evaluate(() => {
      const dialog = document.querySelector("[role='dialog']");
      const activeElement = document.activeElement;

      return (
        dialog !== null &&
        activeElement !== null &&
        dialog.contains(activeElement)
      );
    }),
  ).toBe(true);
}
