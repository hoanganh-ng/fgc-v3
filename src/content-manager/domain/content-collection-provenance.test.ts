import { describe, expect, it } from "vitest";
import { ZodError } from "zod";
import {
  CollectedContentProvenanceInputSchema,
  CollectionSurfaceSchema,
  ContentCollectionProvenanceSchema,
  ContentCollectionProvenanceConflictError,
  createInitialContentCollectionProvenance,
  mergeContentCollectionProvenance,
  collectionSurfaceEquals,
  isProfileHomeFeedCollectionSurface,
  isSourceGroupCollectionSurface,
  parseCollectedContentProvenanceInput,
  parseContentCollectionProvenance,
  validateCollectedContentProvenanceInput,
  validateContentCollectionProvenance,
} from "./index";
import type {
  CollectedContentProvenanceInput,
  CollectionSurface,
  ContentCollectionProvenance,
  ProfileHomeFeedCollectionSurface,
  SourceGroupCollectionSurface,
} from "./index";

const SOURCE_GROUP_SURFACE: SourceGroupCollectionSurface = {
  kind: "SOURCE_GROUP",
  sourceGroupId: "source-group-1",
};

const OTHER_SOURCE_GROUP_SURFACE: SourceGroupCollectionSurface = {
  kind: "SOURCE_GROUP",
  sourceGroupId: "source-group-2",
};

const PROFILE_HOME_FEED_SURFACE: ProfileHomeFeedCollectionSurface = {
  kind: "PROFILE_HOME_FEED",
};

function createSourceGroupInput(
  overrides: Partial<CollectedContentProvenanceInput> = {},
): CollectedContentProvenanceInput {
  return {
    collectionSurface: SOURCE_GROUP_SURFACE,
    managedSourceGroupId: SOURCE_GROUP_SURFACE.sourceGroupId,
    ...overrides,
  };
}

function createProfileHomeFeedInput(
  overrides: Partial<CollectedContentProvenanceInput> = {},
): CollectedContentProvenanceInput {
  return {
    collectionSurface: PROFILE_HOME_FEED_SURFACE,
    ...overrides,
  };
}

