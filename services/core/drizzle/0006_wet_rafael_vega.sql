CREATE TABLE "assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"uploaded_by_account_id" uuid,
	"storage_key" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"content_type" text NOT NULL,
	"byte_size" integer,
	"width" integer,
	"height" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ready_at" timestamp with time zone,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_uploaded_by_account_id_accounts_id_fk" FOREIGN KEY ("uploaded_by_account_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_assets_storage_key" ON "assets" USING btree ("storage_key");--> statement-breakpoint
CREATE INDEX "idx_assets_org" ON "assets" USING btree ("organization_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_assets_pending" ON "assets" USING btree ("created_at") WHERE "assets"."status" = 'pending';--> statement-breakpoint

-- ============================================================================
-- RLS for the new tenant table. Hand-written, as in 0000, 0002 and 0005 —
-- drizzle-kit does not emit RLS.
--
-- `assets` is tenant-scoped and holds the storage keys for an organisation's
-- uploads. Without a policy, the eventual cutover to the `credopass_api` role
-- would let one tenant enumerate another's object keys, which is the whole
-- of the bucket's privacy given the bucket is read-anonymous for download.
-- ============================================================================

ALTER TABLE "assets" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.assets TO credopass_api;--> statement-breakpoint

CREATE POLICY assets_tenant ON public.assets FOR ALL TO credopass_api
  USING      (organization_id = ANY (app.current_org_ids()))
  WITH CHECK (organization_id = ANY (app.current_org_ids()));
