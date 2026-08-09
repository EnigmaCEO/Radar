import type { AlertDataState } from "@/lib/alert-data-state";
import type { RadarAlertPage } from "@/lib/api-types";
import type { SceCatalogResponse } from "@/lib/sce-catalog-types";

export interface DashboardBootstrapPayload {
  /**
   * Snapshot and ledger pages each carry their own `state`. A page the caller's
   * plan does not use is returned with `state` omitted, meaning "not requested"
   * — which is different from a confirmed empty result.
   */
  snapshotPage: RadarAlertPage;
  ledgerPage: RadarAlertPage;
  catalog: SceCatalogResponse;
  /**
   * False when the catalog read failed. The catalog is independent of the alert
   * source, so one failing does not suppress the other; consumers must not read
   * an empty catalog as "zero monitored objects".
   */
  catalogAvailable: boolean;
  /**
   * The state of the alert page this account actually renders. Lets a synthetic
   * or a health check assert one field instead of knowing the plan routing.
   */
  alertDataState: AlertDataState;
}