describe("content collection provenance schemas", () => {
  it("accepts a SOURCE_GROUP collection surface", () => {
    const result = CollectionSurfaceSchema.safeParse(SOURCE_GROUP_SURFACE);

    expect(result.success).toBe(true);
  });

  it("accepts a PROFILE_HOME_FEED collection surface", () => {
    const result = CollectionSurfaceSchema.safeParse(PROFILE_HOME_FEED_SURFACE);

    expect(result.success).toBe(true);
  });

  it("rejects an unknown collection surface kind", () => {
    const result = CollectionSurfaceSchema.safeParse({
      kind: "UNKNOWN",
    });

    expect(result.success).toBe(false);
  });

  it("rejects a SOURCE_GROUP surface missing sourceGroupId", () => {
    const result = CollectionSurfaceSchema.safeParse({ kind: "SOURCE_GROUP" });

    expect(result.success).toBe(false);
  });

  it("rejects a SOURCE_GROUP surface with blank sourceGroupId", () => {
    const result = CollectionSurfaceSchema.safeParse({
      kind: "SOURCE_GROUP",
      sourceGroupId: "   ",
    });

    expect(result.success).toBe(false);
  });

  it("rejects a PROFILE_HOME_FEED surface carrying a profile id", () => {
    const result = CollectionSurfaceSchema.safeParse({
      kind: "PROFILE_HOME_FEED",
      profileId: "profile-1",
    });

    expect(result.success).toBe(false);
  });

  it("rejects a PROFILE_HOME_FEED surface carrying a source group id", () => {
    const result = CollectionSurfaceSchema.safeParse({
      kind: "PROFILE_HOME_FEED",
      sourceGroupId: "source-group-1",
    });

    expect(result.success).toBe(false);
  });

  it("rejects unknown fields on the input schema", () => {
    const result = CollectedContentProvenanceInputSchema.safeParse({
      ...createSourceGroupInput(),
      profileId: "profile-1",
    });

    expect(result.success).toBe(false);
  });

  it("rejects null sourcePublisherId on the input schema", () => {
    const result = CollectedContentProvenanceInputSchema.safeParse({
      ...createSourceGroupInput(),
      sourcePublisherId: null,
    });

    expect(result.success).toBe(false);
  });

  it("rejects null managedSourceGroupId on the input schema", () => {
    const result = CollectedContentProvenanceInputSchema.safeParse({
      ...createSourceGroupInput(),
      managedSourceGroupId: null,
    });

    expect(result.success).toBe(false);
  });

  it("rejects blank sourcePublisherId on the input schema", () => {
    const result = CollectedContentProvenanceInputSchema.safeParse({
      ...createSourceGroupInput(),
      sourcePublisherId: "   ",
    });

    expect(result.success).toBe(false);
  });

  it("requires managedSourceGroupId when the surface is SOURCE_GROUP", () => {
    const result = CollectedContentProvenanceInputSchema.safeParse({
      collectionSurface: SOURCE_GROUP_SURFACE,
    });

    expect(result.success).toBe(false);
  });

  it("requires managedSourceGroupId to equal the surface sourceGroupId", () => {
    const result = CollectedContentProvenanceInputSchema.safeParse({
      collectionSurface: SOURCE_GROUP_SURFACE,
      managedSourceGroupId: "source-group-2",
    });

    expect(result.success).toBe(false);
  });

  it("accepts managedSourceGroupId when the surface is PROFILE_HOME_FEED", () => {
    const result = CollectedContentProvenanceInputSchema.safeParse({
      collectionSurface: PROFILE_HOME_FEED_SURFACE,
      managedSourceGroupId: "source-group-1",
    });

    expect(result.success).toBe(true);
  });

  it("accepts an absent managedSourceGroupId when the surface is PROFILE_HOME_FEED", () => {
    const result = CollectedContentProvenanceInputSchema.safeParse({
      collectionSurface: PROFILE_HOME_FEED_SURFACE,
    });

    expect(result.success).toBe(true);
  });

  it("requires managedSourceGroupId on durable SOURCE_GROUP provenance", () => {
    const result = ContentCollectionProvenanceSchema.safeParse({
      firstCollectionSurface: SOURCE_GROUP_SURFACE,
    });

    expect(result.success).toBe(false);
  });

  it("rejects mismatching managedSourceGroupId on durable SOURCE_GROUP provenance", () => {
    const result = ContentCollectionProvenanceSchema.safeParse({
      firstCollectionSurface: SOURCE_GROUP_SURFACE,
      managedSourceGroupId: "source-group-2",
    });

    expect(result.success).toBe(false);
  });

  it("accepts a matching managedSourceGroupId on durable SOURCE_GROUP provenance", () => {
    const result = ContentCollectionProvenanceSchema.safeParse({
      firstCollectionSurface: SOURCE_GROUP_SURFACE,
      managedSourceGroupId: "source-group-1",
    });

    expect(result.success).toBe(true);
  });

  it("accepts an absent managedSourceGroupId on durable PROFILE_HOME_FEED provenance", () => {
    const result = ContentCollectionProvenanceSchema.safeParse({
      firstCollectionSurface: PROFILE_HOME_FEED_SURFACE,
    });

    expect(result.success).toBe(true);
  });

  it("accepts a present managedSourceGroupId on durable PROFILE_HOME_FEED provenance", () => {
    const result = ContentCollectionProvenanceSchema.safeParse({
      firstCollectionSurface: PROFILE_HOME_FEED_SURFACE,
      managedSourceGroupId: "source-group-1",
    });

    expect(result.success).toBe(true);
  });

  it("rejects unknown fields on the durable provenance schema", () => {
    const result = ContentCollectionProvenanceSchema.safeParse({
      firstCollectionSurface: PROFILE_HOME_FEED_SURFACE,
      profileId: "profile-1",
    });

    expect(result.success).toBe(false);
  });
});

