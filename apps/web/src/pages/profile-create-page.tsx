import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Save } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  applyZodFieldErrors,
  BackendErrorPanel,
  FormField,
  getErrorMessage,
} from "@/features/profiles/profile-form-support";
import { useCreateProfileMutation } from "@/features/profiles/profile-mutations";
import { PageShell } from "@/pages/page-shell";

const CreateProfileFormSchema = z
  .object({
    id: z.string().trim().min(1, "Profile ID is required."),
    displayName: z.string().trim().min(1, "Display name is required."),
  })
  .strict();

type CreateProfileFormValues = z.infer<typeof CreateProfileFormSchema>;

export function ProfileCreatePage(): JSX.Element {
  const navigate = useNavigate();
  const createProfile = useCreateProfileMutation();
  const defaultProfileId = useMemo(() => createDefaultProfileId(), []);
  const [validationSummary, setValidationSummary] = useState<string>();
  const form = useForm<CreateProfileFormValues>({
    defaultValues: {
      id: defaultProfileId,
      displayName: "",
    },
  });

  async function submit(values: CreateProfileFormValues): Promise<void> {
    setValidationSummary(undefined);
    createProfile.reset();

    const parsed = CreateProfileFormSchema.safeParse(values);

    if (!parsed.success) {
      setValidationSummary(
        applyZodFieldErrors(parsed.error, form.setError) ??
          "Profile identity is invalid.",
      );
      return;
    }

    try {
      const response = await createProfile.mutateAsync({
        id: parsed.data.id.trim(),
        displayName: parsed.data.displayName.trim(),
      });

      navigate(`/profiles/${encodeURIComponent(response.profile.id)}`);
    } catch {
      return;
    }
  }

  return (
    <PageShell
      eyebrow="Collector Profile Manager"
      title="Create Profile"
      description="Create a profile identity, then configure the operational profile groups."
      actions={
        <Link className={buttonVariants({ variant: "secondary" })} to="/profiles">
          <ArrowLeft aria-hidden="true" className="size-4" />
          Profiles
        </Link>
      }
    >
      <form
        className="grid gap-5"
        onSubmit={(event) => {
          void form.handleSubmit(submit)(event);
        }}
      >
        {validationSummary !== undefined ? (
          <div
            className="rounded border border-[#e4a0a0] bg-[#fff5f5] px-4 py-3 text-sm font-medium text-[#7f1d1d]"
            role="alert"
          >
            {validationSummary}
          </div>
        ) : null}

        <BackendErrorPanel
          error={createProfile.error}
          fallbackMessage="Profile creation failed."
        />

        <Card>
          <CardHeader>
            <CardTitle>Identity</CardTitle>
            <CardDescription>Profile identity accepted by the backend create API.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <FormField
              error={getErrorMessage(form.formState.errors.id)}
              htmlFor="profile-id"
              label="Profile ID"
            >
              <Input
                id="profile-id"
                autoComplete="off"
                {...form.register("id")}
              />
            </FormField>

            <FormField
              error={getErrorMessage(form.formState.errors.displayName)}
              htmlFor="profile-display-name"
              label="Display Name"
            >
              <Input
                id="profile-display-name"
                autoComplete="off"
                {...form.register("displayName")}
              />
            </FormField>
          </CardContent>
        </Card>

        <div className="flex flex-wrap justify-end gap-2">
          <Link className={buttonVariants({ variant: "secondary" })} to="/profiles">
            Cancel
          </Link>
          <Button disabled={createProfile.isPending} type="submit">
            <Save aria-hidden="true" className="size-4" />
            {createProfile.isPending ? "Creating" : "Create Profile"}
          </Button>
        </div>
      </form>
    </PageShell>
  );
}

function createDefaultProfileId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `profile-${crypto.randomUUID().slice(0, 8)}`;
  }

  return `profile-${Date.now().toString(36)}`;
}
