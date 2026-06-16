import vm from "node:vm";
import { describe, expect, it } from "vitest";
import type { BrowserProviderPage } from "../application";
import {
  FACEBOOK_PAGE_STATE_OBSERVER_SCRIPT,
  observeFacebookPageState,
  type FacebookPageState,
} from "./facebook-page-state-observer";

describe("facebook page state observer", () => {
  it("detects /login URL without returning page text", () => {
    const result = runObserverScript({
      pathname: "/login",
      elements: [],
    });

    expect(result).toEqual({
      marker: "__FGC_FB_PAGE_STATE_OBSERVER__",
      pageLoaded: true,
      blockingState: "LOGIN_REQUIRED",
    });
    expect(JSON.stringify(result)).not.toContain("password");
  });

  it("detects /checkpoint URL", () => {
    expect(
      runObserverScript({
        pathname: "/checkpoint/123",
        elements: [],
      }),
    ).toMatchObject({
      blockingState: "CHECKPOINT_REQUIRED",
    });
  });

  it("detects an English login modal structurally", () => {
    const result = runObserverScript({
      pathname: "/groups/source-group-1",
      elements: [
        element("div", "See more on Facebook", { role: "dialog" }, [
          element("input", "", {
            type: "text",
            "aria-label": "Email or phone number",
          }),
          element("input", "", { type: "password", "aria-label": "Password" }),
          element("button", "Log in"),
        ]),
      ],
    });

    expect(result).toMatchObject({
      pageLoaded: true,
      blockingState: "LOGIN_REQUIRED",
    });
  });

  it("detects a Vietnamese login modal structurally", () => {
    const result = runObserverScript({
      pathname: "/groups/source-group-1",
      elements: [
        element("div", "Xem thêm trên Facebook", { role: "dialog" }, [
          element("input", "", {
            type: "text",
            "aria-label": "Email hoặc số điện thoại",
          }),
          element("input", "", { type: "password", "aria-label": "Mật khẩu" }),
          element("button", "Đăng nhập"),
          element("button", "Tạo tài khoản mới"),
        ]),
      ],
    });

    expect(result).toMatchObject({
      blockingState: "LOGIN_REQUIRED",
    });
    expect(JSON.stringify(result)).not.toContain("Mật khẩu");
  });

  it("treats a login modal over a group URL as login required", () => {
    expect(
      runObserverScript({
        pathname: "/groups/source-group-1",
        elements: [
          element("form", "", { action: "/login/device-based/regular/login/" }, [
            element("input", "", { name: "email", type: "text" }),
            element("input", "", { name: "pass", type: "password" }),
          ]),
        ],
      }),
    ).toMatchObject({
      blockingState: "LOGIN_REQUIRED",
    });
  });

  it("polls for asynchronously appearing authentication walls", async () => {
    const page = new SequencePage([
      { pageLoaded: true, blockingState: "NONE_DETECTED" },
      { pageLoaded: true, blockingState: "LOGIN_REQUIRED" },
    ]);

    await expect(
      observeFacebookPageState(page, {
        settleMs: 50,
        pollIntervalMs: 1,
      }),
    ).resolves.toEqual({
      pageLoaded: true,
      blockingState: "LOGIN_REQUIRED",
    });
    expect(page.evaluateCalls).toBeGreaterThanOrEqual(2);
  });

  it("does not trigger on hidden authentication inputs", () => {
    expect(
      runObserverScript({
        pathname: "/groups/source-group-1",
        elements: [
          element("input", "", { name: "email", type: "hidden" }),
          element("input", "", { name: "pass", type: "password", hidden: true }),
          element("main", "Recent posts"),
        ],
      }),
    ).toMatchObject({
      blockingState: "NONE_DETECTED",
    });
  });

  it("does not trigger on a normal logged-in group page", () => {
    expect(
      runObserverScript({
        pathname: "/groups/source-group-1",
        elements: [
          element("main", "Recent posts"),
          element("div", "Joined"),
        ],
      }),
    ).toMatchObject({
      pageLoaded: true,
      blockingState: "NONE_DETECTED",
    });
  });

  it("gives checkpoint evidence precedence over login evidence", () => {
    expect(
      runObserverScript({
        pathname: "/checkpoint/identity",
        elements: [
          element("form", "Confirm your identity", { action: "/checkpoint/" }, [
            element("input", "", { name: "email", type: "text" }),
            element("input", "", { name: "pass", type: "password" }),
          ]),
        ],
      }),
    ).toMatchObject({
      blockingState: "CHECKPOINT_REQUIRED",
    });
  });
});

