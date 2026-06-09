import { createBrowserRouter } from "react-router-dom";
import { DashboardLayout } from "@/app/layout/dashboard-layout";
import { DashboardPage } from "@/features/dashboard/dashboard-page";
import { CollectionRunsPage } from "@/pages/collection-runs-page";
import { ContentItemsPage } from "@/pages/content-items-page";
import { NotFoundPage } from "@/pages/not-found-page";
import { ProfileConfigurePage } from "@/pages/profile-configure-page";
import { ProfileCreatePage } from "@/pages/profile-create-page";
import { ProfileDetailPage } from "@/pages/profile-detail-page";
import { ProfilesPage } from "@/pages/profiles-page";
import { RouteErrorPage } from "@/pages/route-error-page";
import { SourceGroupsPage } from "@/pages/source-groups-page";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <DashboardLayout />,
    errorElement: <RouteErrorPage />,
    children: [
      {
        index: true,
        element: <DashboardPage />,
      },
      {
        path: "profiles",
        element: <ProfilesPage />,
      },
      {
        path: "profiles/new",
        element: <ProfileCreatePage />,
      },
      {
        path: "profiles/:profileId/configure",
        element: <ProfileConfigurePage />,
      },
      {
        path: "profiles/:profileId",
        element: <ProfileDetailPage />,
      },
      {
        path: "source-groups",
        element: <SourceGroupsPage />,
      },
      {
        path: "content-items",
        element: <ContentItemsPage />,
      },
      {
        path: "collection-runs",
        element: <CollectionRunsPage />,
      },
      {
        path: "*",
        element: <NotFoundPage />,
      },
    ],
  },
]);
