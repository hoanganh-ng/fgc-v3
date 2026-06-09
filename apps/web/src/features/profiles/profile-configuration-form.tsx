import { useEffect, useState } from "react";
import {
  Controller,
  useFieldArray,
  useForm,
  type UseFormRegister,
} from "react-hook-form";
import { Plus, Save, Trash2 } from "lucide-react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  applyZodFieldErrors,
  BackendErrorPanel,
  FieldError,
  FormField,
  getErrorMessage,
} from "@/features/profiles/profile-form-support";
import {
  ChronotypeSchema,
  ProxyProtocolSchema,
  ScrollStyleSchema,
  type Chronotype,
  type NetworkContextConfiguration,
  type ProfileDetail,
  type ProxyProtocol,
  type ScrollStyle,
  type UpdateProfileConfigurationRequest,
} from "@/lib/api/profile-manager-client";

const localTimePattern = /^([01]\d|2[0-3]):[0-5]\d$/;
const dayValues = [0, 1, 2, 3, 4, 5, 6] as const;

const dayOptions: readonly { readonly value: number; readonly label: string }[] = [
  { value: 0, label: "Sun" },
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
];

const NumberRangeFormSchema = z
  .object({
    min: z.number().finite().min(0),
    max: z.number().finite().min(0),
  })
  .strict()
  .refine((range) => range.min <= range.max, {
    message: "Min must be less than or equal to max.",
    path: ["max"],
  });

const WeightedTopicFormSchema = z
  .object({
    topic: z.string().trim().min(1, "Topic is required."),
    weight: z.number().finite().min(0),
  })
  .strict();

const ActiveTimeWindowFormSchema = z
  .object({
    days: z.array(z.number().int().min(0).max(6)).min(1, "Select at least one day."),
    startsAt: z
      .string()
      .regex(localTimePattern, "Expected HH:mm local time."),
    endsAt: z
      .string()
      .regex(localTimePattern, "Expected HH:mm local time."),
  })
  .strict();

const ProfileConfigurationFormSchema = z
  .object({
    networkContext: z
      .object({
        proxyMode: z.enum(["none", "proxy"]),
        protocol: ProxyProtocolSchema,
        host: z.string(),
        port: z.number().int().min(1).max(65_535),
        username: z.string(),
        password: z.string(),
        countryCode: z.string(),
        region: z.string(),
        killswitchEnabled: z.boolean(),
        killswitchFailClosed: z.boolean(),
      })
      .strict()
      .superRefine((value, context) => {
        if (value.proxyMode === "proxy" && value.host.trim().length === 0) {
          context.addIssue({
            code: "custom",
            message: "Proxy host is required.",
            path: ["host"],
          });
        }

        const hasUsername = value.username.trim().length > 0;
        const hasPassword = value.password.trim().length > 0;

        if (hasUsername !== hasPassword) {
          context.addIssue({
            code: "custom",
            message: "Proxy username and password must be entered together.",
            path: hasUsername ? ["password"] : ["username"],
          });
        }
      }),
    hardwareFingerprint: z
      .object({
        userAgent: z.string().trim().min(1, "User agent is required."),
        viewportWidth: z.number().finite().positive(),
        viewportHeight: z.number().finite().positive(),
        deviceScaleFactor: z.number().finite().positive(),
        languagesText: z.string().trim().min(1, "At least one language is required."),
        hardwareConcurrency: z.number().finite().positive(),
        platform: z.string(),
        deviceMemoryGb: z.number().finite().positive(),
        timezone: z.string(),
      })
      .strict(),
    behavioralPersona: z
      .object({
        scrollStyle: ScrollStyleSchema,
        microDelayMs: NumberRangeFormSchema,
        reverseScrollProbability: z.number().finite().min(0).max(1),
        dwellTimeMs: NumberRangeFormSchema,
      })
      .strict(),
    temporalRoutine: z
      .object({
        timezone: z.string().trim().min(1, "Timezone is required."),
        chronotype: ChronotypeSchema,
        activeWindows: z
          .array(ActiveTimeWindowFormSchema)
          .min(1, "At least one active window is required."),
        cooldownMinutes: z.number().finite().min(0),
      })
      .strict(),
    safetyThresholds: z
      .object({
        maxSessionsPerDay: z.number().finite().min(1),
        maxSessionDurationMinutes: z.number().finite().min(1),
        maxMacroActionsPerDay: z.number().finite().min(1),
        minCooldownMinutes: z.number().finite().min(0),
      })
      .strict(),
    contentAffinities: z
      .object({
        primaryTopics: z
          .array(WeightedTopicFormSchema)
          .min(1, "At least one primary topic is required."),
        secondaryTopics: z.array(WeightedTopicFormSchema),
        interactionWeights: z
          .object({
            view: z.number().finite().min(0),
            like: z.number().finite().min(0),
            save: z.number().finite().min(0),
            comment: z.number().finite().min(0),
            share: z.number().finite().min(0),
          })
          .strict(),
      })
      .strict(),
  })
  .strict();

