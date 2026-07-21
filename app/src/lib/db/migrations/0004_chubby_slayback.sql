CREATE TABLE "invoices" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"number" text NOT NULL,
	"plan" text NOT NULL,
	"amount_idr" integer NOT NULL,
	"period_start" timestamp with time zone NOT NULL,
	"period_end" timestamp with time zone NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"due_at" timestamp with time zone NOT NULL,
	"snap_token" text,
	"snap_redirect_url" text,
	"paid_at" timestamp with time zone,
	"payment_type" text,
	"last_reminder_at" timestamp with time zone,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "invoices_number_unique" UNIQUE("number")
);
--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "plan_active_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
-- Backfill: existing tenants get a 14-day runway before their first invoice
-- is due, mirroring the trial new registrations receive. Enterprise tenants
-- stay manually managed (NULL = billing not handled by the app).
UPDATE "tenants" SET "plan_active_until" = now() + interval '14 days' WHERE "plan" != 'enterprise';