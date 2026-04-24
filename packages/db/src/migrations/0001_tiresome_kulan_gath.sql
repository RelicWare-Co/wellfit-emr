CREATE TABLE `rips_reference_entry` (
	`id` integer PRIMARY KEY NOT NULL,
	`table_id` integer NOT NULL,
	`table_name` text NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`enabled` integer DEFAULT true NOT NULL,
	`extra_data` text,
	`source_id` integer,
	`source_updated_at` integer,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`table_id`) REFERENCES `rips_reference_table`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `rips_ref_entry_table_code_idx` ON `rips_reference_entry` (`table_id`,`code`);--> statement-breakpoint
CREATE INDEX `rips_ref_entry_table_name_idx` ON `rips_reference_entry` (`table_id`,`name`);--> statement-breakpoint
CREATE INDEX `rips_ref_entry_table_enabled_idx` ON `rips_reference_entry` (`table_id`,`enabled`);--> statement-breakpoint
CREATE INDEX `rips_ref_entry_table_name_lookup_idx` ON `rips_reference_entry` (`table_name`,`code`);--> statement-breakpoint
CREATE TABLE `rips_reference_table` (
	`id` integer PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`sispro_db_name` text,
	`sispro_url` text NOT NULL,
	`sispro_last_update` integer,
	`last_synced_at` integer,
	`entry_count` integer DEFAULT 0 NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `rips_reference_table_name_unique` ON `rips_reference_table` (`name`);--> statement-breakpoint
CREATE INDEX `rips_ref_table_active_idx` ON `rips_reference_table` (`is_active`);--> statement-breakpoint
CREATE INDEX `rips_ref_table_name_idx` ON `rips_reference_table` (`name`);