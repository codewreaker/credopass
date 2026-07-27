CREATE TABLE "device_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"event_id" uuid,
	"label" text NOT NULL,
	"token_hash" text,
	"pairing_code" text,
	"pairing_expires_at" timestamp with time zone,
	"paired_at" timestamp with time zone,
	"scopes" text[] DEFAULT '{"attendance:record","attendance:read","event:read"}' NOT NULL,
	"issued_by_account_id" uuid,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"last_used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "device_tokens" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "device_tokens" ADD CONSTRAINT "device_tokens_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_tokens" ADD CONSTRAINT "device_tokens_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_tokens" ADD CONSTRAINT "device_tokens_issued_by_account_id_accounts_id_fk" FOREIGN KEY ("issued_by_account_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_device_tokens_token_hash" ON "device_tokens" USING btree ("token_hash") WHERE "device_tokens"."token_hash" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_device_tokens_pairing_code" ON "device_tokens" USING btree ("pairing_code") WHERE "device_tokens"."pairing_code" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_device_tokens_org" ON "device_tokens" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_device_tokens_event" ON "device_tokens" USING btree ("event_id");--> statement-breakpoint
-- A new table with no RLS policy fails the T24 completeness assertion, so the
-- policy ships with the table rather than in a follow-up nobody writes.
CREATE POLICY device_tokens_tenant ON public.device_tokens FOR ALL TO credopass_api
  USING      (organization_id = ANY (app.current_org_ids()))
  WITH CHECK (organization_id = ANY (app.current_org_ids()));
