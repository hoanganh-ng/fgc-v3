import { describe, expect, it } from "vitest";
import {
  getProfileSourceAccessCheckRunDetailContentState,
  getProfileSourceAccessCheckRunRowSelectionState,
  getNextProfileSourceAccessCheckRunDetailDrawerState,
  shouldRestoreProfileSourceAccessCheckRunDetailFocus,
  type ProfileSourceAccessCheckRunDetailCloseSource,
} from "@/features/collector-runtime/profile-source-access-check-run-detail-drawer-state";

describe("profile-source-access-check-run detail drawer state", () => {
  it("opens the drawer for the selected run", () => {
    expect(
      getNextProfileSourceAccessCheckRunDetailDrawerState(
        { selectedRunId: undefined },
        { type: "select", checkRunId: "run-1" },
      ),
    ).toEqual({ selectedRunId: "run-1" });
  });

  it("marks only the selected run row", () => {
    const selected = getProfileSourceAccessCheckRunRowSelectionState({
      runId: "run-1",
      selectedRunId: "run-1",
    });
    const unselected = getProfileSourceAccessCheckRunRowSelectionState({
      runId: "run-2",
      selectedRunId: "run-1",
    });

    expect(selected.selected).toBe(true);
    expect(selected.articleClassName).toContain("ring-primary/30");
    expect(selected.detailsButtonVariant).toBe("primary");
    expect(unselected.selected).toBe(false);
    expect(unselected.articleClassName).not.toContain("ring-primary/30");
    expect(unselected.detailsButtonVariant).toBe("secondary");
  });

  it("switches selected runs without stacking drawer state", () => {
    const firstState = getNextProfileSourceAccessCheckRunDetailDrawerState(
      { selectedRunId: undefined },
      { type: "select", checkRunId: "run-1" },
    );
    const nextState = getNextProfileSourceAccessCheckRunDetailDrawerState(firstState, {
      type: "select",
      checkRunId: "run-2",
    });

    expect(nextState).toEqual({ selectedRunId: "run-2" });
  });

  it("closes from button, escape, and backdrop actions", () => {
    const closeSources: ProfileSourceAccessCheckRunDetailCloseSource[] = [
      "button",
      "escape",
      "backdrop",
    ];

    for (const source of closeSources) {
      expect(
        getNextProfileSourceAccessCheckRunDetailDrawerState(
          { selectedRunId: "run-1" },
          { type: "close", source },
        ),
      ).toEqual({ selectedRunId: undefined });
    }
  });

  it("restores focus only when an open drawer closes", () => {
    expect(
      shouldRestoreProfileSourceAccessCheckRunDetailFocus({
        previousSelectedRunId: "run-1",
        nextSelectedRunId: undefined,
      }),
    ).toBe(true);
    expect(
      shouldRestoreProfileSourceAccessCheckRunDetailFocus({
        previousSelectedRunId: "run-1",
        nextSelectedRunId: "run-2",
      }),
    ).toBe(false);
    expect(
      shouldRestoreProfileSourceAccessCheckRunDetailFocus({
        previousSelectedRunId: undefined,
        nextSelectedRunId: undefined,
      }),
    ).toBe(false);
  });

  it("keeps detail loading and errors isolated to an open drawer", () => {
    expect(
      getProfileSourceAccessCheckRunDetailContentState({
        checkRunId: undefined,
        isPending: true,
        isError: true,
        isSuccess: false,
      }),
    ).toEqual({
      showLoading: false,
      showError: false,
      showContent: false,
    });
    expect(
      getProfileSourceAccessCheckRunDetailContentState({
        checkRunId: "run-1",
        isPending: true,
        isError: false,
        isSuccess: false,
      }).showLoading,
    ).toBe(true);
    expect(
      getProfileSourceAccessCheckRunDetailContentState({
        checkRunId: "run-1",
        isPending: false,
        isError: true,
        isSuccess: false,
      }).showError,
    ).toBe(true);
  });
});
