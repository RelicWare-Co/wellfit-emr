DROP INDEX `rips_ref_entry_table_name_lookup_idx`;--> statement-breakpoint
CREATE UNIQUE INDEX `rips_ref_entry_table_name_code_unique_idx` ON `rips_reference_entry` (`table_name`,`code`);--> statement-breakpoint
ALTER TABLE `coverage` ADD `coverage_plan_code` text;--> statement-breakpoint
CREATE INDEX `coverage_plan_code_idx` ON `coverage` (`coverage_plan_code`);--> statement-breakpoint
ALTER TABLE `diagnosis` ADD `rips_reference_name` text;--> statement-breakpoint
ALTER TABLE `encounter` ADD `cause_external_code` text;--> statement-breakpoint
ALTER TABLE `encounter` ADD `finalidad_consulta_code` text;--> statement-breakpoint
ALTER TABLE `encounter` ADD `condicion_destino_code` text;--> statement-breakpoint
ALTER TABLE `encounter` ADD `modalidad_atencion_code` text;--> statement-breakpoint
CREATE INDEX `encounter_cause_external_idx` ON `encounter` (`cause_external_code`);--> statement-breakpoint
CREATE INDEX `encounter_finalidad_idx` ON `encounter` (`finalidad_consulta_code`);--> statement-breakpoint
ALTER TABLE `patient` ADD `country_code` text;--> statement-breakpoint
ALTER TABLE `patient` ADD `municipality_code` text;--> statement-breakpoint
ALTER TABLE `patient` ADD `zone_code` text;--> statement-breakpoint
CREATE INDEX `patient_municipality_idx` ON `patient` (`municipality_code`);--> statement-breakpoint
ALTER TABLE `procedure_record` ADD `rips_reference_name` text;