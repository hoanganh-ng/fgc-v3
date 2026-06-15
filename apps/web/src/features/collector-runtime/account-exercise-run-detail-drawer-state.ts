import { cn } from "@/lib/cn";

export type AccountExerciseRunDetailCloseSource =
  | "button"
  | "escape"
  | "backdrop";

export type AccountExerciseRunDetailDrawerAction =
  | {
      readonly type: "select";
      readonly accountExerciseRunId: string;
    }
  | {
      readonly type: "close";
      readonly source: AccountExerciseRunDetailCloseSource;
    };

export interface AccountExerciseRunDetailDrawerState {
  readonly selectedRunId: string | undefined;
}

export interface AccountExerciseRunRowSelectionState {
  readonly selected: boolean;
  readonly articleClassName: string;
  readonly detailsButtonVariant: "primary" | "secondary";
}

export interface AccountExerciseRunDetailContentState {
  readonly showLoading: boolean;
  readonly showError: boolean;
  readonly showContent: boolean;
}

export function getNextAccountExerciseRunDetailDrawerState(
  state: AccountExerciseRunDetailDrawerState,
  action: AccountExerciseRunDetailDrawerAction,
): AccountExerciseRunDetailDrawerState {
  switch (action.type) {
    case "select":
      return { selectedRunId: action.accountExerciseRunId };
    case "close":
      return { selectedRunId: undefined };
  }
}

export function getAccountExerciseRunRowSelectionState({
  runId,
  selectedRunId,
}: {
  readonly runId: string;
  readonly selectedRunId: string | undefined;
}): AccountExerciseRunRowSelectionState {
  const selected = selectedRunId === runId;
  return {
    selected,
    articleClassName: cn(
      "grid min-w-0 gap-3 px-4 py-4 transition",
      selected && "bg-muted/45 ring-1 ring-inset ring-primary/30",
    ),
    detailsButtonVariant: selected ? "primary" : "secondary",
  };
}

export function shouldRestoreAccountExerciseRunDetailFocus({
  previousSelectedRunId,
  nextSelectedRunId,
}: {
  readonly previousSelectedRunId: string | undefined;
  readonly nextSelectedRunId: string | undefined;
}): boolean {
  return previousSelectedRunId !== undefined && nextSelectedRunId === undefined;
}

export function getAccountExerciseRunDetailContentState({
  accountExerciseRunId,
  isPending,
  isError,
  isSuccess,
}: {
  readonly accountExerciseRunId: string | undefined;
  readonly isPending: boolean;
  readonly isError: boolean;
  readonly isSuccess: boolean;
}): AccountExerciseRunDetailContentState {
  return {
    showLoading: accountExerciseRunId !== undefined && isPending,
    showError: accountExerciseRunId !== undefined && isError,
    showContent: accountExerciseRunId !== undefined && isSuccess,
  };
}
