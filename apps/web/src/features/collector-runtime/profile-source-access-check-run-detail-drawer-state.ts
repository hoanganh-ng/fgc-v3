import { cn } from "@/lib/cn";

export type ProfileSourceAccessCheckRunDetailCloseSource =
  | "button"
  | "escape"
  | "backdrop";

export type ProfileSourceAccessCheckRunDetailDrawerAction =
  | {
      readonly type: "select";
      readonly checkRunId: string;
    }
  | {
      readonly type: "close";
      readonly source: ProfileSourceAccessCheckRunDetailCloseSource;
    };

export interface ProfileSourceAccessCheckRunDetailDrawerState {
  readonly selectedRunId: string | undefined;
}

export interface ProfileSourceAccessCheckRunRowSelectionState {
  readonly selected: boolean;
  readonly articleClassName: string;
  readonly detailsButtonVariant: "primary" | "secondary";
}

export interface ProfileSourceAccessCheckRunDetailContentState {
  readonly showLoading: boolean;
  readonly showError: boolean;
  readonly showContent: boolean;
}

export function getNextProfileSourceAccessCheckRunDetailDrawerState(
  state: ProfileSourceAccessCheckRunDetailDrawerState,
  action: ProfileSourceAccessCheckRunDetailDrawerAction,
): ProfileSourceAccessCheckRunDetailDrawerState {
  switch (action.type) {
    case "select":
      return { selectedRunId: action.checkRunId };
    case "close":
      return { selectedRunId: undefined };
  }
}

export function getProfileSourceAccessCheckRunRowSelectionState({
  runId,
  selectedRunId,
}: {
  readonly runId: string;
  readonly selectedRunId: string | undefined;
}): ProfileSourceAccessCheckRunRowSelectionState {
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

export function shouldRestoreProfileSourceAccessCheckRunDetailFocus({
  previousSelectedRunId,
  nextSelectedRunId,
}: {
  readonly previousSelectedRunId: string | undefined;
  readonly nextSelectedRunId: string | undefined;
}): boolean {
  return previousSelectedRunId !== undefined && nextSelectedRunId === undefined;
}

export function getProfileSourceAccessCheckRunDetailContentState({
  checkRunId,
  isPending,
  isError,
  isSuccess,
}: {
  readonly checkRunId: string | undefined;
  readonly isPending: boolean;
  readonly isError: boolean;
  readonly isSuccess: boolean;
}): ProfileSourceAccessCheckRunDetailContentState {
  return {
    showLoading: checkRunId !== undefined && isPending,
    showError: checkRunId !== undefined && isError,
    showContent: checkRunId !== undefined && isSuccess,
  };
}
