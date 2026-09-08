CREATE TABLE "content_distributions" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"submission_id" text NOT NULL,
	"version_id" text NOT NULL,
	"channel" text NOT NULL,
	"label" text,
	"status" text DEFAULT 'live' NOT NULL,
	"published_at" timestamp with time zone NOT NULL,
	"published_by" text NOT NULL,
	"pulled_at" timestamp with time zone,
	"pulled_by" text
);
--> statement-breakpoint
ALTER TABLE "claim_flags" ADD COLUMN "cited_reference" jsonb;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "product_scope" jsonb;--> statement-breakpoint
ALTER TABLE "content_distributions" ADD CONSTRAINT "content_distributions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_distributions" ADD CONSTRAINT "content_distributions_submission_id_content_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."content_submissions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_distributions" ADD CONSTRAINT "content_distributions_version_id_content_versions_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."content_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_distributions" ADD CONSTRAINT "content_distributions_published_by_users_id_fk" FOREIGN KEY ("published_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_distributions" ADD CONSTRAINT "content_distributions_pulled_by_users_id_fk" FOREIGN KEY ("pulled_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;