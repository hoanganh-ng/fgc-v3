import { Link } from "react-router-dom";
import { ArrowRight, ClipboardList, FileText, FolderKanban, Users } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { PageShell } from "@/pages/page-shell";

const dashboardSections = [
  {
    title: "Profiles",
    description: "Profile list and detail routes are present with safe API client methods.",
    path: "/profiles",
    icon: Users,
    tone: "success",
  },
  {
    title: "Source Groups",
    description: "Source group navigation is ready for Content Manager reads.",
    path: "/source-groups",
    icon: FolderKanban,
    tone: "info",
  },
  {
    title: "Content Items",
    description: "Collected content navigation is ready for safe read contracts.",
    path: "/content-items",
    icon: FileText,
    tone: "warning",
  },
  {
    title: "Collection Runs",
    description: "Runtime operations remain a placeholder in this sprint.",
    path: "/collection-runs",
    icon: ClipboardList,
    tone: "neutral",
  },
] as const;

export function DashboardPage(): JSX.Element {
  return (
    <PageShell
      eyebrow="Dashboard"
      title="Collector Control Room"
      description="A lightweight operations shell for the Content Collector stage."
    >
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {dashboardSections.map((section) => (
          <Card key={section.path} className="overflow-hidden">
            <CardHeader>
              <div className="mb-4 flex items-center justify-between gap-3">
                <div className="grid size-10 place-items-center rounded border border-border bg-muted text-primary">
                  <section.icon aria-hidden="true" className="size-5" />
                </div>
                <StatusBadge label="Foundation" tone={section.tone} />
              </div>
              <CardTitle>{section.title}</CardTitle>
              <CardDescription>{section.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <Link
                className={buttonVariants({
                  variant: "secondary",
                  size: "sm",
                  className: "w-full",
                })}
                to={section.path}
              >
                Open
                <ArrowRight aria-hidden="true" className="size-4" />
              </Link>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Foundation Boundary</CardTitle>
          <CardDescription>
            The frontend calls dedicated client modules and leaves backend APIs as the
            source of truth.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded border border-border bg-muted/45 p-4">
              <p className="text-sm font-semibold text-foreground">Adapter Layer</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                API access lives in `src/lib/api`.
              </p>
            </div>
            <div className="rounded border border-border bg-muted/45 p-4">
              <p className="text-sm font-semibold text-foreground">Safe Reads</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Runtime configuration and session material are not requested.
              </p>
            </div>
            <div className="rounded border border-border bg-muted/45 p-4">
              <p className="text-sm font-semibold text-foreground">Routing</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Dashboard routes are ready for the next workflow sprint.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </PageShell>
  );
}
