export type SceMonitorType = "oracle" | "bridge" | "lp";

export interface SceCatalogObject {
  id: string;
  monitorType: SceMonitorType;
  displayName: string;
  provider: string;
  chain: string;
  asset: string | null;
  assetPair: string | null;
  route: string | null;
  pool: string | null;
  status: string;
  canAlert: boolean;
  canBroadcast: boolean;
  canWatch: boolean;
  tags: string[];
  commercialValue: string | null;
  purpose: string | null;
}

export interface SceCatalogFilters {
  providers: string[];
  chains: string[];
  assets: string[];
  tags: string[];
  purposes: string[];
  statuses: string[];
}

export interface SceCatalogResponse {
  objects: SceCatalogObject[];
  filters: SceCatalogFilters;
}
