import type {
  ProfileSourceAccessReportableState,
  UpsertProfileSourceAccessResult,
} from "../../collector-runtime/infrastructure";
import { ProfileManagerHttpClient } from "../../collector-runtime/infrastructure";
import type { AssistedGroupAccessCliArgs } from "./cli-args";
import {
  runAssistedAccessCommand,
  type AssistedAccessCommandError,
  type AssistedAccessCommandResult,
  type AssistedAccessDependencies,
  type AssistedAccessLogger,
} from "./assisted-access-runner";

export type AssistedAccessOutcomeSelection =
  | ProfileSourceAccessReportableState
  | "SKIP";

export type AssistedAccessOutcomePromptResult =
  | AssistedAccessOutcomeSelection
  | "ABORTED";

export interface AssistedAccessOutcomePromptPort {
  promptOutcome(input: {
    readonly profileId: string;
    readonly sourceGroupId: string;
    readonly abortSignal?: AbortSignal;
  }): Promise<AssistedAccessOutcomePromptResult>;
}

export interface ProfileSourceAccessOutcomeReporterPort {
  reportOutcome(input: {
    readonly profileId: string;
    readonly sourceGroupId: string;
    readonly outcome: ProfileSourceAccessReportableState;
  }): Promise<UpsertProfileSourceAccessResult>;
}

export interface AssistedAccessWorkflowDependencies {
  readonly assistedAccess?: AssistedAccessDependencies;
  readonly outcomePrompt?: AssistedAccessOutcomePromptPort;
  readonly outcomeReporter?: ProfileSourceAccessOutcomeReporterPort;
}

export interface RunAssistedAccessWorkflowInput {
  readonly args: AssistedGroupAccessCliArgs;
  readonly logger?: AssistedAccessLogger;
  readonly abortSignal?: AbortSignal;
  readonly dependencies?: AssistedAccessWorkflowDependencies;
  readonly now?: () => Date;
}

export interface AssistedAccessWorkflowResult {
  readonly ok: boolean;
  readonly session: AssistedAccessCommandResult;
  readonly reporting:
    | {
        readonly status: "NOT_ELIGIBLE";
      }
    | {
        readonly status: "SKIPPED";
      }
    | {
        readonly status: "ABORTED";
      }
    | {
        readonly status: "SUCCEEDED";
        readonly outcome: ProfileSourceAccessReportableState;
      }
    | {
        readonly status: "FAILED";
        readonly outcome: ProfileSourceAccessReportableState;
        readonly error: AssistedAccessCommandError;
      };
  readonly errors: readonly AssistedAccessCommandError[];
}

export const REPORTABLE_ASSISTED_ACCESS_OUTCOMES = [
  "PUBLIC_ACCESSIBLE",
  "JOIN_REQUIRED",
  "JOINED_ACCESSIBLE",
  "ACCESS_DENIED",
  "LOGIN_REQUIRED",
  "CHECKPOINT_REQUIRED",
] as const;

export async function runAssistedAccessWorkflow(
  input: RunAssistedAccessWorkflowInput,
): Promise<AssistedAccessWorkflowResult> {
  const logger = input.logger ?? { info() {} };
  const session = await runAssistedAccessCommand({
    args: input.args,
    logger,
    ...(input.abortSignal !== undefined ? { abortSignal: input.abortSignal } : {}),
    ...(input.dependencies?.assistedAccess !== undefined
      ? { dependencies: input.dependencies.assistedAccess }
      : {}),
    ...(input.now !== undefined ? { now: input.now } : {}),
  });
  const errors = [...session.errors];

  if (!isOutcomeReportingEligible(session)) {
    logger.info("Profile-source access outcome reporting not eligible.");
    return {
      ok: session.ok,
      session,
      reporting: {
        status: "NOT_ELIGIBLE",
      },
      errors,
    };
  }

  const outcomePrompt =
    input.dependencies?.outcomePrompt ?? createUnavailableOutcomePrompt();
  const selection = await outcomePrompt.promptOutcome({
    profileId: session.profileId,
    sourceGroupId: session.sourceGroupId,
    ...(input.abortSignal !== undefined ? { abortSignal: input.abortSignal } : {}),
  });

  if (selection === "ABORTED") {
    logger.info("Profile-source access outcome reporting aborted.");
    return {
      ok: false,
      session,
      reporting: {
        status: "ABORTED",
      },
      errors,
    };
  }

  if (selection === "SKIP") {
    logger.info("Profile-source access outcome reporting skipped.");
    return {
      ok: session.ok,
      session,
      reporting: {
        status: "SKIPPED",
      },
      errors,
    };
  }

  logger.info(`Reporting profile-source access outcome ${selection}.`);

  const outcomeReporter =
    input.dependencies?.outcomeReporter ??
    new ProfileManagerOutcomeReporter(
      new ProfileManagerHttpClient({ baseUrl: input.args.baseUrl }),
    );
  const reportResult = await outcomeReporter.reportOutcome({
    profileId: session.profileId,
    sourceGroupId: session.sourceGroupId,
    outcome: selection,
  });

  if (!reportResult.ok) {
    const error = toReportingCommandError(reportResult);
    errors.push(error);
    logger.error?.(
      `Profile-source access outcome reporting failed (${error.causeCode ?? error.code}).`,
    );

    return {
      ok: false,
      session,
      reporting: {
        status: "FAILED",
        outcome: selection,
        error,
      },
      errors,
    };
  }

  logger.info("Profile-source access outcome reporting succeeded.");

  return {
    ok: session.ok,
    session,
    reporting: {
      status: "SUCCEEDED",
      outcome: selection,
    },
    errors,
  };
}