describe("content collection provenance validation helpers", () => {
  it("returns a valid result for a SOURCE_GROUP input", () => {
    const result = validateCollectedContentProvenanceInput(
      createSourceGroupInput(),
    );

    expect(result.valid).toBe(true);
  });

  it("returns issues for an input missing required managedSourceGroupId", () => {
    const result = validateCollectedContentProvenanceInput({
      collectionSurface: SOURCE_GROUP_SURFACE,
    });

    expect(result.valid).toBe(false);

    if (!result.valid) {
      expect(result.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ path: "managedSourceGroupId" }),
        ]),
      );
    }
  });

  it("returns a valid result for a PROFILE_HOME_FEED input with managedSourceGroupId", () => {
    const result = validateCollectedContentProvenanceInput({
      collectionSurface: PROFILE_HOME_FEED_SURFACE,
      managedSourceGroupId: "source-group-1",
    });

    expect(result.valid).toBe(true);
  });

  it("parses a durable provenance through parseContentCollectionProvenance", () => {
    const provenance: ContentCollectionProvenance = {
      firstCollectionSurface: PROFILE_HOME_FEED_SURFACE,
    };

    const result = parseContentCollectionProvenance(provenance);

    expect(result.valid).toBe(true);

    if (result.valid) {
      expect(result.value).toEqual(provenance);
    }
  });

  it("rejects an unknown surface kind from parseCollectedContentProvenanceInput", () => {
    const result = parseCollectedContentProvenanceInput({
      collectionSurface: { kind: "UNKNOWN" },
    });

    expect(result.valid).toBe(false);
  });

  it("rejects a mismatching durable SOURCE_GROUP provenance", () => {
    const result = validateContentCollectionProvenance({
      firstCollectionSurface: SOURCE_GROUP_SURFACE,
      managedSourceGroupId: "source-group-2",
    });

    expect(result.valid).toBe(false);
  });
});

describe("content collection provenance creation", () => {
  it("creates SOURCE_GROUP provenance with the matching managedSourceGroupId", () => {
    const provenance = createInitialContentCollectionProvenance(
      createSourceGroupInput({ sourcePublisherId: "publisher-1" }),
    );

    expect(provenance.firstCollectionSurface).toEqual(SOURCE_GROUP_SURFACE);
    expect(provenance.managedSourceGroupId).toBe("source-group-1");
    expect(provenance.sourcePublisherId).toBe("publisher-1");
  });

  it("creates PROFILE_HOME_FEED provenance without a managedSourceGroupId", () => {
    const provenance = createInitialContentCollectionProvenance(
      createProfileHomeFeedInput(),
    );

    expect(provenance.firstCollectionSurface).toEqual(
      PROFILE_HOME_FEED_SURFACE,
    );
    expect(provenance.managedSourceGroupId).toBeUndefined();
  });

  it("creates PROFILE_HOME_FEED provenance with a managedSourceGroupId", () => {
    const provenance = createInitialContentCollectionProvenance(
      createProfileHomeFeedInput({ managedSourceGroupId: "source-group-1" }),
    );

    expect(provenance.firstCollectionSurface).toEqual(
      PROFILE_HOME_FEED_SURFACE,
    );
    expect(provenance.managedSourceGroupId).toBe("source-group-1");
  });

  it("omits an absent sourcePublisherId rather than serializing null", () => {
    const provenance = createInitialContentCollectionProvenance(
      createProfileHomeFeedInput(),
    );

    expect(
      Object.prototype.hasOwnProperty.call(provenance, "sourcePublisherId"),
    ).toBe(false);
  });

  it("omits an absent managedSourceGroupId rather than serializing null", () => {
    const provenance = createInitialContentCollectionProvenance(
      createProfileHomeFeedInput(),
    );

    expect(
      Object.prototype.hasOwnProperty.call(provenance, "managedSourceGroupId"),
    ).toBe(false);
  });

  it("rejects runtime-invalid input forced through TypeScript casts", () => {
    // Bypass the static type to confirm runtime validation rejects bad input.
    const invalid = {
      collectionSurface: SOURCE_GROUP_SURFACE,
      // managedSourceGroupId is missing — required for SOURCE_GROUP.
    } as unknown as CollectedContentProvenanceInput;

    expect(() => createInitialContentCollectionProvenance(invalid)).toThrow(
      ZodError,
    );
  });

  it("rejects runtime-invalid input with mismatching managedSourceGroupId", () => {
    const invalid = {
      collectionSurface: SOURCE_GROUP_SURFACE,
      managedSourceGroupId: "source-group-2",
    } as unknown as CollectedContentProvenanceInput;

    expect(() => createInitialContentCollectionProvenance(invalid)).toThrow(
      ZodError,
    );
  });
});

