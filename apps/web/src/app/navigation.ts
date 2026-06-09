import {
  ClipboardList,
  FileText,
  FolderKanban,
  Gauge,
  Users,
  type LucideIcon,
} from "lucide-react";

export interface NavigationItem {
  readonly label: string;
  readonly path: string;
  readonly icon: LucideIcon;
}

export const primaryNavigation: readonly NavigationItem[] = [
  {
    label: "Dashboard",
    path: "/",
    icon: Gauge,
  },
  {
    label: "Profiles",
    path: "/profiles",
    icon: Users,
  },
  {
    label: "Source Groups",
    path: "/source-groups",
    icon: FolderKanban,
  },
  {
    label: "Content Items",
    path: "/content-items",
    icon: FileText,
  },
  {
    label: "Collection Runs",
    path: "/collection-runs",
    icon: ClipboardList,
  },
];
