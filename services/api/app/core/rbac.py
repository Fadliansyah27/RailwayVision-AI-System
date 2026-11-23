from enum import StrEnum


class RoleCode(StrEnum):
    ADMINISTRATOR = "administrator"
    INSPECTOR = "inspector"
    REVIEWER = "reviewer"
    SUPERVISOR = "supervisor"
    AI_ML_ENGINEER = "ai_ml_engineer"
    AUDITOR = "auditor"


class PermissionCode(StrEnum):
    DASHBOARD_READ = "dashboard:read"
    ASSETS_READ = "assets:read"
    ASSETS_WRITE = "assets:write"
    INSPECTIONS_READ = "inspections:read"
    INSPECTIONS_WRITE = "inspections:write"
    INSPECTIONS_SUBMIT = "inspections:submit"
    INSPECTIONS_MANAGE = "inspections:manage"
    MEDIA_UPLOAD = "media:upload"
    MEDIA_READ = "media:read"
    AI_ENQUEUE = "ai:enqueue"
    DETECTIONS_READ = "detections:read"
    REVIEW_DECIDE = "review:decide"
    FINDINGS_READ = "findings:read"
    FINDINGS_WRITE = "findings:write"
    WORK_ORDERS_READ = "work_orders:read"
    WORK_ORDERS_WRITE = "work_orders:write"
    WORK_ORDERS_VERIFY = "work_orders:verify"
    REPORTS_READ = "reports:read"
    AUDIT_READ = "audit:read"
    USERS_MANAGE = "users:manage"
    MODELS_MANAGE = "models:manage"
    NOTIFICATIONS_READ = "notifications:read"


ALL_PERMISSIONS: tuple[tuple[str, str], ...] = (
    (PermissionCode.DASHBOARD_READ, "Lihat dasbor operasional"),
    (PermissionCode.ASSETS_READ, "Lihat aset dan lokasi"),
    (PermissionCode.ASSETS_WRITE, "Buat dan perbarui aset"),
    (PermissionCode.INSPECTIONS_READ, "Lihat inspeksi"),
    (PermissionCode.INSPECTIONS_WRITE, "Buat dan ubah draf inspeksi"),
    (PermissionCode.INSPECTIONS_SUBMIT, "Kirim inspeksi untuk ditinjau"),
    (PermissionCode.INSPECTIONS_MANAGE, "Ubah inspeksi apa pun dalam cakupan"),
    (PermissionCode.MEDIA_UPLOAD, "Unggah media inspeksi"),
    (PermissionCode.MEDIA_READ, "Lihat media inspeksi yang diizinkan"),
    (PermissionCode.AI_ENQUEUE, "Minta analisis AI atas media"),
    (PermissionCode.DETECTIONS_READ, "Lihat deteksi AI"),
    (PermissionCode.REVIEW_DECIDE, "Catat keputusan peninjauan manusia"),
    (PermissionCode.FINDINGS_READ, "Lihat temuan terverifikasi"),
    (PermissionCode.FINDINGS_WRITE, "Buat dan kelola temuan"),
    (PermissionCode.WORK_ORDERS_READ, "Lihat perintah kerja"),
    (PermissionCode.WORK_ORDERS_WRITE, "Buat dan perbarui perintah kerja"),
    (PermissionCode.WORK_ORDERS_VERIFY, "Verifikasi penyelesaian perintah kerja"),
    (PermissionCode.REPORTS_READ, "Lihat dan ekspor laporan"),
    (PermissionCode.AUDIT_READ, "Lihat peristiwa audit"),
    (PermissionCode.USERS_MANAGE, "Kelola pengguna, peran, dan cakupan"),
    (PermissionCode.MODELS_MANAGE, "Kelola registri model AI"),
    (PermissionCode.NOTIFICATIONS_READ, "Lihat notifikasi"),
)

