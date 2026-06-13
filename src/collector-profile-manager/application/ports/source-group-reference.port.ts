import type { ProfileSourceAccessSourceGroupId } from "../../domain";

export interface SourceGroupReferencePort {
  exists(sourceGroupId: ProfileSourceAccessSourceGroupId): Promise<boolean>;
}
