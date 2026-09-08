import Link from "next/link";
import { and, count, desc, eq, gte, lt, sql } from "drizzle-orm";
import { TrendingDown, TimerReset } from "lucide-react";
import { db, t } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { getDict } from "@/lib/i18n-server";
import { formatDate, relativeDays } from "@/lib/i18n";
import { Card, CardHeader, PageHeader, StatusBadge } from "@/components/ui";

const MARK = "#0d9488"; // validated: lightness/chroma/contrast pass on light surface

export default async function DashboardPage() {
  const user = await requireUser();
  const { dict, locale } = await getDict();

  // Every figure on this page is an aggregate over the tenant's whole
  // history, so all of it is computed in SQL. Reading the submissions and
  // stages to reduce them in JS made the dashboard the heaviest page in the
  // app, growing with the workspace's age rather than with what it shows.
  const now = new Date();
  const cutoff30 = new Date(now.getTime() - 30 * 86_400_000);
  const in30Days = new Date(now.getTime() + 30 * 86_400_000);

  const [totals, flagCount, stageWaits, expiring, recent] = await Promise.all([
    db
      .select({
        total: count(),
        inReview: count(
          sql`case when ${t.contentSubmissions.status} = 'in_review' then 1 end`,
        ),
        approved30: count(
          sql`case when ${t.contentSubmissions.status} = 'approved'
                    and ${t.contentSubmissions.decidedAt} >= ${cutoff30} then 1 end`,
        ),
        // Seconds, so the driver hands back a plain number rather than an
        // interval; converted to days below.
        avgCycleSeconds: sql<number | null>`
          avg(extract(epoch from (${t.contentSubmissions.decidedAt}
                                  - ${t.contentSubmissions.createdAt})))
        `.mapWith(Number),
      })
      .from(t.contentSubmissions)
      .where(eq(t.contentSubmissions.tenantId, user.tenantId))
      .then((r) => r[0]),

    // Joined and counted entirely in SQL. Reading the tenant's versions just
    // to collect their ids would both pull the inline file bytes and put
    // every id into an IN list.
    db
      .select({ n: count() })
      .from(t.claimFlags)
      .innerJoin(t.contentVersions, eq(t.claimFlags.versionId, t.contentVersions.id))
      .innerJoin(
        t.contentSubmissions,
        eq(t.contentVersions.submissionId, t.contentSubmissions.id),
      )
      .where(eq(t.contentSubmissions.tenantId, user.tenantId))
      .then((r) => r[0].n),

    // Average days a stage sat before being decided: from the previous
    // stage's decision, or the submission's creation for the first stage.
    // row_number/lag express "previous stage in order" without assuming
    // stage_order starts at any particular number; a stage whose predecessor
    // is still undecided has no measurable wait and drops out.
    db
      .execute(sql`
        select reviewer_role,
               avg(extract(epoch from (decided_at - start_at))) as avg_seconds,
               count(*) as n
        from (
          select rs.reviewer_role,
                 rs.decided_at,
                 case
                   when row_number() over w = 1 then cs.created_at
                   else lag(rs.decided_at) over w
                 end as start_at
          from ${t.reviewStages} rs
          join ${t.contentSubmissions} cs on cs.id = rs.submission_id
          where cs.tenant_id = ${user.tenantId}
          window w as (partition by rs.submission_id order by rs.stage_order)
        ) staged
        where decided_at is not null and start_at is not null
        group by reviewer_role
      `)
      .then((r) => r.rows as Array<{ reviewer_role: string; avg_seconds: string; n: string }>),

    db
      .select({ claim: t.approvedClaims, product: t.products })
      .from(t.approvedClaims)
      .innerJoin(t.products, eq(t.approvedClaims.productId, t.products.id))
      .where(
        and(
          eq(t.approvedClaims.tenantId, user.tenantId),
          eq(t.approvedClaims.status, "active"),
          gte(t.approvedClaims.expiresAt, now),
          lt(t.approvedClaims.expiresAt, in30Days),
        ),
      ),

    db
      .select({ log: t.auditLog, actor: t.users })
      .from(t.auditLog)
      .innerJoin(t.users, eq(t.auditLog.performedBy, t.users.id))
      .where(eq(t.auditLog.tenantId, user.tenantId))
      .orderBy(desc(t.auditLog.createdAt))
      .limit(8),
  ]);

  const inReview = totals.inReview;
  const approved30 = totals.approved30;
  const avgCycle = (totals.avgCycleSeconds ?? 0) / 86_400;
  const flagRate = totals.total ? flagCount / totals.total : 0;

  const stageRoles = ["medical_reviewer", "legal_reviewer", "regulatory_reviewer"] as const;
  const stageDays = stageRoles.map((role) => {
    const row = stageWaits.find((s) => s.reviewer_role === role);
    return {
      role,
      avg: row ? Number(row.avg_seconds) / 86_400 : 0,
      n: row ? Number(row.n) : 0,
    };
  });
  const maxAvg = Math.max(...stageDays.map((s) => s.avg), 1);
  const bottleneck = stageDays.reduce((a, b) => (b.avg > a.avg ? b : a));

  const nf = new Intl.NumberFormat(locale === "id" ? "id-ID" : "en-US", {
    maximumFractionDigits: 1,
  });

  const stageLabel = (role: string) =>
    role === "medical_reviewer"
      ? dict.dashboard.stageMedical
      : role === "legal_reviewer"
        ? dict.dashboard.stageLegal
        : dict.dashboard.stageRegulatory;

  const kpis = [
    { label: dict.dashboard.inReview, value: String(inReview), sub: null },
    { label: dict.dashboard.approved30, value: String(approved30), sub: null },
    {
      label: dict.dashboard.avgCycle,
      value: nf.format(avgCycle),
      sub: dict.dashboard.days,
    },
    { label: dict.dashboard.flagRate, value: nf.format(flagRate), sub: null },
  ];

  // Chart geometry (single series, one hue, rounded data-end, 2px gaps via row spacing)
  const CW = 560;
  const ROW = 46;
  const LABEL_W = 96;
  const BAR_H = 14;
  const CH = stageRoles.length * ROW + 8;
  const plotW = CW - LABEL_W - 128;

  const barPath = (x: number, y: number, w: number, h: number) => {
    const r = Math.min(4, w);
    return `M${x},${y} h${w - r} q${r},0 ${r},${r / 2} v${h - r} q0,${r / 2} -${r},${r / 2} h-${w - r} Z`;
  };

  return (
    <div className="animate-fade-up">
      <PageHeader title={dict.dashboard.title} subtitle={dict.dashboard.subtitle} />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {kpis.map((k) => (
          <Card key={k.label} className="px-5 py-4">
            <p className="text-[12px] font-medium text-slate-500">{k.label}</p>
            <p className="mt-1.5 text-[30px] font-semibold leading-none tracking-tight text-slate-900">
              {k.value}
              {k.sub ? (
                <span className="ml-1.5 text-[14px] font-medium text-slate-400">{k.sub}</span>
              ) : null}
            </p>
          </Card>
        ))}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[1.4fr_1fr]">
        <Card className="self-start">
          <CardHeader
            title={dict.dashboard.cycleByStage}
            desc={dict.dashboard.cycleByStageDesc}
          />
          <div className="px-6 py-5">
            <svg
              viewBox={`0 0 ${CW} ${CH}`}
              className="w-full"
              role="img"
              aria-label={dict.dashboard.cycleByStage}
            >
              {[0.25, 0.5, 0.75, 1].map((f) => (
                <line
                  key={f}
                  x1={LABEL_W + plotW * f}
                  x2={LABEL_W + plotW * f}
                  y1={0}
                  y2={CH - 8}
                  stroke="#eef2f6"
                  strokeWidth="1"
                />
              ))}
              <line x1={LABEL_W} x2={LABEL_W} y1={0} y2={CH - 8} stroke="#dbe2ea" strokeWidth="1.5" />
              {stageDays.map((s, i) => {
                const w = Math.max(3, (s.avg / maxAvg) * plotW);
                const y = i * ROW + (ROW - BAR_H) / 2;
                const isBn = s.role === bottleneck.role && s.avg > 0;
                return (
                  <g key={s.role}>
                    <title>{`${stageLabel(s.role)}: ${nf.format(s.avg)} ${dict.dashboard.days} (n=${s.n})`}</title>
                    <text
                      x={LABEL_W - 10}
                      y={y + BAR_H / 2 + 4}
                      textAnchor="end"
                      className="fill-slate-600"
                      fontSize="12.5"
                      fontWeight="500"
                    >
                      {stageLabel(s.role)}
                    </text>
                    <path d={barPath(LABEL_W + 1, y, w, BAR_H)} fill={MARK} />
                    <text
                      x={LABEL_W + w + 10}
                      y={y + BAR_H / 2 + 4}
                      fontSize="12.5"
                      fontWeight="600"
                      className="fill-slate-800"
                    >
                      {nf.format(s.avg)} {dict.dashboard.days}
                    </text>
                    {isBn ? (
                      <text
                        x={LABEL_W + w + 10}
                        y={y + BAR_H / 2 + 20}
                        fontSize="10.5"
                        className="fill-amber-600"
                        fontWeight="600"
                      >
                        ⚠ {dict.dashboard.bottleneck}
                      </text>
                    ) : null}
                  </g>
                );
              })}
            </svg>
          </div>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader
              title={
                <span className="flex items-center gap-2">
                  <TimerReset className="size-4 text-amber-500" />
                  {dict.dashboard.expiringClaims}
                </span>
              }
              action={
                <Link
                  href="/claims"
                  className="text-[12.5px] font-semibold text-brand-700 hover:text-brand-800"
                >
                  {dict.dashboard.viewAll} →
                </Link>
              }
            />
            <div className="divide-y divide-slate-100">
              {expiring.length ? (
                expiring.map(({ claim, product }) => {
                  const daysLeft = Math.ceil(
                    (claim.expiresAt!.getTime() - now.getTime()) / 86_400_000,
                  );
                  return (
                    <div key={claim.id} className="px-6 py-3.5">
                      <p className="line-clamp-2 text-[13px] leading-snug text-slate-700">
                        {claim.claimText}
                      </p>
                      <p className="mt-1 text-[11.5px] text-slate-500">
                        <span className="font-semibold text-brand-800">{product.name}</span>
                        {" · "}
                        <span className="font-semibold text-amber-700">
                          {dict.dashboard.expiresIn} {daysLeft} {dict.dashboard.days}
                        </span>
                        {" · "}
                        {formatDate(claim.expiresAt, locale)}
                      </p>
                    </div>
                  );
                })
              ) : (
                <p className="px-6 py-5 text-[13px] text-slate-400">
                  {dict.dashboard.noExpiring}
                </p>
              )}
            </div>
          </Card>

          <Card>
            <CardHeader title={dict.dashboard.recentActivity} />
            <ul className="divide-y divide-slate-100">
              {recent.map(({ log, actor }) => (
                <li key={log.id} className="flex items-baseline gap-3 px-6 py-3">
                  <span className="w-20 shrink-0 font-mono text-[11px] text-slate-400">
                    {relativeDays(log.createdAt, locale)}
                  </span>
                  <span className="text-[12.5px] leading-snug text-slate-600">
                    <strong className="font-semibold text-slate-800">{actor.name}</strong>{" "}
                    {dict.audit.actions[log.action as keyof typeof dict.audit.actions] ??
                      log.action}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>

      {inReview > 0 ? (
        <Card className="mt-6 border-sky-200 bg-gradient-to-r from-sky-50/70 to-white">
          <div className="flex flex-wrap items-center gap-3 px-6 py-4">
            <TrendingDown className="size-5 text-sky-600" />
            <p className="text-[13.5px] text-slate-700">
              <strong>{inReview}</strong>{" "}
              {locale === "id"
                ? "konten sedang menunggu keputusan reviewer."
                : "items are waiting on reviewer decisions."}
            </p>
            <Link
              href="/submissions?status=in_review"
              className="ml-auto rounded-xl bg-sky-600 px-4 py-2 text-[12.5px] font-semibold text-white shadow-sm transition hover:bg-sky-700"
            >
              {dict.dashboard.viewAll} →
            </Link>
          </div>
        </Card>
      ) : null}

      <div className="mt-6 flex flex-wrap gap-2 text-[11px] text-slate-400">
        <StatusBadge status="in_review" label={dict.status.in_review} />
        <StatusBadge status="changes_requested" label={dict.status.changes_requested} />
        <StatusBadge status="approved" label={dict.status.approved} />
        <StatusBadge status="rejected" label={dict.status.rejected} />
      </div>
    </div>
  );
}
