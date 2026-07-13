// Per-plan quotas (PRD §12). Enforcement happens in the server actions that
// create users/products; payment/upgrade flows come later — for now plans are
// assigned at registration (starter) or manually.
export const PLAN_LIMITS: Record<string, { users: number; products: number }> = {
  starter: { users: 15, products: 3 },
  growth: { users: 50, products: 15 },
  enterprise: { users: Infinity, products: Infinity },
};

export function planLimits(plan: string | null | undefined) {
  return PLAN_LIMITS[plan ?? "starter"] ?? PLAN_LIMITS.starter;
}
