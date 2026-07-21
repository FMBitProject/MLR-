ALTER TABLE "content_submissions" ADD COLUMN "expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "content_submissions" ADD COLUMN "expiry_reminded_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "content_submissions" ADD COLUMN "withdrawn_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "content_submissions" ADD COLUMN "withdrawn_by" text;--> statement-breakpoint
ALTER TABLE "content_submissions" ADD COLUMN "withdrawn_reason" text;--> statement-breakpoint
ALTER TABLE "review_stages" ADD COLUMN "decided_by" text;--> statement-breakpoint
ALTER TABLE "content_submissions" ADD CONSTRAINT "content_submissions_withdrawn_by_users_id_fk" FOREIGN KEY ("withdrawn_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_stages" ADD CONSTRAINT "review_stages_decided_by_users_id_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
-- Backfill: material approved before this feature gets the default one-year
-- shelf life from its approval date, so the expiry sweep covers it too.
UPDATE "content_submissions" SET "expires_at" = "decided_at" + interval '1 year'
  WHERE "status" = 'approved' AND "decided_at" IS NOT NULL AND "expires_at" IS NULL;
