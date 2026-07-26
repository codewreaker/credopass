CREATE TABLE "attendance" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organizationId" uuid NOT NULL,
	"eventId" uuid NOT NULL,
	"patronId" uuid NOT NULL,
	"attended" boolean DEFAULT false NOT NULL,
	"checkInTime" timestamp with time zone,
	"checkOutTime" timestamp with time zone,
	"checkInMethod" text,
	"notes" text,
	CONSTRAINT "uq_attendance_event_patron" UNIQUE("eventId","patronId")
);
--> statement-breakpoint
CREATE TABLE "event_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"eventId" uuid NOT NULL,
	"userId" uuid NOT NULL,
	"role" text DEFAULT 'staff' NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_event_members_event_user" UNIQUE("eventId","userId")
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organizationId" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"checkInMethods" text[] DEFAULT '{"qr"}' NOT NULL,
	"requireCheckOut" boolean DEFAULT false NOT NULL,
	"startTime" timestamp with time zone NOT NULL,
	"endTime" timestamp with time zone NOT NULL,
	"location" text NOT NULL,
	"capacity" integer,
	"deletedAt" timestamp with time zone,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "loyalty" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organizationId" uuid NOT NULL,
	"patronId" uuid NOT NULL,
	"description" text NOT NULL,
	"tier" text,
	"points" integer DEFAULT 0,
	"reward" text,
	"issuedAt" timestamp with time zone DEFAULT now() NOT NULL,
	"expiresAt" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "org_memberships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" uuid NOT NULL,
	"organizationId" uuid NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"invitedBy" uuid,
	"invitedAt" timestamp with time zone,
	"acceptedAt" timestamp with time zone,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_org_memberships_user_org" UNIQUE("userId","organizationId")
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"plan" text DEFAULT 'free' NOT NULL,
	"externalAuthEndpoint" text,
	"externalAuthApiKey" text,
	"stripeCustomerId" text,
	"stripeSubscriptionId" text,
	"deletedAt" timestamp with time zone,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "organizations_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"firstName" text NOT NULL,
	"lastName" text NOT NULL,
	"phone" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_organizationId_organizations_id_fk" FOREIGN KEY ("organizationId") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_eventId_events_id_fk" FOREIGN KEY ("eventId") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_patronId_users_id_fk" FOREIGN KEY ("patronId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_members" ADD CONSTRAINT "event_members_eventId_events_id_fk" FOREIGN KEY ("eventId") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_members" ADD CONSTRAINT "event_members_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_organizationId_organizations_id_fk" FOREIGN KEY ("organizationId") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loyalty" ADD CONSTRAINT "loyalty_organizationId_organizations_id_fk" FOREIGN KEY ("organizationId") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loyalty" ADD CONSTRAINT "loyalty_patronId_users_id_fk" FOREIGN KEY ("patronId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_memberships" ADD CONSTRAINT "org_memberships_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_memberships" ADD CONSTRAINT "org_memberships_organizationId_organizations_id_fk" FOREIGN KEY ("organizationId") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_memberships" ADD CONSTRAINT "org_memberships_invitedBy_users_id_fk" FOREIGN KEY ("invitedBy") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_attendance_organizationId" ON "attendance" USING btree ("organizationId");--> statement-breakpoint
CREATE INDEX "idx_attendance_eventId" ON "attendance" USING btree ("eventId");--> statement-breakpoint
CREATE INDEX "idx_attendance_patronId" ON "attendance" USING btree ("patronId");--> statement-breakpoint
CREATE INDEX "idx_attendance_attended" ON "attendance" USING btree ("attended");--> statement-breakpoint
CREATE INDEX "idx_attendance_checkInTime" ON "attendance" USING btree ("checkInTime");--> statement-breakpoint
CREATE INDEX "idx_event_members_eventId" ON "event_members" USING btree ("eventId");--> statement-breakpoint
CREATE INDEX "idx_event_members_userId" ON "event_members" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "idx_event_members_role" ON "event_members" USING btree ("role");--> statement-breakpoint
CREATE INDEX "idx_events_organizationId" ON "events" USING btree ("organizationId");--> statement-breakpoint
CREATE INDEX "idx_events_status" ON "events" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_events_startTime" ON "events" USING btree ("startTime");--> statement-breakpoint
CREATE INDEX "idx_events_deletedAt" ON "events" USING btree ("deletedAt");--> statement-breakpoint
CREATE INDEX "idx_loyalty_organizationId" ON "loyalty" USING btree ("organizationId");--> statement-breakpoint
CREATE INDEX "idx_loyalty_patronId" ON "loyalty" USING btree ("patronId");--> statement-breakpoint
CREATE INDEX "idx_loyalty_tier" ON "loyalty" USING btree ("tier");--> statement-breakpoint
CREATE INDEX "idx_loyalty_expiresAt" ON "loyalty" USING btree ("expiresAt");--> statement-breakpoint
CREATE INDEX "idx_org_memberships_userId" ON "org_memberships" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "idx_org_memberships_organizationId" ON "org_memberships" USING btree ("organizationId");--> statement-breakpoint
CREATE INDEX "idx_org_memberships_role" ON "org_memberships" USING btree ("role");--> statement-breakpoint
CREATE INDEX "idx_organizations_slug" ON "organizations" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "idx_organizations_plan" ON "organizations" USING btree ("plan");--> statement-breakpoint
CREATE INDEX "idx_organizations_stripeCustomerId" ON "organizations" USING btree ("stripeCustomerId");--> statement-breakpoint
CREATE INDEX "idx_users_email" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "idx_users_createdAt" ON "users" USING btree ("createdAt");