CREATE TYPE "public"."event_role" AS ENUM('organizer', 'co_host', 'staff');--> statement-breakpoint
CREATE TYPE "public"."identity_provider_kind" AS ENUM('oidc', 'saml');--> statement-breakpoint
CREATE TYPE "public"."org_role" AS ENUM('owner', 'admin', 'organizer', 'checkin', 'viewer');--> statement-breakpoint
CREATE TYPE "public"."provisioned_by" AS ENUM('manual', 'jit', 'scim');--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text,
	"display_name" text,
	"avatar_asset_id" uuid,
	"is_guest" boolean DEFAULT false NOT NULL,
	"locale" text,
	"timezone" text,
	"last_seen_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "accounts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "identities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"issuer" text NOT NULL,
	"subject" text NOT NULL,
	"provider_kind" text NOT NULL,
	"org_identity_provider_id" uuid,
	"email" text,
	"email_verified" boolean DEFAULT false NOT NULL,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_identities_issuer_subject" UNIQUE("issuer","subject")
);
--> statement-breakpoint
ALTER TABLE "identities" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "invitations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"email" text NOT NULL,
	"role" "org_role" NOT NULL,
	"token_hash" text NOT NULL,
	"invited_by_account_id" uuid,
	"expires_at" timestamp with time zone NOT NULL,
	"accepted_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "invitations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "org_domains" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"domain" text NOT NULL,
	"verification_token" text NOT NULL,
	"verified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "org_domains" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "org_identity_providers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"kind" "identity_provider_kind" NOT NULL,
	"display_name" text NOT NULL,
	"issuer" text NOT NULL,
	"jwks_uri" text,
	"metadata_url" text,
	"audience" text NOT NULL,
	"default_role" "org_role" DEFAULT 'viewer' NOT NULL,
	"jit_provisioning" boolean DEFAULT true NOT NULL,
	"enforce_sso" boolean DEFAULT false NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "org_identity_providers_issuer_unique" UNIQUE("issuer")
);
--> statement-breakpoint
ALTER TABLE "org_identity_providers" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "people" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"account_id" uuid,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"email" text,
	"phone" text,
	"avatar_asset_id" uuid,
	"notes" text,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "people" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "org_memberships" ADD COLUMN "account_id" uuid;--> statement-breakpoint
ALTER TABLE "org_memberships" ADD COLUMN "status" text DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE "org_memberships" ADD COLUMN "provisioned_by" "provisioned_by" DEFAULT 'manual' NOT NULL;--> statement-breakpoint
ALTER TABLE "org_memberships" ADD COLUMN "external_id" text;--> statement-breakpoint
ALTER TABLE "identities" ADD CONSTRAINT "identities_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_invited_by_account_id_accounts_id_fk" FOREIGN KEY ("invited_by_account_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_domains" ADD CONSTRAINT "org_domains_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_identity_providers" ADD CONSTRAINT "org_identity_providers_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "people" ADD CONSTRAINT "people_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "people" ADD CONSTRAINT "people_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_accounts_email" ON "accounts" USING btree (lower("email")) WHERE "accounts"."email" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_accounts_last_seen_at" ON "accounts" USING btree ("last_seen_at");--> statement-breakpoint
CREATE INDEX "idx_identities_account_id" ON "identities" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "idx_identities_verified_email" ON "identities" USING btree (lower("email")) WHERE "identities"."email_verified";--> statement-breakpoint
CREATE UNIQUE INDEX "uq_invitations_org_email_pending" ON "invitations" USING btree ("organization_id",lower("email")) WHERE "invitations"."accepted_at" IS NULL AND "invitations"."revoked_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_invitations_token_hash" ON "invitations" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "idx_invitations_organization_id" ON "invitations" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_org_domains_verified" ON "org_domains" USING btree (lower("domain")) WHERE "org_domains"."verified_at" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_org_domains_organization_id" ON "org_domains" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_org_domains_lookup" ON "org_domains" USING btree (lower("domain"));--> statement-breakpoint
CREATE INDEX "idx_org_idp_organization_id" ON "org_identity_providers" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_org_idp_issuer" ON "org_identity_providers" USING btree ("issuer");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_people_org_email" ON "people" USING btree ("organization_id",lower("email")) WHERE "people"."email" IS NOT NULL AND "people"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_people_org_name" ON "people" USING btree ("organization_id","last_name","first_name");--> statement-breakpoint
CREATE INDEX "idx_people_account_id" ON "people" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "idx_people_org_active" ON "people" USING btree ("organization_id") WHERE "people"."deleted_at" IS NULL;--> statement-breakpoint
ALTER TABLE "org_memberships" ADD CONSTRAINT "org_memberships_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_org_memberships_account_id" ON "org_memberships" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "idx_org_memberships_org_role" ON "org_memberships" USING btree ("organizationId","role");