import { createBrowserRouter } from "react-router-dom";
import { DashboardLayout } from "@/app/layout/dashboard-layout";
import { DashboardPage } from "@/features/dashboard/dashboard-page";
import { AccountExerciseRunsPage } from "@/pages/account-exercise-runs-page";
import { CollectionRunsPage } from "@/pages/collection-runs-page";
import { CollectionSchedulesPage } from "@/pages/collection-schedules-page";
import { ProfileHomeFeedCollectionSchedulesPage } from "@/pages/profile-home-feed-collection-schedules-page";
import { ContentItemDetailPage } from "@/pages/content-item-detail-page";
import { ContentItemsPage } from "@/pages/content-items-page";
import { NotFoundPage } from "@/pages/not-found-page";
import { ProfileConfigurePage } from "@/pages/profile-configure-page";
import { ProfileCreatePage } from "@/pages/profile-create-page";
import { ProfileDetailPage } from "@/pages/profile-detail-page";
import { ProfilesPage } from "@/pages/profiles-page";
import { RouteErrorPage } from "@/pages/route-error-page";
import { SourceGroupsPage } from "@/pages/source-groups-page";
import { SourcePublishersPage } from "@/pages/source-publishers-page";
import { ProfileSourceAccessCheckRunsPage } from "@/pages/profile-source-access-check-runs-page";

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
        path: "source-publishers",
        element: <SourcePublishersPage />,
      },
      {
        path: "content-items",
        element: <ContentItemsPage />,
      },
      {
        path: "content-items/:contentItemId",
        element: <ContentItemDetailPage />,
      },
      {
        path: "collection-runs",
        element: <CollectionRunsPage />,
      },
      {
        path: "collection-schedules",
        element: <CollectionSchedulesPage />,
      },
      {
        path: "profile-home-feed-schedules",
        element: <ProfileHomeFeedCollectionSchedulesPage />,
      },
      {
        path: "account-exercise-runs",
        element: <AccountExerciseRunsPage />,
      },
      {
        path: "profile-source-access-check-runs",
        element: <ProfileSourceAccessCheckRunsPage />,
      },
      {
        path: "*",
        element: <NotFoundPage />,
      },
    ],
  },
]);
