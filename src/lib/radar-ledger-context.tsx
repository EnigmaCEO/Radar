"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { getDashboardBootstrap } from "@/lib/api";
import type { AlertDataState } from "@/lib/alert-data-state";
import type { RadarAlertPage } from "@/lib/api-types";
import type { DashboardBootstrapPayload } from "@/lib/dashboard-bootstrap-types";
import type { SceCatalogResponse } from "@/lib/sce-catalog-types";

// Used only as the pre-load placeholder, before any read has been attempted.
const EMPTY_ALERT_PAGE: RadarAlertPage = {
  alerts: [],
  count: 0,
  pageCount: 0,
};

// Used when the bootstrap request itself failed. It must never look like a
// confirmed empty page, so it carries an explicit unavailable state.
const UNAVAILABLE_ALERT_PAGE: RadarAlertPage = {
  alerts: [],
  count: 0,
  pageCount: 0,
  state: "unavailable",
  source: "sce",
  error: { code: "UPSTREAM_UNAVAILABLE", retryable: true },
};

const EMPTY_CATALOG: SceCatalogResponse = {
  objects: [],
  filters: {
    providers: [],
    chains: [],
    assets: [],
    tags: [],
    statuses: [],
  },
};

let cachedBootstrap: DashboardBootstrapPayload | null = null;
let cachedBootstrapPromise: Promise<DashboardBootstrapPayload> | null = null;

interface RadarLedgerContextValue {
  snapshotPage: RadarAlertPage;
  ledgerPage: RadarAlertPage;
  page: RadarAlertPage;
  catalog: SceCatalogResponse;
  /** False when the catalog read failed, so an empty catalog is not read as zero. */
  catalogAvailable: boolean;
  /** State of the alert page this account renders. */
  alertDataState: AlertDataState;
  loading: boolean;
  loaded: boolean;
  error: string | null;
  reload: () => Promise<void>;
}

const RadarLedgerContext = createContext<RadarLedgerContextValue | null>(null);

async function loadDashboardBootstrap(force = false): Promise<DashboardBootstrapPayload> {
  if (!force && cachedBootstrap) {
    return cachedBootstrap;
  }
  if (!force && cachedBootstrapPromise) {
    return cachedBootstrapPromise;
  }

  const request = getDashboardBootstrap()
    .then((payload) => {
      cachedBootstrap = payload;
      return payload;
    })
    .finally(() => {
      cachedBootstrapPromise = null;
    });

  cachedBootstrapPromise = request;
  return request;
}

export function RadarLedgerProvider({ children }: { children: React.ReactNode }) {
  const [snapshotPage, setSnapshotPage] = useState<RadarAlertPage>(
    cachedBootstrap?.snapshotPage ?? EMPTY_ALERT_PAGE,
  );
  const [ledgerPage, setLedgerPage] = useState<RadarAlertPage>(
    cachedBootstrap?.ledgerPage ?? EMPTY_ALERT_PAGE,
  );
  const [catalog, setCatalog] = useState<SceCatalogResponse>(cachedBootstrap?.catalog ?? EMPTY_CATALOG);
  const [catalogAvailable, setCatalogAvailable] = useState<boolean>(
    cachedBootstrap?.catalogAvailable ?? false,
  );
  const [alertDataState, setAlertDataState] = useState<AlertDataState>(
    cachedBootstrap?.alertDataState ?? "unavailable",
  );
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(cachedBootstrap !== null);
  const [error, setError] = useState<string | null>(null);
  const inflightRef = useRef<Promise<void> | null>(null);

  async function load(force = false) {
    if (inflightRef.current) {
      return inflightRef.current;
    }
    if (loaded && !force) {
      return;
    }

    const request = (async () => {
      setLoading(true);
      setError(null);
      try {
        const payload = await loadDashboardBootstrap(force);
        setSnapshotPage(payload.snapshotPage);
        setLedgerPage(payload.ledgerPage);
        setCatalog(payload.catalog);
        setCatalogAvailable(payload.catalogAvailable ?? true);
        setAlertDataState(payload.alertDataState ?? "unavailable");
        setLoaded(true);
      } catch (nextError) {
        console.error(nextError);
        // A failed bootstrap yields unavailable pages, not empty ones: the
        // dashboard must not render measured-looking zeros from a failed read.
        setSnapshotPage(UNAVAILABLE_ALERT_PAGE);
        setLedgerPage(UNAVAILABLE_ALERT_PAGE);
        setCatalog(EMPTY_CATALOG);
        setCatalogAvailable(false);
        setAlertDataState("unavailable");
        setLoaded(true);
        setError(nextError instanceof Error ? nextError.message : "Failed to load dashboard data.");
      } finally {
        setLoading(false);
      }
    })();

    inflightRef.current = request.finally(() => {
      inflightRef.current = null;
    });

    return inflightRef.current;
  }

  const value: RadarLedgerContextValue = {
    snapshotPage,
    ledgerPage,
    page: ledgerPage,
    catalog,
    catalogAvailable,
    alertDataState,
    loading,
    loaded,
    error,
    reload: () => load(true),
  };

  return <RadarLedgerContext.Provider value={value}>{children}</RadarLedgerContext.Provider>;
}

export function useRadarLedgerHistory() {
  const ctx = useContext(RadarLedgerContext);
  if (!ctx) {
    throw new Error("useRadarLedgerHistory must be used within RadarLedgerProvider");
  }
  const { loaded, loading, reload } = ctx;

  useEffect(() => {
    if (!loaded && !loading) {
      void reload();
    }
  }, [loaded, loading, reload]);

  return ctx;
}
