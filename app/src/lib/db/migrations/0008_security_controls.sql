CREATE TABLE "sessions" (
	"token_hash" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account_tokens" RENAME COLUMN "token" TO "token_hash";--> statement-breakpoint
-- Existing values were raw bearer tokens. Expire them rather than retaining
-- plaintext values or relying on a database-specific hash extension.
DELETE FROM account_tokens;
--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sessions_expiry_idx" ON "sessions" USING btree ("expires_at");--> statement-breakpoint
-- Repair old invalid pins before enforcing version ownership. Keep the comment
-- and audit history; only disconnect its foreign element reference.
UPDATE review_comments rc SET element_id = NULL
WHERE element_id IS NOT NULL AND NOT EXISTS (
  SELECT 1 FROM content_elements ce WHERE ce.id = rc.element_id AND ce.version_id = rc.version_id
);
--> statement-breakpoint
ALTER TABLE "content_elements" ADD CONSTRAINT "content_elements_id_version_unique" UNIQUE("id","version_id");
--> statement-breakpoint
ALTER TABLE "review_comments" ADD CONSTRAINT "review_comments_element_version_fk" FOREIGN KEY ("element_id","version_id") REFERENCES "public"."content_elements"("id","version_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint

-- Retire the identities created by the old public-password seed scripts.
-- Real user accounts and the demo workspaces' content/audit history are preserved.
UPDATE users SET password_hash = '!disabled-demo-account', email_verified_at = NULL
WHERE (tenant_id = 'tn-nusantara' AND id IN ('u-dewi','u-budi','u-ratna','u-agus','u-sari','u-rudi'))
   OR (tenant_id = 'tn-demo' AND id IN ('u-demo-dewi','u-demo-budi','u-demo-ratna','u-demo-agus','u-demo-sari','u-demo-rudi'));
--> statement-breakpoint
DELETE FROM account_tokens WHERE user_id IN (
  SELECT id FROM users WHERE password_hash = '!disabled-demo-account'
);
