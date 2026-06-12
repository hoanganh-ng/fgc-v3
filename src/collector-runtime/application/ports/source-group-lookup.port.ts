export interface SourceGroupLookupSourceGroup {
  readonly id: string;
  readonly platform: string;
  readonly status: string;
  readonly url: string;
}

export type SourceGroupLookupResult =
  | {
      readonly ok: true;
      readonly statusCode?: number;
      readonly sourceGroup: SourceGroupLookupSourceGroup;
    }
  | {
      readonly ok: false;
      readonly statusCode?: number;
      readonly errorCode: string;
      readonly errorMessage: string;
    };

export interface SourceGroupLookupPort {
  getSourceGroup(sourceGroupId: string): Promise<SourceGroupLookupResult>;
}
