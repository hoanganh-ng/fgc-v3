import { ClipboardList } from "lucide-react";
import { PageShell } from "@/pages/page-shell";
import { ResourcePlaceholder } from "@/pages/resource-placeholder";

export function CollectionRunsPage(): JSX.Element {
  return (
    <PageShell
      eyebrow="Collector Runtime"
      title="Collection Runs"
      description="A placeholder surface for future runtime execution history."
    >
      <ResourcePlaceholder
        icon={ClipboardList}
        title="Collection Run Workspace"
        description="Runtime history and execution controls remain outside this sprint."
        rows={["Run history", "Lease usage", "Submission outcomes"]}
        stats={[
          { label: "Runtime Actions", value: "Deferred", tone: "warning" },
          { label: "Scheduler", value: "Out", tone: "neutral" },
          { label: "Queue", value: "Out", tone: "neutral" },
        ]}
      />
    </PageShell>
  );
}
