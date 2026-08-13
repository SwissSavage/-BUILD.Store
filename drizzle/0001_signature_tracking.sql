ALTER TABLE "agreements" ADD COLUMN "documenso_envelope_id" text;--> statement-breakpoint
ALTER TABLE "agreements" ADD COLUMN "signature_status" text;--> statement-breakpoint
ALTER TABLE "agreements" ADD COLUMN "signature_completed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "documenso_envelope_id" text;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "signature_status" text;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "signature_completed_at" timestamp with time zone;