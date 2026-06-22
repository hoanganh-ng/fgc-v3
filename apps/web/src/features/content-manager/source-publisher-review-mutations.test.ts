import { describe, expect, it, vi } from "vitest";
import {
  invalidateContentManagerQueries,
  promoteSourcePublisherToSourceGroup,
  updateSourcePublisherStatus,
} from "@/features/content-manager/content-manager-mutations";
import { contentManagerQueryKeys } from "@/features/content-manager/content-manager-queries";
import type {
  PromoteSourcePublisherToSourceGroupRequest,
  PromoteSourcePublisherToSourceGroupResponse,
  SourcePublisherResponse,
} from "@/lib/api/content-manager-client";

const mocks = vi.hoisted(() => ({
  updateSourcePublisherStatus: vi.fn(async () => {
    const response: SourcePublisherResponse = {
      sourcePublisher: {
        id: "source-publisher-1",
        platform: "FACEBOOK",
        kind: "GROUP",
        externalPublisherId: "fb-group-1",
        displayName: "Publisher Group",
        canonicalUrl: "https://facebook.test/groups/fb-group-1",
        status: "APPROVED",
        firstObservedAt: "2026-06-18T10:00:00.000Z",
        lastObservedAt: "2026-06-18T10:00:00.000Z",
        observationCount: 2,
        createdAt: "2026-06-18T10:00:00.000Z",
        updatedAt: "2026-06-18T10:00:00.000Z",
      },
    };
    return { ok: true as const, data: response };
  }),
  promoteSourcePublisherToSourceGroup: vi.fn(
    async (
      _sourcePublisherId: string,
      _request: PromoteSourcePublisherToSourceGroupRequest,
    ) => {
      const response: PromoteSourcePublisherToSourceGroupResponse = {
        sourceGroup: {
          id: "source-group-1",
          platform: "FACEBOOK",
          externalGroupId: "fb-group-1",
          name: "Publisher Group",
          url: "https://facebook.test/groups/fb-group-1",
          categoryId: "category-1",
          status: "PAUSED",
          collectionPriority: 50,
          entryRoutes: [],
          createdAt: "2026-06-18T10:00:00.000Z",
          updatedAt: "2026-06-18T10:00:00.000Z",
        },
        promotion: { outcome: "CREATED" },
      };
      return { ok: true as const, data: response };
    },
  ),
}));

vi.mock("@/lib/api/content-manager-client", async (importOriginal) => {
  const actual =
    (await importOriginal()) as typeof import("@/lib/api/content-manager-client");
  return {
    ...actual,
    contentManagerClient: {
      listContentCategories: vi.fn(),
      createContentCategory: vi.fn(),
      listSourceGroups: vi.fn(),
      createSourceGroup: vi.fn(),
      updateSourceGroupStatus: vi.fn(),
      createSourceGroupEntryRoute: vi.fn(),
      updateSourceGroupEntryRoute: vi.fn(),
      removeSourceGroupEntryRoute: vi.fn(),
      listSourcePublishers: vi.fn(),
      getSourcePublisher: vi.fn(),
      updateSourcePublisherStatus: mocks.updateSourcePublisherStatus,
      promoteSourcePublisherToSourceGroup:
        mocks.promoteSourcePublisherToSourceGroup,
      listContentItems: vi.fn(),
      getContentItem: vi.fn(),
      updateContentItemStatus: vi.fn(),
      ingestHomeFeedCollectedContent: vi.fn(),
    },
  };
});

describe("source publisher review mutation helpers", () => {
  it("updateSourcePublisherStatus calls the production client", async () => {
    const result = await updateSourcePublisherStatus({
      sourcePublisherId: "source-publisher-1",
      status: "APPROVED",
    });

    expect(mocks.updateSourcePublisherStatus).toHaveBeenCalledWith(
      "source-publisher-1",
      "APPROVED",
    );
    expect(result.sourcePublisher.status).toBe("APPROVED");
  });

  it("promoteSourcePublisherToSourceGroup calls the production client", async () => {
    const request = {
      categoryId: "category-1",
      collectionPriority: 50,
      name: "Publisher Group",
    } satisfies PromoteSourcePublisherToSourceGroupRequest;
    const result = await promoteSourcePublisherToSourceGroup({
      sourcePublisherId: "source-publisher-1",
      request,
    });

    expect(mocks.promoteSourcePublisherToSourceGroup).toHaveBeenCalledWith(
      "source-publisher-1",
      request,
    );
    expect(result.promotion.outcome).toBe("CREATED");
  });

  it("invalidateContentManagerQueries invalidates the content manager root key", async () => {
    const calls: unknown[] = [];

    await invalidateContentManagerQueries({
      async invalidateQueries(filters) {
        calls.push(filters);
      },
    });

    expect(calls).toEqual([{ queryKey: contentManagerQueryKeys.all }]);
  });
});