describe("content collection provenance enrichment", () => {
  it("fills an absent sourcePublisherId on a later observation", () => {
    const existing = createInitialContentCollectionProvenance(
      createSourceGroupInput(),
    );

    const merged = mergeContentCollectionProvenance(existing, {
      ...createSourceGroupInput(),
      sourcePublisherId: "publisher-1",
    });

    expect(merged.sourcePublisherId).toBe("publisher-1");
    expect(merged.firstCollectionSurface).toEqual(SOURCE_GROUP_SURFACE);
    expect(merged.managedSourceGroupId).toBe("source-group-1");
  });

  it("fills an absent managedSourceGroupId on a later SOURCE_GROUP observation", () => {
    // First observed as PROFILE_HOME_FEED with no associations.
    const existing = createInitialContentCollectionProvenance(
      createProfileHomeFeedInput(),
    );

    // A later SOURCE_GROUP observation carries the managedSourceGroupId.
    const merged = mergeContentCollectionProvenance(existing, {
      collectionSurface: SOURCE_GROUP_SURFACE,
      managedSourceGroupId: SOURCE_GROUP_SURFACE.sourceGroupId,
      sourcePublisherId: "publisher-1",
    });

    expect(merged.firstCollectionSurface).toEqual(PROFILE_HOME_FEED_SURFACE);
    expect(merged.managedSourceGroupId).toBe("source-group-1");
    expect(merged.sourcePublisherId).toBe("publisher-1");
  });

  it("keeps an existing sourcePublisherId when a later observation omits it", () => {
    const existing = createInitialContentCollectionProvenance(
      createSourceGroupInput({ sourcePublisherId: "publisher-1" }),
    );

    const merged = mergeContentCollectionProvenance(
      existing,
      createSourceGroupInput(),
    );

    expect(merged.sourcePublisherId).toBe("publisher-1");
  });

  it("keeps an existing managedSourceGroupId when a later observation omits it", () => {
    const existing = createInitialContentCollectionProvenance(
      createSourceGroupInput(),
    );

    // Later observed as PROFILE_HOME_FEED without a managedSourceGroupId.
    const merged = mergeContentCollectionProvenance(
      existing,
      createProfileHomeFeedInput(),
    );

    expect(merged.managedSourceGroupId).toBe("source-group-1");
  });
});

describe("content collection provenance idempotency", () => {
  it("is idempotent when reapplying an identical SOURCE_GROUP observation", () => {
    const existing = createInitialContentCollectionProvenance(
      createSourceGroupInput({ sourcePublisherId: "publisher-1" }),
    );

    const merged = mergeContentCollectionProvenance(
      existing,
      createSourceGroupInput({ sourcePublisherId: "publisher-1" }),
    );

    expect(merged).toEqual(existing);
  });

  it("is idempotent when reapplying an identical PROFILE_HOME_FEED observation", () => {
    const existing = createInitialContentCollectionProvenance(
      createProfileHomeFeedInput({ sourcePublisherId: "publisher-1" }),
    );

    const merged = mergeContentCollectionProvenance(
      existing,
      createProfileHomeFeedInput({ sourcePublisherId: "publisher-1" }),
    );

    expect(merged).toEqual(existing);
  });
});

describe("content collection provenance different-surface recollection", () => {
  it("preserves the first collection surface when a later observation uses a different surface", () => {
    const existing = createInitialContentCollectionProvenance(
      createSourceGroupInput({ sourcePublisherId: "publisher-1" }),
    );

    const merged = mergeContentCollectionProvenance(
      existing,
      createProfileHomeFeedInput(),
    );

    expect(merged.firstCollectionSurface).toEqual(SOURCE_GROUP_SURFACE);
    expect(merged.managedSourceGroupId).toBe("source-group-1");
    expect(merged.sourcePublisherId).toBe("publisher-1");
  });

  it("home-feed-first then source-group observation produces a durable schema-valid result", () => {
    const existing = createInitialContentCollectionProvenance({
      collectionSurface: PROFILE_HOME_FEED_SURFACE,
    });

    const merged = mergeContentCollectionProvenance(existing, {
      collectionSurface: SOURCE_GROUP_SURFACE,
      managedSourceGroupId: "source-group-1",
    });

    const result = ContentCollectionProvenanceSchema.safeParse(merged);

    expect(result.success).toBe(true);
    expect(merged.firstCollectionSurface).toEqual(PROFILE_HOME_FEED_SURFACE);
    expect(merged.managedSourceGroupId).toBe("source-group-1");
  });
});

