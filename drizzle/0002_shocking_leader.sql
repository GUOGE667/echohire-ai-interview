CREATE TABLE `skill_evidence` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`interview_id` text NOT NULL,
	`skill_key` text NOT NULL,
	`score` integer NOT NULL,
	`insight` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`interview_id`) REFERENCES `interviews`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `skill_evidence_user_created_idx` ON `skill_evidence` (`user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `skill_evidence_interview_idx` ON `skill_evidence` (`interview_id`);--> statement-breakpoint
CREATE TABLE `skill_profiles` (
	`user_id` text NOT NULL,
	`skill_key` text NOT NULL,
	`label` text NOT NULL,
	`score` integer NOT NULL,
	`evidence_count` integer DEFAULT 1 NOT NULL,
	`latest_insight` text NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	PRIMARY KEY(`user_id`, `skill_key`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `skill_profiles_user_updated_idx` ON `skill_profiles` (`user_id`,`updated_at`);