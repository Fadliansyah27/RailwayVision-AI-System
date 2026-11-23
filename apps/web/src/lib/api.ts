// Empty by default: the Next.js server proxies /api/v1 and /health to the API,
// keeping the refresh cookie first-party regardless of the browser hostname.
export const API_BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "").replace(/\/+$/, "");

export type ComponentState = "ok" | "error";

export interface ReadinessResponse {
  status: "ok" | "degraded";
  components: {
    database: ComponentState;
    redis: ComponentState;
    worker: ComponentState;
  };
}

export interface MetaResponse {
  name: string;
  version: string;
  environment: string;
  api_version: string;
  ai_disclaimer: string;
}

export interface ScopeInfo {
  id: string;
  code: string;
  name: string;
  path: string;
}

export interface RoleBrief {
  id: string;
  code: string;
  name: string;
}

export interface CurrentUser {
  id: string;
  email: string;
  full_name: string;
  is_active: boolean;
  last_login_at: string | null;
  scope: ScopeInfo;
  roles: RoleBrief[];
  permissions: string[];
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  user: CurrentUser;
  refresh_token?: string | null;
}

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}

export interface UserAdmin {
  id: string;
  email: string;
  full_name: string;
  is_active: boolean;
  last_login_at: string | null;
  scope: ScopeInfo;
  roles: RoleBrief[];
  created_at: string;
  updated_at: string;
}

export interface PasswordResetRequestInfo {
  id: string;
  user_id: string;
  email: string;
  full_name: string;
  status: string;
  requested_at: string;
  token_expires_at: string | null;
}

export interface PasswordResetTokenInfo {
  token: string;
  expires_at: string;
}

export interface PermissionInfo {
  id: string;
  code: string;
  name: string;
}

export interface RoleDetail extends RoleBrief {
  description: string;
  permissions: PermissionInfo[];
}

