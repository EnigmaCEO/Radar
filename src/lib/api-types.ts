// Types mirroring the SCE backend models (camelCase as returned by the API)

export type RadarMonitorType = "oracle" | "bridge" | "governance" | "sce_heartbeat" | "dependency" | "lp";
export type RadarSeverity = "watch" | "warning" | "critical";
export type RadarStatus = "active" | "resolved" | "superseded";
export type RadarVisibility = "public" | "private";
export type RadarAlertProvenance = "sample" | "manual" | "runtime" | "live" | "drill";
export type RadarWatchlistPlan =
  | "public_record"
  | "watch"
  | "radar"
  | "radar_signal"
  | "radar_intel"
  | "desk"
  | "free"
  | "radar_live"
  | "radar_pro"
  | "managed";
export type RadarClientStatus = "trial" | "active" | "past_due" | "suspended" | "canceled";
export type RadarLiveDeliveryChannel = "discord" | "telegram" | "webhook";
export type RadarLiveDeliveryStatus = "pending" | "sent" | "skipped" | "failed";
export type RadarNotificationChannel = "discord";
export type RadarWatchlistDeliveryChannel = "discord" | "telegram" | "email" | "webhook";
export type RadarDeliveryMode =
  | "alert_fanout"
  | "public_thread"
  | "digest"
  | "announcement_feed";

export type AccountType = "internal" | "client" | "demo";
export type AccountStatus = "active" | "pending" | "suspended";
export type UserStatus = "active" | "invited" | "disabled";
export type MembershipRole =
  | "super_admin"
  | "sce_operator"
  | "account_owner"
  | "security_admin"
  | "developer"
  | "operations_lead"
  | "reviewer"
  | "viewer"
  | "client_admin"
  | "client_member"
  | "client_viewer";
export type AccessRequestStatus = "pending" | "approved" | "rejected";

export interface RadarAlert {
  id: string;
  dedupeKey: string;
  monitorType: RadarMonitorType;
  source: string;
  severity: RadarSeverity;
  status: RadarStatus;
  confidence: number;
  summary: string;
  reasonCode: string;
  visibility: RadarVisibility;
  provenance: RadarAlertProvenance;
  signalClass?: string;
  createdAt: string;
  updatedAt: string;
  oracle?: string;
  bridge?: string;
  asset?: string;
  assetPair?: string;
  chain?: string;
  route?: string;
  poolName?: string;
  objectId?: string;
  affectedProtocol?: string;
  observedValue?: string;
  expectedValue?: string;
  thresholdName?: string;
  observedValueLabel?: string;
  thresholdValueLabel?: string;
  declaredHeartbeatSeconds?: number;
  appliedThresholdSeconds?: number;
  appliedThresholdKind?: string;
  thresholdSourceLabel?: string;
  evidenceState?: string;
  publicVerificationState?: string;
  publicSummary?: string;
  whatHappened?: string;
  whyItMatters?: string;
  radarStatus?: string;
  evidenceExplanation?: string;
  lastSuccessfulObservationAt?: string;
  lastObservationAttemptAt?: string;
  consecutiveFailedCycles?: number;
  objectState?: string;
  failureCause?: string;
  coverageTier?: string;
  evidenceUrl?: string;
  openedAt?: string;
  resolvedAt?: string;
}

export interface RadarObservabilitySummary {
  cycleAt: string;
  totalObjects: number;
  observedObjects: number;
  unobservedObjects: number;
}

export interface RadarClient {
  id: string;
  name: string;
  status: RadarClientStatus;
  plan: RadarWatchlistPlan;
  primaryContactEmail?: string;
  telegramHandle?: string;
  discordContact?: string;
  notes?: string;
  trialEndsAt?: string;
  externalBillingCustomerId?: string;
  billingProvider?: "manual" | "stripe" | "x402";
  createdAt: string;
  updatedAt: string;
}

export interface RadarClientEntitlementSummary {
  clientId: string;
  clientName: string;
  plan: RadarWatchlistPlan;
  status: RadarClientStatus;
  watchlistsUsed: number;
  watchlistsLimit?: number;
  destinationsUsed: number;
  destinationsLimit?: number;
  liveDeliveryEnabled: boolean;
  discordEnabled: boolean;
  telegramEnabled: boolean;
  webhookEnabled: boolean;
  alertHistoryDays: number;
}

export interface RadarWatchlist {
  id: string;
  clientId: string;
  name: string;
  enabled: boolean;
  plan: RadarWatchlistPlan;
  monitorTypes: RadarMonitorType[];
  sources: string[];
  assets: string[];
  chains: string[];
  routes: string[];
  reasonCodes: string[];
  minimumSeverity: RadarSeverity;
  deliveryChannels: RadarWatchlistDeliveryChannel[];
  createdAt: string;
  updatedAt: string;
}

export interface RadarDeliveryDestination {
  id: string;
  clientId: string;
  name: string;
  enabled: boolean;
  channel: RadarLiveDeliveryChannel;
  destinationUrl: string;
  purpose?: string;
  deliveryMode: RadarDeliveryMode;
  minimumSeverity: RadarSeverity;
  monitorTypes: RadarMonitorType[];
  sources: string[];
  assets: string[];
  chains: string[];
  routes: string[];
  createdAt: string;
  updatedAt: string;
}

export interface RadarGms {
  monitoredValueUsd?: number;
  grossMonitoredSurfaceUsd?: number;
  oracleTvsUsd?: number | null;
  bridgeVolume24hUsd?: number | null;
  lpTvlUsd?: number | null;
}

export interface RadarDailyBriefRecord {
  id: string;
  briefDate: string;
  windowStart: string;
  windowEnd: string;
  status: "draft" | "published" | "superseded";
  totalAlerts: number;
  rawAlertsTotal: number;
  broadcastCandidates: number;
  headline: string;
  summary: string;
  publicBody: string;
  countsBy_severity: Array<{ key: string; count: number }>;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
}

export interface Account {
  id: string;
  name: string;
  slug: string;
  accountType: AccountType;
  status: AccountStatus;
  createdAt: string;
  updatedAt: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  status: UserStatus;
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string;
}

export interface Membership {
  id: string;
  accountId: string;
  userId: string;
  role: MembershipRole;
  createdAt: string;
  updatedAt: string;
}

export interface MembershipDetail {
  membership: Membership;
  account: Account;
  user: User;
}

export interface SaasPermissions {
  isGlobalAdmin: boolean;
  isSceOperator: boolean;
  canViewGlobalModules: boolean;
  canManageSources: boolean;
  canManageAccounts: boolean;
  canManageAccount: boolean;
  canManageProjects: boolean;
  canEditAssets: boolean;
  canRunScans: boolean;
  canGenerateControls: boolean;
  canSubmitEvidence: boolean;
  canVerifyControls: boolean;
  canViewOnly: boolean;
}

export interface SaasMeResponse {
  user: User;
  activeAccount?: Account;
  memberships: MembershipDetail[];
  permissions: SaasPermissions;
  currentRole?: MembershipRole;
  sessionMode: string;
  sessionToken?: string;
}

export interface AccessRequest {
  id: string;
  name: string;
  email: string;
  organization: string;
  roleTitle?: string;
  useCase?: string;
  status: AccessRequestStatus;
  reviewNote?: string;
  createdAt: string;
  updatedAt: string;
}
