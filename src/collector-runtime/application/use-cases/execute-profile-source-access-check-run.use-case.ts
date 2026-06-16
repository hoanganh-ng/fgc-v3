import { InvalidProfileSourceAccessCheckRunStatusTransitionError } from "../application-errors";
import type { Clock } from "../ports/clock.port";
import type {
  ProfileSourceAccessBrowserCheckPort,
  ProfileSourceAccessMutationPort,
  ProfileSourceAccessOutcomeClassifierPort,
} from "../ports/profile-source-access-check-execution.port";
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
    );

    if (!browserResult.ok) {
      return this.failRun(checkRun, browserResult.failureReason);
    }

    const outcomeResult = await classifySafely(
      this.classifier,
      browserResult.observation,
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
) {
  try {
    return await browserCheck.check({
      checkRunId: checkRun.id,
      profileId: checkRun.profileId,
      sourceGroupId: checkRun.sourceGroupId,
      target: checkRun.target,
    });
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
