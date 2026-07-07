export interface ManualDeliveryMatchedAlert {
  alertId: string;
  severity: string;
  monitorType: string;
  title: string;
  matchedWatchlistIds: string[];
  matchedWatchlistNames: string[];
}

export interface ManualDeliveryExcludedEvent {
  alertId: string;
  eventId?: string | null;
  eventType?: string | null;
  status?: string;
  severity: string;
  monitorType: string;
  title: string;
  skippedReasons: string[];
}

export interface ManualDeliveryAlertResultDebug extends ManualDeliveryMatchedAlert {
  eventId?: string | null;
  eventType?: string | null;
  status?: string;
  summary?: string;
  skippedReasons: string[];
  skippedReason?: string;
}

export interface ManualDeliveryResultDisplayInput {
  matchedAlerts?: ManualDeliveryMatchedAlert[];
  excludedEvents?: ManualDeliveryExcludedEvent[];
  alertResults?: ManualDeliveryAlertResultDebug[];
}

export function deriveMatchedAlertsForDisplay(
  result: ManualDeliveryResultDisplayInput,
): ManualDeliveryMatchedAlert[] {
  if (Array.isArray(result.matchedAlerts)) return result.matchedAlerts;

  return (result.alertResults ?? [])
    .filter((alert) => alert.matchedWatchlistNames.length > 0 && alert.skippedReasons.length === 0)
    .map((alert) => ({
      alertId: alert.alertId,
      severity: alert.severity,
      monitorType: alert.monitorType,
      title: alert.title,
      matchedWatchlistIds: alert.matchedWatchlistIds,
      matchedWatchlistNames: alert.matchedWatchlistNames,
    }));
}

export function deriveExcludedEventsForDisplay(
  result: ManualDeliveryResultDisplayInput,
): ManualDeliveryExcludedEvent[] {
  if (Array.isArray(result.excludedEvents)) return result.excludedEvents;

  return (result.alertResults ?? [])
    .filter((alert) => alert.skippedReasons.length > 0)
    .map((alert) => ({
      alertId: alert.alertId,
      eventId: alert.eventId ?? null,
      eventType: alert.eventType ?? null,
      status: alert.status,
      severity: alert.severity,
      monitorType: alert.monitorType,
      title: alert.title,
      skippedReasons: alert.skippedReasons,
    }));
}
