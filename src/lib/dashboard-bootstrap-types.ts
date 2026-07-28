import type { RadarAlertPage } from "@/lib/api-types";
import type { SceCatalogResponse } from "@/lib/sce-catalog-types";

export interface DashboardBootstrapPayload {
  snapshotPage: RadarAlertPage;
  ledgerPage: RadarAlertPage;
  catalog: SceCatalogResponse;
}