type ProfileConfigurationFormValues = z.infer<
  typeof ProfileConfigurationFormSchema
>;

export interface ProfileConfigurationFormProps {
  readonly profile: ProfileDetail;
  readonly isSubmitting: boolean;
  readonly submitError: unknown;
  readonly onSubmit: (
    configuration: UpdateProfileConfigurationRequest,
  ) => Promise<void>;
}

export function ProfileConfigurationForm({
  profile,
  isSubmitting,
  submitError,
  onSubmit,
}: ProfileConfigurationFormProps): JSX.Element {
  const [validationSummary, setValidationSummary] = useState<string>();
  const form = useForm<ProfileConfigurationFormValues>({
    defaultValues: toProfileConfigurationFormValues(profile),
  });
  const { reset } = form;
  const activeWindows = useFieldArray({
    control: form.control,
    name: "temporalRoutine.activeWindows",
  });
  const primaryTopics = useFieldArray({
    control: form.control,
    name: "contentAffinities.primaryTopics",
  });
  const secondaryTopics = useFieldArray({
    control: form.control,
    name: "contentAffinities.secondaryTopics",
  });
  const canAssignHardwareFingerprint = profile.hardwareFingerprint === null;

  useEffect(() => {
    reset(toProfileConfigurationFormValues(profile));
  }, [profile.id, profile.updatedAt, reset]);

  async function submit(values: ProfileConfigurationFormValues): Promise<void> {
    setValidationSummary(undefined);

    const parsed = ProfileConfigurationFormSchema.safeParse(values);

    if (!parsed.success) {
      setValidationSummary(
        applyZodFieldErrors(parsed.error, form.setError) ??
          "Profile configuration is invalid.",
      );
      return;
    }

    await onSubmit(
      toUpdateProfileConfigurationRequest(parsed.data, {
        includeHardwareFingerprint: canAssignHardwareFingerprint,
      }),
    );
  }

  return (
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
        error={submitError}
        fallbackMessage="Profile configuration update failed."
      />

      <IdentitySection profile={profile} />

      <Card>
        <CardHeader>
          <CardTitle>Network Context</CardTitle>
          <CardDescription>Proxy routing and network fail-closed behavior.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-4 md:grid-cols-3">
            <FormField
              error={getErrorMessage(form.formState.errors.networkContext?.proxyMode)}
              htmlFor="network-proxy-mode"
              label="Proxy Mode"
            >
              <Select
                id="network-proxy-mode"
                {...form.register("networkContext.proxyMode")}
              >
                <option value="none">None</option>
                <option value="proxy">Proxy</option>
              </Select>
            </FormField>
            <FormField
              error={getErrorMessage(form.formState.errors.networkContext?.protocol)}
              htmlFor="network-proxy-protocol"
              label="Proxy Protocol"
            >
              <Select
                id="network-proxy-protocol"
                {...form.register("networkContext.protocol")}
              >
                <option value="HTTPS">HTTPS</option>
                <option value="HTTP">HTTP</option>
                <option value="SOCKS5">SOCKS5</option>
              </Select>
            </FormField>
            <FormField
              error={getErrorMessage(form.formState.errors.networkContext?.port)}
              htmlFor="network-proxy-port"
              label="Proxy Port"
            >
              <Input
                id="network-proxy-port"
                inputMode="numeric"
                type="number"
                {...form.register("networkContext.port", { valueAsNumber: true })}
              />
            </FormField>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <FormField
              error={getErrorMessage(form.formState.errors.networkContext?.host)}
              htmlFor="network-proxy-host"
              label="Proxy Host"
            >
              <Input
                id="network-proxy-host"
                {...form.register("networkContext.host")}
              />
            </FormField>
            <FormField
              error={getErrorMessage(form.formState.errors.networkContext?.countryCode)}
              htmlFor="network-proxy-country"
              label="Country Code"
            >
              <Input
                id="network-proxy-country"
                {...form.register("networkContext.countryCode")}
              />
            </FormField>
            <FormField
              error={getErrorMessage(form.formState.errors.networkContext?.region)}
              htmlFor="network-proxy-region"
              label="Region"
            >
              <Input
                id="network-proxy-region"
                {...form.register("networkContext.region")}
              />
            </FormField>
            <FormField
              error={getErrorMessage(form.formState.errors.networkContext?.username)}
              htmlFor="network-proxy-username"
              label="Proxy Username"
            >
              <Input
                id="network-proxy-username"
                autoComplete="off"
                {...form.register("networkContext.username")}
              />
            </FormField>
            <FormField
              error={getErrorMessage(form.formState.errors.networkContext?.password)}
              htmlFor="network-proxy-password"
              label="Proxy Password"
            >
              <Input
                id="network-proxy-password"
                autoComplete="new-password"
                type="password"
                {...form.register("networkContext.password")}
              />
            </FormField>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <label className="flex min-h-11 items-center gap-3 rounded border border-border bg-muted/30 px-3 text-sm">
              <input
                className="size-4 accent-[hsl(var(--primary))]"
                type="checkbox"
                {...form.register("networkContext.killswitchEnabled")}
              />
              <span>Network Killswitch Enabled</span>
            </label>
            <label className="flex min-h-11 items-center gap-3 rounded border border-border bg-muted/30 px-3 text-sm">
              <input
                className="size-4 accent-[hsl(var(--primary))]"
                type="checkbox"
                {...form.register("networkContext.killswitchFailClosed")}
              />
              <span>Fail Closed</span>
            </label>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <CardTitle>Hardware Fingerprint</CardTitle>
            <CardDescription>Browser fingerprint assigned before provisioning.</CardDescription>
          </div>
          <StatusBadge
            label={canAssignHardwareFingerprint ? "Assignable" : "Locked"}
            tone={canAssignHardwareFingerprint ? "warning" : "success"}
          />
        </CardHeader>
        <CardContent className="grid gap-4">
          <FormField
            error={getErrorMessage(form.formState.errors.hardwareFingerprint?.userAgent)}
            htmlFor="hardware-user-agent"
            label="User Agent"
          >
            <Input
              id="hardware-user-agent"
              readOnly={!canAssignHardwareFingerprint}
              {...form.register("hardwareFingerprint.userAgent")}
            />
          </FormField>

          <div className="grid gap-4 md:grid-cols-3">
            <FormField
              error={getErrorMessage(
                form.formState.errors.hardwareFingerprint?.viewportWidth,
              )}
              htmlFor="hardware-viewport-width"
              label="Viewport Width"
            >
              <Input
                id="hardware-viewport-width"
                inputMode="numeric"
                readOnly={!canAssignHardwareFingerprint}
                type="number"
                {...form.register("hardwareFingerprint.viewportWidth", {
                  valueAsNumber: true,
                })}
              />
            </FormField>
            <FormField
              error={getErrorMessage(
                form.formState.errors.hardwareFingerprint?.viewportHeight,
              )}
              htmlFor="hardware-viewport-height"
              label="Viewport Height"
            >
              <Input
                id="hardware-viewport-height"
                inputMode="numeric"
                readOnly={!canAssignHardwareFingerprint}
                type="number"
                {...form.register("hardwareFingerprint.viewportHeight", {
                  valueAsNumber: true,
                })}
              />
            </FormField>
            <FormField
              error={getErrorMessage(
                form.formState.errors.hardwareFingerprint?.deviceScaleFactor,
              )}
              htmlFor="hardware-device-scale"
              label="Scale Factor"
            >
              <Input
                id="hardware-device-scale"
                inputMode="decimal"
                readOnly={!canAssignHardwareFingerprint}
                step="0.1"
                type="number"
                {...form.register("hardwareFingerprint.deviceScaleFactor", {
                  valueAsNumber: true,
                })}
              />
            </FormField>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <FormField
              error={getErrorMessage(
                form.formState.errors.hardwareFingerprint?.languagesText,
              )}
              htmlFor="hardware-languages"
              label="Languages"
            >
              <Input
                id="hardware-languages"
                readOnly={!canAssignHardwareFingerprint}
                {...form.register("hardwareFingerprint.languagesText")}
              />
            </FormField>
            <FormField
              error={getErrorMessage(
                form.formState.errors.hardwareFingerprint?.hardwareConcurrency,
              )}
              htmlFor="hardware-concurrency"
              label="Hardware Concurrency"
            >
              <Input
                id="hardware-concurrency"
                inputMode="numeric"
                readOnly={!canAssignHardwareFingerprint}
                type="number"
                {...form.register("hardwareFingerprint.hardwareConcurrency", {
                  valueAsNumber: true,
                })}
              />
            </FormField>
            <FormField
              error={getErrorMessage(form.formState.errors.hardwareFingerprint?.platform)}
              htmlFor="hardware-platform"
              label="Platform"
            >
              <Input
                id="hardware-platform"
                readOnly={!canAssignHardwareFingerprint}
                {...form.register("hardwareFingerprint.platform")}
              />
            </FormField>
            <FormField
              error={getErrorMessage(
                form.formState.errors.hardwareFingerprint?.deviceMemoryGb,
              )}
              htmlFor="hardware-memory"
              label="Device Memory GB"
            >
              <Input
                id="hardware-memory"
                inputMode="numeric"
                readOnly={!canAssignHardwareFingerprint}
                type="number"
                {...form.register("hardwareFingerprint.deviceMemoryGb", {
                  valueAsNumber: true,
                })}
              />
            </FormField>
            <FormField
              error={getErrorMessage(form.formState.errors.hardwareFingerprint?.timezone)}
              htmlFor="hardware-timezone"
              label="Hardware Timezone"
            >
              <Input
                id="hardware-timezone"
                readOnly={!canAssignHardwareFingerprint}
                {...form.register("hardwareFingerprint.timezone")}
              />
            </FormField>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Behavioral Persona</CardTitle>
          <CardDescription>Interaction timing and scrolling profile.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-4 md:grid-cols-2">
            <FormField
              error={getErrorMessage(form.formState.errors.behavioralPersona?.scrollStyle)}
              htmlFor="behavior-scroll-style"
              label="Scroll Style"
            >
              <Select
                id="behavior-scroll-style"
                {...form.register("behavioralPersona.scrollStyle")}
              >
                <option value="STEADY">Steady</option>
                <option value="SKIMMING">Skimming</option>
                <option value="DEEP_READ">Deep Read</option>
              </Select>
            </FormField>
            <FormField
              error={getErrorMessage(
                form.formState.errors.behavioralPersona?.reverseScrollProbability,
              )}
              htmlFor="behavior-reverse-probability"
              label="Reverse Scroll Probability"
            >
              <Input
                id="behavior-reverse-probability"
                inputMode="decimal"
                max="1"
                min="0"
                step="0.01"
                type="number"
                {...form.register("behavioralPersona.reverseScrollProbability", {
                  valueAsNumber: true,
                })}
              />
            </FormField>
          </div>

          <div className="grid gap-4 md:grid-cols-4">
            <FormField
              error={getErrorMessage(
                form.formState.errors.behavioralPersona?.microDelayMs?.min,
              )}
              htmlFor="behavior-micro-delay-min"
              label="Micro Delay Min MS"
            >
              <Input
                id="behavior-micro-delay-min"
                inputMode="numeric"
                type="number"
                {...form.register("behavioralPersona.microDelayMs.min", {
                  valueAsNumber: true,
                })}
              />
            </FormField>
            <FormField
              error={getErrorMessage(
                form.formState.errors.behavioralPersona?.microDelayMs?.max,
              )}
              htmlFor="behavior-micro-delay-max"
              label="Micro Delay Max MS"
            >
              <Input
                id="behavior-micro-delay-max"
                inputMode="numeric"
                type="number"
                {...form.register("behavioralPersona.microDelayMs.max", {
                  valueAsNumber: true,
                })}
              />
            </FormField>
            <FormField
              error={getErrorMessage(
                form.formState.errors.behavioralPersona?.dwellTimeMs?.min,
              )}
              htmlFor="behavior-dwell-min"
              label="Dwell Min MS"
            >
              <Input
                id="behavior-dwell-min"
                inputMode="numeric"
                type="number"
                {...form.register("behavioralPersona.dwellTimeMs.min", {
                  valueAsNumber: true,
                })}
              />
            </FormField>
            <FormField
              error={getErrorMessage(
                form.formState.errors.behavioralPersona?.dwellTimeMs?.max,
              )}
              htmlFor="behavior-dwell-max"
              label="Dwell Max MS"
            >
              <Input
                id="behavior-dwell-max"
                inputMode="numeric"
                type="number"
                {...form.register("behavioralPersona.dwellTimeMs.max", {
                  valueAsNumber: true,
                })}
              />
            </FormField>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <CardTitle>Temporal Routine</CardTitle>
            <CardDescription>Timezone, chronotype, active windows, and cooldown.</CardDescription>
          </div>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => activeWindows.append(createDefaultActiveWindow())}
          >
            <Plus aria-hidden="true" className="size-4" />
            Window
          </Button>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-4 md:grid-cols-3">
            <FormField
              error={getErrorMessage(form.formState.errors.temporalRoutine?.timezone)}
              htmlFor="routine-timezone"
              label="Timezone"
            >
              <Input
                id="routine-timezone"
                {...form.register("temporalRoutine.timezone")}
              />
            </FormField>
            <FormField
              error={getErrorMessage(form.formState.errors.temporalRoutine?.chronotype)}
              htmlFor="routine-chronotype"
              label="Chronotype"
            >
              <Select
                id="routine-chronotype"
                {...form.register("temporalRoutine.chronotype")}
              >
                <option value="MORNING">Morning</option>
                <option value="AFTERNOON">Afternoon</option>
                <option value="EVENING">Evening</option>
                <option value="NIGHT">Night</option>
              </Select>
            </FormField>
            <FormField
              error={getErrorMessage(
                form.formState.errors.temporalRoutine?.cooldownMinutes,
              )}
              htmlFor="routine-cooldown"
              label="Cooldown Minutes"
            >
              <Input
                id="routine-cooldown"
                inputMode="numeric"
                type="number"
                {...form.register("temporalRoutine.cooldownMinutes", {
                  valueAsNumber: true,
                })}
              />
            </FormField>
          </div>

          <FieldError
            message={getErrorMessage(
              form.formState.errors.temporalRoutine?.activeWindows,
            )}
          />
          {activeWindows.fields.map((field, index) => (
            <div
              key={field.id}
              className="grid gap-4 rounded border border-border bg-muted/20 p-3"
            >
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold text-foreground">
                  Active Window {index + 1}
                </h3>
                <Button
                  aria-label={`Remove active window ${index + 1}`}
                  size="sm"
                  variant="ghost"
                  onClick={() => activeWindows.remove(index)}
                >
                  <Trash2 aria-hidden="true" className="size-4" />
                </Button>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  error={getErrorMessage(
                    form.formState.errors.temporalRoutine?.activeWindows?.[
                      index
                    ]?.startsAt,
                  )}
                  htmlFor={`routine-window-${index}-starts`}
                  label="Starts At"
                >
                  <Input
                    id={`routine-window-${index}-starts`}
                    type="time"
                    {...form.register(
                      `temporalRoutine.activeWindows.${index}.startsAt`,
                    )}
                  />
                </FormField>
                <FormField
                  error={getErrorMessage(
                    form.formState.errors.temporalRoutine?.activeWindows?.[
                      index
                    ]?.endsAt,
                  )}
                  htmlFor={`routine-window-${index}-ends`}
                  label="Ends At"
                >
                  <Input
                    id={`routine-window-${index}-ends`}
                    type="time"
                    {...form.register(
                      `temporalRoutine.activeWindows.${index}.endsAt`,
                    )}
                  />
                </FormField>
              </div>

              <Controller
                control={form.control}
                name={`temporalRoutine.activeWindows.${index}.days`}
                render={({ field: dayField }) => (
                  <div className="space-y-2">
                    <span className="block text-sm font-medium text-foreground">
                      Days
                    </span>
                    <div className="grid gap-2 sm:grid-cols-4 lg:grid-cols-7">
                      {dayOptions.map((day) => {
                        const values = new Set(dayField.value);
                        const checked = values.has(day.value);

                        return (
                          <label
                            key={day.value}
                            className="flex min-h-10 items-center gap-2 rounded border border-border bg-white px-3 text-sm"
                          >
                            <input
                              checked={checked}
                              className="size-4 accent-[hsl(var(--primary))]"
                              type="checkbox"
                              onChange={(event) => {
                                const nextValues = new Set(dayField.value);

                                if (event.target.checked) {
                                  nextValues.add(day.value);
                                } else {
                                  nextValues.delete(day.value);
                                }

                                dayField.onChange(
                                  [...nextValues].sort((left, right) => left - right),
                                );
                              }}
                            />
                            <span>{day.label}</span>
                          </label>
                        );
                      })}
                    </div>
                    <FieldError
                      message={getErrorMessage(
                        form.formState.errors.temporalRoutine?.activeWindows?.[
                          index
                        ]?.days,
                      )}
                    />
                  </div>
                )}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Safety Thresholds</CardTitle>
          <CardDescription>Daily and session-level operating limits.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-4">
          <FormField
            error={getErrorMessage(form.formState.errors.safetyThresholds?.maxSessionsPerDay)}
            htmlFor="safety-sessions"
            label="Max Sessions Per Day"
          >
            <Input
              id="safety-sessions"
              inputMode="numeric"
              type="number"
              {...form.register("safetyThresholds.maxSessionsPerDay", {
                valueAsNumber: true,
              })}
            />
          </FormField>
          <FormField
            error={getErrorMessage(
              form.formState.errors.safetyThresholds?.maxSessionDurationMinutes,
            )}
            htmlFor="safety-session-duration"
            label="Max Session Minutes"
          >
            <Input
              id="safety-session-duration"
              inputMode="numeric"
              type="number"
              {...form.register("safetyThresholds.maxSessionDurationMinutes", {
                valueAsNumber: true,
              })}
            />
          </FormField>
          <FormField
            error={getErrorMessage(
              form.formState.errors.safetyThresholds?.maxMacroActionsPerDay,
            )}
            htmlFor="safety-macro-actions"
            label="Max Macro Actions"
          >
            <Input
              id="safety-macro-actions"
              inputMode="numeric"
              type="number"
              {...form.register("safetyThresholds.maxMacroActionsPerDay", {
                valueAsNumber: true,
              })}
            />
          </FormField>
          <FormField
            error={getErrorMessage(form.formState.errors.safetyThresholds?.minCooldownMinutes)}
            htmlFor="safety-min-cooldown"
            label="Min Cooldown Minutes"
          >
            <Input
              id="safety-min-cooldown"
              inputMode="numeric"
              type="number"
              {...form.register("safetyThresholds.minCooldownMinutes", {
                valueAsNumber: true,
              })}
            />
          </FormField>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Content Affinities</CardTitle>
          <CardDescription>Topic weights and interaction weighting.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5">
          <TopicArrayFields
            errors={form.formState.errors.contentAffinities?.primaryTopics}
            fields={primaryTopics.fields}
            label="Primary Topics"
            name="contentAffinities.primaryTopics"
            onAdd={() => primaryTopics.append(createDefaultTopic())}
            onRemove={(index) => primaryTopics.remove(index)}
            register={form.register}
          />
          <TopicArrayFields
            errors={form.formState.errors.contentAffinities?.secondaryTopics}
            fields={secondaryTopics.fields}
            label="Secondary Topics"
            name="contentAffinities.secondaryTopics"
            onAdd={() => secondaryTopics.append(createDefaultSecondaryTopic())}
            onRemove={(index) => secondaryTopics.remove(index)}
            register={form.register}
          />

          <div className="grid gap-4 md:grid-cols-5">
            <FormField
              error={getErrorMessage(
                form.formState.errors.contentAffinities?.interactionWeights?.view,
              )}
              htmlFor="affinity-view-weight"
              label="View Weight"
            >
              <Input
                id="affinity-view-weight"
                inputMode="decimal"
                step="0.01"
                type="number"
                {...form.register("contentAffinities.interactionWeights.view", {
                  valueAsNumber: true,
                })}
              />
            </FormField>
            <FormField
              error={getErrorMessage(
                form.formState.errors.contentAffinities?.interactionWeights?.like,
              )}
              htmlFor="affinity-like-weight"
              label="Like Weight"
            >
              <Input
                id="affinity-like-weight"
                inputMode="decimal"
                step="0.01"
                type="number"
                {...form.register("contentAffinities.interactionWeights.like", {
                  valueAsNumber: true,
                })}
              />
            </FormField>
            <FormField
              error={getErrorMessage(
                form.formState.errors.contentAffinities?.interactionWeights?.save,
              )}
              htmlFor="affinity-save-weight"
              label="Save Weight"
            >
              <Input
                id="affinity-save-weight"
                inputMode="decimal"
                step="0.01"
                type="number"
                {...form.register("contentAffinities.interactionWeights.save", {
                  valueAsNumber: true,
                })}
              />
            </FormField>
            <FormField
              error={getErrorMessage(
                form.formState.errors.contentAffinities?.interactionWeights?.comment,
              )}
              htmlFor="affinity-comment-weight"
              label="Comment Weight"
            >
              <Input
                id="affinity-comment-weight"
                inputMode="decimal"
                step="0.01"
                type="number"
                {...form.register("contentAffinities.interactionWeights.comment", {
                  valueAsNumber: true,
                })}
              />
            </FormField>
            <FormField
              error={getErrorMessage(
                form.formState.errors.contentAffinities?.interactionWeights?.share,
              )}
              htmlFor="affinity-share-weight"
              label="Share Weight"
            >
              <Input
                id="affinity-share-weight"
                inputMode="decimal"
                step="0.01"
                type="number"
                {...form.register("contentAffinities.interactionWeights.share", {
                  valueAsNumber: true,
                })}
              />
            </FormField>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap justify-end gap-2">
        <Button disabled={isSubmitting} type="submit">
          <Save aria-hidden="true" className="size-4" />
          {isSubmitting ? "Saving" : "Save Configuration"}
        </Button>
      </div>
    </form>
  );
}

function IdentitySection({ profile }: { readonly profile: ProfileDetail }): JSX.Element {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Identity</CardTitle>
        <CardDescription>Read-only identity for this configuration update.</CardDescription>
      </CardHeader>
      <CardContent>
        <dl className="grid gap-3 md:grid-cols-3">
          <ReadOnlyField label="Profile ID" value={profile.id} />
          <ReadOnlyField label="Display Name" value={profile.displayName} />
          <ReadOnlyField label="Status" value={profile.status} />
        </dl>
      </CardContent>
    </Card>
  );
}

function ReadOnlyField({
  label,
  value,
}: {
  readonly label: string;
  readonly value: string;
}): JSX.Element {
  return (
    <div className="min-w-0 rounded border border-border bg-muted/35 p-3">
      <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-2 break-words text-sm font-medium text-foreground">
        {value}
      </dd>
    </div>
  );
}

function TopicArrayFields({
  errors,
  fields,
  label,
  name,
  onAdd,
  onRemove,
  register,
}: {
  readonly errors: unknown;
  readonly fields: readonly { readonly id: string }[];
  readonly label: string;
  readonly name:
    | "contentAffinities.primaryTopics"
    | "contentAffinities.secondaryTopics";
  readonly onAdd: () => void;
  readonly onRemove: (index: number) => void;
  readonly register: UseFormRegister<ProfileConfigurationFormValues>;
}): JSX.Element {
  const arrayErrors = Array.isArray(errors) ? errors : [];

  return (
    <div className="grid gap-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-foreground">{label}</h3>
        <Button size="sm" variant="secondary" onClick={onAdd}>
          <Plus aria-hidden="true" className="size-4" />
          Topic
        </Button>
      </div>
      <FieldError message={getErrorMessage(errors)} />
      <div className="grid gap-3">
        {fields.map((field, index) => {
          const topicError = arrayErrors[index] as
            | {
                readonly topic?: unknown;
                readonly weight?: unknown;
              }
            | undefined;

          return (
            <div
              key={field.id}
              className="grid gap-3 rounded border border-border bg-muted/20 p-3 md:grid-cols-[minmax(0,1fr)_8rem_auto]"
            >
              <FormField
                error={getErrorMessage(topicError?.topic)}
                htmlFor={`${name}-${index}-topic`}
                label="Topic"
              >
                <Input
                  id={`${name}-${index}-topic`}
                  {...register(`${name}.${index}.topic`)}
                />
              </FormField>
              <FormField
                error={getErrorMessage(topicError?.weight)}
                htmlFor={`${name}-${index}-weight`}
                label="Weight"
              >
                <Input
                  id={`${name}-${index}-weight`}
                  inputMode="decimal"
                  step="0.01"
                  type="number"
                  {...register(`${name}.${index}.weight`, {
                    valueAsNumber: true,
                  })}
                />
              </FormField>
              <div className="flex items-end">
                <Button
                  aria-label={`Remove ${label.toLowerCase()} row ${index + 1}`}
                  size="sm"
                  variant="ghost"
                  onClick={() => onRemove(index)}
                >
                  <Trash2 aria-hidden="true" className="size-4" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function toProfileConfigurationFormValues(
  profile: ProfileDetail,
): ProfileConfigurationFormValues {
  const safeTimezone = withDefault(profile.temporalRoutine.timezone, "Asia/Ho_Chi_Minh");
  const proxy = profile.networkContext.proxy;
  const hardware = profile.hardwareFingerprint;

  return {
    networkContext: {
      proxyMode: proxy === null ? "none" : "proxy",
      protocol: proxy !== null ? asProxyProtocol(proxy.protocol) : "HTTPS",
      host: proxy?.host ?? "",
      port: proxy?.port ?? 8080,
      username: "",
      password: "",
      countryCode: proxy?.countryCode ?? "",
      region: proxy?.region ?? "",
      killswitchEnabled: profile.networkContext.killswitch.enabled,
      killswitchFailClosed: profile.networkContext.killswitch.failClosed,
    },
    hardwareFingerprint: {
      userAgent: hardware?.userAgent ?? defaultUserAgent,
      viewportWidth: hardware?.viewport.width ?? 1366,
      viewportHeight: hardware?.viewport.height ?? 768,
      deviceScaleFactor: hardware?.viewport.deviceScaleFactor ?? 1,
      languagesText:
        hardware !== null && hardware.languages.length > 0
          ? hardware.languages.join(", ")
          : "en-US, en",
      hardwareConcurrency: hardware?.hardwareConcurrency ?? 4,
      platform: hardware?.platform ?? "Linux x86_64",
      deviceMemoryGb: hardware?.deviceMemoryGb ?? 4,
      timezone: hardware?.timezone ?? safeTimezone,
    },
    behavioralPersona: {
      scrollStyle: asScrollStyle(profile.behavioralPersona.scrollStyle),
      microDelayMs: {
        min: nonZeroDefault(profile.behavioralPersona.microDelayMs.min, 250),
        max: nonZeroDefault(profile.behavioralPersona.microDelayMs.max, 1200),
      },
      reverseScrollProbability: profile.behavioralPersona.reverseScrollProbability,
      dwellTimeMs: {
        min: nonZeroDefault(profile.behavioralPersona.dwellTimeMs.min, 1000),
        max: nonZeroDefault(profile.behavioralPersona.dwellTimeMs.max, 5000),
      },
    },
    temporalRoutine: {
      timezone: safeTimezone,
      chronotype: asChronotype(profile.temporalRoutine.chronotype),
      activeWindows:
        profile.temporalRoutine.activeWindows.length > 0
          ? profile.temporalRoutine.activeWindows.map((window) => ({
              days: [...window.days],
              startsAt: window.startsAt,
              endsAt: window.endsAt,
            }))
          : [createDefaultActiveWindow()],
      cooldownMinutes: nonZeroDefault(profile.temporalRoutine.cooldownMinutes, 60),
    },
    safetyThresholds: {
      maxSessionsPerDay: nonZeroDefault(profile.safetyThresholds.maxSessionsPerDay, 1),
      maxSessionDurationMinutes: nonZeroDefault(
        profile.safetyThresholds.maxSessionDurationMinutes,
        60,
      ),
      maxMacroActionsPerDay: nonZeroDefault(
        profile.safetyThresholds.maxMacroActionsPerDay,
        100,
      ),
      minCooldownMinutes: nonZeroDefault(profile.safetyThresholds.minCooldownMinutes, 60),
    },
    contentAffinities: {
      primaryTopics:
        profile.contentAffinities.primaryTopics.length > 0
          ? profile.contentAffinities.primaryTopics.map((topic) => ({ ...topic }))
          : [createDefaultTopic()],
      secondaryTopics: profile.contentAffinities.secondaryTopics.map((topic) => ({
        ...topic,
      })),
      interactionWeights: {
        view: nonZeroDefault(profile.contentAffinities.interactionWeights.view, 1),
        like: profile.contentAffinities.interactionWeights.like,
        save: profile.contentAffinities.interactionWeights.save,
        comment: profile.contentAffinities.interactionWeights.comment,
        share: profile.contentAffinities.interactionWeights.share,
      },
    },
  };
}

function toUpdateProfileConfigurationRequest(
  values: ProfileConfigurationFormValues,
  options: { readonly includeHardwareFingerprint: boolean },
): UpdateProfileConfigurationRequest {
  const networkContext = toNetworkContextConfiguration(values.networkContext);
  const hardwareFingerprint = {
    userAgent: values.hardwareFingerprint.userAgent.trim(),
    viewport: {
      width: values.hardwareFingerprint.viewportWidth,
      height: values.hardwareFingerprint.viewportHeight,
      deviceScaleFactor: values.hardwareFingerprint.deviceScaleFactor,
    },
    languages: values.hardwareFingerprint.languagesText
      .split(",")
      .map((language) => language.trim())
      .filter((language) => language.length > 0),
    hardwareConcurrency: values.hardwareFingerprint.hardwareConcurrency,
    ...(cleanOptionalText(values.hardwareFingerprint.platform) !== undefined
      ? { platform: cleanOptionalText(values.hardwareFingerprint.platform) }
      : {}),
    deviceMemoryGb: values.hardwareFingerprint.deviceMemoryGb,
    ...(cleanOptionalText(values.hardwareFingerprint.timezone) !== undefined
      ? { timezone: cleanOptionalText(values.hardwareFingerprint.timezone) }
      : {}),
  };

  return {
    networkContext,
    ...(options.includeHardwareFingerprint ? { hardwareFingerprint } : {}),
    behavioralPersona: {
      scrollStyle: values.behavioralPersona.scrollStyle,
      microDelayMs: values.behavioralPersona.microDelayMs,
      reverseScrollProbability:
        values.behavioralPersona.reverseScrollProbability,
      dwellTimeMs: values.behavioralPersona.dwellTimeMs,
    },
    temporalRoutine: {
      timezone: values.temporalRoutine.timezone.trim(),
      chronotype: values.temporalRoutine.chronotype,
      activeWindows: values.temporalRoutine.activeWindows.map((window) => ({
        days: [...window.days].sort((left, right) => left - right),
        startsAt: window.startsAt,
        endsAt: window.endsAt,
      })),
      cooldownMinutes: values.temporalRoutine.cooldownMinutes,
    },
    safetyThresholds: values.safetyThresholds,
    contentAffinities: {
      primaryTopics: values.contentAffinities.primaryTopics.map((topic) => ({
        topic: topic.topic.trim(),
        weight: topic.weight,
      })),
      secondaryTopics: values.contentAffinities.secondaryTopics.map((topic) => ({
        topic: topic.topic.trim(),
        weight: topic.weight,
      })),
      interactionWeights: values.contentAffinities.interactionWeights,
    },
  };
}

function toNetworkContextConfiguration(
  values: ProfileConfigurationFormValues["networkContext"],
): NetworkContextConfiguration {
  if (values.proxyMode === "none") {
    return {
      proxy: null,
      killswitch: {
        enabled: values.killswitchEnabled,
        failClosed: values.killswitchFailClosed,
      },
    };
  }

  const username = cleanOptionalText(values.username);
  const password = cleanOptionalText(values.password);
  const countryCode = cleanOptionalText(values.countryCode);
  const region = cleanOptionalText(values.region);

  return {
    proxy: {
      protocol: values.protocol,
      host: values.host.trim(),
      port: values.port,
      credentials:
        username !== undefined && password !== undefined
          ? { username, password }
          : null,
      ...(countryCode !== undefined ? { countryCode } : {}),
      ...(region !== undefined ? { region } : {}),
    },
    killswitch: {
      enabled: values.killswitchEnabled,
      failClosed: values.killswitchFailClosed,
    },
  };
}

function createDefaultActiveWindow(): {
  readonly days: number[];
  readonly startsAt: string;
  readonly endsAt: string;
} {
  return {
    days: [...dayValues],
    startsAt: "00:00",
    endsAt: "23:59",
  };
}

function createDefaultTopic(): { readonly topic: string; readonly weight: number } {
  return {
    topic: "knowledge",
    weight: 1,
  };
}

function createDefaultSecondaryTopic(): {
  readonly topic: string;
  readonly weight: number;
} {
  return {
    topic: "video",
    weight: 0.5,
  };
}

function cleanOptionalText(value: string): string | undefined {
  const trimmed = value.trim();

  return trimmed.length > 0 ? trimmed : undefined;
}

function withDefault(value: string, fallback: string): string {
  const trimmed = value.trim();

  return trimmed.length > 0 ? trimmed : fallback;
}

function nonZeroDefault(value: number, fallback: number): number {
  return value > 0 ? value : fallback;
}

function asProxyProtocol(value: string): ProxyProtocol {
  return ProxyProtocolSchema.safeParse(value).success
    ? (value as ProxyProtocol)
    : "HTTPS";
}

function asScrollStyle(value: string): ScrollStyle {
  return ScrollStyleSchema.safeParse(value).success
    ? (value as ScrollStyle)
    : "STEADY";
}

function asChronotype(value: string): Chronotype {
  return ChronotypeSchema.safeParse(value).success
    ? (value as Chronotype)
    : "MORNING";
}

const defaultUserAgent =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36";
