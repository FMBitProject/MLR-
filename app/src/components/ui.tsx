import clsx from "clsx";
import type { ReactNode } from "react";

export function Card({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={clsx(
        "rounded-2xl border border-slate-200/80 bg-white shadow-card",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  desc,
  action,
}: {
  title: ReactNode;
  desc?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-4">
      <div>
        <h2 className="text-[15px] font-semibold text-slate-900">{title}</h2>
        {desc ? <p className="mt-0.5 text-[13px] text-slate-500">{desc}</p> : null}
      </div>
      {action}
    </div>
  );
}

const STATUS_STYLES: Record<string, string> = {
  in_review: "bg-sky-50 text-sky-700 ring-sky-600/20",
  in_progress: "bg-sky-50 text-sky-700 ring-sky-600/20",
  pending: "bg-slate-100 text-slate-600 ring-slate-500/20",
  changes_requested: "bg-amber-50 text-amber-700 ring-amber-600/25",
  approved: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  active: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  rejected: "bg-rose-50 text-rose-700 ring-rose-600/20",
  expired: "bg-rose-50 text-rose-700 ring-rose-600/20",
  withdrawn: "bg-slate-100 text-slate-500 ring-slate-500/20",
  skipped: "bg-slate-100 text-slate-500 ring-slate-500/20",
  processing: "bg-violet-50 text-violet-700 ring-violet-600/20",
};

export function StatusBadge({
  status,
  label,
  className,
}: {
  status: string;
  label: string;
  className?: string;
}) {
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset",
        STATUS_STYLES[status] ?? STATUS_STYLES.pending,
        className,
      )}
    >
      <span
        className={clsx("size-1.5 rounded-full", {
          "bg-sky-500": status === "in_review" || status === "in_progress",
          "bg-slate-400": status === "pending" || status === "withdrawn" || status === "skipped",
          "bg-amber-500": status === "changes_requested",
          "bg-emerald-500": status === "approved" || status === "active",
          "bg-rose-500": status === "rejected" || status === "expired",
          "bg-violet-500": status === "processing",
        })}
      />
      {label}
    </span>
  );
}

export function Chip({
  children,
  tone = "slate",
}: {
  children: ReactNode;
  tone?: "slate" | "brand" | "amber";
}) {
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset",
        tone === "slate" && "bg-slate-50 text-slate-600 ring-slate-200",
        tone === "brand" && "bg-brand-50 text-brand-800 ring-brand-200",
        tone === "amber" && "bg-amber-50 text-amber-800 ring-amber-200",
      )}
    >
      {children}
    </span>
  );
}

export function Avatar({ name, size = 32 }: { name: string; size?: number }) {
  const initials = name
    .replace(/^(dr|drg|prof)\.?\s+/i, "")
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
  const hues = [172, 199, 262, 335, 25, 152];
  const hue = hues[(name.charCodeAt(0) + name.length) % hues.length];
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.38,
        background: `linear-gradient(135deg, hsl(${hue} 55% 42%), hsl(${hue} 60% 30%))`,
      }}
      title={name}
    >
      {initials}
    </span>
  );
}

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-[22px] font-semibold tracking-tight text-slate-900">{title}</h1>
        {subtitle ? <p className="mt-1 text-sm text-slate-500">{subtitle}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function EmptyState({ icon, text }: { icon?: ReactNode; text: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-14 text-center">
      {icon}
      <p className="text-sm text-slate-500">{text}</p>
    </div>
  );
}
