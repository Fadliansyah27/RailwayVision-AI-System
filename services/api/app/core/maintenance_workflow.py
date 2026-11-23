"""Server-side rules for findings, work orders, and their linkage.

These are provisional synthetic workflow rules, not KCIC procedures. A finding is a
human-verified follow-up observation; a work order is corrective-action tracking.
Neither is a safety clearance.
"""

FINDING_PRIORITIES: tuple[str, ...] = ("low", "medium", "high")

FINDING_STATUSES: tuple[str, ...] = (
    "confirmed",
    "assigned",
    "in_progress",
    "awaiting_verification",
    "closed",
    "rejected",
)

WORK_ORDER_STATUSES: tuple[str, ...] = (
    "open",
    "in_progress",
    "awaiting_verification",
    "completed",
    "cancelled",
)

FINDABLE_INSPECTION_STATUSES = frozenset({"reviewed", "inconclusive"})
SUPERSEDABLE_FINDING_STATUSES = frozenset({"closed", "rejected"})

ACTIVE_WORK_ORDER_STATUSES = frozenset({"open", "in_progress", "awaiting_verification"})
CANCELLABLE_WORK_ORDER_STATUSES = frozenset({"open", "in_progress"})
REJECTABLE_FINDING_STATUSES = frozenset({"confirmed"})
REOPENABLE_FINDING_STATUSES = frozenset({"closed", "rejected"})
EDITABLE_FINDING_STATUSES = frozenset({"confirmed"})
