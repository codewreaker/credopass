CREATE TABLE "event_series" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"timezone" text DEFAULT 'UTC' NOT NULL,
	"rrule" text NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"materialised_through" timestamp with time zone NOT NULL,
	"occurrence_count" integer DEFAULT 0 NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "series_id" uuid;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "series_index" integer;--> statement-breakpoint
ALTER TABLE "event_series" ADD CONSTRAINT "event_series_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_event_series_org" ON "event_series" USING btree ("organization_id");--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_series_id_event_series_id_fk" FOREIGN KEY ("series_id") REFERENCES "public"."event_series"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_events_series" ON "events" USING btree ("series_id","start_at");--> statement-breakpoint

-- ============================================================================
-- RLS for the new tenant table. Hand-written: drizzle-kit does not emit RLS,
-- which is why 0000_baseline.sql and 0002 carry theirs the same way.
--
-- This matters even though it looks inert today. The API still connects as
-- `postgres`, which is BYPASSRLS, so no policy on any table is currently
-- doing anything (CLAUDE.md, the open Phase 1 item). The moment DATABASE_URL
-- moves to `credopass_api`, a table with RLS enabled and no policy denies
-- everything, and a table with neither is readable across every tenant.
-- Adding a tenant table without this is how the cutover acquires a hole.
-- ============================================================================

ALTER TABLE "event_series" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.event_series TO credopass_api;--> statement-breakpoint

CREATE POLICY event_series_tenant ON public.event_series FOR ALL TO credopass_api
  USING      (organization_id = ANY (app.current_org_ids()))
  WITH CHECK (organization_id = ANY (app.current_org_ids()));
