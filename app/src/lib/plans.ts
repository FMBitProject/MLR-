// Plan catalog (PRD §12): price, quotas, and feature access per tier.
// Enforcement happens in the server actions that create users, products and
// submissions, and in the feature-gated actions (journal substantiation,
// custom workflows). Payment/upgrade flows come later — for now plans are
// assigned at registration (starter) or manually.

export type PlanId = "starter" | "growth" | "enterprise";

export type PlanDef = {
  id: PlanId;
  /** Regular (list) monthly price in IDR; null = custom quote (enterprise). */
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
    monthlyPriceIdr: 3_500_000,
    promoPriceIdr: 2_500_000,
    promoEndsAt: "2026-12-31",
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
    monthlyPriceIdr: 9_500_000,
    promoPriceIdr: 6_500_000,
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
    monthlyPriceIdr: null,
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
