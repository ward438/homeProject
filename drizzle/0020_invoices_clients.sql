CREATE TABLE "clients" (
	"id" varchar(191) PRIMARY KEY NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"name" text NOT NULL,
	"email" text,
	"address" text,
	"phone" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "clients" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "documents" (
	"id" varchar(191) PRIMARY KEY NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"original_filename" text NOT NULL,
	"original_mime_type" varchar(256) NOT NULL,
	"original_path" text NOT NULL,
	"pdf_path" text,
	"status" varchar(256) DEFAULT 'uploaded' NOT NULL,
	"extracted_text" text,
	"json_data" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "documents" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "form_templates" (
	"id" varchar(191) PRIMARY KEY NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"name" text NOT NULL,
	"fields" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"source_document_id" varchar(191),
	"exported_document_id" varchar(191),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "form_templates" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "invoice_sequences" (
	"user_id" varchar(255) PRIMARY KEY NOT NULL,
	"last_number" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "invoice_sequences" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "invoices" (
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
--> statement-breakpoint
ALTER TABLE "invoices" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "files" (
	"id" varchar(191) PRIMARY KEY NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"chat_id" varchar(191),
	"filename" text NOT NULL,
	"object_key" text NOT NULL,
	"media_type" varchar(256) NOT NULL,
	"size" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "files" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "notes" (
	"id" varchar(191) PRIMARY KEY NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"chat_id" varchar(191),
	"source_message_id" varchar(191),
	"title" text NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "notes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "parts" DROP CONSTRAINT "file_fields_required";--> statement-breakpoint
ALTER TABLE "parts" ADD COLUMN "file_key" text;--> statement-breakpoint
ALTER TABLE "form_templates" ADD CONSTRAINT "form_templates_source_document_id_documents_id_fk" FOREIGN KEY ("source_document_id") REFERENCES "public"."documents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "form_templates" ADD CONSTRAINT "form_templates_exported_document_id_documents_id_fk" FOREIGN KEY ("exported_document_id") REFERENCES "public"."documents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_exported_document_id_documents_id_fk" FOREIGN KEY ("exported_document_id") REFERENCES "public"."documents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_chat_id_chats_id_fk" FOREIGN KEY ("chat_id") REFERENCES "public"."chats"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notes" ADD CONSTRAINT "notes_chat_id_chats_id_fk" FOREIGN KEY ("chat_id") REFERENCES "public"."chats"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "clients_user_id_idx" ON "clients" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "documents_user_id_idx" ON "documents" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "documents_user_id_created_at_idx" ON "documents" USING btree ("user_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "form_templates_user_id_idx" ON "form_templates" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "invoices_user_id_idx" ON "invoices" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "invoices_user_id_created_at_idx" ON "invoices" USING btree ("user_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "invoices_status_idx" ON "invoices" USING btree ("status");--> statement-breakpoint
CREATE INDEX "files_user_id_idx" ON "files" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "files_user_id_updated_at_idx" ON "files" USING btree ("user_id","updated_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "files_chat_id_idx" ON "files" USING btree ("chat_id");--> statement-breakpoint
CREATE INDEX "files_media_type_idx" ON "files" USING btree ("media_type");--> statement-breakpoint
CREATE INDEX "files_object_key_idx" ON "files" USING btree ("object_key");--> statement-breakpoint
CREATE INDEX "notes_user_id_idx" ON "notes" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "notes_user_id_updated_at_idx" ON "notes" USING btree ("user_id","updated_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "notes_chat_id_idx" ON "notes" USING btree ("chat_id");--> statement-breakpoint
CREATE INDEX "notes_source_message_id_idx" ON "notes" USING btree ("source_message_id");--> statement-breakpoint
ALTER TABLE "parts" ADD CONSTRAINT "file_fields_required" CHECK ((type != 'file' OR (file_media_type IS NOT NULL AND file_filename IS NOT NULL AND (file_key IS NOT NULL OR file_url IS NOT NULL))));--> statement-breakpoint
CREATE POLICY "users_manage_own_clients" ON "clients" AS PERMISSIVE FOR ALL TO public USING (user_id = (select current_setting('app.current_user_id', true))) WITH CHECK (user_id = (select current_setting('app.current_user_id', true)));--> statement-breakpoint
CREATE POLICY "users_manage_own_documents" ON "documents" AS PERMISSIVE FOR ALL TO public USING (user_id = (select current_setting('app.current_user_id', true))) WITH CHECK (user_id = (select current_setting('app.current_user_id', true)));--> statement-breakpoint
CREATE POLICY "users_manage_own_form_templates" ON "form_templates" AS PERMISSIVE FOR ALL TO public USING (user_id = (select current_setting('app.current_user_id', true))) WITH CHECK (user_id = (select current_setting('app.current_user_id', true)));--> statement-breakpoint
CREATE POLICY "users_manage_own_invoice_sequences" ON "invoice_sequences" AS PERMISSIVE FOR ALL TO public USING (user_id = (select current_setting('app.current_user_id', true))) WITH CHECK (user_id = (select current_setting('app.current_user_id', true)));--> statement-breakpoint
CREATE POLICY "users_manage_own_invoices" ON "invoices" AS PERMISSIVE FOR ALL TO public USING (user_id = (select current_setting('app.current_user_id', true))) WITH CHECK (user_id = (select current_setting('app.current_user_id', true)));--> statement-breakpoint
CREATE POLICY "users_manage_own_files" ON "files" AS PERMISSIVE FOR ALL TO public USING (user_id = (select current_setting('app.current_user_id', true))) WITH CHECK (user_id = (select current_setting('app.current_user_id', true)));--> statement-breakpoint
CREATE POLICY "users_manage_own_notes" ON "notes" AS PERMISSIVE FOR ALL TO public USING (user_id = (select current_setting('app.current_user_id', true))) WITH CHECK (user_id = (select current_setting('app.current_user_id', true)));--> statement-breakpoint
ALTER POLICY "users_manage_own_chats" ON "chats" TO public USING (user_id = (select current_setting('app.current_user_id', true))) WITH CHECK (user_id = (select current_setting('app.current_user_id', true)));--> statement-breakpoint
ALTER POLICY "users_anonymize_own_feedback" ON "feedback" TO public USING (user_id = (select current_setting('app.current_user_id', true))) WITH CHECK (user_id IS NULL);