export function createProfileSourceAccessOutcomeRequest(
  outcome: ProfileSourceAccessReportableState,
): {
  readonly accessState: ProfileSourceAccessReportableState;
  readonly lastFailureReason: {
    readonly code: string;
    readonly message: string;
  } | null;
} {
  switch (outcome) {
    case "PUBLIC_ACCESSIBLE":
    case "JOINED_ACCESSIBLE":
      return {
        accessState: outcome,
        lastFailureReason: null,
      };
    case "JOIN_REQUIRED":
      return {
        accessState: outcome,
        lastFailureReason: {
          code: "JOIN_REQUIRED",
          message: "Operator observed that group membership is required.",
        },
      };
    case "ACCESS_DENIED":
      return {
        accessState: outcome,
        lastFailureReason: {
          code: "ACCESS_DENIED",
          message: "Operator observed that access was denied.",
        },
      };
    case "LOGIN_REQUIRED":
      return {
        accessState: outcome,
        lastFailureReason: {
          code: "LOGIN_REQUIRED",
          message: "Operator observed that login is required.",
        },
      };
    case "CHECKPOINT_REQUIRED":
      return {
        accessState: outcome,
        lastFailureReason: {
          code: "CHECKPOINT_REQUIRED",
          message: "Operator observed that a checkpoint is required.",
        },
      };
  }
}

export function parseAssistedAccessOutcomeSelection(
  rawInput: string | undefined,
): AssistedAccessOutcomeSelection | undefined {
  if (rawInput === undefined) {
    return "SKIP";
  }

  const normalized = rawInput.trim();

  if (normalized.length === 0) {
    return undefined;
  }

  if (normalized.toUpperCase() === "S" || normalized.toUpperCase() === "SKIP") {
    return "SKIP";
  }

  const byNumber = Number.parseInt(normalized, 10);

  if (
    String(byNumber) === normalized &&
    byNumber >= 1 &&
    byNumber <= REPORTABLE_ASSISTED_ACCESS_OUTCOMES.length
  ) {
    return REPORTABLE_ASSISTED_ACCESS_OUTCOMES[byNumber - 1];
  }

  const byName = REPORTABLE_ASSISTED_ACCESS_OUTCOMES.find(
    (outcome) => outcome.toLowerCase() === normalized.toLowerCase(),
  );

  return byName;
}

export async function promptForAssistedAccessOutcome(input: {
  readonly writeLine: (message: string) => void;
  readonly readLine: () => Promise<string | undefined>;
}): Promise<AssistedAccessOutcomeSelection> {
  for (;;) {
    writeOutcomeMenu(input.writeLine);
    const selection = parseAssistedAccessOutcomeSelection(await input.readLine());

    if (selection !== undefined) {
      return selection;
    }

    input.writeLine("Invalid selection. Choose a number, state name, or S.");
  }
}

function isOutcomeReportingEligible(
  session: AssistedAccessCommandResult,
): boolean {
  return session.pageLoaded && session.completionReason === "OPERATOR_COMPLETED";
}

class ProfileManagerOutcomeReporter
  implements ProfileSourceAccessOutcomeReporterPort
{
  public constructor(private readonly client: ProfileManagerHttpClient) {}

  public async reportOutcome(input: {
    readonly profileId: string;
    readonly sourceGroupId: string;
    readonly outcome: ProfileSourceAccessReportableState;
  }): Promise<UpsertProfileSourceAccessResult> {
    return this.client.upsertProfileSourceAccess({
      profileId: input.profileId,
      sourceGroupId: input.sourceGroupId,
      ...createProfileSourceAccessOutcomeRequest(input.outcome),
    });
  }
}

function writeOutcomeMenu(writeLine: (message: string) => void): void {
  writeLine("Select observed profile-source access outcome:");
  writeLine("1. PUBLIC_ACCESSIBLE");
  writeLine("2. JOIN_REQUIRED");
  writeLine("3. JOINED_ACCESSIBLE");
  writeLine("4. ACCESS_DENIED");
  writeLine("5. LOGIN_REQUIRED");
  writeLine("6. CHECKPOINT_REQUIRED");
  writeLine("S. Skip without updating");
}

function createUnavailableOutcomePrompt(): AssistedAccessOutcomePromptPort {
  return {
    async promptOutcome() {
      throw new Error("Assisted access outcome prompt adapter is required.");
    },
  };
}

function toReportingCommandError(result: {
  readonly statusCode?: number;
  readonly errorCode: string;
  readonly errorMessage: string;
}): AssistedAccessCommandError {
  return {
    code: "PROFILE_SOURCE_ACCESS_REPORT_FAILED",
    message: "Profile-source access outcome could not be reported.",
    causeCode: sanitizeFailureCode(result.errorCode),
    ...(result.statusCode !== undefined ? { statusCode: result.statusCode } : {}),
  };
}

function sanitizeFailureCode(code: string | undefined): string {
  const normalizedCode = code?.trim().toUpperCase();

  if (
    normalizedCode !== undefined &&
    /^[A-Z0-9_]+$/.test(normalizedCode) &&
    normalizedCode.length <= 80
  ) {
    return normalizedCode;
  }

  return "UNKNOWN_FAILURE";
}