export interface AuditEvent {
  id: string;
  action: string;
  actor_label: string | null;
  target_type: string | null;
  target_id: string | null;
  scope_id: string | null;
  outcome: string;
  request_id: string | null;
  event_metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface AssetCategory {
  id: string;
  code: string;
  name: string;
}

export interface LocationInfo {
  id: string;
  code: string;
  name: string;
  scope_id: string;
  description: string;
}

export interface AssetSummary {
  id: string;
  code: string;
  name: string;
  description: string;
  status: string;
  category: AssetCategory;
  location: LocationInfo | null;
  scope: ScopeInfo;
  created_at: string;
  updated_at: string;
}

export interface InspectionBrief {
  id: string;
  reference: string;
  status: string;
  inspected_at: string;
}

export interface AssetDetail extends AssetSummary {
  inspections: InspectionBrief[];
  latest_inspection: InspectionBrief | null;
}

export interface AssetStats {
  total: number;
  active: number;
  out_of_service: number;
  retired: number;
}

export interface InspectionStats {
  total: number;
  counts: Record<string, number>;
}

export interface DashboardTrendPoint {
  month: string;
  label: string;
  count: number;
}

export interface DashboardOverview {
  generated_at: string;
  inspections: {
    total: number;
    this_month: number;
    awaiting_review: number;
    ai_processing: number;
    counts: Record<string, number>;
  };
  findings: {
    total: number;
    open: number;
    counts: Record<string, number>;
  };
  work_orders: {
    total: number;
    active: number;
    overdue: number;
    counts: Record<string, number>;
  };
  inspection_trend: DashboardTrendPoint[];
  recent_inspections: {
    id: string;
    reference: string;
    status: string;
    asset: AssetBrief;
    inspected_at: string;
  }[];
  overdue_after_days: number;
}

export interface AssetBrief {
  id: string;
  code: string;
  name: string;
}

export interface UserBrief {
  id: string;
  full_name: string;
}

export interface InspectionSummary {
  id: string;
  reference: string;
  status: string;
  inspection_type: string;
  location_reference: string;
  notes: string;
  inspected_at: string;
  version: number;
  asset: AssetBrief;
  inspector: UserBrief;
  scope: ScopeInfo;
  created_at: string;
  updated_at: string;
}

export interface InspectionReview {
  id: string;
  decision: string;
  notes: string;
  reviewer: UserBrief;
  created_at: string;
}

export interface InspectionChecklistItem {
  item_code: string;
  item_label: string;
  position: number;
  is_required: boolean;
  result: string | null;
  notes: string;
  recorded_by: UserBrief | null;
  updated_at: string;
}

export interface InspectionChecklist {
  template_id: string | null;
  template_code: string | null;
  template_name: string | null;
  template_version: number | null;
  total: number;
  required_total: number;
  answered: number;
  required_unanswered: number;
  items: InspectionChecklistItem[];
}

export interface ChecklistTemplateItem {
  id: string;
  code: string;
  label: string;
  position: number;
  is_required: boolean;
}

export interface ChecklistTemplate {
  id: string;
  code: string;
  name: string;
  inspection_type: string;
  version: number;
  is_active: boolean;
  items: ChecklistTemplateItem[];
  created_at: string;
  updated_at: string;
}

export interface InspectionDetail extends InspectionSummary {
  media_count: number;
  pending_detections: number;
  reviews: InspectionReview[];
  checklist: InspectionChecklist | null;
}

export interface FindingBrief {
  id: string;
  reference: string;
  title: string;
  status: string;
  priority: string;
}

export interface Finding {
  id: string;
  reference: string;
  title: string;
  description: string;
  priority: string;
  status: string;
  resolution_notes: string;
  version: number;
  inspection: InspectionBrief;
  asset: AssetBrief;
  scope: ScopeInfo;
  created_by: UserBrief;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface WorkOrder {
  id: string;
  reference: string;
  title: string;
  instructions: string;
  status: string;
  completion_notes: string;
  verification_notes: string;
  version: number;
  finding: FindingBrief;
  asset: AssetBrief;
  scope: ScopeInfo;
  assignee: UserBrief;
  created_by: UserBrief;
  completed_at: string | null;
  verified_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface FindingDetail extends Finding {
  work_orders: WorkOrder[];
}

export interface FindingStats {
  total: number;
  counts: Record<string, number>;
}

export interface WorkOrderStats {
  total: number;
  counts: Record<string, number>;
}

export interface Assignee {
  id: string;
  full_name: string;
  scope: ScopeInfo;
}

export interface NotificationItem {
  id: string;
  kind: string;
  title: string;
  body: string;
  target_type: string | null;
  target_id: string | null;
  read_at: string | null;
  created_at: string;
}

export interface NotificationStats {
  unread: number;
}

export interface ReportInspectionRow {
  id: string;
  reference: string;
  status: string;
  inspection_type: string;
  asset: AssetBrief;
  inspector: UserBrief;
  inspected_at: string;
}

export interface ReportSummary {
  date_from: string;
  date_to: string;
  generated_at: string;
  totals: {
    inspections: number;
    findings: number;
    work_orders: number;
  };
  inspection_counts: Record<string, number>;
  finding_counts: Record<string, number>;
  work_order_counts: Record<string, number>;
  inspections: ReportInspectionRow[];
}

export interface MediaObject {
  id: string;
  inspection_id: string;
  filename: string;
  content_type: string;
  size_bytes: number;
  sha256: string | null;
  status: string;
  quarantine_reason: string | null;
  uploaded_by: UserBrief;
  uploaded_at: string | null;
  created_at: string;
}

export interface AIModelBrief {
  id: string;
  code: string;
  name: string;
  version: string;
}

export interface AIModelRegistryEntry extends AIModelBrief {
  family: string;
  modality: string;
  description: string;
  is_demo: boolean;
  status: string;
  approval_status: string;
  dataset_version: string | null;
  checksum_sha256: string | null;
  class_names: string[];
  training_config: Record<string, unknown>;
  evaluation_metrics: Record<string, unknown> | null;
  evaluation_notes: string;
  known_limitations: string;
  approval_notes: string;
  approved_at: string | null;
  deployed_at: string | null;
  retired_at: string | null;
  usage_count: number;
  last_used_at: string | null;
  created_at: string;
}

export interface AIModelCreatePayload {
  code: string;
  name: string;
  version: string;
  family?: string;
  description?: string;
  is_demo?: boolean;
  dataset_version?: string | null;
  checksum_sha256?: string | null;
  class_names?: string[];
  training_config?: Record<string, unknown>;
  evaluation_metrics?: Record<string, unknown> | null;
  evaluation_notes?: string;
  known_limitations?: string;
}

export interface AIModelHistoryEvent {
  id: string;
  action: string;
  actor_label: string | null;
  outcome: string;
  event_metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface DatasetInfo {
  id: string;
  code: string;
  name: string;
  version: string;
  source: string;
  license_note: string;
  description: string;
  class_names: string[];
  image_count: number;
  split_train: number;
  split_validation: number;
  split_test: number;
  status: string;
  approval_notes: string;
  approved_at: string | null;
  approved_by: UserBrief | null;
  created_at: string;
  updated_at: string;
}

export interface DatasetCreatePayload {
  code: string;
  name: string;
  version: string;
  source: string;
  license_note: string;
  description?: string;
  class_names?: string[];
  image_count?: number;
  split_train?: number;
  split_validation?: number;
  split_test?: number;
}

export interface SyntheticQualityMetrics {
  width: number;
  height: number;
  mean_luminance: number;
  contrast_stddev: number;
  edge_variance: number;
}

export interface SyntheticQualityResult {
  kind: string;
  advisory: boolean;
  disclaimer: string;
  metrics: SyntheticQualityMetrics;
  quality_flags: string[];
  thresholds?: Record<string, number>;
  note?: string;
}

export interface AIJob {
  id: string;
  inspection_id: string;
  media_id: string;
  status: string;
  error_code: string | null;
  result: SyntheticQualityResult | null;
  model: AIModelBrief;
  requested_by: UserBrief;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
}

export interface OpsAIJob {
  id: string;
  inspection_id: string;
  inspection_reference: string;
  inspection_status: string;
  media_id: string;
  media_filename: string;
  status: string;
  error_code: string | null;
  model: AIModelBrief;
  requested_by: UserBrief;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
}

export interface OpsLogEntry {
  ts: string;
  level: string;
  logger: string;
  message: string;
  request_id: string | null;
  event: string | null;
  method: string | null;
  path: string | null;
  status_code: number | null;
  duration_ms: number | null;
  outcome: string | null;
  error_code: string | null;
  exception: string | null;
}

export interface OpsLogPage {
  items: OpsLogEntry[];
  retained: number;
  capacity: number;
  generated_at: string;
  note: string;
}

export interface DeploymentRecord {
  id: string;
  version: string;
  environment: string;
  commit_sha: string | null;
  notes: string;
  recorded_by: string;
  recorded_at: string;
}

export interface DeploymentPayload {
  version: string;
  environment: "local" | "test" | "staging" | "production";
  commit_sha?: string | null;
  notes?: string;
}

export interface BackupStatus {
  status: string;
  configured: boolean;
  checked_at: string;
  last_backup_at: string | null;
  age_hours: number | null;
  size_bytes: number | null;
  checksum_sha256: string | null;
  last_restore_test_at: string | null;
  max_age_hours: number;
  detail: string;
}

export interface SyntheticResetPreview {
  enabled: boolean;
  environment: string;
  confirmation_phrase: string;
  scope_codes: string[];
  counts: Record<string, number>;
  total: number;
  reason: string | null;
}

export interface SyntheticResetResult {
  deleted: Record<string, number>;
  total: number;
  storage_cleanup: string;
  storage_objects_deleted: number;
  storage_failures: number;
  completed_at: string;
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly requestId?: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

interface ErrorEnvelope {
  error?: {
    code?: string;
    message?: string;
    request_id?: string;
    details?: unknown;
  };
}

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  token?: string | null;
  signal?: AbortSignal;
  timeoutMs?: number;
}

const REQUEST_TIMEOUT_MS = 15000;

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? REQUEST_TIMEOUT_MS);
  const onAbort = () => controller.abort();
  options.signal?.addEventListener("abort", onAbort, { once: true });

  const headers: Record<string, string> = { Accept: "application/json" };
  if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
  }
  if (options.token) {
    headers.Authorization = `Bearer ${options.token}`;
  }

  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method: options.method ?? (options.body !== undefined ? "POST" : "GET"),
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      credentials: "include",
      cache: "no-store",
      signal: controller.signal,
    });

    if (response.status === 204) {
      return undefined as T;
    }

    const payload = (await response.json().catch(() => null)) as (T & ErrorEnvelope) | null;
    if (!response.ok) {
      const error = payload?.error;
      throw new ApiError(
        response.status,
        error?.code ?? "request_failed",
        error?.message ?? `Permintaan gagal dengan status ${response.status}.`,
        error?.request_id,
        error?.details,
      );
    }
    return payload as T;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new ApiError(0, "timeout", "Permintaan melebihi batas waktu. Coba lagi.");
    }
    throw new ApiError(
      0,
      "network_error",
      API_BASE_URL
        ? `Tidak dapat menjangkau API RailwayVision di ${API_BASE_URL}.`
        : "Tidak dapat menjangkau API RailwayVision.",
    );
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener("abort", onAbort);
  }
}

