import type { FastifyInstance } from "fastify";
import type {
  ArchiveTransformTypeInput,
  CreateTransformTypeInput,
  GetTransformTypeInput,
  ListTransformTypesInput,
  ListTransformTypesOutput,
  UpdateTransformTypeInput,
} from "../../../content-builder/application";
import type {
  IsoDateTime,
  TransformType,
  TransformTypeId,
  TransformTypeStatus,
} from "../../../content-builder/domain";
import {
  CreateTransformTypeHttpBodySchema,
  ListTransformTypesHttpQuerySchema,
  TransformTypeIdHttpParamsSchema,
  UpdateTransformTypeHttpBodySchema,
  archiveTransformTypeHttpRouteSchema,
  createTransformTypeHttpRouteSchema,
  getTransformTypeHttpRouteSchema,
  listTransformTypesHttpRouteSchema,
  parseHttpInput,
  updateTransformTypeHttpRouteSchema,
} from "../schemas/content-builder.http-schemas";

interface ExecutableUseCase<Input, Output> {
  execute(input: Input): Promise<Output>;
}

export interface ContentBuilderHttpService {
  readonly createTransformType: ExecutableUseCase<
    CreateTransformTypeInput,
    TransformType
  >;
  readonly updateTransformType: ExecutableUseCase<
    UpdateTransformTypeInput,
    TransformType
  >;
  readonly getTransformType: ExecutableUseCase<
    GetTransformTypeInput,
    TransformType
  >;
  readonly listTransformTypes: ExecutableUseCase<
    ListTransformTypesInput,
    ListTransformTypesOutput
  >;
  readonly archiveTransformType: ExecutableUseCase<
    ArchiveTransformTypeInput,
    TransformType
  >;
}

export interface RegisterContentBuilderRoutesOptions {
  readonly contentBuilder: ContentBuilderHttpService;
}

export interface TransformTypeDto {
  readonly transformTypeId: TransformTypeId;
  readonly name: string;
  readonly description?: string;
  readonly initialPrompt: string;
  readonly status: TransformTypeStatus;
  readonly createdAt: IsoDateTime;
  readonly updatedAt: IsoDateTime;
}

export function registerContentBuilderRoutes(
  server: FastifyInstance,
  options: RegisterContentBuilderRoutesOptions,
): void {
  const { contentBuilder } = options;

  server.post(
    "/builder/transform-types",
    { schema: createTransformTypeHttpRouteSchema },
    async (request, reply) => {
      const body = parseHttpInput(
        CreateTransformTypeHttpBodySchema,
        request.body,
      );
      const input = {
        name: body.name,
        ...(body.description !== undefined
          ? { description: body.description }
          : {}),
        initialPrompt: body.initialPrompt,
      } satisfies CreateTransformTypeInput;
      const transformType =
        await contentBuilder.createTransformType.execute(input);

      return reply.code(201).send({
        transformType: toTransformTypeDto(transformType),
      });
    },
  );

  server.get(
    "/builder/transform-types",
    { schema: listTransformTypesHttpRouteSchema },
    async (request) => {
      const query = parseHttpInput(
        ListTransformTypesHttpQuerySchema,
        request.query,
      );
      const input = {
        ...(query.status !== undefined ? { status: query.status } : {}),
        limit: query.limit,
        offset: query.offset,
      } satisfies ListTransformTypesInput;
      const output = await contentBuilder.listTransformTypes.execute(input);

      return {
        items: output.items.map(toTransformTypeDto),
        page: output.page,
      };
    },
  );

  server.get(
    "/builder/transform-types/:transformTypeId",
    { schema: getTransformTypeHttpRouteSchema },
    async (request) => {
      const params = parseHttpInput(
        TransformTypeIdHttpParamsSchema,
        request.params,
      );
      const transformType = await contentBuilder.getTransformType.execute({
        transformTypeId: params.transformTypeId,
      });

      return {
        transformType: toTransformTypeDto(transformType),
      };
    },
  );

  server.patch(
    "/builder/transform-types/:transformTypeId",
    { schema: updateTransformTypeHttpRouteSchema },
    async (request) => {
      const params = parseHttpInput(
        TransformTypeIdHttpParamsSchema,
        request.params,
      );
      const body = parseHttpInput(
        UpdateTransformTypeHttpBodySchema,
        request.body,
      );
      const input = {
        transformTypeId: params.transformTypeId,
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.description !== undefined && body.description !== null
          ? { description: body.description }
          : {}),
        ...(body.description === null ? { clearDescription: true } : {}),
        ...(body.initialPrompt !== undefined
          ? { initialPrompt: body.initialPrompt }
          : {}),
      } satisfies UpdateTransformTypeInput;
      const transformType =
        await contentBuilder.updateTransformType.execute(input);

      return {
        transformType: toTransformTypeDto(transformType),
      };
    },
  );

  server.post(
    "/builder/transform-types/:transformTypeId/archive",
    { schema: archiveTransformTypeHttpRouteSchema },
    async (request) => {
      const params = parseHttpInput(
        TransformTypeIdHttpParamsSchema,
        request.params,
      );
      const transformType =
        await contentBuilder.archiveTransformType.execute({
          transformTypeId: params.transformTypeId,
        });

      return {
        transformType: toTransformTypeDto(transformType),
      };
    },
  );
}

export function toTransformTypeDto(
  transformType: TransformType,
): TransformTypeDto {
  return {
    transformTypeId: transformType.transformTypeId,
    name: transformType.name,
    ...(transformType.description !== undefined
      ? { description: transformType.description }
      : {}),
    initialPrompt: transformType.initialPrompt,
    status: transformType.status,
    createdAt: transformType.createdAt,
    updatedAt: transformType.updatedAt,
  };
}
