// Types mirroring the SCE backend RadarThreshold* models (camelCase as returned
// by GET /v1/radar/thresholds). See apps/api/app/radar/models.py and
// apps/api/app/radar/threshold_registry.py in the SCE repo.

export type SceThresholdMonitorType = "oracle" | "oracle_reference" | "bridge" | "lp";
export type SceThresholdObjectType =
  | "oracle_feed"
  | "oracle_reference_group"
  | "bridge_route"
  | "lp_pool";
export type SceThresholdUnit = "seconds" | "bps" | "mixed";

export interface SceThresholdItem {
  objectId: string;
  monitorType: SceThresholdMonitorType;
  objectType: SceThresholdObjectType;
  provider: string;
  displayName: string;
  chain?: string | null;
  sourceChain?: string | null;
  destinationChain?: string | null;
  asset?: string | null;
  assetPair?: string | null;
  route?: string | null;
  purpose?: string | null;
  status: string;
  thresholdUnit: SceThresholdUnit;
  expectedBaselineLabel?: string | null;
  expectedBaselineValue?: number | null;
  watchThresholdValue?: number | null;
  warningThresholdValue?: number | null;
  criticalThresholdValue?: number | null;
  doctrineClass?: string | null;
  doctrineThresholdSource?: string | null;
  officialMetadataStatus?: string | null;
  officialSourceUrl?: string | null;
  extraThresholds: Record<string, number | string | boolean | null>;
  notes?: string | null;
}

export interface SceThresholdSummary {
  totalItems: number;
  oracleFeedItems: number;
  oracleReferenceGroupItems: number;
  bridgeRouteItems: number;
  lpPoolItems: number;
}

export interface SceThresholdResponse {
  generatedAt: string;
  summary: SceThresholdSummary;
  items: SceThresholdItem[];
}
