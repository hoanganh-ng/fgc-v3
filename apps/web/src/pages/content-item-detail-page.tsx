import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  CalendarClock,
  ExternalLink,
  FileText,
  FolderKanban,
  RefreshCw,
  Tags,
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
import { TopCommentsList } from "@/features/content-items/top-comments-list";
import {
  useContentItemQuery,
  useSourceGroupsQuery,
} from "@/features/content-manager/content-manager-queries";
import { isApiResultError } from "@/lib/api/http-client";
import type { ContentItem } from "@/lib/api/content-manager-client";
import { PageShell } from "@/pages/page-shell";

export function ContentItemDetailPage(): JSX.Element {
  const navigate = useNavigate();
  const { contentItemId: routeContentItemId } = useParams();
  const contentItemId = routeContentItemId ?? "";
  const contentItemQuery = useContentItemQuery(contentItemId);
  const sourceGroupsQuery = useSourceGroupsQuery();
  const contentItem = contentItemQuery.data?.contentItem;
  const categoryId =
    contentItem !== undefined
      ? sourceGroupsQuery.data?.items.find(
          (sourceGroup) => sourceGroup.id === contentItem.sourceGroupId,
        )?.categoryId
      : undefined;

  return (
    <PageShell
      eyebrow="Content Manager"
      title={contentItem?.title ?? "Content Item"}
      description="Review the full post text, top comments, and lifecycle status."
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" onClick={() => navigate(-1)}>
            <ArrowLeft aria-hidden="true" className="size-4" />
            Back
          </Button>
          <Link
            className={buttonVariants({ variant: "secondary" })}
            to="/content-items"
          >
            <FileText aria-hidden="true" className="size-4" />
            All Items
          </Link>
          <Button
            variant="secondary"
            onClick={() => {
              void contentItemQuery.refetch();
              void sourceGroupsQuery.refetch();
            }}
          >
            <RefreshCw aria-hidden="true" className="size-4" />
            Refresh
          </Button>
        </div>
      }
    >
      {contentItemId.trim().length === 0 ? <ContentItemNotFoundState /> : null}
      {contentItemId.trim().length > 0 && contentItemQuery.isPending ? (
        <ContentItemDetailLoadingState />
      ) : null}
      {contentItemId.trim().length > 0 && contentItemQuery.isError ? (
        isContentItemNotFoundError(contentItemQuery.error) ? (
          <ContentItemNotFoundState />
        ) : (
          <ContentItemDetailErrorState
            error={contentItemQuery.error}
            onRetry={() => {
              void contentItemQuery.refetch();
            }}
          />
        )
      ) : null}
      {contentItem !== undefined ? (
        <ContentItemDetailView
          categoryId={categoryId}
          contentItem={contentItem}
          categoryLookupLoading={sourceGroupsQuery.isPending}
        />
      ) : null}
    </PageShell>
  );
}

function ContentItemDetailView({
  categoryId,
  categoryLookupLoading,
  contentItem,
}: {
  readonly categoryId: string | undefined;
  readonly categoryLookupLoading: boolean;
  readonly contentItem: ContentItem;
}): JSX.Element {
  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="grid min-w-0 gap-5">
        <PostBodyCard contentItem={contentItem} />
        <TopCommentsCard contentItem={contentItem} />
      </div>
      <aside className="grid min-w-0 content-start gap-5">
        <ReviewStatusCard contentItem={contentItem} />
        <EngagementCard contentItem={contentItem} />
        <SourceMetadataCard
          categoryId={categoryId}
          categoryLookupLoading={categoryLookupLoading}
          contentItem={contentItem}
        />
        <TimestampSummaryCard contentItem={contentItem} />
      </aside>
    </div>
  );
}

