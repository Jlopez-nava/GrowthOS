CREATE TABLE `company_brands` (
	`id` text NOT NULL,
	`company_id` text NOT NULL,
	`name` text NOT NULL,
	`website` text NOT NULL,
	`created_at` text NOT NULL,
	PRIMARY KEY(`company_id`, `id`)
);
