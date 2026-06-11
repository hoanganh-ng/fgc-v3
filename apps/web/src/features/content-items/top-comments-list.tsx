import { MessageSquareText } from "lucide-react";
import { StatusBadge } from "@/components/ui/status-badge";
import type { ContentItem } from "@/lib/api/content-manager-client";

type TopComment = ContentItem["topComments"][number];

export function TopCommentsList({
  topComments,
}: {
  readonly topComments: readonly TopComment[];
}): JSX.Element {
  if (topComments.length === 0) {
    return (
      <div className="rounded border border-border bg-muted/35 px-4 py-4 text-sm text-muted-foreground">
        No top comments were returned for this content item.
      </div>
    );
  }

  return (
    <div className="divide-y divide-border rounded border border-border">
      {topComments.map((comment) => (
        <article key={comment.externalCommentId} className="grid gap-3 px-4 py-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p
                className="truncate text-sm font-semibold text-foreground"
                title={comment.authorDisplayName ?? "Top comment"}
              >
                {comment.authorDisplayName ?? "Top comment"}
              </p>
              <p
                className="mt-1 truncate text-xs text-muted-foreground"
                title={comment.externalCommentId}
              >
                {comment.externalCommentId}
              </p>
            </div>
            <div className="flex flex-wrap gap-2 sm:justify-end">
              <StatusBadge
                label={`${formatNumber(comment.reactionCount)} reactions`}
                tone="info"
              />
              {comment.replyCount !== undefined ? (
                <StatusBadge
                  label={`${formatNumber(comment.replyCount)} replies`}
                  tone="neutral"
                />
              ) : null}
            </div>
          </div>

          <p className="whitespace-pre-wrap break-words text-sm leading-6 text-foreground">
            {comment.bodyText}
          </p>

          <dl className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
            {comment.postedAt !== undefined ? (
              <div className="flex min-w-0 items-center gap-2">
                <MessageSquareText
                  aria-hidden="true"
                  className="size-3.5 shrink-0"
                />
                <dt className="shrink-0 font-medium">Posted</dt>
                <dd className="truncate">{formatDateTime(comment.postedAt)}</dd>
              </div>
            ) : null}
            <div className="flex min-w-0 items-center gap-2">
              <MessageSquareText
                aria-hidden="true"
                className="size-3.5 shrink-0"
              />
              <dt className="shrink-0 font-medium">Collected</dt>
              <dd className="truncate">{formatDateTime(comment.collectedAt)}</dd>
            </div>
          </dl>
        </article>
      ))}
    </div>
  );
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat().format(value);
}

function formatDateTime(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}
