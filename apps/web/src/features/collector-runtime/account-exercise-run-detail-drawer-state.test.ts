import { describe, expect, it } from "vitest";
import {
  getAccountExerciseRunDetailContentState,
  getAccountExerciseRunRowSelectionState,
  getNextAccountExerciseRunDetailDrawerState,
  shouldRestoreAccountExerciseRunDetailFocus,
  type AccountExerciseRunDetailCloseSource,
} from "@/features/collector-runtime/account-exercise-run-detail-drawer-state";

describe("account-exercise-run detail drawer state", () => {
  it("opens the drawer for the selected run", () => {
    expect(
      getNextAccountExerciseRunDetailDrawerState(
        { selectedRunId: undefined },
        { type: "select", accountExerciseRunId: "run-1" },
      ),
    ).toEqual({ selectedRunId: "run-1" });
  });

  it("marks only the selected run row", () => {
    const selected = getAccountExerciseRunRowSelectionState({
      runId: "run-1",
      selectedRunId: "run-1",
    });
    const unselected = getAccountExerciseRunRowSelectionState({
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
    const firstState = getNextAccountExerciseRunDetailDrawerState(
      { selectedRunId: undefined },
      { type: "select", accountExerciseRunId: "run-1" },
    );
    const nextState = getNextAccountExerciseRunDetailDrawerState(firstState, {
      type: "select",
      accountExerciseRunId: "run-2",
    });

    expect(nextState).toEqual({ selectedRunId: "run-2" });
  });

  it("closes from button, escape, and backdrop actions", () => {
    const closeSources: AccountExerciseRunDetailCloseSource[] = [
      "button",
      "escape",
      "backdrop",
    ];

    for (const source of closeSources) {
      expect(
        getNextAccountExerciseRunDetailDrawerState(
          { selectedRunId: "run-1" },
          { type: "close", source },
        ),
      ).toEqual({ selectedRunId: undefined });
    }
  });

  it("restores focus only when an open drawer closes", () => {
    expect(
      shouldRestoreAccountExerciseRunDetailFocus({
        previousSelectedRunId: "run-1",
        nextSelectedRunId: undefined,
      }),
    ).toBe(true);
    expect(
      shouldRestoreAccountExerciseRunDetailFocus({
        previousSelectedRunId: "run-1",
        nextSelectedRunId: "run-2",
      }),
    ).toBe(false);
    expect(
      shouldRestoreAccountExerciseRunDetailFocus({
        previousSelectedRunId: undefined,
        nextSelectedRunId: undefined,
      }),
    ).toBe(false);
  });

  it("keeps detail loading and errors isolated to an open drawer", () => {
    expect(
      getAccountExerciseRunDetailContentState({
        accountExerciseRunId: undefined,
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
      getAccountExerciseRunDetailContentState({
        accountExerciseRunId: "run-1",
        isPending: true,
        isError: false,
        isSuccess: false,
      }).showLoading,
    ).toBe(true);
    expect(
      getAccountExerciseRunDetailContentState({
        accountExerciseRunId: "run-1",
        isPending: false,
        isError: true,
        isSuccess: false,
      }).showError,
    ).toBe(true);
  });
});