ROLE_DEFINITIONS: dict[str, tuple[str, str, tuple[str, ...]]] = {
    RoleCode.ADMINISTRATOR: (
        "Administrator",
        "Administrasi platform penuh",
        tuple(code for code, _ in ALL_PERMISSIONS),
    ),
    RoleCode.INSPECTOR: (
        "Inspektur / Teknisi",
        "Pencatatan dan pengiriman inspeksi lapangan",
        (
            PermissionCode.DASHBOARD_READ,
            PermissionCode.ASSETS_READ,
            PermissionCode.INSPECTIONS_READ,
            PermissionCode.INSPECTIONS_WRITE,
            PermissionCode.INSPECTIONS_SUBMIT,
            PermissionCode.MEDIA_UPLOAD,
            PermissionCode.MEDIA_READ,
            PermissionCode.AI_ENQUEUE,
            PermissionCode.DETECTIONS_READ,
            PermissionCode.WORK_ORDERS_READ,
            PermissionCode.NOTIFICATIONS_READ,
        ),
    ),
    RoleCode.REVIEWER: (
        "Peninjau Teknik",
        "Verifikasi manusia atas saran AI dan temuan",
        (
            PermissionCode.DASHBOARD_READ,
            PermissionCode.ASSETS_READ,
            PermissionCode.INSPECTIONS_READ,
            PermissionCode.MEDIA_READ,
            PermissionCode.DETECTIONS_READ,
            PermissionCode.REVIEW_DECIDE,
            PermissionCode.FINDINGS_READ,
            PermissionCode.FINDINGS_WRITE,
            PermissionCode.WORK_ORDERS_READ,
            PermissionCode.REPORTS_READ,
            PermissionCode.NOTIFICATIONS_READ,
        ),
    ),
    RoleCode.SUPERVISOR: (
        "Supervisor",
        "Pengawasan cakupan, kendali perintah kerja, dan tinjauan audit",
        (
            PermissionCode.DASHBOARD_READ,
            PermissionCode.ASSETS_READ,
            PermissionCode.ASSETS_WRITE,
            PermissionCode.INSPECTIONS_READ,
            PermissionCode.INSPECTIONS_WRITE,
            PermissionCode.INSPECTIONS_SUBMIT,
            PermissionCode.INSPECTIONS_MANAGE,
            PermissionCode.MEDIA_READ,
            PermissionCode.AI_ENQUEUE,
            PermissionCode.DETECTIONS_READ,
            PermissionCode.REVIEW_DECIDE,
            PermissionCode.FINDINGS_READ,
            PermissionCode.FINDINGS_WRITE,
            PermissionCode.WORK_ORDERS_READ,
            PermissionCode.WORK_ORDERS_WRITE,
            PermissionCode.WORK_ORDERS_VERIFY,
            PermissionCode.REPORTS_READ,
            PermissionCode.AUDIT_READ,
            PermissionCode.NOTIFICATIONS_READ,
        ),
    ),
    RoleCode.AI_ML_ENGINEER: (
        "Engineer AI/ML",
        "Pengelolaan registri model dan operasi pipeline AI (tanpa keputusan keselamatan)",
        (
            PermissionCode.DASHBOARD_READ,
            PermissionCode.ASSETS_READ,
            PermissionCode.INSPECTIONS_READ,
            PermissionCode.MEDIA_READ,
            PermissionCode.AI_ENQUEUE,
            PermissionCode.DETECTIONS_READ,
            PermissionCode.MODELS_MANAGE,
            PermissionCode.REPORTS_READ,
            PermissionCode.NOTIFICATIONS_READ,
        ),
    ),
    RoleCode.AUDITOR: (
        "Auditor",
        "Akses jaminan hanya-baca",
        (
            PermissionCode.DASHBOARD_READ,
            PermissionCode.ASSETS_READ,
            PermissionCode.INSPECTIONS_READ,
            PermissionCode.MEDIA_READ,
            PermissionCode.DETECTIONS_READ,
            PermissionCode.FINDINGS_READ,
            PermissionCode.WORK_ORDERS_READ,
            PermissionCode.REPORTS_READ,
            PermissionCode.AUDIT_READ,
            PermissionCode.NOTIFICATIONS_READ,
        ),
    ),
}

INSPECTION_STATUSES = (
    "draft",
    "submitted",
    "ai_processing",
    "ai_processed",
    "under_review",
    "reviewed",
    "ai_failed",
    "cancelled",
    "inconclusive",
)

ASSET_STATUSES = ("active", "out_of_service", "retired")
