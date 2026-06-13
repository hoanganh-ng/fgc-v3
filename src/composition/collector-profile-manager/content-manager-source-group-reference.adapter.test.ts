import { describe, expect, it } from "vitest";
import { SourceGroupNotFoundError } from "../../content-manager/application";
import type { GetSourceGroupInput } from "../../content-manager/application";
import type { SourceGroup } from "../../content-manager/domain";
import { ContentManagerSourceGroupReferenceAdapter } from "./content-manager-source-group-reference.adapter";

describe("ContentManagerSourceGroupReferenceAdapter", () => {
  it("reports true when the safe Content Manager source group query finds a group", async () => {
    const getSourceGroup = new FakeGetSourceGroupUseCase({} as SourceGroup);
    const adapter = new ContentManagerSourceGroupReferenceAdapter(
      getSourceGroup,
    );

    await expect(adapter.exists("source-group-1")).resolves.toBe(true);
    expect(getSourceGroup.calls).toEqual([
      {
        sourceGroupId: "source-group-1",
      },
    ]);
  });

  it("reports false when the safe Content Manager query returns not found", async () => {
    const getSourceGroup = new FakeGetSourceGroupUseCase({} as SourceGroup);
    const adapter = new ContentManagerSourceGroupReferenceAdapter(
      getSourceGroup,
    );

    getSourceGroup.setError(new SourceGroupNotFoundError("missing-group"));

    await expect(adapter.exists("missing-group")).resolves.toBe(false);
  });

  it("preserves unexpected Content Manager query failures", async () => {
    const getSourceGroup = new FakeGetSourceGroupUseCase({} as SourceGroup);
    const adapter = new ContentManagerSourceGroupReferenceAdapter(
      getSourceGroup,
    );
    const error = new Error("database unavailable");

    getSourceGroup.setError(error);

    await expect(adapter.exists("source-group-1")).rejects.toBe(error);
  });
});

class FakeGetSourceGroupUseCase {
  public readonly calls: GetSourceGroupInput[] = [];
  private error: unknown;

  public constructor(private readonly output: SourceGroup) {}

  public setError(error: unknown): void {
    this.error = error;
  }

  public async execute(input: GetSourceGroupInput): Promise<SourceGroup> {
    this.calls.push(input);

    if (this.error !== undefined) {
      throw this.error;
    }

    return this.output;
  }
}
