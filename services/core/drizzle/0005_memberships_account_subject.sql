ALTER TABLE "org_memberships" ALTER COLUMN "userId" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "org_memberships" ALTER COLUMN "role" SET DEFAULT 'viewer';