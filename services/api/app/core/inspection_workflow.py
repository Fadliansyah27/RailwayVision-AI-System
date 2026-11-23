"""Server-side inspection workflow rules.

Statuses and inspection types are provisional until KCIC approves its own
procedure. The transition sets below are the single source of truth for the
API; the demo worker mirrors the AI transitions with SQL.
"""

INSPECTION_STATUSES: tuple[str, ...] = (
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

INSPECTION_TYPES: tuple[str, ...] = (
    "routine",
    "detailed",
    "follow_up",
    "emergency",
)

EDITABLE_STATUSES = frozenset({"draft"})
REVIEW_START_STATUSES = frozenset({"submitted", "ai_processed"})
DECIDABLE_STATUSES = frozenset({"submitted", "ai_processed", "under_review"})
CANCELLABLE_STATUSES = frozenset(
    {"draft", "submitted", "ai_processing", "ai_processed", "ai_failed"}
)
REOPENABLE_STATUSES = frozenset({"reviewed", "inconclusive"})
AI_QUEUE_STATUSES = frozenset({"submitted", "ai_processed", "ai_failed"})
TERMINAL_STATUSES = frozenset({"reviewed", "cancelled", "inconclusive"})

REVIEW_DECISION_STATUSES: dict[str, str] = {
    "accepted": "reviewed",
    "returned": "draft",
    "inconclusive": "inconclusive",
}
