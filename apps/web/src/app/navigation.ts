import {
  Activity,
  CalendarClock,
  ClipboardList,
  FileText,
  FolderKanban,
  Gauge,
  RadioTower,
  ShieldCheck,
  Users,
  WandSparkles,
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
    label: "Source Publishers",
    path: "/source-publishers",
    icon: RadioTower,
  },
  {
    label: "Content Items",
    path: "/content-items",
    icon: FileText,
  },
  {
    label: "Transform Types",
    path: "/transform-types",
    icon: WandSparkles,
  },
  {
    label: "Collection Runs",
    path: "/collection-runs",
    icon: ClipboardList,
  },
  {
    label: "Schedules",
    path: "/collection-schedules",
    icon: CalendarClock,
  },
  {
    label: "Home Feed Schedules",
    path: "/profile-home-feed-schedules",
    icon: CalendarClock,
  },
  {
    label: "Home Feed Runs",
    path: "/profile-home-feed-collection-runs",
    icon: ClipboardList,
  },
  {
    label: "Exercise Runs",
    path: "/account-exercise-runs",
    icon: Activity,
  },
  {
    label: "Access Checks",
    path: "/profile-source-access-check-runs",
    icon: ShieldCheck,
  },
];
