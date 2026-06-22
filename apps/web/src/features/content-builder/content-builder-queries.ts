import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import {
  contentBuilderClient,
  type ListTransformTypesQuery,
  type TransformTypesListResponse,
} from "@/lib/api/content-builder-client";
import {
  unwrapApiResult,
  type ApiResultError,
} from "@/lib/api/http-client";

const defaultTransformTypesQuery = {
  status: "ACTIVE",
  limit: 100,
  offset: 0,
} satisfies ListTransformTypesQuery;

export const contentBuilderQueryKeys = {
  all: ["content-builder"] as const,
  transformTypes: () =>
    [...contentBuilderQueryKeys.all, "transform-types"] as const,
  transformTypesList: (query: ListTransformTypesQuery) =>
    [...contentBuilderQueryKeys.transformTypes(), "list", query] as const,
};

export function useTransformTypesQuery(
  query: ListTransformTypesQuery = defaultTransformTypesQuery,
): UseQueryResult<TransformTypesListResponse, ApiResultError> {
  return useQuery<TransformTypesListResponse, ApiResultError>({
    queryKey: contentBuilderQueryKeys.transformTypesList(query),
    queryFn: async () =>
      unwrapApiResult(await contentBuilderClient.listTransformTypes(query)),
  });
}
