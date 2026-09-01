CREATE TABLE `api_tokens` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`organizationId` int,
	`name` varchar(140) NOT NULL,
	`tokenHash` varchar(255) NOT NULL,
	`tokenPrefix` varchar(16) NOT NULL,
	`abilities` text NOT NULL,
	`ipAllowlist` text,
	`lastUsedAt` timestamp,
	`expiresAt` timestamp,
	`revokedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `api_tokens_id` PRIMARY KEY(`id`),
	CONSTRAINT `api_tokens_tokenHash_unique` UNIQUE(`tokenHash`)
);
--> statement-breakpoint
CREATE TABLE `backup_schedules` (
	`organizationId` int NOT NULL,
	`frequency` enum('every_6h','every_12h','daily','weekly') NOT NULL DEFAULT 'daily',
	`retentionDays` int NOT NULL DEFAULT 30,
	`isEnabled` int NOT NULL DEFAULT 1,
	`lastRunAt` timestamp,
	`nextRunAt` timestamp,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `backup_schedules_organizationId` PRIMARY KEY(`organizationId`)
);
--> statement-breakpoint
CREATE TABLE `card_import_jobs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`source` enum('csv','mikrotik_sqlite','mikrotik_wizard') NOT NULL,
	`status` enum('queued','validating','importing','ready','failed') NOT NULL DEFAULT 'queued',
	`fileId` int,
	`totalRows` int NOT NULL DEFAULT 0,
	`importedRows` int NOT NULL DEFAULT 0,
	`duplicateRows` int NOT NULL DEFAULT 0,
	`invalidRows` int NOT NULL DEFAULT 0,
	`quotaExceeded` int NOT NULL DEFAULT 0,
	`errorLog` text,
	`createdByUserId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`completedAt` timestamp,
	CONSTRAINT `card_import_jobs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `dynamic_settings_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`module` varchar(60) NOT NULL,
	`key` varchar(80) NOT NULL,
	`label` varchar(200) NOT NULL,
	`fieldType` enum('select','text','checkbox','time','textarea','number') NOT NULL DEFAULT 'text',
	`expectedValues` text,
	`conditionField` varchar(80),
	`conditionOp` varchar(8),
	`conditionValue` varchar(200),
	`minValue` int,
	`maxValue` int,
	`notice` varchar(400),
	`sortOrder` decimal(8,3) NOT NULL DEFAULT '1',
	`value` text,
	`updatedByUserId` int,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `dynamic_settings_items_id` PRIMARY KEY(`id`),
	CONSTRAINT `dynamic_settings_item_unique` UNIQUE(`organizationId`,`module`,`key`)
);
--> statement-breakpoint
CREATE TABLE `hotspot_login_pages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`name` varchar(140) NOT NULL,
	`isDefault` int NOT NULL DEFAULT 0,
	`logoImageKey` varchar(600),
	`backgroundImageKey` varchar(600),
	`primaryColor` varchar(16) NOT NULL DEFAULT '#6d28d9',
	`welcomeTitle` varchar(200),
	`welcomeBody` text,
	`termsText` text,
	`voucherGroupScope` text,
	`createdByUserId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `hotspot_login_pages_id` PRIMARY KEY(`id`),
	CONSTRAINT `hotspot_login_page_name_unique` UNIQUE(`organizationId`,`name`)
);
--> statement-breakpoint
CREATE TABLE `mac_security_action_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`macAddress` varchar(17) NOT NULL,
	`action` enum('block','unblock') NOT NULL,
	`triggeredByUserId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `mac_security_action_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `mac_security_rules` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`macAddress` varchar(17) NOT NULL,
	`listType` enum('whitelist','blacklist') NOT NULL,
	`reason` varchar(255),
	`customerId` int,
	`createdByUserId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `mac_security_rules_id` PRIMARY KEY(`id`),
	CONSTRAINT `mac_rule_unique` UNIQUE(`organizationId`,`macAddress`,`listType`)
);
--> statement-breakpoint
CREATE TABLE `monitor_action_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`routerId` int,
	`action` enum('reboot','shutdown') NOT NULL,
	`status` enum('queued','sent','failed') NOT NULL DEFAULT 'queued',
	`triggeredByUserId` int,
	`errorMessage` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `monitor_action_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `report_builder_access` (
	`organizationId` int NOT NULL,
	`pinHash` varchar(255),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `report_builder_access_organizationId` PRIMARY KEY(`organizationId`)
);
--> statement-breakpoint
CREATE TABLE `report_categories` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`name` varchar(120) NOT NULL,
	`sortOrder` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `report_categories_id` PRIMARY KEY(`id`),
	CONSTRAINT `report_category_name_unique` UNIQUE(`organizationId`,`name`)
);
--> statement-breakpoint
CREATE TABLE `report_parameter_definitions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`reportDefinitionId` int NOT NULL,
	`key` varchar(80) NOT NULL,
	`label` varchar(160) NOT NULL,
	`fieldType` enum('text','number','date','date_range','select','sort') NOT NULL DEFAULT 'text',
	`expectedValues` text,
	`isRequired` int NOT NULL DEFAULT 0,
	`sortOrder` int NOT NULL DEFAULT 0,
	CONSTRAINT `report_parameter_definitions_id` PRIMARY KEY(`id`),
	CONSTRAINT `report_parameter_unique` UNIQUE(`reportDefinitionId`,`key`)
);
--> statement-breakpoint
CREATE TABLE `report_saved_filters` (
	`id` int AUTO_INCREMENT NOT NULL,
	`reportDefinitionId` int NOT NULL,
	`name` varchar(140) NOT NULL,
	`filterJson` text NOT NULL,
	`isShared` int NOT NULL DEFAULT 0,
	`createdByUserId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `report_saved_filters_id` PRIMARY KEY(`id`),
	CONSTRAINT `report_saved_filter_unique` UNIQUE(`reportDefinitionId`,`name`)
);
--> statement-breakpoint
CREATE TABLE `report_schedule_deliveries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`reportScheduleId` int NOT NULL,
	`channel` enum('email','telegram') NOT NULL,
	`target` varchar(255) NOT NULL,
	`lastDeliveryStatus` enum('pending','sent','failed') NOT NULL DEFAULT 'pending',
	`lastDeliveryAt` timestamp,
	`failureCount` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `report_schedule_deliveries_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `report_schedule_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`reportScheduleId` int,
	`level` enum('info','warning','error') NOT NULL DEFAULT 'info',
	`message` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `report_schedule_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sms_templates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`key` varchar(80) NOT NULL,
	`name` varchar(140) NOT NULL,
	`namespace` enum('direct','scheduled','custom') NOT NULL DEFAULT 'custom',
	`body` text NOT NULL,
	`isSystem` int NOT NULL DEFAULT 0,
	`createdByUserId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `sms_templates_id` PRIMARY KEY(`id`),
	CONSTRAINT `sms_template_key_unique` UNIQUE(`organizationId`,`key`)
);
--> statement-breakpoint
CREATE TABLE `support_ticket_device_info` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ticketId` int NOT NULL,
	`ipAddress` varchar(64),
	`userAgent` varchar(400),
	`routerId` int,
	`macAddress` varchar(17),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `support_ticket_device_info_id` PRIMARY KEY(`id`),
	CONSTRAINT `support_ticket_device_info_ticketId_unique` UNIQUE(`ticketId`)
);
--> statement-breakpoint
CREATE TABLE `two_factor_secrets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`secretCiphertext` text NOT NULL,
	`secretIv` varchar(32) NOT NULL,
	`secretAuthTag` varchar(32) NOT NULL,
	`recoveryCodes` text NOT NULL,
	`confirmedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `two_factor_secrets_id` PRIMARY KEY(`id`),
	CONSTRAINT `two_factor_secrets_userId_unique` UNIQUE(`userId`)
);
--> statement-breakpoint
CREATE TABLE `voucher_bulk_actions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`actionType` enum('delete','group_change','stop') NOT NULL,
	`voucherIds` text NOT NULL,
	`targetGroupId` int,
	`status` enum('queued','running','done','failed') NOT NULL DEFAULT 'queued',
	`affectedCount` int NOT NULL DEFAULT 0,
	`createdByUserId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`completedAt` timestamp,
	CONSTRAINT `voucher_bulk_actions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `users` ADD `twoFactorEnabled` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `api_tokens` ADD CONSTRAINT `api_tokens_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `api_tokens` ADD CONSTRAINT `api_tokens_organizationId_organizations_id_fk` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `backup_schedules` ADD CONSTRAINT `backup_schedules_organizationId_organizations_id_fk` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `card_import_jobs` ADD CONSTRAINT `card_import_jobs_organizationId_organizations_id_fk` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `card_import_jobs` ADD CONSTRAINT `card_import_jobs_fileId_files_id_fk` FOREIGN KEY (`fileId`) REFERENCES `files`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `card_import_jobs` ADD CONSTRAINT `card_import_jobs_createdByUserId_users_id_fk` FOREIGN KEY (`createdByUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `dynamic_settings_items` ADD CONSTRAINT `dynamic_settings_items_organizationId_organizations_id_fk` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `dynamic_settings_items` ADD CONSTRAINT `dynamic_settings_items_updatedByUserId_users_id_fk` FOREIGN KEY (`updatedByUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `hotspot_login_pages` ADD CONSTRAINT `hotspot_login_pages_organizationId_organizations_id_fk` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `hotspot_login_pages` ADD CONSTRAINT `hotspot_login_pages_createdByUserId_users_id_fk` FOREIGN KEY (`createdByUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `mac_security_action_logs` ADD CONSTRAINT `mac_security_action_logs_organizationId_organizations_id_fk` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `mac_security_action_logs` ADD CONSTRAINT `mac_security_action_logs_triggeredByUserId_users_id_fk` FOREIGN KEY (`triggeredByUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `mac_security_rules` ADD CONSTRAINT `mac_security_rules_organizationId_organizations_id_fk` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `mac_security_rules` ADD CONSTRAINT `mac_security_rules_customerId_customers_id_fk` FOREIGN KEY (`customerId`) REFERENCES `customers`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `mac_security_rules` ADD CONSTRAINT `mac_security_rules_createdByUserId_users_id_fk` FOREIGN KEY (`createdByUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `monitor_action_logs` ADD CONSTRAINT `monitor_action_logs_organizationId_organizations_id_fk` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `monitor_action_logs` ADD CONSTRAINT `monitor_action_logs_routerId_routers_id_fk` FOREIGN KEY (`routerId`) REFERENCES `routers`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `monitor_action_logs` ADD CONSTRAINT `monitor_action_logs_triggeredByUserId_users_id_fk` FOREIGN KEY (`triggeredByUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `report_builder_access` ADD CONSTRAINT `report_builder_access_organizationId_organizations_id_fk` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `report_categories` ADD CONSTRAINT `report_categories_organizationId_organizations_id_fk` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `report_parameter_definitions` ADD CONSTRAINT `report_param_defs_report_def_id_fk` FOREIGN KEY (`reportDefinitionId`) REFERENCES `report_definitions`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `report_saved_filters` ADD CONSTRAINT `report_saved_filters_reportDefinitionId_report_definitions_id_fk` FOREIGN KEY (`reportDefinitionId`) REFERENCES `report_definitions`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `report_saved_filters` ADD CONSTRAINT `report_saved_filters_createdByUserId_users_id_fk` FOREIGN KEY (`createdByUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `report_schedule_deliveries` ADD CONSTRAINT `report_sched_deliveries_sched_id_fk` FOREIGN KEY (`reportScheduleId`) REFERENCES `report_schedules`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `report_schedule_logs` ADD CONSTRAINT `report_schedule_logs_organizationId_organizations_id_fk` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `report_schedule_logs` ADD CONSTRAINT `report_schedule_logs_reportScheduleId_report_schedules_id_fk` FOREIGN KEY (`reportScheduleId`) REFERENCES `report_schedules`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sms_templates` ADD CONSTRAINT `sms_templates_organizationId_organizations_id_fk` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sms_templates` ADD CONSTRAINT `sms_templates_createdByUserId_users_id_fk` FOREIGN KEY (`createdByUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `support_ticket_device_info` ADD CONSTRAINT `support_ticket_device_info_ticketId_support_tickets_id_fk` FOREIGN KEY (`ticketId`) REFERENCES `support_tickets`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `support_ticket_device_info` ADD CONSTRAINT `support_ticket_device_info_routerId_routers_id_fk` FOREIGN KEY (`routerId`) REFERENCES `routers`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `two_factor_secrets` ADD CONSTRAINT `two_factor_secrets_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `voucher_bulk_actions` ADD CONSTRAINT `voucher_bulk_actions_organizationId_organizations_id_fk` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `voucher_bulk_actions` ADD CONSTRAINT `voucher_bulk_actions_targetGroupId_voucher_groups_id_fk` FOREIGN KEY (`targetGroupId`) REFERENCES `voucher_groups`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `voucher_bulk_actions` ADD CONSTRAINT `voucher_bulk_actions_createdByUserId_users_id_fk` FOREIGN KEY (`createdByUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `api_token_user_idx` ON `api_tokens` (`userId`);--> statement-breakpoint
CREATE INDEX `card_import_job_org_idx` ON `card_import_jobs` (`organizationId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `dynamic_settings_org_module_idx` ON `dynamic_settings_items` (`organizationId`,`module`);--> statement-breakpoint
CREATE INDEX `mac_action_log_org_idx` ON `mac_security_action_logs` (`organizationId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `mac_rule_org_idx` ON `mac_security_rules` (`organizationId`);--> statement-breakpoint
CREATE INDEX `monitor_action_log_org_idx` ON `monitor_action_logs` (`organizationId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `report_delivery_schedule_idx` ON `report_schedule_deliveries` (`reportScheduleId`);--> statement-breakpoint
CREATE INDEX `report_schedule_log_org_idx` ON `report_schedule_logs` (`organizationId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `voucher_bulk_action_org_idx` ON `voucher_bulk_actions` (`organizationId`,`createdAt`);