CREATE TABLE `account` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`provider_id` text NOT NULL,
	`user_id` text NOT NULL,
	`access_token` text,
	`refresh_token` text,
	`id_token` text,
	`access_token_expires_at` integer,
	`refresh_token_expires_at` integer,
	`scope` text,
	`password` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `account_userId_idx` ON `account` (`user_id`);--> statement-breakpoint
CREATE TABLE `session` (
	`id` text PRIMARY KEY NOT NULL,
	`expires_at` integer NOT NULL,
	`token` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer NOT NULL,
	`ip_address` text,
	`user_agent` text,
	`impersonated_by` text,
	`user_id` text NOT NULL,
	FOREIGN KEY (`impersonated_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `session_token_unique` ON `session` (`token`);--> statement-breakpoint
CREATE INDEX `session_userId_idx` ON `session` (`user_id`);--> statement-breakpoint
CREATE TABLE `user` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`email_verified` integer DEFAULT false NOT NULL,
	`role` text DEFAULT 'user',
	`banned` integer DEFAULT false,
	`ban_reason` text,
	`ban_expires` integer,
	`image` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_email_unique` ON `user` (`email`);--> statement-breakpoint
CREATE TABLE `verification` (
	`id` text PRIMARY KEY NOT NULL,
	`identifier` text NOT NULL,
	`value` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `verification_identifier_idx` ON `verification` (`identifier`);--> statement-breakpoint
CREATE TABLE `allergy_intolerance` (
	`id` text PRIMARY KEY NOT NULL,
	`patient_id` text NOT NULL,
	`substance_code` text NOT NULL,
	`code_system` text NOT NULL,
	`criticality` text,
	`reaction_text` text,
	`status` text NOT NULL,
	`recorded_at` integer NOT NULL,
	`recorded_by` text NOT NULL,
	FOREIGN KEY (`patient_id`) REFERENCES `patient`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `allergy_patient_status_idx` ON `allergy_intolerance` (`patient_id`,`status`);--> statement-breakpoint
CREATE TABLE `attachment_link` (
	`id` text PRIMARY KEY NOT NULL,
	`binary_id` text NOT NULL,
	`linked_entity_type` text NOT NULL,
	`linked_entity_id` text NOT NULL,
	`title` text NOT NULL,
	`classification` text NOT NULL,
	`captured_at` integer NOT NULL,
	FOREIGN KEY (`binary_id`) REFERENCES `binary_object`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `attachment_link_entity_idx` ON `attachment_link` (`linked_entity_type`,`linked_entity_id`);--> statement-breakpoint
CREATE TABLE `audit_event` (
	`id` integer PRIMARY KEY NOT NULL,
	`patient_id` text,
	`encounter_id` text,
	`user_id` text NOT NULL,
	`action_code` text NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text,
	`occurred_at` integer NOT NULL,
	`channel` text NOT NULL,
	`ip_hash` text,
	`result_code` text NOT NULL,
	`reason_code` text,
	FOREIGN KEY (`patient_id`) REFERENCES `patient`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`encounter_id`) REFERENCES `encounter`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `audit_event_patient_time_idx` ON `audit_event` (`patient_id`,`occurred_at`);--> statement-breakpoint
CREATE INDEX `audit_event_user_time_idx` ON `audit_event` (`user_id`,`occurred_at`);--> statement-breakpoint
CREATE INDEX `audit_event_action_time_idx` ON `audit_event` (`action_code`,`occurred_at`);--> statement-breakpoint
CREATE TABLE `binary_object` (
	`id` text PRIMARY KEY NOT NULL,
	`storage_locator` text NOT NULL,
	`mime_type` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`hash_sha256` text NOT NULL,
	`encrypted_key_ref` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`retention_class` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `binary_object_hash_sha256_unique` ON `binary_object` (`hash_sha256`);--> statement-breakpoint
CREATE INDEX `binary_object_retention_class_idx` ON `binary_object` (`retention_class`);--> statement-breakpoint
CREATE TABLE `clinical_document` (
	`id` text PRIMARY KEY NOT NULL,
	`patient_id` text NOT NULL,
	`encounter_id` text NOT NULL,
	`document_type` text NOT NULL,
	`status` text NOT NULL,
	`current_version_id` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`created_by` text NOT NULL,
	FOREIGN KEY (`patient_id`) REFERENCES `patient`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`encounter_id`) REFERENCES `encounter`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `clinical_document_patient_type_created_idx` ON `clinical_document` (`patient_id`,`document_type`,`created_at`);--> statement-breakpoint
CREATE TABLE `clinical_document_version` (
	`id` text PRIMARY KEY NOT NULL,
	`document_id` text NOT NULL,
	`version_no` integer NOT NULL,
	`supersedes_version_id` text,
	`author_practitioner_id` text NOT NULL,
	`author_user_id` text NOT NULL,
	`signed_by_user_id` text,
	`signed_at` integer,
	`correction_reason` text,
	`payload_json` text NOT NULL,
	`text_rendered` text,
	`hash_sha256` text NOT NULL,
	`is_current` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`document_id`) REFERENCES `clinical_document`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`author_practitioner_id`) REFERENCES `practitioner`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`author_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`signed_by_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `clinical_document_version_unique_idx` ON `clinical_document_version` (`document_id`,`version_no`);--> statement-breakpoint
CREATE INDEX `clinical_document_version_current_idx` ON `clinical_document_version` (`document_id`,`is_current`);--> statement-breakpoint
CREATE INDEX `clinical_document_version_hash_idx` ON `clinical_document_version` (`hash_sha256`);--> statement-breakpoint
CREATE TABLE `clinical_role` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`scope` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `clinical_role_code_unique` ON `clinical_role` (`code`);--> statement-breakpoint
CREATE TABLE `consent_record` (
	`id` text PRIMARY KEY NOT NULL,
	`patient_id` text NOT NULL,
	`encounter_id` text,
	`consent_type` text NOT NULL,
	`procedure_code` text,
	`decision` text NOT NULL,
	`granted_by_person_name` text NOT NULL,
	`representative_relationship` text,
	`signed_at` integer NOT NULL,
	`expires_at` integer,
	`document_version_id` text,
	`revoked_at` integer,
	FOREIGN KEY (`patient_id`) REFERENCES `patient`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`encounter_id`) REFERENCES `encounter`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`document_version_id`) REFERENCES `clinical_document_version`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `consent_patient_type_signed_idx` ON `consent_record` (`patient_id`,`consent_type`,`signed_at`);--> statement-breakpoint
CREATE TABLE `coverage` (
	`id` text PRIMARY KEY NOT NULL,
	`patient_id` text NOT NULL,
	`payer_id` text NOT NULL,
	`affiliate_type` text NOT NULL,
	`policy_number` text,
	`effective_from` integer NOT NULL,
	`effective_to` integer,
	FOREIGN KEY (`patient_id`) REFERENCES `patient`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`payer_id`) REFERENCES `payer`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `coverage_patient_active_idx` ON `coverage` (`patient_id`,`effective_to`);--> statement-breakpoint
CREATE TABLE `data_disclosure_authorization` (
	`id` text PRIMARY KEY NOT NULL,
	`patient_id` text NOT NULL,
	`third_party_name` text NOT NULL,
	`purpose_code` text NOT NULL,
	`scope_json` text NOT NULL,
	`granted_at` integer NOT NULL,
	`expires_at` integer,
	`revoked_at` integer,
	`legal_basis` text NOT NULL,
	FOREIGN KEY (`patient_id`) REFERENCES `patient`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `data_disclosure_patient_expiry_idx` ON `data_disclosure_authorization` (`patient_id`,`expires_at`);--> statement-breakpoint
CREATE TABLE `diagnosis` (
	`id` text PRIMARY KEY NOT NULL,
	`encounter_id` text NOT NULL,
	`document_version_id` text,
	`code_system` text NOT NULL,
	`code` text NOT NULL,
	`description` text NOT NULL,
	`diagnosis_type` text NOT NULL,
	`rank` integer,
	`onset_at` integer,
	`certainty` text,
	FOREIGN KEY (`encounter_id`) REFERENCES `encounter`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`document_version_id`) REFERENCES `clinical_document_version`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `diagnosis_encounter_code_idx` ON `diagnosis` (`encounter_id`,`code_system`,`code`);--> statement-breakpoint
CREATE TABLE `diagnostic_report` (
	`id` text PRIMARY KEY NOT NULL,
	`request_id` text NOT NULL,
	`encounter_id` text NOT NULL,
	`report_type` text NOT NULL,
	`issued_at` integer NOT NULL,
	`conclusion_text` text,
	`performer_org_id` text,
	`status` text NOT NULL,
	FOREIGN KEY (`request_id`) REFERENCES `service_request`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`encounter_id`) REFERENCES `encounter`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`performer_org_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `diagnostic_report_request_issued_idx` ON `diagnostic_report` (`request_id`,`issued_at`);--> statement-breakpoint
CREATE TABLE `document_section` (
	`id` text PRIMARY KEY NOT NULL,
	`document_version_id` text NOT NULL,
	`section_code` text NOT NULL,
	`section_order` integer NOT NULL,
	`section_payload_json` text NOT NULL,
	FOREIGN KEY (`document_version_id`) REFERENCES `clinical_document_version`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `document_section_version_code_idx` ON `document_section` (`document_version_id`,`section_code`);--> statement-breakpoint
CREATE TABLE `encounter` (
	`id` text PRIMARY KEY NOT NULL,
	`patient_id` text NOT NULL,
	`site_id` text NOT NULL,
	`service_unit_id` text NOT NULL,
	`encounter_class` text NOT NULL,
	`care_modality` text NOT NULL,
	`admission_source` text,
	`reason_for_visit` text NOT NULL,
	`started_at` integer NOT NULL,
	`ended_at` integer,
	`status` text NOT NULL,
	`vida_code` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`patient_id`) REFERENCES `patient`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`site_id`) REFERENCES `site`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`service_unit_id`) REFERENCES `service_unit`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `encounter_patient_started_idx` ON `encounter` (`patient_id`,`started_at`);--> statement-breakpoint
CREATE INDEX `encounter_site_started_idx` ON `encounter` (`site_id`,`started_at`);--> statement-breakpoint
CREATE TABLE `encounter_participant` (
	`id` text PRIMARY KEY NOT NULL,
	`encounter_id` text NOT NULL,
	`practitioner_id` text NOT NULL,
	`participant_role` text NOT NULL,
	`started_at` integer NOT NULL,
	`ended_at` integer,
	FOREIGN KEY (`encounter_id`) REFERENCES `encounter`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`practitioner_id`) REFERENCES `practitioner`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `encounter_participant_role_idx` ON `encounter_participant` (`encounter_id`,`participant_role`);--> statement-breakpoint
CREATE TABLE `ihce_bundle` (
	`id` text PRIMARY KEY NOT NULL,
	`encounter_id` text NOT NULL,
	`bundle_type` text NOT NULL,
	`bundle_json` text NOT NULL,
	`generated_at` integer NOT NULL,
	`sent_at` integer,
	`response_code` text,
	`vida_code` text,
	`status` text NOT NULL,
	FOREIGN KEY (`encounter_id`) REFERENCES `encounter`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `ihce_bundle_encounter_status_idx` ON `ihce_bundle` (`encounter_id`,`status`);--> statement-breakpoint
CREATE TABLE `incapacity_certificate` (
	`id` text PRIMARY KEY NOT NULL,
	`patient_id` text NOT NULL,
	`encounter_id` text NOT NULL,
	`issued_by` text NOT NULL,
	`issued_at` integer NOT NULL,
	`start_date` integer NOT NULL,
	`end_date` integer NOT NULL,
	`concept_text` text NOT NULL,
	`destination_entity` text,
	`signed_at` integer NOT NULL,
	FOREIGN KEY (`patient_id`) REFERENCES `patient`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`encounter_id`) REFERENCES `encounter`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`issued_by`) REFERENCES `practitioner`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `incapacity_patient_issued_idx` ON `incapacity_certificate` (`patient_id`,`issued_at`);--> statement-breakpoint
CREATE TABLE `interconsultation` (
	`id` text PRIMARY KEY NOT NULL,
	`encounter_id` text NOT NULL,
	`requested_specialty` text NOT NULL,
	`requested_by` text NOT NULL,
	`requested_at` integer NOT NULL,
	`reason_text` text NOT NULL,
	`response_document_id` text,
	`status` text NOT NULL,
	FOREIGN KEY (`encounter_id`) REFERENCES `encounter`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`requested_by`) REFERENCES `practitioner`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`response_document_id`) REFERENCES `clinical_document`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `interconsultation_encounter_status_idx` ON `interconsultation` (`encounter_id`,`status`);--> statement-breakpoint
CREATE TABLE `medication_administration` (
	`id` text PRIMARY KEY NOT NULL,
	`medication_order_id` text NOT NULL,
	`administered_at` integer NOT NULL,
	`administered_by` text NOT NULL,
	`dose_administered` text,
	`status` text NOT NULL,
	`reason_not_administered` text,
	FOREIGN KEY (`medication_order_id`) REFERENCES `medication_order`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`administered_by`) REFERENCES `practitioner`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `med_admin_order_time_idx` ON `medication_administration` (`medication_order_id`,`administered_at`);--> statement-breakpoint
CREATE TABLE `medication_order` (
	`id` text PRIMARY KEY NOT NULL,
	`patient_id` text NOT NULL,
	`encounter_id` text NOT NULL,
	`diagnosis_id` text,
	`prescriber_id` text NOT NULL,
	`generic_name` text NOT NULL,
	`atc_code` text,
	`concentration` text NOT NULL,
	`dosage_form` text NOT NULL,
	`dose` text NOT NULL,
	`dose_unit` text,
	`route_code` text NOT NULL,
	`frequency_text` text NOT NULL,
	`duration_text` text NOT NULL,
	`quantity_total` text NOT NULL,
	`valid_until` integer,
	`indications` text,
	`status` text NOT NULL,
	`signed_at` integer NOT NULL,
	FOREIGN KEY (`patient_id`) REFERENCES `patient`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`encounter_id`) REFERENCES `encounter`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`diagnosis_id`) REFERENCES `diagnosis`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`prescriber_id`) REFERENCES `practitioner`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `medication_order_encounter_prescriber_idx` ON `medication_order` (`encounter_id`,`prescriber_id`,`signed_at`);--> statement-breakpoint
CREATE TABLE `observation` (
	`id` text PRIMARY KEY NOT NULL,
	`patient_id` text NOT NULL,
	`encounter_id` text NOT NULL,
	`document_version_id` text,
	`observation_type` text NOT NULL,
	`code_system` text,
	`code` text,
	`value_text` text,
	`value_num` integer,
	`value_unit` text,
	`observed_at` integer NOT NULL,
	`status` text NOT NULL,
	FOREIGN KEY (`patient_id`) REFERENCES `patient`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`encounter_id`) REFERENCES `encounter`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`document_version_id`) REFERENCES `clinical_document_version`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `observation_encounter_type_time_idx` ON `observation` (`encounter_id`,`observation_type`,`observed_at`);--> statement-breakpoint
CREATE TABLE `organization` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`reps_code` text,
	`tax_id` text,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `organization_reps_code_idx` ON `organization` (`reps_code`);--> statement-breakpoint
CREATE INDEX `organization_tax_id_idx` ON `organization` (`tax_id`);--> statement-breakpoint
CREATE TABLE `patient` (
	`id` text PRIMARY KEY NOT NULL,
	`primary_document_type` text NOT NULL,
	`primary_document_number` text NOT NULL,
	`first_name` text NOT NULL,
	`middle_name` text,
	`last_name_1` text NOT NULL,
	`last_name_2` text,
	`birth_date` integer NOT NULL,
	`sex_at_birth` text NOT NULL,
	`gender_identity` text,
	`deceased_at` integer,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `patient_primary_document_idx` ON `patient` (`primary_document_type`,`primary_document_number`);--> statement-breakpoint
CREATE INDEX `patient_birth_date_idx` ON `patient` (`birth_date`);--> statement-breakpoint
CREATE TABLE `patient_contact` (
	`id` text PRIMARY KEY NOT NULL,
	`patient_id` text NOT NULL,
	`contact_type` text NOT NULL,
	`full_name` text,
	`relationship_code` text,
	`phone` text,
	`email` text,
	`address` text,
	`is_primary` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`patient_id`) REFERENCES `patient`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `patient_contact_primary_idx` ON `patient_contact` (`patient_id`,`is_primary`);--> statement-breakpoint
CREATE TABLE `patient_identifier` (
	`id` text PRIMARY KEY NOT NULL,
	`patient_id` text NOT NULL,
	`identifier_system` text NOT NULL,
	`identifier_type` text NOT NULL,
	`identifier_value` text NOT NULL,
	`is_current` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`patient_id`) REFERENCES `patient`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `patient_identifier_system_value_idx` ON `patient_identifier` (`identifier_system`,`identifier_value`);--> statement-breakpoint
CREATE TABLE `payer` (
	`id` text PRIMARY KEY NOT NULL,
	`payer_type` text NOT NULL,
	`name` text NOT NULL,
	`code` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `payer_type_code_idx` ON `payer` (`payer_type`,`code`);--> statement-breakpoint
CREATE TABLE `permission` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `permission_code_unique` ON `permission` (`code`);--> statement-breakpoint
CREATE TABLE `practitioner` (
	`id` text PRIMARY KEY NOT NULL,
	`document_type` text NOT NULL,
	`document_number` text NOT NULL,
	`full_name` text NOT NULL,
	`rethus_number` text,
	`active` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `practitioner_document_idx` ON `practitioner` (`document_type`,`document_number`);--> statement-breakpoint
CREATE INDEX `practitioner_rethus_number_idx` ON `practitioner` (`rethus_number`);--> statement-breakpoint
CREATE TABLE `practitioner_role` (
	`id` text PRIMARY KEY NOT NULL,
	`practitioner_id` text NOT NULL,
	`organization_id` text NOT NULL,
	`site_id` text,
	`role_code` text NOT NULL,
	`start_at` integer NOT NULL,
	`end_at` integer,
	FOREIGN KEY (`practitioner_id`) REFERENCES `practitioner`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`site_id`) REFERENCES `site`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `practitioner_role_lookup_idx` ON `practitioner_role` (`practitioner_id`,`role_code`,`end_at`);--> statement-breakpoint
CREATE TABLE `procedure_record` (
	`id` text PRIMARY KEY NOT NULL,
	`patient_id` text NOT NULL,
	`encounter_id` text NOT NULL,
	`cups_code` text NOT NULL,
	`description` text NOT NULL,
	`performed_at` integer,
	`performer_id` text,
	`status` text NOT NULL,
	FOREIGN KEY (`patient_id`) REFERENCES `patient`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`encounter_id`) REFERENCES `encounter`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`performer_id`) REFERENCES `practitioner`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `procedure_encounter_cups_idx` ON `procedure_record` (`encounter_id`,`cups_code`);--> statement-breakpoint
CREATE TABLE `retention_record` (
	`id` text PRIMARY KEY NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`retention_class` text NOT NULL,
	`trigger_date` integer NOT NULL,
	`disposal_eligibility_date` integer NOT NULL,
	`legal_hold_flag` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE INDEX `retention_disposal_hold_idx` ON `retention_record` (`disposal_eligibility_date`,`legal_hold_flag`);--> statement-breakpoint
CREATE TABLE `rips_export` (
	`id` text PRIMARY KEY NOT NULL,
	`payer_id` text NOT NULL,
	`period_from` integer NOT NULL,
	`period_to` integer NOT NULL,
	`status` text NOT NULL,
	`generated_at` integer NOT NULL,
	`payload_json` text,
	`validation_result_json` text,
	FOREIGN KEY (`payer_id`) REFERENCES `payer`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `rips_export_generated_status_idx` ON `rips_export` (`generated_at`,`status`);--> statement-breakpoint
CREATE TABLE `role_permission` (
	`id` text PRIMARY KEY NOT NULL,
	`role_id` text NOT NULL,
	`permission_id` text NOT NULL,
	FOREIGN KEY (`role_id`) REFERENCES `clinical_role`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`permission_id`) REFERENCES `permission`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `role_permission_unique_idx` ON `role_permission` (`role_id`,`permission_id`);--> statement-breakpoint
CREATE TABLE `service_request` (
	`id` text PRIMARY KEY NOT NULL,
	`patient_id` text NOT NULL,
	`encounter_id` text NOT NULL,
	`request_type` text NOT NULL,
	`request_code` text NOT NULL,
	`priority` text NOT NULL,
	`requested_by` text NOT NULL,
	`requested_at` integer NOT NULL,
	`status` text NOT NULL,
	FOREIGN KEY (`patient_id`) REFERENCES `patient`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`encounter_id`) REFERENCES `encounter`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`requested_by`) REFERENCES `practitioner`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `service_request_encounter_type_status_idx` ON `service_request` (`encounter_id`,`request_type`,`status`);--> statement-breakpoint
CREATE TABLE `service_unit` (
	`id` text PRIMARY KEY NOT NULL,
	`site_id` text NOT NULL,
	`service_code` text NOT NULL,
	`name` text NOT NULL,
	`care_setting` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`site_id`) REFERENCES `site`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `service_unit_site_code_idx` ON `service_unit` (`site_id`,`service_code`);--> statement-breakpoint
CREATE TABLE `site` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`site_code` text NOT NULL,
	`name` text NOT NULL,
	`municipality_code` text,
	`address` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `site_organization_code_idx` ON `site` (`organization_id`,`site_code`);--> statement-breakpoint
CREATE TABLE `user_clinical_role` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`role_id` text NOT NULL,
	`site_id` text,
	`effective_from` integer NOT NULL,
	`effective_to` integer,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`role_id`) REFERENCES `clinical_role`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`site_id`) REFERENCES `site`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `user_clinical_role_active_idx` ON `user_clinical_role` (`user_id`,`effective_to`);--> statement-breakpoint
CREATE TABLE `user_practitioner_link` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`practitioner_id` text NOT NULL,
	`link_type` text DEFAULT 'primary' NOT NULL,
	`effective_from` integer NOT NULL,
	`effective_to` integer,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`practitioner_id`) REFERENCES `practitioner`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_practitioner_link_user_practitioner_idx` ON `user_practitioner_link` (`user_id`,`practitioner_id`,`link_type`);--> statement-breakpoint
CREATE INDEX `user_practitioner_link_user_active_idx` ON `user_practitioner_link` (`user_id`,`effective_to`);--> statement-breakpoint
CREATE INDEX `user_practitioner_link_practitioner_active_idx` ON `user_practitioner_link` (`practitioner_id`,`effective_to`);