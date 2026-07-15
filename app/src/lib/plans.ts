// Plan catalog (PRD §12): price, quotas, and feature access per tier.
// Enforcement happens in the server actions that create users, products and
// submissions, and in the feature-gated actions (journal substantiation,
// custom workflows). Payment/upgrade flows come later — for now plans are
// assigned at registration (starter) or manually.

export type PlanId = "starter" | "growth" | "enterprise";

export type PlanDef = {
  id: PlanId;
  /** Monthly price in IDR; null = custom quote (enterprise). */
  monthlyPriceIdr: number | null;
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
    monthlyPriceIdr: 2_500_000,
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
    monthlyPriceIdr: 6_500_000,
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

/** "Rp 3.500.000" — no decimals; used on the pricing page and settings. */
export function formatIdr(amount: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(amount);
}