describe("content collection provenance conflicts", () => {
  it("throws a typed conflict on conflicting sourcePublisherId", () => {
    const existing = createInitialContentCollectionProvenance(
      createSourceGroupInput({ sourcePublisherId: "publisher-1" }),
    );

    expect(() =>
      mergeContentCollectionProvenance(
        existing,
        createSourceGroupInput({ sourcePublisherId: "publisher-2" }),
      ),
    ).toThrow(ContentCollectionProvenanceConflictError);

    try {
      mergeContentCollectionProvenance(
        existing,
        createSourceGroupInput({ sourcePublisherId: "publisher-2" }),
      );
    } catch (error) {
      expect(error).toBeInstanceOf(ContentCollectionProvenanceConflictError);
      const conflict = error as ContentCollectionProvenanceConflictError;
      expect(conflict.code).toBe("CONTENT_COLLECTION_PROVENANCE_CONFLICT");
      expect(conflict.field).toBe("sourcePublisherId");
      expect(conflict.existing).toBe("publisher-1");
      expect(conflict.incoming).toBe("publisher-2");
    }
  });

  it("throws a typed conflict on conflicting managedSourceGroupId", () => {
    const existing = createInitialContentCollectionProvenance(
      createSourceGroupInput(),
    );

    expect(() =>
      mergeContentCollectionProvenance(existing, {
        collectionSurface: OTHER_SOURCE_GROUP_SURFACE,
        managedSourceGroupId: OTHER_SOURCE_GROUP_SURFACE.sourceGroupId,
      }),
    ).toThrow(ContentCollectionProvenanceConflictError);

    try {
      mergeContentCollectionProvenance(existing, {
        collectionSurface: OTHER_SOURCE_GROUP_SURFACE,
        managedSourceGroupId: OTHER_SOURCE_GROUP_SURFACE.sourceGroupId,
      });
    } catch (error) {
      const conflict = error as ContentCollectionProvenanceConflictError;
      expect(conflict.code).toBe("CONTENT_COLLECTION_PROVENANCE_CONFLICT");
      expect(conflict.field).toBe("managedSourceGroupId");
      expect(conflict.existing).toBe("source-group-1");
      expect(conflict.incoming).toBe("source-group-2");
    }
  });

  it("does not mutate the existing provenance when merge throws", () => {
    const existing = createInitialContentCollectionProvenance(
      createSourceGroupInput({ sourcePublisherId: "publisher-1" }),
    );
    const snapshot = JSON.parse(JSON.stringify(existing));

    expect(() =>
      mergeContentCollectionProvenance(
        existing,
        createSourceGroupInput({ sourcePublisherId: "publisher-2" }),
      ),
    ).toThrow(ContentCollectionProvenanceConflictError);

    expect(existing).toEqual(snapshot);
  });

  it("does not mutate the incoming input when merge throws", () => {
    const existing = createInitialContentCollectionProvenance(
      createSourceGroupInput({ sourcePublisherId: "publisher-1" }),
    );
    const incoming = createSourceGroupInput({
      sourcePublisherId: "publisher-2",
    });
    const snapshot = JSON.parse(JSON.stringify(incoming));

    expect(() =>
      mergeContentCollectionProvenance(existing, incoming),
    ).toThrow(ContentCollectionProvenanceConflictError);

    expect(incoming).toEqual(snapshot);
  });
});

