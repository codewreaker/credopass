ALTER TABLE "events" ALTER COLUMN "location_text" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "meeting_url" text;