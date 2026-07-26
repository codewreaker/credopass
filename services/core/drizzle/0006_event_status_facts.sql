ALTER TABLE "events" ADD COLUMN "opened_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "closed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "cancelled_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "cancellation_reason" text;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "enforce_capacity" boolean DEFAULT false NOT NULL;