import { describe, expect, it } from "vitest";
import {
  collectionRunStatusEnum,
  collectionRunTriggerTypeEnum,
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

  it("keeps database enum values aligned with the collection run model", () => {
    expect(collectionRunStatusEnum.enumValues).toEqual([
      "QUEUED",
      "RUNNING",
      "SUCCEEDED",
      "FAILED",
      "CANCELED",
    ]);
    expect(collectionRunTriggerTypeEnum.enumValues).toEqual(["MANUAL_API"]);
  });
});
