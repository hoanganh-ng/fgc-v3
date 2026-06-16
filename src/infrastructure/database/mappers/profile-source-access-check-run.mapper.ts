import type { ProfileSourceAccessCheckRun } from "../../../collector-runtime/domain";

export function toDomainProfileSourceAccessCheckRun(
  record: any,
): ProfileSourceAccessCheckRun {
  return {
    id: record.id,
    profileId: record.profileId,
    sourceGroupId: record.sourceGroupId,
    triggerType: record.triggerType,
    status: record.status,
    accountStageAtRequest: record.accountStageAtRequest,
    target: record.target,
    ...(record.failureReason !== null
      ? { failureReason: record.failureReason }
      : {}),
    requestedAt: new Date(record.requestedAt).toISOString(),
    ...(record.startedAt !== null
      ? { startedAt: new Date(record.startedAt).toISOString() }
      : {}),
    ...(record.finishedAt !== null
      ? { finishedAt: new Date(record.finishedAt).toISOString() }
      : {}),
    createdAt: new Date(record.createdAt).toISOString(),
    updatedAt: new Date(record.updatedAt).toISOString(),
  };
}

export function toProfileSourceAccessCheckRunRecord(
  domain: ProfileSourceAccessCheckRun,
): any {
  return {
    id: domain.id,
    profileId: domain.profileId,
    sourceGroupId: domain.sourceGroupId,
    triggerType: domain.triggerType,
    status: domain.status,
    accountStageAtRequest: domain.accountStageAtRequest,
    target: domain.target,
    failureReason: domain.failureReason ?? null,
    requestedAt: new Date(domain.requestedAt),
    startedAt: domain.startedAt ? new Date(domain.startedAt) : null,
    finishedAt: domain.finishedAt ? new Date(domain.finishedAt) : null,
    createdAt: new Date(domain.createdAt),
    updatedAt: new Date(domain.updatedAt),
  };
}
