import {
  ClipboardList,
  FileText,
  FolderKanban,
  Gauge,
  RadioTower,
  Users,
  type LucideIcon,
} from "lucide-react";

export interface NavigationItem {
  readonly label: string;
  readonly path: string;
  readonly icon: LucideIcon;
}

// Primary sidebar surfaces for the Profile Feed Collector MVP.
// Parked/advanced pages (Transform Types, schedules, exercise/access-check
// runs, generic Collection Runs) remain routed and compilable but are not
// surfaced here. See `docs/SPRINTS/SPRINT-073-product-scope-lock-and-surface-trim.md`.
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
    label: "Profile Feed Runs",
    path: "/profile-home-feed-collection-runs",
    icon: ClipboardList,
  },
  {
    label: "Content Items",
    path: "/content-items",
    icon: FileText,
  },
  {
    label: "Source Groups",
    path: "/source-groups",
    icon: FolderKanban,
  },
  {
    label: "Discovered Sources",
    path: "/source-publishers",
    icon: RadioTower,
  },
];
