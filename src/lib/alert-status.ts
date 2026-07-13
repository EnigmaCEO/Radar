export function isResolvedAlertStatus(status: string): boolean {
  return status.toLowerCase() === "resolved";
}

export function isDisabledAlertStatus(status: string): boolean {
  return status.toLowerCase() === "disabled";
}

export function isSupersededAlertStatus(status: string): boolean {
  return status.toLowerCase() === "superseded";
}

export function isClosedAlertStatus(status: string): boolean {
  return (
    isResolvedAlertStatus(status) ||
    isDisabledAlertStatus(status) ||
    isSupersededAlertStatus(status)
  );
}

export function coverageGapStatusLabel(status: string): string {
  if (isResolvedAlertStatus(status)) return "restored";
  if (isDisabledAlertStatus(status)) return "disabled";
  if (isSupersededAlertStatus(status)) return "superseded";
  return "active";
}

export function coverageGapHeadlineLabel(status: string): string {
  if (isResolvedAlertStatus(status)) return "Restored";
  if (isClosedAlertStatus(status)) return "Closed";
  return "Unresolved";
}
