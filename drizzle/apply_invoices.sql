-- Targeted migration: add invoices, invoice_sequences, clients tables
-- Run this directly if the drizzle migration runner can't be used

CREATE TABLE IF NOT EXISTS "clients" (
	"id" varchar(191) PRIMARY KEY NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"name" text NOT NULL,
	"email" text,
	"address" text,
	"phone" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

ALTER TABLE "clients" ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS "invoice_sequences" (
	"user_id" varchar(255) PRIMARY KEY NOT NULL,
	"last_number" integer DEFAULT 0 NOT NULL
);

ALTER TABLE "invoice_sequences" ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS "invoices" (
	"id" varchar(191) PRIMARY KEY NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"invoice_number" varchar(256) NOT NULL,
	"status" varchar(256) DEFAULT 'draft' NOT NULL,
	"issued_at" timestamp DEFAULT now() NOT NULL,
	"due_date" timestamp,
	"seller_info" jsonb NOT NULL,
	"billed_to" jsonb NOT NULL,
	"line_items" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"subtotal" numeric DEFAULT '0' NOT NULL,
	"discount_amount" numeric DEFAULT '0' NOT NULL,
	"discount_code" text,
	"tax_rate" numeric DEFAULT '0' NOT NULL,
	"tax_amount" numeric DEFAULT '0' NOT NULL,
	"shipping_handling" numeric DEFAULT '0' NOT NULL,
	"grand_total" numeric DEFAULT '0' NOT NULL,
	"payment_method" text,
	"shipping_method" text,
	"notes" text,
	"footer_message" text,
	"exported_document_id" varchar(191),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

ALTER TABLE "invoices" ENABLE ROW LEVEL SECURITY;

-- Add config column to form_templates if not already there
ALTER TABLE "form_templates" ADD COLUMN IF NOT EXISTS "config" jsonb DEFAULT '{}'::jsonb NOT NULL;

-- Foreign key from invoices to documents
ALTER TABLE "invoices" ADD CONSTRAINT IF NOT EXISTS "invoices_exported_document_id_documents_id_fk"
  FOREIGN KEY ("exported_document_id") REFERENCES "public"."documents"("id") ON DELETE set null ON UPDATE no action;

-- Indexes
CREATE INDEX IF NOT EXISTS "clients_user_id_idx" ON "clients" USING btree ("user_id");
CREATE INDEX IF NOT EXISTS "invoices_user_id_idx" ON "invoices" USING btree ("user_id");
CREATE INDEX IF NOT EXISTS "invoices_user_id_created_at_idx" ON "invoices" USING btree ("user_id","created_at" DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS "invoices_status_idx" ON "invoices" USING btree ("status");

-- RLS policies
CREATE POLICY IF NOT EXISTS "users_manage_own_clients" ON "clients"
  AS PERMISSIVE FOR ALL TO public
  USING (user_id = (select current_setting('app.current_user_id', true)))
  WITH CHECK (user_id = (select current_setting('app.current_user_id', true)));

CREATE POLICY IF NOT EXISTS "users_manage_own_invoice_sequences" ON "invoice_sequences"
  AS PERMISSIVE FOR ALL TO public
  USING (user_id = (select current_setting('app.current_user_id', true)))
  WITH CHECK (user_id = (select current_setting('app.current_user_id', true)));

CREATE POLICY IF NOT EXISTS "users_manage_own_invoices" ON "invoices"
  AS PERMISSIVE FOR ALL TO public
  USING (user_id = (select current_setting('app.current_user_id', true)))
  WITH CHECK (user_id = (select current_setting('app.current_user_id', true)));
