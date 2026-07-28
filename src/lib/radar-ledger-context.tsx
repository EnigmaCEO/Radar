"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { getDashboardBootstrap } from "@/lib/api";
import type { RadarAlertPage } from "@/lib/api-types";
import type { DashboardBootstrapPayload } from "@/lib/dashboard-bootstrap-types";
import type { SceCatalogResponse } from "@/lib/sce-catalog-types";

const EMPTY_ALERT_PAGE: RadarAlertPage = {
  alerts: [],
  count: 0,
  pageCount: 0,
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
        setLoaded(true);
      } catch (nextError) {
        console.error(nextError);
        setSnapshotPage(EMPTY_ALERT_PAGE);
        setLedgerPage(EMPTY_ALERT_PAGE);
        setCatalog(EMPTY_CATALOG);
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
