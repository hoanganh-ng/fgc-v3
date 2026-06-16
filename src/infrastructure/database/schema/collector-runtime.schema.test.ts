import { describe, expect, it } from "vitest";
import {
  accountExerciseRunStatusEnum,
  accountExerciseTypeEnum,
  collectionRunStatusEnum,
  collectionRunTriggerTypeEnum,
  collectorAccountExerciseRuns,
  collectorCollectionRuns,
  collectorProfileSourceAccessCheckRuns,
  profileSourceAccessCheckRunStatusEnum,
  profileSourceAccessCheckRunTriggerTypeEnum,
} from "./collector-runtime.schema";

describe("collector runtime database schema", () => {
  it("exports collection run table metadata for migration generation", () => {
    expect(collectorCollectionRuns.id.name).toBe("id");
    expect(collectorCollectionRuns.sourceGroupId.name).toBe("source_group_id");
    expect(collectorCollectionRuns.parameters.name).toBe("parameters");
    expect(collectorCollectionRuns.failureReason.name).toBe("failure_reason");
    expect(collectorCollectionRuns.requestedAt.name).toBe("requested_at");
  });

  it("exports account exercise run table metadata for migration generation", () => {
    expect(collectorAccountExerciseRuns.id.name).toBe("id");
    expect(collectorAccountExerciseRuns.profileId.name).toBe("profile_id");
    expect(collectorAccountExerciseRuns.leaseId.name).toBe("lease_id");
    expect(collectorAccountExerciseRuns.exerciseType.name).toBe(
      "exercise_type",
    );
    expect(collectorAccountExerciseRuns.stageAtStart.name).toBe(
      "stage_at_start",
    );
    expect(collectorAccountExerciseRuns.actionBudget.name).toBe(
      "action_budget",
    );
    expect(collectorAccountExerciseRuns.safeSummary.name).toBe("safe_summary");
  });

  it("exports profile-source access check run table metadata for migration generation", () => {
    expect(collectorProfileSourceAccessCheckRuns.id.name).toBe("id");
    expect(collectorProfileSourceAccessCheckRuns.profileId.name).toBe("profile_id");
    expect(collectorProfileSourceAccessCheckRuns.sourceGroupId.name).toBe("source_group_id");
    expect(collectorProfileSourceAccessCheckRuns.accountStageAtRequest.name).toBe(
      "account_stage_at_request",
    );
    expect(collectorProfileSourceAccessCheckRuns.target.name).toBe("target");
    expect(collectorProfileSourceAccessCheckRuns.failureReason.name).toBe(
      "failure_reason",
    );
  });

  it("keeps database enum values aligned with the collection run model", () => {
    expect(collectionRunStatusEnum.enumValues).toEqual([
      "QUEUED",
      "RUNNING",
      "SUCCEEDED",
      "FAILED",
      "CANCELED",
    ]);
    expect(collectionRunTriggerTypeEnum.enumValues).toEqual(["MANUAL_API"]);
    expect(accountExerciseRunStatusEnum.enumValues).toEqual([
      "QUEUED",
      "RUNNING",
      "SUCCEEDED",
      "FAILED",
      "CANCELED",
    ]);
    expect(accountExerciseTypeEnum.enumValues).toEqual([
      "AMBIENT_ACCOUNT",
      "CATEGORY_BROWSE",
    ]);
    expect(profileSourceAccessCheckRunStatusEnum.enumValues).toEqual([
      "QUEUED",
      "RUNNING",
      "SUCCEEDED",
      "FAILED",
      "CANCELED",
    ]);
    expect(profileSourceAccessCheckRunTriggerTypeEnum.enumValues).toEqual([
      "MANUAL",
    ]);
  });
});
