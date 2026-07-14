export interface AlertEvidenceDetails {
  thresholdSourceLabel: string | null;
  expectedHeartbeat: string | null;
  warningThreshold: string | null;
  criticalThreshold: string | null;
  evidenceState: string | null;
  publicVerificationState: string | null;
}

const EMPTY_DETAILS: AlertEvidenceDetails = {
  thresholdSourceLabel: null,
  expectedHeartbeat: null,
  warningThreshold: null,
  criticalThreshold: null,
  evidenceState: null,
  publicVerificationState: null,
};

function capture(value: string, pattern: RegExp): string | null {
  const match = value.match(pattern);
  const captured = match?.[1]?.trim().replace(/^and\s+/i, "").trim();
  return captured && captured.length > 0 ? captured : null;
}

export function extractAlertEvidenceDetails(
  evidenceExplanation: string | null | undefined,
): AlertEvidenceDetails {
  if (typeof evidenceExplanation !== "string") return EMPTY_DETAILS;
  const trimmed = evidenceExplanation.trim();
  if (trimmed.length === 0) return EMPTY_DETAILS;

  return {
    thresholdSourceLabel: capture(
      trimmed,
      /threshold metadata comes from\s+(.+?)(?=:\s*expected heartbeat|\.|;|$)/i,
    ),
    expectedHeartbeat: capture(
      trimmed,
      /expected heartbeat\s+(.+?)(?=,\s*warning threshold|\.|;|$)/i,
    ),
    warningThreshold: capture(
      trimmed,
      /warning threshold\s+(.+?)(?=,\s*(?:and\s+)?critical threshold|\.|;|$)/i,
    ),
    criticalThreshold: capture(trimmed, /critical threshold\s+(.+?)(?=\.|;|$)/i),
    evidenceState: capture(trimmed, /evidence state:\s*(.+?)(?=\.|;|$)/i),
    publicVerificationState: capture(
      trimmed,
      /public verification:\s*(.+?)(?=\.|;|$)/i,
    ),
  };
}
