import { InvalidProfileSourceAccessCheckRunStatusTransitionError } from "../application-errors";
import type { Clock } from "../ports/clock.port";
import type {
  ProfileSourceAccessBrowserCheckPort,
  ProfileSourceAccessMutationPort,
  ProfileSourceAccessOutcomeClassifierPort,
} from "../ports/profile-source-access-check-execution.port";
import { ProfileSourceAccessBrowserObservationSchema } from "../ports/profile-source-access-check-execution.port";
import type { ProfileSourceAccessCheckRunRepository } from "../ports/profile-source-access-check-run-repository.port";
import {
  loadValidatedProfileSourceAccessCheckRunById,
  toProfileSourceAccessCheckRunIsoDateTime,
  validateProfileSourceAccessCheckRunFailureReasonForApplication,
  validateProfileSourceAccessCheckRunForApplication,
  validateProfileSourceAccessCheckRunOutcomeForApplication,
} from "../profile-source-access-check-run-validation";
import type {
  ProfileSourceAccessCheckRun,
  ProfileSourceAccessCheckRunFailureReason,
  ProfileSourceAccessCheckRunId,
} from "../../domain";

export interface ExecuteProfileSourceAccessCheckRunInput {
  readonly checkRunId: ProfileSourceAccessCheckRunId;
  readonly abortSignal?: AbortSignal;
}

export class ExecuteProfileSourceAccessCheckRunUseCase {
  public constructor(
    private readonly checkRuns: ProfileSourceAccessCheckRunRepository,
    private readonly browserCheck: ProfileSourceAccessBrowserCheckPort,
    private readonly classifier: ProfileSourceAccessOutcomeClassifierPort,
    private readonly mutation: ProfileSourceAccessMutationPort,
    private readonly clock: Clock,
  ) {}

  public async execute(
    input: ExecuteProfileSourceAccessCheckRunInput,
  ): Promise<ProfileSourceAccessCheckRun> {
    const checkRun = await loadValidatedProfileSourceAccessCheckRunById(
      this.checkRuns,
      input.checkRunId,
    );

    if (checkRun.status !== "RUNNING") {
      throw new InvalidProfileSourceAccessCheckRunStatusTransitionError(
        checkRun.status,
        "SUCCEEDED",
      );
    }

    const browserResult = await executeBrowserCheckSafely(
      this.browserCheck,
      checkRun,
      input.abortSignal,
    );

    if (!browserResult.ok) {
      return this.failRun(checkRun, browserResult.failureReason);
    }

    const observationResult = validateObservationSafely(
      browserResult.observation,
    );

    if (!observationResult.ok) {
      return this.failRun(checkRun, observationResult.failureReason);
    }

    const outcomeResult = await classifySafely(
      this.classifier,
      observationResult.observation,
    );

    if (!outcomeResult.ok) {
      return this.failRun(checkRun, outcomeResult.failureReason);
    }

    const mutationResult = await mutateSafely(this.mutation, {
      profileId: checkRun.profileId,
      sourceGroupId: checkRun.sourceGroupId,
      outcome: outcomeResult.outcome,
    });

    if (!mutationResult.ok) {
      return this.failRun(checkRun, mutationResult.failureReason);
    }

    const now = toProfileSourceAccessCheckRunIsoDateTime(this.clock.now());
    const outcome = validateProfileSourceAccessCheckRunOutcomeForApplication(
      outcomeResult.outcome,
    );
    const { failureReason: _failureReason, ...checkRunWithoutFailureReason } =
      checkRun;
    const succeeded = validateProfileSourceAccessCheckRunForApplication({
      ...checkRunWithoutFailureReason,
      status: "SUCCEEDED",
      outcome,
      finishedAt: now,
      updatedAt: now,
    });

    await this.checkRuns.save(succeeded);

    return succeeded;
  }

  private async failRun(
    checkRun: ProfileSourceAccessCheckRun,
    failureReason: ProfileSourceAccessCheckRunFailureReason,
  ): Promise<ProfileSourceAccessCheckRun> {
    const now = toProfileSourceAccessCheckRunIsoDateTime(this.clock.now());
    const validFailureReason =
      validateProfileSourceAccessCheckRunFailureReasonForApplication(
        failureReason,
      );
    const { outcome: _outcome, ...checkRunWithoutOutcome } = checkRun;
    const failed = validateProfileSourceAccessCheckRunForApplication({
      ...checkRunWithoutOutcome,
      status: "FAILED",
      failureReason: validFailureReason,
      finishedAt: now,
      updatedAt: now,
    });

    await this.checkRuns.save(failed);

    return failed;
  }
}

async function executeBrowserCheckSafely(
  browserCheck: ProfileSourceAccessBrowserCheckPort,
  checkRun: ProfileSourceAccessCheckRun,
  abortSignal: AbortSignal | undefined,
) {
  try {
    const input = {
      checkRunId: checkRun.id,
      profileId: checkRun.profileId,
      sourceGroupId: checkRun.sourceGroupId,
      target: checkRun.target,
    };

    const result = await browserCheck.check({
      ...input,
      ...(abortSignal === undefined ? {} : { abortSignal }),
    });

    if (!result.ok) {
      return {
        ok: false as const,
        failureReason: sanitizeFailureReason(
          result.failureReason,
          "ACCESS_CHECK_BROWSER_FAILED",
          "Profile-source access browser check failed.",
        ),
      };
    }

    return result;
  } catch {
    return {
      ok: false as const,
      failureReason: {
        code: "ACCESS_CHECK_BROWSER_FAILED",
        message: "Profile-source access browser check failed.",
      },
    };
  }
}

function sanitizeFailureReason(
  failureReason: ProfileSourceAccessCheckRunFailureReason,
  fallbackCode: string,
  message: string,
): ProfileSourceAccessCheckRunFailureReason {
  const trimmedCode = failureReason.code.trim();
  const code = /^[A-Z0-9_]+$/.test(trimmedCode) ? trimmedCode : fallbackCode;

  return {
    code,
    message,
  };
}

function validateObservationSafely(observation: unknown) {
  const result = ProfileSourceAccessBrowserObservationSchema.safeParse(observation);

  if (result.success) {
    return {
      ok: true as const,
      observation: result.data,
    };
  }

  return {
    ok: false as const,
    failureReason: {
      code: "ACCESS_CHECK_OBSERVATION_INVALID",
      message: "Profile-source access browser check observation is invalid.",
    },
  };
}

async function classifySafely(
  classifier: ProfileSourceAccessOutcomeClassifierPort,
  observation: Parameters<ProfileSourceAccessOutcomeClassifierPort["classify"]>[0],
) {
  try {
    return {
      ok: true as const,
      outcome: validateProfileSourceAccessCheckRunOutcomeForApplication(
        await classifier.classify(observation),
      ),
    };
  } catch {
    return {
      ok: false as const,
      failureReason: {
        code: "ACCESS_CHECK_CLASSIFICATION_FAILED",
        message: "Profile-source access classification failed.",
      },
    };
  }
}

async function mutateSafely(
  mutation: ProfileSourceAccessMutationPort,
  input: Parameters<ProfileSourceAccessMutationPort["applyOutcome"]>[0],
) {
  try {
    return await mutation.applyOutcome(input);
  } catch {
    return {
      ok: false as const,
      failureReason: {
        code: "ACCESS_CHECK_MUTATION_FAILED",
        message: "Profile-source access mutation failed.",
      },
    };
  }
}
