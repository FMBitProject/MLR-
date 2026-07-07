import Link from "next/link";
import { and, desc, eq, inArray } from "drizzle-orm";
import { Plus, Inbox } from "lucide-react";
import { db, t } from "@/lib/db";
import { requireUser, REVIEWER_ROLES } from "@/lib/auth";
import { getDict } from "@/lib/i18n-server";
import { relativeDays } from "@/lib/i18n";
import { Avatar, Card, EmptyState, PageHeader, StatusBadge, Chip } from "@/components/ui";

export default async function SubmissionsPage(props: PageProps<"/submissions">) {
  const user = await requireUser();
  const { dict, locale } = await getDict();
  const sp = await props.searchParams;
  const statusFilter = typeof sp.status === "string" ? sp.status : null;

  const subs = db
    .select({
      sub: t.contentSubmissions,
      product: t.products,
      submitter: t.users,
    })
    .from(t.contentSubmissions)
    .innerJoin(t.products, eq(t.contentSubmissions.productId, t.products.id))
    .innerJoin(t.users, eq(t.contentSubmissions.submittedBy, t.users.id))
    .where(
      and(
        eq(t.contentSubmissions.tenantId, user.tenantId),
        ...(statusFilter ? [eq(t.contentSubmissions.status, statusFilter)] : []),
      ),
    )
    .orderBy(desc(t.contentSubmissions.createdAt))
    .all();

  const subIds = subs.map((s) => s.sub.id);
  const versions = subIds.length
    ? db
        .select()
        .from(t.contentVersions)
        .where(inArray(t.contentVersions.submissionId, subIds))
        .all()
    : [];
  const stages = subIds.length
    ? db
        .select()
        .from(t.reviewStages)
        .where(inArray(t.reviewStages.submissionId, subIds))
        .all()
    : [];

  const latestVersion = (subId: string) =>
    Math.max(0, ...versions.filter((v) => v.submissionId === subId).map((v) => v.versionNumber));
  const stageDots = (subId: string) =>
    stages
      .filter((s) => s.submissionId === subId)
      .sort((a, b) => a.stageOrder - b.stageOrder);

  const isReviewer = REVIEWER_ROLES.includes(user.role as (typeof REVIEWER_ROLES)[number]);
  const myQueue = isReviewer
    ? subs.filter(
        (s) => s.sub.status === "in_review" && s.sub.currentStage === user.role,
      )
    : [];

  const filters = ["all", "in_review", "changes_requested", "approved", "rejected"] as const;

  const roleShort = (role: string) =>
    dict.roles[role as keyof typeof dict.roles] ?? role;

  const row = ({ sub, product, submitter }: (typeof subs)[number]) => (
    <Link
      key={sub.id}
      href={`/submissions/${sub.id}`}
      className="group grid grid-cols-[1fr_auto] items-center gap-4 px-6 py-4 transition hover:bg-slate-50 sm:grid-cols-[minmax(0,2.2fr)_minmax(0,1fr)_auto_auto]"
    >
      <div className="min-w-0">
        <p className="truncate text-[14px] font-medium text-slate-900 group-hover:text-brand-800">
          {sub.title}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-[12px] text-slate-500">
          <Chip tone="brand">{product.name}</Chip>
          <Chip>{dict.channels[sub.channel as keyof typeof dict.channels] ?? sub.channel}</Chip>
          <span>v{latestVersion(sub.id)}</span>
          <span>·</span>
          <span>{relativeDays(sub.createdAt, locale)}</span>
        </div>
      </div>

      <div className="hidden items-center gap-1.5 sm:flex">
        {stageDots(sub.id).map((s) => (
          <span
            key={s.id}
            title={`${roleShort(s.reviewerRole)}: ${dict.status[s.status as keyof typeof dict.status] ?? s.status}`}
            className={
              "h-1.5 w-7 rounded-full " +
              (s.status === "approved"
                ? "bg-emerald-500"
                : s.status === "in_progress"
                  ? "bg-sky-500"
                  : s.status === "changes_requested"
                    ? "bg-amber-500"
                    : s.status === "rejected"
                      ? "bg-rose-500"
                      : "bg-slate-200")
            }
          />
        ))}
      </div>

      <div className="hidden items-center gap-2 sm:flex">
        <Avatar name={submitter.name} size={26} />
      </div>

      <StatusBadge
        status={sub.status}
        label={dict.status[sub.status as keyof typeof dict.status] ?? sub.status}
      />
    </Link>
  );

  return (
    <div className="animate-fade-up">
      <PageHeader
        title={dict.submissions.title}
        subtitle={dict.submissions.subtitle}
        action={
          <Link
            href="/submissions/new"
            className="inline-flex items-center gap-2 rounded-xl bg-brand-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-800 active:scale-[0.99]"
          >
            <Plus className="size-4" />
            {dict.submissions.newSubmission}
          </Link>
        }
      />

      {isReviewer ? (
        <Card className="mb-6 overflow-hidden border-brand-200 bg-gradient-to-r from-brand-50/70 to-white">
          <div className="border-b border-brand-100 px-6 py-3">
            <h2 className="text-[14px] font-semibold text-brand-900">
              {dict.submissions.myQueueTitle}
            </h2>
          </div>
          {myQueue.length ? (
            <div className="divide-y divide-slate-100">{myQueue.map(row)}</div>
          ) : (
            <p className="px-6 py-5 text-sm text-slate-500">{dict.submissions.myQueueEmpty}</p>
          )}
        </Card>
      ) : null}

      <div className="mb-4 flex flex-wrap gap-2">
        {filters.map((f) => {
          const active = f === "all" ? !statusFilter : statusFilter === f;
          return (
            <Link
              key={f}
              href={f === "all" ? "/submissions" : `/submissions?status=${f}`}
              className={
                "rounded-full px-3.5 py-1.5 text-[12.5px] font-medium ring-1 ring-inset transition " +
                (active
                  ? "bg-slate-900 text-white ring-slate-900"
                  : "bg-white text-slate-600 ring-slate-200 hover:bg-slate-50")
              }
            >
              {f === "all"
                ? dict.submissions.all
                : dict.status[f as keyof typeof dict.status]}
            </Link>
          );
        })}
      </div>

      <Card className="overflow-hidden">
        {subs.length ? (
          <div className="divide-y divide-slate-100">{subs.map(row)}</div>
        ) : (
          <EmptyState
            icon={<Inbox className="size-8 text-slate-300" />}
            text={dict.submissions.empty}
          />
        )}
      </Card>
    </div>
  );
}
