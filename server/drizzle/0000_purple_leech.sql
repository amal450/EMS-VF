CREATE TABLE "alerts" (
	"id" serial PRIMARY KEY NOT NULL,
	"asset_id" integer NOT NULL,
	"message" text NOT NULL,
	"value" double precision NOT NULL,
	"threshold" double precision NOT NULL,
	"timestamp" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "assets" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"parent_id" integer,
	"websocketlink" varchar(255),
	"max_current" double precision DEFAULT 80
);
--> statement-breakpoint
CREATE TABLE "facture" (
	"id" serial PRIMARY KEY NOT NULL,
	"asset_id" integer NOT NULL,
	"active_energy" double precision NOT NULL,
	"rate_jour" double precision NOT NULL,
	"rate_pointe_matin" double precision NOT NULL,
	"rate_soir" double precision NOT NULL,
	"rate_nuit" double precision NOT NULL,
	"prime_puissance" double precision NOT NULL,
	"tva" double precision NOT NULL,
	"municipal" double precision NOT NULL,
	"total_amount" double precision NOT NULL,
	"month" integer NOT NULL,
	"year" integer NOT NULL,
	"timestamp" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "measurements" (
	"id" serial PRIMARY KEY NOT NULL,
	"asset_id" integer NOT NULL,
	"v1n" double precision,
	"v2n" double precision,
	"v3n" double precision,
	"v12" double precision,
	"v23" double precision,
	"v31" double precision,
	"i1" double precision,
	"i2" double precision,
	"i3" double precision,
	"tkw" double precision,
	"ikwh" double precision,
	"hz" double precision,
	"pf" double precision,
	"kvah" double precision,
	"timestamp" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "permissions" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	CONSTRAINT "permissions_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "thresholds" (
	"id" serial PRIMARY KEY NOT NULL,
	"asset_id" integer NOT NULL,
	"parameter" text NOT NULL,
	"min_value" double precision,
	"max_value" double precision,
	"is_active" integer DEFAULT 1,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "user_permissions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"permission_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"email" text NOT NULL,
	"password" text NOT NULL,
	"role" text DEFAULT 'AGENT',
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
