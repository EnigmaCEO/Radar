"use client";

import { LocalDateTime } from "@/components/local-time";
import { Card, CardContent } from "@/components/ui/card";
import {
  ALERT_DEGRADED_DETAIL_PREFIX,
  ALERT_DEGRADED_HEADLINE,
  ALERT_UNAVAILABLE_DETAIL,
  ALERT_UNAVAILABLE_HEADLINE,
} from "@/lib/alert-data-state";
import type { RadarAlertPage } from "@/lib/api-types";

/**
 * Dashboard-side banner for a non-live alert page.
 *
 * Renders nothing for `available` and `empty` — those are confirmed reads and
 * the surrounding UI already tells the truth. Only `degraded` and `unavailable`
 * need a disclosure, and neither borrows empty-state language.
 */
export function AlertDataStateNotice({ page }: { page: RadarAlertPage }) {
  if (page.state !== "degraded" && page.state !== "unavailable") return null;

  const isDegraded = page.state === "degraded";

  return (
    <div role="status" aria-live="polite" data-alert-state={page.state}>
      <Card
        className={
          isDegraded
            ? "border-orange-500/40 bg-orange-500/5"
            : "border-red-500/40 bg-red-500/5"
        }
      >
        <CardContent className="space-y-1 py-4">
          <p className="text-sm font-medium">
            {isDegraded ? ALERT_DEGRADED_HEADLINE : ALERT_UNAVAILABLE_HEADLINE}
          </p>
          <p className="text-sm text-muted-foreground">
            {isDegraded ? (
              <>
                {ALERT_DEGRADED_DETAIL_PREFIX}{" "}
                {page.lastSuccessfulAt ? (
                  <LocalDateTime value={page.lastSuccessfulAt} preset="detailed" />
                ) : (
                  "unknown"
                )}
                .
              </>
            ) : (
              ALERT_UNAVAILABLE_DETAIL
            )}
          </p>
          <p className="text-xs text-muted-foreground">
            Counts and charts below{" "}
            {isDegraded
              ? "reflect the last confirmed read, not live data."
              : "cannot be measured while the alert source is unreachable."}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