function runObserverScript(input: {
  readonly pathname: string;
  readonly elements: readonly FakeElement[];
  readonly readyState?: string;
}): unknown {
  const documentElement = element("html", "", {}, [...input.elements]);
  const sandbox = {
    window: {
      location: {
        hostname: "www.facebook.com",
        pathname: input.pathname,
        href: `https://www.facebook.com${input.pathname}`,
      },
      getComputedStyle: (node: FakeElement) => ({
        display: node.style.display ?? "block",
        visibility: node.style.visibility ?? "visible",
        opacity: node.style.opacity ?? "1",
      }),
    },
    document: {
      readyState: input.readyState ?? "complete",
      querySelectorAll: () => flattenElements(documentElement),
    },
  };

  return vm.runInNewContext(FACEBOOK_PAGE_STATE_OBSERVER_SCRIPT, sandbox);
}

interface FakeElement {
  readonly nodeType: 1;
  readonly tagName: string;
  readonly nodeName: string;
  readonly innerText: string;
  readonly textContent: string;
  readonly attributes: Record<string, string>;
  readonly style: Record<string, string>;
  readonly children: readonly FakeElement[];
  readonly hidden?: boolean;
  getAttribute(name: string): string | null;
  getClientRects(): readonly { readonly width: number; readonly height: number }[];
  getBoundingClientRect(): { readonly width: number; readonly height: number };
  contains(candidate: FakeElement): boolean;
}

function element(
  tagName: string,
  text: string,
  attributes: Record<string, string | boolean> = {},
  children: readonly FakeElement[] = [],
): FakeElement {
  const normalizedAttributes = Object.fromEntries(
    Object.entries(attributes).map(([key, value]) => [key, String(value)]),
  );
  const fakeElement: FakeElement = {
    nodeType: 1,
    tagName,
    nodeName: tagName,
    innerText: [text, ...children.map((child) => child.innerText)]
      .filter((value) => value.length > 0)
      .join(" "),
    textContent: [text, ...children.map((child) => child.textContent)]
      .filter((value) => value.length > 0)
      .join(" "),
    attributes: normalizedAttributes,
    style: {},
    children,
    ...(attributes.hidden === true ? { hidden: true } : {}),
    getAttribute(name: string) {
      return normalizedAttributes[name] ?? null;
    },
    getClientRects() {
      return fakeElement.hidden === true ||
        normalizedAttributes.type === "hidden" ||
        fakeElement.style.display === "none"
        ? []
        : [{ width: 1, height: 1 }];
    },
    getBoundingClientRect() {
      return fakeElement.getClientRects().length > 0
        ? { width: 1, height: 1 }
        : { width: 0, height: 0 };
    },
    contains(candidate: FakeElement) {
      return (
        fakeElement === candidate ||
        fakeElement.children.some((child) => child.contains(candidate))
      );
    },
  };

  return fakeElement;
}

function flattenElements(root: FakeElement): readonly FakeElement[] {
  return [root, ...root.children.flatMap((child) => flattenElements(child))];
}

class SequencePage implements BrowserProviderPage {
  public evaluateCalls = 0;

  public constructor(private readonly states: readonly FacebookPageState[]) {}

  public url(): string {
    return "https://www.facebook.com/groups/source-group-1";
  }

  public async goto(): Promise<{ readonly status: number }> {
    return { status: 200 };
  }

  public async evaluate<T = unknown>(): Promise<T> {
    const index = Math.min(this.evaluateCalls, this.states.length - 1);
    this.evaluateCalls += 1;
    return this.states[index] as T;
  }

  public async exposeBinding(): Promise<void> {}

  public async addInitScript(): Promise<void> {}

  public onResponse(): void {}

  public oncePageError(): void {}

  public offPageError(): void {}

  public onceCrash(): void {}

  public offCrash(): void {}
}
