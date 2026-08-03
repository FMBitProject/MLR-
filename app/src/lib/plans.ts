// Plan catalog (PRD §12): price, quotas, and feature access per tier.
// Enforcement happens in the server actions that create users, products and
// submissions, and in the feature-gated actions (journal substantiation,
// custom workflows). Payment/upgrade flows come later — for now plans are
// assigned at registration (starter) or manually.

export type PlanId = "starter" | "growth" | "enterprise";

export type PlanDef = {
  id: PlanId;
  /**
   * Regular (list) monthly price in IDR.
   *   0    = free forever (Starter) — never invoiced, never locked
   *   null = custom quote, billed outside the app
   */
  monthlyPriceIdr: number | null;
  /** Time-limited launch promo price; applies while today <= promoEndsAt. */
  promoPriceIdr?: number;
  /** Last day the promo price applies (inclusive, WIB), as YYYY-MM-DD. */
  promoEndsAt?: string;
  limits: {
    users: number;
    products: number;
    /** New submissions per calendar month across the tenant. */
    submissionsPerMonth: number;
  };
  features: {
    /** AI claims check vs the Approved Claims Library — core, every plan. */
    aiClaimsCheck: boolean;
    /** On-demand AI substantiation against journal full text / abstracts. */
    journalSubstantiation: boolean;
    /** Per-channel review workflow configuration (else the default 3-stage). */
    customWorkflows: boolean;
    prioritySupport: boolean;
    dedicatedOnboarding: boolean;
  };
};

export const PLANS: Record<PlanId, PlanDef> = {
  starter: {
    id: "starter",
    // Free tier: lets a pharma company run a real submission through the full
    // MLR workflow before committing. The quota limits below are what push an
    // active team onto Growth.
    monthlyPriceIdr: 0,
    limits: { users: 15, products: 3, submissionsPerMonth: 25 },
    features: {
      aiClaimsCheck: true,
      journalSubstantiation: false,
      customWorkflows: false,
      prioritySupport: false,
      dedicatedOnboarding: false,
    },
  },
  growth: {
    id: "growth",
    monthlyPriceIdr: 1_000_000,
    promoPriceIdr: 799_000,
    promoEndsAt: "2026-12-31",
    limits: { users: 50, products: 15, submissionsPerMonth: 150 },
    features: {
      aiClaimsCheck: true,
      journalSubstantiation: true,
      customWorkflows: true,
      prioritySupport: true,
      dedicatedOnboarding: false,
    },
  },
  enterprise: {
    id: "enterprise",
    monthlyPriceIdr: 3_000_000,
    promoPriceIdr: 1_500_000,
    promoEndsAt: "2026-12-31",
    limits: { users: Infinity, products: Infinity, submissionsPerMonth: Infinity },
    features: {
      aiClaimsCheck: true,
      journalSubstantiation: true,
      customWorkflows: true,
      prioritySupport: true,
      dedicatedOnboarding: true,
    },
  },
};

export function planDef(plan: string | null | undefined): PlanDef {
  return PLANS[(plan ?? "starter") as PlanId] ?? PLANS.starter;
}

export function planLimits(plan: string | null | undefined) {
  return planDef(plan).limits;
}

export function planHas(
  plan: string | null | undefined,
  feature: keyof PlanDef["features"],
) {
  return planDef(plan).features[feature];
}

/** Free forever — no invoice is ever raised and the workspace is never locked. */
export function isFreePlan(def: PlanDef): boolean {
  return def.monthlyPriceIdr === 0;
}

/**
 * Whether the app bills this plan itself through Midtrans. False for the free
 * tier and for custom-quote plans, which are handled outside the app.
 */
export function isBillablePlan(def: PlanDef): boolean {
  return def.monthlyPriceIdr !== null && def.monthlyPriceIdr > 0;
}

/** Plans a workspace can move onto by paying an invoice, cheapest first. */
export const UPGRADABLE_PLANS: PlanId[] = ["growth", "enterprise"];

export function promoActive(def: PlanDef, now = new Date()): boolean {
  return (
    def.promoPriceIdr != null &&
    def.promoEndsAt != null &&
    now <= new Date(`${def.promoEndsAt}T23:59:59+07:00`)
  );
}

/** The price a tenant actually pays this month: promo while it runs, else list. */
export function effectivePriceIdr(def: PlanDef, now = new Date()): number | null {
  return promoActive(def, now) ? (def.promoPriceIdr ?? def.monthlyPriceIdr) : def.monthlyPriceIdr;
}

/** "Rp 3.500.000" — no decimals; used on the pricing page and settings. */
export function formatIdr(amount: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(amount);
}
