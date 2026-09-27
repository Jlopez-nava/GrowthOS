CREATE TABLE `company_audit` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`actor` text NOT NULL,
	`action` text NOT NULL,
	`target` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `company_members` (
	`company_id` text NOT NULL,
	`email` text NOT NULL,
	`role` text NOT NULL,
	`added_by` text NOT NULL,
	`updated_at` text NOT NULL,
	PRIMARY KEY(`company_id`, `email`)
);