function PostBodyCard({
  contentItem,
}: {
  readonly contentItem: ContentItem;
}): JSX.Element {
  return (
    <Card className="min-w-0">
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <CardTitle>Post Body</CardTitle>
          <CardDescription>
            {contentItem.title ?? "Collected Facebook post text"}
          </CardDescription>
        </div>
        <ContentItemStatusBadge status={contentItem.status} />
      </CardHeader>
      <CardContent className="grid gap-5">
        <div className="min-w-0">
          <p className="whitespace-pre-wrap break-words text-base leading-8 text-foreground">
            {contentItem.bodyText}
          </p>
        </div>

        <div className="min-w-0 border-t border-border pt-4">
          <DetailLabel>Source URL</DetailLabel>
          <a
            className="mt-1 inline-flex max-w-full items-center gap-2 truncate font-medium text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-primary"
            href={contentItem.sourceUrl}
            rel="noreferrer"
            target="_blank"
            title={contentItem.sourceUrl}
          >
            <ExternalLink aria-hidden="true" className="size-4 shrink-0" />
            <span className="truncate">{contentItem.sourceUrl}</span>
          </a>
        </div>
      </CardContent>
    </Card>
  );
}

function ReviewStatusCard({
  contentItem,
}: {
  readonly contentItem: ContentItem;
}): JSX.Element {
  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle>Review Status</CardTitle>
        <CardDescription>Lifecycle state controlled by Content Manager.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm text-muted-foreground">Current Status</span>
          <ContentItemStatusBadge status={contentItem.status} />
        </div>
        <ContentItemStatusActions
          contentItemId={contentItem.id}
          status={contentItem.status}
        />
      </CardContent>
    </Card>
  );
}

function EngagementCard({
  contentItem,
}: {
  readonly contentItem: ContentItem;
}): JSX.Element {
  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle>Engagement</CardTitle>
        <CardDescription>Counts returned by the safe content item read.</CardDescription>
      </CardHeader>
      <CardContent>
        <dl className="grid gap-3">
          <MetricField
            label="Reactions"
            value={formatNumber(contentItem.reactionCount)}
          />
          <MetricField
            label="Comments"
            value={formatNumber(contentItem.commentCount)}
          />
          {contentItem.shareCount !== undefined ? (
            <MetricField
              label="Shares"
              value={formatNumber(contentItem.shareCount)}
            />
          ) : null}
        </dl>
      </CardContent>
    </Card>
  );
}

function SourceMetadataCard({
  categoryId,
  categoryLookupLoading,
  contentItem,
}: {
  readonly categoryId: string | undefined;
  readonly categoryLookupLoading: boolean;
  readonly contentItem: ContentItem;
}): JSX.Element {
  const categoryValue =
    categoryId ?? (categoryLookupLoading ? "Loading" : "Unknown");

  return (
    <Card className="min-w-0">
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between xl:flex-col xl:items-start">
        <div className="min-w-0">
          <CardTitle>Source Metadata</CardTitle>
          <CardDescription>Safe platform and source identifiers.</CardDescription>
        </div>
        <div className="grid size-11 place-items-center rounded border border-border bg-muted text-primary">
          <FolderKanban aria-hidden="true" className="size-5" />
        </div>
      </CardHeader>
      <CardContent>
        <dl className="grid gap-4">
          <DetailField label="Platform">
            <StatusBadge label={contentItem.platform} tone="info" />
          </DetailField>
          <DetailField label="External Post ID">
            <CodeValue value={contentItem.externalPostId} />
          </DetailField>
          <DetailField label="Source Group ID">
            <CodeValue
              displayValue={formatCompactId(contentItem.sourceGroupId)}
              value={contentItem.sourceGroupId}
            />
          </DetailField>
          <DetailField label="Category ID">
            <CodeValue
              displayValue={formatCompactId(categoryValue)}
              icon="category"
              value={categoryValue}
            />
          </DetailField>
        </dl>
      </CardContent>
    </Card>
  );
}

function TopCommentsCard({
  contentItem,
}: {
  readonly contentItem: ContentItem;
}): JSX.Element {
  return (
    <Card className="min-w-0">
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <CardTitle>Top Comments</CardTitle>
          <CardDescription>
            {formatCount(contentItem.topComments.length, "comment")}
          </CardDescription>
        </div>
        <StatusBadge
          label={`${formatNumber(contentItem.commentCount)} total`}
          tone="neutral"
        />
      </CardHeader>
      <CardContent>
        <TopCommentsList topComments={contentItem.topComments} />
      </CardContent>
    </Card>
  );
}

