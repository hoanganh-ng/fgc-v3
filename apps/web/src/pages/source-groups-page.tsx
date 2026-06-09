import { FolderKanban } from "lucide-react";
import { PageShell } from "@/pages/page-shell";
import { ResourcePlaceholder } from "@/pages/resource-placeholder";

export function SourceGroupsPage(): JSX.Element {
  return (
    <PageShell
      eyebrow="Content Manager"
      title="Source Groups"
      description="A placeholder surface for Facebook group sources and managed categories."
    >
      <ResourcePlaceholder
        icon={FolderKanban}
        title="Source Group Workspace"
        description="Source group list and operational metadata space."
        rows={["Group list", "Category reference", "Collection priority"]}
        stats={[
          { label: "Read Contract", value: "Ready", tone: "success" },
          { label: "Writes", value: "Deferred", tone: "warning" },
          { label: "Platform", value: "Facebook", tone: "info" },
        ]}
      />
    </PageShell>
  );
}
