import vm from "node:vm";
import { describe, expect, it } from "vitest";
import type { BrowserProviderPage } from "../application";
import {
  FACEBOOK_PAGE_STATE_OBSERVER_SCRIPT,
  observeFacebookPageState,
  type FacebookPageState,
} from "./facebook-page-state-observer";

describe("facebook page state observer", () => {
  // --- URL detection ---

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

  it("detects bare /checkpoint pathname", () => {
    expect(
      runObserverScript({ pathname: "/checkpoint", elements: [] }),
    ).toMatchObject({ blockingState: "CHECKPOINT_REQUIRED" });
  });

  // --- Login modal detection ---

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

  // --- Healthy-feed false-positive cases (Sprint 053B) ---

  it("healthy feed with visible forms returns NONE_DETECTED", () => {
    expect(
      runObserverScript({
        pathname: "/groups/source-group-1",
        elements: [
          element("main", "Recent posts"),
          element("form", "Search", { action: "/search/results/" }, [
            element("input", "", { type: "search", placeholder: "Search" }),
            element("button", "Search"),
          ]),
        ],
      }),
    ).toMatchObject({ blockingState: "NONE_DETECTED" });
  });

  it("healthy feed with a Continue button returns NONE_DETECTED", () => {
    expect(
      runObserverScript({
        pathname: "/groups/source-group-1",
        elements: [
          element("main", "Recent posts"),
          element("button", "Continue"),
        ],
      }),
    ).toMatchObject({ blockingState: "NONE_DETECTED" });
  });

  it("healthy feed with generic 'security' text returns NONE_DETECTED", () => {
    expect(
      runObserverScript({
        pathname: "/groups/source-group-1",
        elements: [
          element("main", "Recent posts about security topics"),
          element("div", "Security best practices"),
        ],
      }),
    ).toMatchObject({ blockingState: "NONE_DETECTED" });
  });

  it("healthy feed with 'confirm' form action returns NONE_DETECTED", () => {
    expect(
      runObserverScript({
        pathname: "/groups/source-group-1",
        elements: [
          element("main", "Recent posts"),
          element("form", "Subscribe", { action: "/confirm/subscription/" }, [
            element("input", "", { type: "email", placeholder: "Email" }),
            element("button", "Confirm"),
          ]),
        ],
      }),
    ).toMatchObject({ blockingState: "NONE_DETECTED" });
  });

  it("healthy feed with 'identity' form action returns NONE_DETECTED", () => {
    expect(
      runObserverScript({
        pathname: "/groups/source-group-1",
        elements: [
          element("main", "Recent posts"),
          element("form", "Update info", { action: "/identity/update/" }, [
            element("input", "", { type: "text", name: "username" }),
            element("button", "Save"),
          ]),
        ],
      }),
    ).toMatchObject({ blockingState: "NONE_DETECTED" });
  });

  // --- Hidden/zero-size checkpoint forms should not trigger ---

  it("hidden checkpoint form does not trigger CHECKPOINT_REQUIRED", () => {
    expect(
      runObserverScript({
        pathname: "/groups/source-group-1",
        elements: [
          element("main", "Recent posts"),
          element(
            "form",
            "Security check",
            { action: "/checkpoint/", hidden: true },
            [element("button", "Continue")],
          ),
        ],
      }),
    ).toMatchObject({ blockingState: "NONE_DETECTED" });
  });

  it("zero-size checkpoint-like template element does not trigger CHECKPOINT_REQUIRED", () => {
    expect(
      runObserverScript({
        pathname: "/groups/source-group-1",
        elements: [
          element("main", "Recent posts"),
          zeroSizeElement("form", "Security check confirm your identity", {
            action: "/checkpoint/",
          }),
        ],
      }),
    ).toMatchObject({ blockingState: "NONE_DETECTED" });
  });

  // --- Co-location requirement ---

  it("checkpoint text in one container and Continue button in another returns NONE_DETECTED", () => {
    expect(
      runObserverScript({
        pathname: "/groups/source-group-1",
        elements: [
          element("div", "Security check — confirm your identity"),
          element("div", "", {}, [element("button", "Continue")]),
        ],
      }),
    ).toMatchObject({ blockingState: "NONE_DETECTED" });
  });

  // --- Real checkpoint detection ---

  it("detects visible /checkpoint form action", () => {
    expect(
      runObserverScript({
        pathname: "/groups/source-group-1",
        elements: [
          element("form", "Verify your identity", { action: "/checkpoint/" }, [
            element("input", "", { type: "text", name: "code" }),
            element("button", "Continue"),
          ]),
        ],
      }),
    ).toMatchObject({ blockingState: "CHECKPOINT_REQUIRED" });
  });

  it("detects visible checkpoint dialog with co-located verification control", () => {
    expect(
      runObserverScript({
        pathname: "/groups/source-group-1",
        elements: [
          element(
            "div",
            "Security check",
            { role: "dialog" },
            [
              element("p", "Confirm your identity to continue"),
              element("input", "", {
                type: "text",
                "aria-label": "Verification code",
                name: "code",
              }),
              element("button", "Continue"),
            ],
          ),
        ],
      }),
    ).toMatchObject({ blockingState: "CHECKPOINT_REQUIRED" });
  });

  it("checkpoint dialog takes precedence over co-present login evidence", () => {
    expect(
      runObserverScript({
        pathname: "/groups/source-group-1",
        elements: [
          element(
            "div",
            "Security check",
            { role: "dialog" },
            [
              element("p", "Confirm your identity"),
              element("input", "", { type: "password" }),
              element("button", "Continue"),
            ],
          ),
          element("form", "", { action: "/login/" }, [
            element("input", "", { type: "email" }),
            element("input", "", { type: "password" }),
          ]),
        ],
      }),
    ).toMatchObject({ blockingState: "CHECKPOINT_REQUIRED" });
  });

  it("healthy feed returns NONE_DETECTED (evidence code NONE)", () => {
    expect(
      runObserverScript({
        pathname: "/groups/source-group-1",
        elements: [
          element("main", "Welcome to the group"),
          element("div", "See all posts"),
          element("button", "Continue reading"),
        ],
      }),
    ).toMatchObject({ blockingState: "NONE_DETECTED" });
  });
});