function TimestampSummaryCard({
  contentItem,
}: {
  readonly contentItem: ContentItem;
}): JSX.Element {
  return (
    <Card className="min-w-0">
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between xl:flex-col xl:items-start">
        <div className="min-w-0">
          <CardTitle>Timestamps</CardTitle>
          <CardDescription>Collection and record lifecycle timestamps.</CardDescription>
        </div>
        <div className="grid size-11 place-items-center rounded border border-border bg-muted text-primary">
          <CalendarClock aria-hidden="true" className="size-5" />
        </div>
      </CardHeader>
      <CardContent>
        <dl className="grid gap-3">
          <MetricField
            label="First Collected"
            value={formatOptionalDateTime(contentItem.firstCollectedAt)}
          />
          <MetricField
            label="Last Collected"
            value={formatOptionalDateTime(contentItem.lastCollectedAt)}
          />
          <MetricField
            label="Created"
            value={formatOptionalDateTime(contentItem.createdAt)}
          />
          <MetricField
            label="Updated"
            value={formatOptionalDateTime(contentItem.updatedAt)}
          />
        </dl>
      </CardContent>
    </Card>
  );
}

function DetailField({
  children,
  label,
}: {
  readonly children: JSX.Element;
  readonly label: string;
}): JSX.Element {
  return (
    <div className="min-w-0">
      <dt>
        <DetailLabel>{label}</DetailLabel>
      </dt>
      <dd className="mt-1 min-w-0">{children}</dd>
    </div>
  );
}

function MetricField({
  label,
  value,
}: {
  readonly label: string;
  readonly value: string;
}): JSX.Element {
  return (
    <div className="flex min-w-0 items-center justify-between gap-3">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="truncate text-sm font-semibold text-foreground">{value}</dd>
    </div>
  );
}

function DetailLabel({
  children,
}: {
  readonly children: string;
}): JSX.Element {
  return (
    <span className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
      {children}
    </span>
  );
}

function CodeValue({
  displayValue,
  icon,
  value,
}: {
  readonly displayValue?: string | undefined;
  readonly icon?: "category" | undefined;
  readonly value: string;
}): JSX.Element {
  return (
    <div className="flex min-w-0 items-center gap-2">
      {icon === "category" ? (
        <Tags aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
      ) : null}
      <code
        className="block min-w-0 truncate rounded border border-border bg-muted/55 px-2 py-1 font-mono text-xs text-foreground"
        title={value}
      >
        {displayValue ?? value}
      </code>
    </div>
  );
}

function ContentItemDetailLoadingState(): JSX.Element {
  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle>Loading Content Item</CardTitle>
        <CardDescription>Reading content item detail from Content Manager.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="h-6 max-w-md animate-pulse rounded bg-muted" />
        <div className="h-28 animate-pulse rounded bg-muted" />
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="h-12 animate-pulse rounded bg-muted" />
          <div className="h-12 animate-pulse rounded bg-muted" />
          <div className="h-12 animate-pulse rounded bg-muted" />
        </div>
      </CardContent>
    </Card>
  );
}

function ContentItemDetailErrorState({
  error,
  onRetry,
}: {
  readonly error: unknown;
  readonly onRetry: () => void;
}): JSX.Element {
  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle>Content Item Could Not Load</CardTitle>
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

function ContentItemNotFoundState(): JSX.Element {
  return (
    <Card className="min-w-0">
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <CardTitle>Content Item Not Found</CardTitle>
          <CardDescription>The requested content item was not returned.</CardDescription>
        </div>
        <StatusBadge label="Not Found" tone="warning" />
      </CardHeader>
      <CardContent>
        <Link className={buttonVariants({ variant: "primary" })} to="/content-items">
          <FileText aria-hidden="true" className="size-4" />
          View Content Items
        </Link>
      </CardContent>
    </Card>
  );
}

function isContentItemNotFoundError(error: unknown): boolean {
  return (
    isApiResultError(error) &&
    error.error.kind === "http" &&
    error.error.status === 404
  );
}

function formatApiError(error: unknown): string {
  if (isApiResultError(error)) {
    return error.message;
  }

  return "The Content Manager content item request failed.";
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

function formatCompactId(value: string): string {
  const normalized = value.trim();

  if (normalized.length <= 12) {
    return normalized;
  }

  return `${normalized.slice(0, 8)}...`;
}
