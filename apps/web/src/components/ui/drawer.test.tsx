import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { Drawer, getDrawerPanelClassName } from "@/components/ui/drawer";

describe("Drawer", () => {
  it("renders an accessible dialog with backdrop and close affordances", () => {
    const markup = renderToStaticMarkup(
      <Drawer
        open
        title="Run Detail"
        description="run-1"
        closeLabel="Close run detail drawer"
        onClose={vi.fn()}
      >
        <p>Loading detail</p>
      </Drawer>,
    );

    expect(markup).toContain('role="dialog"');
    expect(markup).toContain('aria-modal="true"');
    expect(markup).toContain('aria-label="Close drawer backdrop"');
    expect(markup).toContain('aria-label="Close run detail drawer"');
    expect(markup).toContain("Run Detail");
    expect(markup).toContain("run-1");
    expect(markup).toContain("Loading detail");
  });

  it("does not render when closed", () => {
    const markup = renderToStaticMarkup(
      <Drawer open={false} title="Run Detail" onClose={vi.fn()}>
        <p>Hidden detail</p>
      </Drawer>,
    );

    expect(markup).toBe("");
  });

  it("uses full viewport width by default and a desktop drawer width", () => {
    const className = getDrawerPanelClassName();

    expect(className).toContain("h-dvh");
    expect(className).toContain("w-screen");
    expect(className).toContain("sm:max-w-[28rem]");
    expect(className).toContain("flex-col");
  });
});