// ---------------------------------------------------------------------------
// Consumer regression stubs — verify healthy feed does not false-positive
// and genuine checkpoint/login still detected via SequencePage
// ---------------------------------------------------------------------------

describe("consumer regression: exerciser", () => {
  it("healthy feed page state returns NONE_DETECTED (exerciser)", async () => {
    const page = new SequencePage([
      { pageLoaded: true, blockingState: "NONE_DETECTED" },
    ]);
    const result = await observeFacebookPageState(page, {
      settleMs: 0,
      pollIntervalMs: 1,
    });
    expect(result.blockingState).toBe("NONE_DETECTED");
  });

  it("genuine checkpoint stops exerciser flow", async () => {
    const page = new SequencePage([
      { pageLoaded: true, blockingState: "CHECKPOINT_REQUIRED" },
    ]);
    const result = await observeFacebookPageState(page, {
      settleMs: 50,
      pollIntervalMs: 1,
    });
    expect(result.blockingState).toBe("CHECKPOINT_REQUIRED");
  });
});

describe("consumer regression: collector", () => {
  it("healthy feed page state returns NONE_DETECTED (collector)", async () => {
    const page = new SequencePage([
      { pageLoaded: true, blockingState: "NONE_DETECTED" },
    ]);
    const result = await observeFacebookPageState(page, {
      settleMs: 0,
      pollIntervalMs: 1,
    });
    expect(result.blockingState).toBe("NONE_DETECTED");
  });

  it("genuine checkpoint stops collector flow", async () => {
    const page = new SequencePage([
      { pageLoaded: true, blockingState: "CHECKPOINT_REQUIRED" },
    ]);
    const result = await observeFacebookPageState(page, {
      settleMs: 0,
      pollIntervalMs: 1,
    });
    expect(result.blockingState).toBe("CHECKPOINT_REQUIRED");
  });
});

describe("consumer regression: access check", () => {
  it("normal group/feed does not return CHECKPOINT_REQUIRED", () => {
    expect(
      runObserverScript({
        pathname: "/groups/source-group-1",
        elements: [
          element("main", "Recent posts"),
          element("div", "Members · 1.2k"),
        ],
      }),
    ).toMatchObject({ blockingState: "NONE_DETECTED" });
  });

  it("genuine checkpoint on group URL returns CHECKPOINT_REQUIRED", () => {
    expect(
      runObserverScript({
        pathname: "/groups/source-group-1",
        elements: [
          element(
            "div",
            "Security check",
            { role: "dialog" },
            [
              element("p", "Confirm your identity to continue"),
              element("button", "Continue"),
            ],
          ),
        ],
      }),
    ).toMatchObject({ blockingState: "CHECKPOINT_REQUIRED" });
  });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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
    URL,
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

/** Element that always returns zero client rects and zero bounding box — simulates off-screen template nodes */
function zeroSizeElement(
  tagName: string,
  text: string,
  attributes: Record<string, string | boolean> = {},
  children: readonly FakeElement[] = [],
): FakeElement {
  const base = element(tagName, text, attributes, children);
  return {
    ...base,
    getClientRects() {
      return [];
    },
    getBoundingClientRect() {
      return { width: 0, height: 0 };
    },
  };
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
