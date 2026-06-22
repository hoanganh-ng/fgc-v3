import type {
  ArchiveTransformTypeInput,
  CreateTransformTypeInput,
  GetTransformTypeInput,
  ListTransformTypesInput,
  ListTransformTypesOutput,
  UpdateTransformTypeInput,
} from "../../../content-builder/application";
import type { TransformType } from "../../../content-builder/domain";
import type { ContentBuilderHttpService } from "../routes/content-builder.routes";
import { StubUseCase } from "./content-manager-http-service";

export const contentBuilderHttpTestNow = "2026-06-22T00:00:00.000Z";

export interface FakeContentBuilderHttpService
  extends ContentBuilderHttpService {
  readonly createTransformType: StubUseCase<
    CreateTransformTypeInput,
    TransformType
  >;
  readonly updateTransformType: StubUseCase<
    UpdateTransformTypeInput,
    TransformType
  >;
  readonly getTransformType: StubUseCase<GetTransformTypeInput, TransformType>;
  readonly listTransformTypes: StubUseCase<
    ListTransformTypesInput,
    ListTransformTypesOutput
  >;
  readonly archiveTransformType: StubUseCase<
    ArchiveTransformTypeInput,
    TransformType
  >;
}

export function createFakeContentBuilderHttpService(): FakeContentBuilderHttpService {
  const transformType = createTransformType();

  return {
    createTransformType: new StubUseCase(transformType),
    updateTransformType: new StubUseCase(transformType),
    getTransformType: new StubUseCase(transformType),
    listTransformTypes: new StubUseCase({
      items: [transformType],
      page: {
        limit: 50,
        offset: 0,
        total: 1,
      },
    }),
    archiveTransformType: new StubUseCase(
      createTransformType({ status: "ARCHIVED" }),
    ),
  };
}

export function createUnusedContentBuilderHttpService(): FakeContentBuilderHttpService {
  return createFakeContentBuilderHttpService();
}

export function createTransformType(
  overrides: Partial<Omit<TransformType, "description">> & {
    readonly description?: string | undefined;
  } = {},
): TransformType {
  const description =
    Object.prototype.hasOwnProperty.call(overrides, "description")
      ? overrides.description
      : "Creates an initial short-form hook.";

  return {
    transformTypeId: overrides.transformTypeId ?? "transform-type-1",
    name: overrides.name ?? "Hook Rewrite",
    normalizedName: overrides.normalizedName ?? "hook rewrite",
    ...(description !== undefined ? { description } : {}),
    initialPrompt:
      overrides.initialPrompt ??
      "Rewrite the collected content into a short video hook.",
    status: overrides.status ?? "ACTIVE",
    createdAt: overrides.createdAt ?? contentBuilderHttpTestNow,
    updatedAt: overrides.updatedAt ?? contentBuilderHttpTestNow,
  };
}
