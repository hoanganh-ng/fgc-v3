import {
  ArchiveTransformTypeUseCase,
  CreateTransformTypeUseCase,
  GetTransformTypeUseCase,
  ListTransformTypesUseCase,
  UpdateTransformTypeUseCase,
} from "../../content-builder/application";
import type {
  Clock,
  IdGenerator,
  TransformTypeRepository,
} from "../../content-builder/application";

export interface ContentBuilderDependencies {
  readonly transformTypes: TransformTypeRepository;
  readonly clock: Clock;
  readonly idGenerator: IdGenerator;
  readonly close?: () => Promise<void>;
}

export interface ContentBuilderContainer {
  readonly createTransformType: CreateTransformTypeUseCase;
  readonly updateTransformType: UpdateTransformTypeUseCase;
  readonly getTransformType: GetTransformTypeUseCase;
  readonly listTransformTypes: ListTransformTypesUseCase;
  readonly archiveTransformType: ArchiveTransformTypeUseCase;
  close(): Promise<void>;
}

export function createContentBuilder(
  dependencies: ContentBuilderDependencies,
): ContentBuilderContainer {
  const { transformTypes, clock, idGenerator } = dependencies;

  return {
    createTransformType: new CreateTransformTypeUseCase(
      transformTypes,
      idGenerator,
      clock,
    ),
    updateTransformType: new UpdateTransformTypeUseCase(
      transformTypes,
      clock,
    ),
    getTransformType: new GetTransformTypeUseCase(transformTypes),
    listTransformTypes: new ListTransformTypesUseCase(transformTypes),
    archiveTransformType: new ArchiveTransformTypeUseCase(
      transformTypes,
      clock,
    ),
    close: dependencies.close ?? noopClose,
  };
}

async function noopClose(): Promise<void> {}
