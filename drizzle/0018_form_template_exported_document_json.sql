ALTER TABLE "documents" ADD COLUMN "json_data" jsonb;
--> statement-breakpoint
ALTER TABLE "form_templates" ADD COLUMN "exported_document_id" varchar(191);
--> statement-breakpoint
ALTER TABLE "form_templates" ADD CONSTRAINT "form_templates_exported_document_id_documents_id_fk" FOREIGN KEY ("exported_document_id") REFERENCES "public"."documents"("id") ON DELETE set null ON UPDATE no action;
