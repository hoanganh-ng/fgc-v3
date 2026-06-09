import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ProfileConfigurationForm } from "@/features/profiles/profile-configuration-form";
import { useUpdateProfileConfigurationMutation } from "@/features/profiles/profile-mutations";
import { useProfileQuery } from "@/features/profiles/profile-queries";
import { isApiResultError } from "@/lib/api/http-client";
import type { UpdateProfileConfigurationRequest } from "@/lib/api/profile-manager-client";
import { PageShell } from "@/pages/page-shell";

export function ProfileConfigurePage(): JSX.Element {
  const navigate = useNavigate();
  const { profileId: routeProfileId } = useParams();
  const profileId = routeProfileId ?? "";
  const profileQuery = useProfileQuery(profileId);
  const updateConfiguration = useUpdateProfileConfigurationMutation();
  const profile = profileQuery.data?.profile;

  async function submit(
    configuration: UpdateProfileConfigurationRequest,
  ): Promise<void> {
    updateConfiguration.reset();

    try {
      const response = await updateConfiguration.mutateAsync({
        profileId,
        configuration,
      });

      navigate(`/profiles/${encodeURIComponent(response.profile.id)}`);
    } catch {
      return;
    }
  }

  return (
    <PageShell
      eyebrow="Collector Profile Manager"
      title={profile !== undefined ? `Configure ${profile.displayName}` : "Configure Profile"}
      description={
        profile !== undefined
          ? profile.id
          : "Structured profile configuration form."
      }
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Link
            className={buttonVariants({ variant: "secondary" })}
            to={
              profileId.trim().length > 0
                ? `/profiles/${encodeURIComponent(profileId)}`
                : "/profiles"
            }
          >
            <ArrowLeft aria-hidden="true" className="size-4" />
            Detail
          </Link>
          <Button
            variant="secondary"
            onClick={() => {
              void profileQuery.refetch();
            }}
          >
            <RefreshCw aria-hidden="true" className="size-4" />
            Refresh
          </Button>
        </div>
      }
    >
      {profileId.trim().length === 0 ? <ProfileConfigureNotFoundState /> : null}
      {profileId.trim().length > 0 && profileQuery.isPending ? (
        <ProfileConfigureLoadingState />
      ) : null}
      {profileId.trim().length > 0 && profileQuery.isError ? (
        isProfileNotFoundError(profileQuery.error) ? (
          <ProfileConfigureNotFoundState />
        ) : (
          <ProfileConfigureErrorState
            error={profileQuery.error}
            onRetry={() => {
              void profileQuery.refetch();
            }}
          />
        )
      ) : null}
      {profile !== undefined ? (
        <ProfileConfigurationForm
          isSubmitting={updateConfiguration.isPending}
          profile={profile}
          submitError={updateConfiguration.error}
          onSubmit={submit}
        />
      ) : null}
    </PageShell>
  );
}

function ProfileConfigureLoadingState(): JSX.Element {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Loading Profile</CardTitle>
        <CardDescription>Reading safe profile detail from the API.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {["identity", "network", "hardware", "behavior", "routine", "safety"].map(
          (section) => (
            <div
              key={section}
              className="h-24 animate-pulse rounded border border-border bg-muted/70"
            />
          ),
        )}
      </CardContent>
    </Card>
  );
}

function ProfileConfigureErrorState({
  error,
  onRetry,
}: {
  readonly error: unknown;
  readonly onRetry: () => void;
}): JSX.Element {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile Could Not Load</CardTitle>
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

function ProfileConfigureNotFoundState(): JSX.Element {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile Not Found</CardTitle>
        <CardDescription>No safe profile detail was returned for this id.</CardDescription>
      </CardHeader>
      <CardContent>
        <Link className={buttonVariants({ variant: "secondary" })} to="/profiles">
          <ArrowLeft aria-hidden="true" className="size-4" />
          Profiles
        </Link>
      </CardContent>
    </Card>
  );
}

function isProfileNotFoundError(error: unknown): boolean {
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

  return "The profile configuration request failed.";
}
