import { Link } from "react-router-dom";
import {
  ArrowRight,
  Clock3,
  FileText,
  MessageCircle,
  RefreshCw,
  ThumbsUp,
} from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { ContentItemStatusActions } from "@/features/content-items/content-item-status-actions";
import { ContentItemStatusBadge } from "@/features/content-items/content-item-status-badge";
import {
  useContentItemsQuery,
  useSourceGroupsQuery,
} from "@/features/content-manager/content-manager-queries";
import { isApiResultError } from "@/lib/api/http-client";
import type { ContentItem, SourceGroup } from "@/lib/api/content-manager-client";
import { PageShell } from "@/pages/page-shell";

export function ContentItemsPage(): JSX.Element {
  const contentItemsQuery = useContentItemsQuery();
  const sourceGroupsQuery = useSourceGroupsQuery();
  const sourceGroups = sourceGroupsQuery.data?.items ?? [];

  function refresh(): void {
    void contentItemsQuery.refetch();
    void sourceGroupsQuery.refetch();
  }

  return (
    <PageShell
      eyebrow="Content Manager"
      title="Content Items"
      description="Review collected Facebook posts and inspect lifecycle status from the safe Content Manager API."
      actions={
        <Button variant="secondary" onClick={refresh}>
          <RefreshCw aria-hidden="true" className="size-4" />
          Refresh
        </Button>
      }
    >
      {contentItemsQuery.isPending ? <ContentItemsLoadingState /> : null}
      {contentItemsQuery.isError ? (
        <ContentItemsErrorState
          error={contentItemsQuery.error}
          onRetry={() => {
            void contentItemsQuery.refetch();
          }}
        />
      ) : null}
      {contentItemsQuery.isSuccess &&
      contentItemsQuery.data.items.length === 0 ? (
        <ContentItemsEmptyState />
      ) : null}
      {contentItemsQuery.isSuccess &&
      contentItemsQuery.data.items.length > 0 ? (
        <ContentItemsReviewQueue
          categoryLookupLoading={sourceGroupsQuery.isPending}
          contentItems={contentItemsQuery.data.items}
          page={contentItemsQuery.data.page}
          sourceGroups={sourceGroups}
        />
      ) : null}
    </PageShell>
  );
}

function ContentItemsReviewQueue({
  categoryLookupLoading,
  contentItems,
  page,
  sourceGroups,
}: {
  readonly categoryLookupLoading: boolean;
  readonly contentItems: readonly ContentItem[];
  readonly page: { readonly total?: number | undefined };
  readonly sourceGroups: readonly SourceGroup[];
}): JSX.Element {
  const categoryIdBySourceGroupId = new Map(
    sourceGroups.map((sourceGroup) => [
      sourceGroup.id,
      sourceGroup.categoryId,
    ]),
  );

  return (
    <div className="grid gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h3 className="text-base font-semibold leading-6 text-foreground">
            Review Queue
          </h3>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            {formatCount(page.total ?? contentItems.length, "content item")}
          </p>
        </div>
        <div className="grid size-11 place-items-center rounded border border-border bg-muted text-primary">
          <FileText aria-hidden="true" className="size-5" />
        </div>
      </div>

      <div className="grid gap-3">
        {contentItems.map((contentItem) => {
          const categoryId =
            categoryIdBySourceGroupId.get(contentItem.sourceGroupId) ??
            (categoryLookupLoading ? "Loading" : "Unknown");

          return (
            <ContentItemReviewCard
              key={contentItem.id}
              categoryId={categoryId}
              contentItem={contentItem}
            />
          );
        })}
      </div>
    </div>
  );
}

function ContentItemReviewCard({
  categoryId,
  contentItem,
}: {
  readonly categoryId: string;
  readonly contentItem: ContentItem;
}): JSX.Element {
  const detailPath = `/content-items/${encodeURIComponent(contentItem.id)}`;
  const hasQuickActions = contentItem.status !== "USED";

  return (
    <Card className="min-w-0 overflow-hidden">
      <CardContent className="p-0">
        <article className="grid min-w-0 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <div className="grid min-w-0 gap-4 p-4 sm:p-5">
            <div className="flex flex-wrap items-center gap-2">
              <ContentItemStatusBadge status={contentItem.status} />
              <MetricPill
                icon="reactions"
                label={`${formatNumber(contentItem.reactionCount)} reactions`}
              />
              <MetricPill
                icon="comments"
                label={`${formatNumber(contentItem.commentCount)} comments`}
              />
              {contentItem.lastCollectedAt !== undefined ? (
                <MetricPill
                  dateTime={contentItem.lastCollectedAt}
                  icon="collected"
                  label={`Collected ${formatOptionalDateTime(
                    contentItem.lastCollectedAt,
                  )}`}
                />
              ) : null}
            </div>

            <div className="grid min-w-0 gap-2">
              {contentItem.title !== undefined ? (
                <p
                  className="truncate text-sm font-semibold text-muted-foreground"
                  title={contentItem.title}
                >
                  {contentItem.title}
                </p>
              ) : null}
              <Link
                className="group block min-w-0 rounded outline-none focus-visible:ring-2 focus-visible:ring-primary"
                to={detailPath}
              >
                <p
                  className="break-words text-base leading-7 text-foreground group-hover:text-primary"
                  title={contentItem.bodyText}
                >
                  {createBodyPreview(contentItem.bodyText)}
                </p>
              </Link>
            </div>

            <dl className="flex min-w-0 flex-wrap gap-x-4 gap-y-2">
              <CompactMetadata
                label="Source"
                value={contentItem.sourceGroupId}
              />
              <CompactMetadata label="Category" value={categoryId} />
            </dl>
          </div>

          <aside className="grid content-start gap-4 border-t border-border bg-muted/25 p-4 sm:p-5 lg:border-l lg:border-t-0">
            {hasQuickActions ? (
              <div className="grid gap-2">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  Quick Status
                </p>
                <ContentItemStatusActions
                  actionSize="sm"
                  contentItemId={contentItem.id}
                  showTerminalMessage={false}
                  status={contentItem.status}
                />
              </div>
            ) : null}

            <Link
              aria-label={`Open content item ${contentItem.id}`}
              className={buttonVariants({
                variant: "secondary",
                size: "sm",
                className: "w-full",
              })}
              to={detailPath}
            >
              <ArrowRight aria-hidden="true" className="size-4" />
              Open Detail
            </Link>
          </aside>
        </article>
      </CardContent>
    </Card>
  );
}

