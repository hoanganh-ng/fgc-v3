import { useState } from "react";
import { Ban, CheckCircle2 } from "lucide-react";
import {
  Button,
  type ButtonSize,
  type ButtonVariant,
} from "@/components/ui/button";
import { BackendErrorPanel } from "@/features/profiles/profile-form-support";
import { useUpdateContentItemStatusMutation } from "@/features/content-manager/content-manager-mutations";
import type { ContentStatus } from "@/lib/api/content-manager-client";
import { cn } from "@/lib/cn";

interface ContentItemStatusActionsProps {
  readonly contentItemId: string;
  readonly status: ContentStatus;
  readonly onStatusUpdated?: ((status: ContentStatus) => void) | undefined;
  readonly actionSize?: ButtonSize | undefined;
  readonly className?: string | undefined;
  readonly showTerminalMessage?: boolean | undefined;
}

interface StatusAction {
  readonly label: string;
  readonly nextStatus: ContentStatus;
  readonly variant: ButtonVariant;
  readonly icon: "select" | "reject" | "used";
}

export function ContentItemStatusActions({
  actionSize = "md",
  className,
  contentItemId,
  showTerminalMessage = true,
  status,
  onStatusUpdated,
}: ContentItemStatusActionsProps): JSX.Element {
  const updateStatus = useUpdateContentItemStatusMutation();
  const [successStatus, setSuccessStatus] = useState<ContentStatus>();
  const actions = getStatusActions(status);

  async function runAction(nextStatus: ContentStatus): Promise<void> {
    setSuccessStatus(undefined);
    updateStatus.reset();

    try {
      const response = await updateStatus.mutateAsync({
        contentItemId,
        status: nextStatus,
      });

      setSuccessStatus(response.contentItem.status);
      onStatusUpdated?.(response.contentItem.status);
    } catch {
      return;
    }
  }

  return (
    <div className={cn("grid gap-3", className)}>
      <BackendErrorPanel
        error={updateStatus.error}
        fallbackMessage="Content item status update failed."
      />

      {successStatus !== undefined ? (
        <div
          className="rounded border border-[#8ac6a7] bg-[#f1fbf5] px-4 py-3 text-sm text-[#23563b]"
          role="status"
        >
          <div className="flex items-start gap-2">
            <CheckCircle2
              aria-hidden="true"
              className="mt-0.5 size-4 shrink-0"
            />
            <p className="font-semibold">Status updated to {successStatus}.</p>
          </div>
        </div>
      ) : null}

      {actions.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {actions.map((action) => {
            const isPending =
              updateStatus.isPending &&
              updateStatus.variables?.status === action.nextStatus;

            return (
              <Button
                key={action.nextStatus}
                disabled={updateStatus.isPending}
                size={actionSize}
                variant={action.variant}
                onClick={() => {
                  void runAction(action.nextStatus);
                }}
              >
                <ActionIcon action={action.icon} />
                {isPending ? "Updating" : action.label}
              </Button>
            );
          })}
        </div>
      ) : showTerminalMessage ? (
        <p className="text-sm leading-6 text-muted-foreground">
          USED content is terminal and has no review actions.
        </p>
      ) : null}
    </div>
  );
}

function ActionIcon({
  action,
}: {
  readonly action: StatusAction["icon"];
}): JSX.Element {
  if (action === "reject") {
    return <Ban aria-hidden="true" className="size-4" />;
  }

  return <CheckCircle2 aria-hidden="true" className="size-4" />;
}

function getStatusActions(status: ContentStatus): readonly StatusAction[] {
  if (status === "COLLECTED") {
    return [
      {
        label: "Select",
        nextStatus: "SELECTED",
        variant: "primary",
        icon: "select",
      },
      {
        label: "Reject",
        nextStatus: "REJECTED",
        variant: "danger",
        icon: "reject",
      },
    ];
  }

  if (status === "SELECTED") {
    return [
      {
        label: "Reject",
        nextStatus: "REJECTED",
        variant: "danger",
        icon: "reject",
      },
      {
        label: "Mark Used",
        nextStatus: "USED",
        variant: "primary",
        icon: "used",
      },
    ];
  }

  if (status === "REJECTED") {
    return [
      {
        label: "Select Again",
        nextStatus: "SELECTED",
        variant: "primary",
        icon: "select",
      },
    ];
  }

  return [];
}