export function uploadMediaContent(
  mediaId: string,
  file: File,
  token: string | null,
  onProgress?: (percent: number) => void,
): Promise<MediaObject> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", `${API_BASE_URL}/api/v1/media/${mediaId}/content`);
    xhr.setRequestHeader("Content-Type", file.type);
    xhr.setRequestHeader("Accept", "application/json");
    if (token) {
      xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    }
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };
    xhr.onerror = () => {
      reject(new ApiError(0, "network_error", "Unggahan tidak dapat menjangkau API RailwayVision."));
    };
    xhr.onload = () => {
      let payload: (MediaObject & ErrorEnvelope) | null = null;
      try {
        payload = xhr.responseText ? JSON.parse(xhr.responseText) : null;
      } catch {
        payload = null;
      }
      if (xhr.status >= 200 && xhr.status < 300 && payload) {
        resolve(payload);
        return;
      }
      const error = payload?.error;
      reject(
        new ApiError(
          xhr.status,
          error?.code ?? "request_failed",
          error?.message ?? `Unggahan gagal dengan status ${xhr.status}.`,
          error?.request_id,
          error?.details,
        ),
      );
    };
    xhr.send(file);
  });
}

export async function downloadFile(
  path: string,
  token: string | null,
  fallbackName: string,
): Promise<void> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    credentials: "include",
    cache: "no-store",
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as ErrorEnvelope | null;
    throw new ApiError(
      response.status,
      payload?.error?.code ?? "request_failed",
      payload?.error?.message ?? `Unduhan gagal dengan status ${response.status}.`,
      payload?.error?.request_id,
    );
  }
  const blob = await response.blob();
  const disposition = response.headers.get("Content-Disposition") ?? "";
  const matched = /filename="([^"]+)"/.exec(disposition);
  const filename = matched?.[1] ?? fallbackName;
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(objectUrl);
}

export async function fetchMediaBlob(
  mediaId: string,
  token: string | null,
  download = false,
): Promise<Blob> {
  const response = await fetch(
    `${API_BASE_URL}/api/v1/media/${mediaId}/content${download ? "?download=true" : ""}`,
    {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      credentials: "include",
      cache: "no-store",
    },
  );
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as ErrorEnvelope | null;
    throw new ApiError(
      response.status,
      payload?.error?.code ?? "request_failed",
      payload?.error?.message ?? `Tidak dapat memuat media (${response.status}).`,
      payload?.error?.request_id,
    );
  }
  return response.blob();
}

async function getJson<T>(path: string, signal?: AbortSignal): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  const onAbort = () => controller.abort();
  signal?.addEventListener("abort", onAbort, { once: true });
  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (!response.ok && response.status !== 503) {
      throw new Error(`Request to ${path} failed with status ${response.status}`);
    }
    return (await response.json()) as T;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", onAbort);
  }
}

export function fetchReadiness(signal?: AbortSignal): Promise<ReadinessResponse> {
  return getJson<ReadinessResponse>("/health/ready", signal);
}

export function fetchMeta(signal?: AbortSignal): Promise<MetaResponse> {
  return getJson<MetaResponse>("/api/v1/meta", signal);
}