function MetricPill({
  dateTime,
  icon,
  label,
}: {
  readonly dateTime?: string | undefined;
  readonly icon: "comments" | "collected" | "reactions";
  readonly label: string;
}): JSX.Element {
  const iconClassName = "size-3.5 shrink-0";
  const content = (
    <>
      {icon === "reactions" ? (
        <ThumbsUp aria-hidden="true" className={iconClassName} />
      ) : null}
      {icon === "comments" ? (
        <MessageCircle aria-hidden="true" className={iconClassName} />
      ) : null}
      {icon === "collected" ? (
        <Clock3 aria-hidden="true" className={iconClassName} />
      ) : null}
      <span className="truncate">{label}</span>
    </>
  );

  if (dateTime !== undefined) {
    return (
      <time
        className="inline-flex h-7 max-w-full items-center gap-1.5 rounded border border-border bg-white px-2 text-xs font-medium text-muted-foreground"
        dateTime={dateTime}
        title={label}
      >
        {content}
      </time>
    );
  }

  return (
    <span
      className="inline-flex h-7 max-w-full items-center gap-1.5 rounded border border-border bg-white px-2 text-xs font-medium text-muted-foreground"
      title={label}
    >
      {content}
    </span>
  );
}

function CompactMetadata({
  label,
  value,
}: {
  readonly label: string;
  readonly value: string;
}): JSX.Element {
  return (
    <div className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
      <dt className="font-medium">{label}</dt>
      <dd className="min-w-0">
        <code className="font-mono text-[11px] text-muted-foreground" title={value}>
          {formatCompactId(value)}
        </code>
      </dd>
    </div>
  );
}

function ContentItemsLoadingState(): JSX.Element {
  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle>Loading Content Items</CardTitle>
        <CardDescription>Reading collected content from Content Manager.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        {["one", "two", "three", "four"].map((row) => (
          <div
            key={row}
            className="grid min-h-36 animate-pulse gap-4 rounded border border-border bg-muted/35 p-4 lg:grid-cols-[minmax(0,1fr)_18rem]"
          >
            <div className="grid content-start gap-3">
              <div className="h-6 max-w-sm rounded bg-muted" />
              <div className="h-20 rounded bg-muted" />
              <div className="h-4 max-w-xs rounded bg-muted" />
            </div>
            <div className="grid content-start gap-3">
              <div className="h-9 rounded bg-muted" />
              <div className="h-9 rounded bg-muted" />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function ContentItemsErrorState({
  error,
  onRetry,
}: {
  readonly error: unknown;
  readonly onRetry: () => void;
}): JSX.Element {
  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle>Content Items Could Not Load</CardTitle>
        <CardDescription>{formatApiError(error)}</CardDescription>
      </CardHeader>
      <CardContent>
        <Button variant="secondary" onClick={onRetry}>
          <RefreshCw aria-hidden="true" className="size-4" />
          Retry
        </Button>
      </CardContent>
    </Card>
  );
}

function ContentItemsEmptyState(): JSX.Element {
  return (
    <Card className="min-w-0">
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <CardTitle>No Content Items</CardTitle>
          <CardDescription>No collected content items were returned.</CardDescription>
        </div>
        <StatusBadge label="Empty" tone="neutral" />
      </CardHeader>
    </Card>
  );
}

function createBodyPreview(bodyText: string): string {
  const normalized = bodyText.replace(/\s+/g, " ").trim();

  if (normalized.length <= 360) {
    return normalized;
  }

  return `${normalized.slice(0, 357)}...`;
}

function formatCompactId(value: string): string {
  const normalized = value.trim();

  if (normalized.length <= 12) {
    return normalized;
  }

  return `${normalized.slice(0, 8)}...`;
}

function formatCount(count: number, singularLabel: string): string {
  return count === 1 ? `1 ${singularLabel}` : `${count} ${singularLabel}s`;
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat().format(value);
}

function formatOptionalDateTime(value: string | undefined): string {
  if (value === undefined) {
    return "Unknown";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatApiError(error: unknown): string {
  if (isApiResultError(error)) {
    return error.message;
  }

  return "The Content Manager content item request failed.";
}
