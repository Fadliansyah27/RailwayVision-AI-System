import type { ReactNode } from "react";

import type { Tone } from "@/lib/status";

const TONE_CLASSES: Record<Tone, string> = {
  success: "bg-success-soft text-success border-success/20",
  warning: "bg-warning-soft text-warning border-warning/20",
  critical: "bg-critical-soft text-critical border-critical/20",
  neutral: "bg-canvas text-secondary border-border",
  ai: "bg-ai-soft text-ai border-ai/20",
};

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <section className={`rv-card ${className}`}>{children}</section>;
}

export function CardHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border/80 px-5 py-4 sm:px-6 sm:py-5">
      <div className="min-w-0">
        <h2 className="text-[15px] font-semibold tracking-tight text-ink">{title}</h2>
        {description ? (
          <p className="mt-1 max-w-2xl text-[13px] leading-5 text-secondary">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function Chip({
  children,
  tone = "neutral",
  className = "",
}: {
  children: ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold tracking-wide shadow-[0_1px_0_rgba(255,255,255,0.6)_inset] ${TONE_CLASSES[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: ReactNode;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow ? (
          <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
            <span className="h-px w-6 bg-primary/40" aria-hidden="true" />
            {eyebrow}
          </p>
        ) : null}
        <h1 className="mt-2 text-[1.7rem] font-semibold leading-tight tracking-tight text-ink sm:text-[2rem]">
          {title}
        </h1>
        {description ? (
          <p className="mt-2 max-w-3xl text-sm leading-6 text-secondary">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  icon,
}: {
  title: string;
  description: string;
  icon?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-14 text-center">
      {icon ? (
        <div className="flex size-12 items-center justify-center rounded-2xl border border-border/80 bg-gradient-to-br from-canvas to-surface text-secondary shadow-[var(--rv-shadow-xs)]">
          {icon}
        </div>
      ) : null}
      <p className="text-[15px] font-semibold tracking-tight text-ink">{title}</p>
      <p className="max-w-md text-sm leading-6 text-secondary">{description}</p>
    </div>
  );
}

export function TabBar({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div
      className="grid gap-1.5 rounded-2xl border border-border/80 bg-surface p-1.5 shadow-[var(--rv-shadow-xs)] [grid-template-columns:repeat(auto-fit,minmax(150px,1fr))]"
      role="tablist"
      aria-label={label}
    >
      {children}
    </div>
  );
}

export function TabButton({
  active,
  onClick,
  title,
  description,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  description: string;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`flex min-w-0 flex-col rounded-xl px-3.5 py-2.5 text-left transition-all duration-200 ${
        active
          ? "bg-primary text-white shadow-[0_10px_24px_-14px_rgba(198,31,51,0.8)]"
          : "text-ink hover:bg-canvas"
      }`}
    >
      <span className="text-xs font-semibold">{title}</span>
      <span
        className={`mt-0.5 text-[10px] leading-4 ${
          active ? "text-white/75" : "text-secondary"
        }`}
      >
        {description}
      </span>
    </button>
  );
}
