import { FileText } from "lucide-react";
import { PageShell } from "@/pages/page-shell";
import { ResourcePlaceholder } from "@/pages/resource-placeholder";

export function ContentItemsPage(): JSX.Element {
  return (
    <PageShell
      eyebrow="Content Manager"
      title="Content Items"
      description="A placeholder surface for collected content records and lifecycle status."
    >
      <ResourcePlaceholder
        icon={FileText}
        title="Content Item Workspace"
        description="Content item list, status, and engagement summary space."
        rows={["Collected content list", "Lifecycle status", "Top comment summary"]}
        stats={[
          { label: "Read Contract", value: "Ready", tone: "success" },
          { label: "Status Changes", value: "Deferred", tone: "warning" },
          { label: "Raw Payload", value: "Hidden", tone: "success" },
        ]}
      />
    </PageShell>
  );
}
