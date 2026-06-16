import { describe, expect, it } from "vitest";
import { ProfileManagerHttpProfileSourceAccessMutationAdapter } from "./profile-source-access-mutation-adapter";
import type {
  UpsertProfileSourceAccessInput,
  UpsertProfileSourceAccessResult,
} from "./profile-manager-http-client";

describe("profile-source access mutation adapter", () => {
  it("maps inconclusive outcomes to manual-review source access failure", async () => {
    const client = new FakeProfileSourceAccessClient();

    const result = await new ProfileManagerHttpProfileSourceAccessMutationAdapter(
      client,
    ).applyOutcome({
      profileId: "profile-1",
      sourceGroupId: "source-group-1",
      outcome: "NEEDS_MANUAL_REVIEW",
    });

    expect(result).toEqual({ ok: true });
    expect(client.calls).toEqual([
      {
        profileId: "profile-1",
        sourceGroupId: "source-group-1",
        accessState: "NEEDS_MANUAL_REVIEW",
        lastFailureReason: {
          code: "ACCESS_CHECK_INCONCLUSIVE",
          message: "Automated source access check was inconclusive.",
        },
      },
    ]);
  });

  it("fails safely when the Profile Manager response does not match the request", async () => {
    const client = new FakeProfileSourceAccessClient();
    client.result = {
      ok: true,
      profileId: "different-profile",
      sourceGroupId: "source-group-1",
      accessState: "PUBLIC_ACCESSIBLE",
    };

    const result = await new ProfileManagerHttpProfileSourceAccessMutationAdapter(
      client,
    ).applyOutcome({
      profileId: "profile-1",
      sourceGroupId: "source-group-1",
      outcome: "PUBLIC_ACCESSIBLE",
    });

    expect(result).toEqual({
      ok: false,
      failureReason: {
        code: "ACCESS_CHECK_MUTATION_RESPONSE_INVALID",
        message: "Profile-source access mutation response was invalid.",
      },
    });
  });
});

class FakeProfileSourceAccessClient {
  public readonly calls: UpsertProfileSourceAccessInput[] = [];
  public result: UpsertProfileSourceAccessResult | undefined;

  public async upsertProfileSourceAccess(
    input: UpsertProfileSourceAccessInput,
  ): Promise<UpsertProfileSourceAccessResult> {
    this.calls.push(input);
    return (
      this.result ?? {
        ok: true,
        profileId: input.profileId,
        sourceGroupId: input.sourceGroupId,
        accessState: input.accessState,
      }
    );
  }
}