describe("content collection provenance runtime validation", () => {
  it("createInitialContentCollectionProvenance rejects runtime-invalid input", () => {
    const invalid = {
      collectionSurface: SOURCE_GROUP_SURFACE,
    } as unknown as CollectedContentProvenanceInput;

    expect(() => createInitialContentCollectionProvenance(invalid)).toThrow(
      ZodError,
    );
  });

  it("mergeContentCollectionProvenance rejects runtime-invalid existing provenance", () => {
    const valid = createInitialContentCollectionProvenance(
      createSourceGroupInput(),
    );

    // Bypass the static type to force a mismatching SOURCE_GROUP durable value.
    const invalidExisting = {
      firstCollectionSurface: SOURCE_GROUP_SURFACE,
      managedSourceGroupId: "source-group-2",
    } as unknown as ContentCollectionProvenance;

    expect(() =>
      mergeContentCollectionProvenance(invalidExisting, {
        ...createSourceGroupInput(),
      }),
    ).toThrow(ZodError);

    // Confirm the valid value is untouched and would still merge successfully.
    const merged = mergeContentCollectionProvenance(valid, {
      ...createSourceGroupInput(),
    });

    expect(merged.firstCollectionSurface).toEqual(SOURCE_GROUP_SURFACE);
  });

  it("mergeContentCollectionProvenance rejects runtime-invalid incoming input", () => {
    const valid = createInitialContentCollectionProvenance(
      createSourceGroupInput(),
    );

    // Bypass the static type to drop the required managedSourceGroupId.
    const invalidIncoming = {
      collectionSurface: SOURCE_GROUP_SURFACE,
    } as unknown as CollectedContentProvenanceInput;

    expect(() =>
      mergeContentCollectionProvenance(valid, invalidIncoming),
    ).toThrow(ZodError);
  });

  it("createInitialContentCollectionProvenance result always passes the durable schema", () => {
    const inputs: CollectedContentProvenanceInput[] = [
      createSourceGroupInput(),
      createSourceGroupInput({ sourcePublisherId: "publisher-1" }),
      createProfileHomeFeedInput(),
      createProfileHomeFeedInput({ managedSourceGroupId: "source-group-1" }),
      createProfileHomeFeedInput({
        managedSourceGroupId: "source-group-1",
        sourcePublisherId: "publisher-1",
      }),
    ];

    for (const input of inputs) {
      const provenance = createInitialContentCollectionProvenance(input);
      const result = ContentCollectionProvenanceSchema.safeParse(provenance);

      expect(result.success).toBe(true);
    }
  });

  it("mergeContentCollectionProvenance result always passes the durable schema", () => {
    const initial = createInitialContentCollectionProvenance(
      createProfileHomeFeedInput(),
    );

    const cases: CollectedContentProvenanceInput[] = [
      {
        collectionSurface: SOURCE_GROUP_SURFACE,
        managedSourceGroupId: SOURCE_GROUP_SURFACE.sourceGroupId,
      },
      {
        collectionSurface: SOURCE_GROUP_SURFACE,
        managedSourceGroupId: SOURCE_GROUP_SURFACE.sourceGroupId,
        sourcePublisherId: "publisher-1",
      },
      createProfileHomeFeedInput(),
      createProfileHomeFeedInput({ managedSourceGroupId: "source-group-1" }),
      createProfileHomeFeedInput({ sourcePublisherId: "publisher-1" }),
    ];

    for (const incoming of cases) {
      const merged = mergeContentCollectionProvenance(initial, incoming);
      const result = ContentCollectionProvenanceSchema.safeParse(merged);

      expect(result.success).toBe(true);
    }
  });
});

describe("content collection provenance immutability", () => {
  it("createInitialContentCollectionProvenance does not mutate its input", () => {
    const input = createSourceGroupInput({ sourcePublisherId: "publisher-1" });
    const snapshot = JSON.parse(JSON.stringify(input));

    createInitialContentCollectionProvenance(input);

    expect(input).toEqual(snapshot);
  });

  it("mergeContentCollectionProvenance does not mutate either side", () => {
    const existing = createInitialContentCollectionProvenance(
      createSourceGroupInput({ sourcePublisherId: "publisher-1" }),
    );
    const incoming = createSourceGroupInput();
    const existingSnapshot = JSON.parse(JSON.stringify(existing));
    const incomingSnapshot = JSON.parse(JSON.stringify(incoming));

    mergeContentCollectionProvenance(existing, incoming);

    expect(existing).toEqual(existingSnapshot);
    expect(incoming).toEqual(incomingSnapshot);
  });
});

describe("content collection provenance surface helpers", () => {
  it("identifies SOURCE_GROUP surfaces", () => {
    expect(isSourceGroupCollectionSurface(SOURCE_GROUP_SURFACE)).toBe(true);
    expect(isSourceGroupCollectionSurface(PROFILE_HOME_FEED_SURFACE)).toBe(
      false,
    );
  });

  it("identifies PROFILE_HOME_FEED surfaces", () => {
    expect(isProfileHomeFeedCollectionSurface(PROFILE_HOME_FEED_SURFACE)).toBe(
      true,
    );
    expect(isProfileHomeFeedCollectionSurface(SOURCE_GROUP_SURFACE)).toBe(
      false,
    );
  });

  it("compares surfaces by kind and sourceGroupId", () => {
    expect(
      collectionSurfaceEquals(SOURCE_GROUP_SURFACE, SOURCE_GROUP_SURFACE),
    ).toBe(true);

    expect(
      collectionSurfaceEquals(
        SOURCE_GROUP_SURFACE,
        OTHER_SOURCE_GROUP_SURFACE,
      ),
    ).toBe(false);

    expect(
      collectionSurfaceEquals(SOURCE_GROUP_SURFACE, PROFILE_HOME_FEED_SURFACE),
    ).toBe(false);

    expect(
      collectionSurfaceEquals(
        PROFILE_HOME_FEED_SURFACE,
        PROFILE_HOME_FEED_SURFACE,
      ),
    ).toBe(true);
  });
});
