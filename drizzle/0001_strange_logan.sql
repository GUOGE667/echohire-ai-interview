ALTER TABLE `interviews` ADD `analysis_json` text;--> statement-breakpoint
ALTER TABLE `interviews` ADD `ai_status` text DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE `interviews` ADD `ai_model` text;