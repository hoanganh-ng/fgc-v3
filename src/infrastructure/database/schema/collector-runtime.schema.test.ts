import { describe, expect, it } from "vitest";
import {
  accountExerciseRunStatusEnum,
  accountExerciseTypeEnum,
  collectionRunStatusEnum,
  collectionRunTriggerTypeEnum,
  collectorAccountExerciseRuns,
  collectorCollectionRuns,
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
    expect(accountExerciseTypeEnum.enumValues).toEqual(["AMBIENT_ACCOUNT"]);
  });
});
