CREATE TABLE `lab_experiments` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`data` text NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL,
	`updated_at` text NOT NULL,
	`locked_until` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_lab_experiments_project` ON `lab_experiments` (`project_id`,`updated_at`);--> statement-breakpoint
CREATE TABLE `lab_projects` (
	`id` text PRIMARY KEY NOT NULL,
	`data` text NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_lab_projects_updated` ON `lab_projects` (`updated_at`);