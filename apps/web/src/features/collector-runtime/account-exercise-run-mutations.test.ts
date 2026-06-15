import { describe, expect, it } from "vitest";
import { invalidateAccountExerciseRunQueries } from "@/features/collector-runtime/account-exercise-run-mutations";
import { accountExerciseRunQueryKeys } from "@/features/collector-runtime/account-exercise-run-queries";

describe("account-exercise-run mutations", () => {
  it("invalidates account exercise run queries after mutations", async () => {
    const calls: unknown[] = [];

    await invalidateAccountExerciseRunQueries({
      async invalidateQueries(filters) {
        calls.push(filters);
      },
    });

    expect(calls).toEqual([
      {
        queryKey: accountExerciseRunQueryKeys.all,
      },
    ]);
  });
});
