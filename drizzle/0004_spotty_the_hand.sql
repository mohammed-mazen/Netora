CREATE TABLE `backup_jobs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`status` enum('queued','running','ready','failed','restoring','restored') NOT NULL DEFAULT 'queued',
	`fileId` int,
	`sizeBytes` int,
	`errorMessage` text,
	`createdByUserId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`completedAt` timestamp,
	CONSTRAINT `backup_jobs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `card_designs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`name` varchar(120) NOT NULL,
	`isDefault` int NOT NULL DEFAULT 0,
	`cardWidthMm` decimal(6,2) NOT NULL DEFAULT '90',
	`cardHeightMm` decimal(6,2) NOT NULL DEFAULT '50',
	`cardBorderColor` varchar(16) NOT NULL DEFAULT '#6d28d9',
	`backgroundImageKey` varchar(600),
	`watermarkOpacity` int NOT NULL DEFAULT 0,
	`watermarkPosition` enum('center','top','bottom') NOT NULL DEFAULT 'center',
	`printSerialAsBarcode` int NOT NULL DEFAULT 1,
	`printCardQrCode` int NOT NULL DEFAULT 1,
	`fields` text NOT NULL,
	`createdByUserId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `card_designs_id` PRIMARY KEY(`id`),
	CONSTRAINT `card_design_name_unique` UNIQUE(`organizationId`,`name`)
);
--> statement-breakpoint
CREATE TABLE `cash_boxes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`accountId` int NOT NULL,
	`name` varchar(140) NOT NULL,
	`isDefault` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `cash_boxes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `cash_vouchers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`cashBoxId` int NOT NULL,
	`counterAccountId` int NOT NULL,
	`customerId` int,
	`kind` enum('receipt','payment') NOT NULL,
	`reference` varchar(80) NOT NULL,
	`amount` decimal(14,2) NOT NULL,
	`description` varchar(255),
	`journalEntryId` int,
	`createdByUserId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `cash_vouchers_id` PRIMARY KEY(`id`),
	CONSTRAINT `cash_voucher_reference_unique` UNIQUE(`organizationId`,`reference`)
);
--> statement-breakpoint
CREATE TABLE `chart_accounts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`parentId` int,
	`accountNumber` varchar(40) NOT NULL,
	`name` varchar(160) NOT NULL,
	`grade` int NOT NULL,
	`kind` enum('asset','liability','equity','revenue','expense') NOT NULL,
	`nature` enum('debit','credit') NOT NULL,
	`isCashBox` int NOT NULL DEFAULT 0,
	`isWarehouse` int NOT NULL DEFAULT 0,
	`isDeletable` int NOT NULL DEFAULT 1,
	`balance` decimal(14,2) NOT NULL DEFAULT '0',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `chart_accounts_id` PRIMARY KEY(`id`),
	CONSTRAINT `chart_account_number_unique` UNIQUE(`organizationId`,`accountNumber`)
);
--> statement-breakpoint
CREATE TABLE `chat_messages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`threadId` int NOT NULL,
	`senderKind` enum('staff','customer') NOT NULL,
	`senderUserId` int,
	`body` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `chat_messages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `chat_threads` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`customerId` int,
	`subject` varchar(200),
	`status` enum('open','closed') NOT NULL DEFAULT 'open',
	`lastMessageAt` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `chat_threads_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `competition_entries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`competitionId` int NOT NULL,
	`customerId` int NOT NULL,
	`pointsEarned` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `competition_entries_id` PRIMARY KEY(`id`),
	CONSTRAINT `competition_entry_unique` UNIQUE(`competitionId`,`customerId`)
);
--> statement-breakpoint
CREATE TABLE `competition_questions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`competitionId` int NOT NULL,
	`difficulty` enum('easy','medium','hard') NOT NULL,
	`question` text NOT NULL,
	`correctAnswer` varchar(400) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `competition_questions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `competitions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`name` varchar(160) NOT NULL,
	`easyPoints` int NOT NULL DEFAULT 5,
	`mediumPoints` int NOT NULL DEFAULT 7,
	`hardPoints` int NOT NULL DEFAULT 10,
	`duration` enum('daily','weekly','one_time') NOT NULL DEFAULT 'daily',
	`questionsPerDuration` int NOT NULL DEFAULT 10,
	`status` enum('draft','active','ended') NOT NULL DEFAULT 'draft',
	`startsAt` timestamp,
	`endsAt` timestamp,
	`createdByUserId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `competitions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `custom_roles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`name` varchar(140) NOT NULL,
	`description` varchar(255),
	`isSystem` int NOT NULL DEFAULT 0,
	`createdByUserId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `custom_roles_id` PRIMARY KEY(`id`),
	CONSTRAINT `custom_role_name_unique` UNIQUE(`organizationId`,`name`)
);
--> statement-breakpoint
CREATE TABLE `customer_point_balances` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`customerId` int NOT NULL,
	`balance` int NOT NULL DEFAULT 0,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `customer_point_balances_id` PRIMARY KEY(`id`),
	CONSTRAINT `customer_point_balances_customerId_unique` UNIQUE(`customerId`)
);
--> statement-breakpoint
CREATE TABLE `monitor_samples` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`cpuPercent` int,
	`memoryPercent` int,
	`diskPercent` int,
	`batteryPercent` int,
	`serviceStatus` enum('healthy','degraded','down') NOT NULL DEFAULT 'healthy',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `monitor_samples_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `monitor_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`rebootable` int NOT NULL DEFAULT 1,
	`shutdownable` int NOT NULL DEFAULT 1,
	`batteryNotification` int NOT NULL DEFAULT 0,
	`batteryNotificationType` enum('telegram','sms','email') NOT NULL DEFAULT 'telegram',
	`batteryWarningPercentage` int NOT NULL DEFAULT 50,
	`batteryCriticalPercentage` int NOT NULL DEFAULT 10,
	`telegramChatId` varchar(64),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `monitor_settings_id` PRIMARY KEY(`id`),
	CONSTRAINT `monitor_settings_organizationId_unique` UNIQUE(`organizationId`)
);
--> statement-breakpoint
CREATE TABLE `point_ledger_entries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`customerId` int NOT NULL,
	`kind` enum('earn','redeem','adjust') NOT NULL,
	`points` int NOT NULL,
	`reason` varchar(200),
	`createdByUserId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `point_ledger_entries_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `points_benefit_tiers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`name` varchar(120) NOT NULL,
	`requiredPoints` int NOT NULL,
	`sortOrder` int NOT NULL DEFAULT 0,
	CONSTRAINT `points_benefit_tiers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `points_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`minimumAmount` decimal(12,2) NOT NULL DEFAULT '0',
	`isEnabled` int NOT NULL DEFAULT 0,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `points_settings_id` PRIMARY KEY(`id`),
	CONSTRAINT `points_settings_organizationId_unique` UNIQUE(`organizationId`)
);
--> statement-breakpoint
CREATE TABLE `print_jobs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`batchId` int NOT NULL,
	`designId` int NOT NULL,
	`status` enum('queued','rendering','ready','failed') NOT NULL DEFAULT 'queued',
	`fileId` int,
	`errorMessage` text,
	`createdByUserId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `print_jobs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `report_definitions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`name` varchar(140) NOT NULL,
	`dataset` enum('customers','invoices','payments','vouchers','sessions','journal_entries','support_tickets') NOT NULL,
	`columns` text NOT NULL,
	`filters` text,
	`createdByUserId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `report_definitions_id` PRIMARY KEY(`id`),
	CONSTRAINT `report_definition_name_unique` UNIQUE(`organizationId`,`name`)
);
--> statement-breakpoint
CREATE TABLE `report_exports` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`reportDefinitionId` int NOT NULL,
	`fileId` int,
	`status` enum('queued','generating','ready','failed') NOT NULL DEFAULT 'queued',
	`rowCount` int,
	`createdByUserId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `report_exports_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `report_schedules` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`reportDefinitionId` int NOT NULL,
	`frequency` enum('daily','weekly','monthly') NOT NULL,
	`isEnabled` int NOT NULL DEFAULT 1,
	`lastRunAt` timestamp,
	`nextRunAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `report_schedules_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `role_permissions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`roleId` int NOT NULL,
	`permission` varchar(80) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `role_permissions_id` PRIMARY KEY(`id`),
	CONSTRAINT `role_permission_unique` UNIQUE(`roleId`,`permission`)
);
--> statement-breakpoint
CREATE TABLE `sms_messages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`customerId` int,
	`toNumber` varchar(40) NOT NULL,
	`body` varchar(640) NOT NULL,
	`status` enum('queued','sent','failed') NOT NULL DEFAULT 'queued',
	`createdByUserId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `sms_messages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sms_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`serverType` enum('cloud','local_modem') NOT NULL DEFAULT 'cloud',
	`simCardsCount` enum('one','two') NOT NULL DEFAULT 'one',
	`defaultSimCard` int NOT NULL DEFAULT 1,
	`sendingType` enum('auto','manual') NOT NULL DEFAULT 'auto',
	`secretRef` varchar(255),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `sms_settings_id` PRIMARY KEY(`id`),
	CONSTRAINT `sms_settings_organizationId_unique` UNIQUE(`organizationId`)
);
--> statement-breakpoint
CREATE TABLE `stock_transfers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`fromWarehouseId` int,
	`toWarehouseId` int,
	`reference` varchar(80) NOT NULL,
	`itemDescription` varchar(200) NOT NULL,
	`quantity` int NOT NULL,
	`status` enum('draft','confirmed','cancelled') NOT NULL DEFAULT 'draft',
	`createdByUserId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `stock_transfers_id` PRIMARY KEY(`id`),
	CONSTRAINT `stock_transfer_reference_unique` UNIQUE(`organizationId`,`reference`)
);
--> statement-breakpoint
CREATE TABLE `voucher_categories` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`name` varchar(120) NOT NULL,
	`priceType` enum('fixed','customer') NOT NULL DEFAULT 'fixed',
	`amount` decimal(12,2) NOT NULL,
	`prefix` varchar(12),
	`defaultAmount` decimal(12,2),
	`maxAmount` decimal(12,2),
	`minAmount` decimal(12,2),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `voucher_categories_id` PRIMARY KEY(`id`),
	CONSTRAINT `voucher_category_name_unique` UNIQUE(`organizationId`,`name`)
);
--> statement-breakpoint
CREATE TABLE `voucher_category_prices` (
	`id` int AUTO_INCREMENT NOT NULL,
	`categoryId` int NOT NULL,
	`tier` enum('retail','wholesale','wholesale_of_wholesale') NOT NULL,
	`price` decimal(12,2) NOT NULL,
	CONSTRAINT `voucher_category_prices_id` PRIMARY KEY(`id`),
	CONSTRAINT `voucher_category_price_unique` UNIQUE(`categoryId`,`tier`)
);
--> statement-breakpoint
CREATE TABLE `voucher_groups` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`categoryId` int,
	`name` varchar(140) NOT NULL,
	`limitUsers` int NOT NULL DEFAULT 1,
	`voucherCodeLength` int NOT NULL DEFAULT 10,
	`timeBalanceMinutes` int,
	`downloadBalanceMb` int,
	`cardValidityDays` int,
	`speedProfileId` int,
	`mikrotikProfile` varchar(140),
	`linkWithFirstMac` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `voucher_groups_id` PRIMARY KEY(`id`),
	CONSTRAINT `voucher_group_name_unique` UNIQUE(`organizationId`,`name`)
);
--> statement-breakpoint
CREATE TABLE `warehouses` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`accountId` int,
	`name` varchar(140) NOT NULL,
	`location` varchar(200),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `warehouses_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `organization_members` ADD `customRoleId` int;--> statement-breakpoint
ALTER TABLE `backup_jobs` ADD CONSTRAINT `backup_jobs_organizationId_organizations_id_fk` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `backup_jobs` ADD CONSTRAINT `backup_jobs_fileId_files_id_fk` FOREIGN KEY (`fileId`) REFERENCES `files`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `backup_jobs` ADD CONSTRAINT `backup_jobs_createdByUserId_users_id_fk` FOREIGN KEY (`createdByUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `card_designs` ADD CONSTRAINT `card_designs_organizationId_organizations_id_fk` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `card_designs` ADD CONSTRAINT `card_designs_createdByUserId_users_id_fk` FOREIGN KEY (`createdByUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `cash_boxes` ADD CONSTRAINT `cash_boxes_organizationId_organizations_id_fk` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `cash_boxes` ADD CONSTRAINT `cash_boxes_accountId_chart_accounts_id_fk` FOREIGN KEY (`accountId`) REFERENCES `chart_accounts`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `cash_vouchers` ADD CONSTRAINT `cash_vouchers_organizationId_organizations_id_fk` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `cash_vouchers` ADD CONSTRAINT `cash_vouchers_cashBoxId_cash_boxes_id_fk` FOREIGN KEY (`cashBoxId`) REFERENCES `cash_boxes`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `cash_vouchers` ADD CONSTRAINT `cash_vouchers_counterAccountId_chart_accounts_id_fk` FOREIGN KEY (`counterAccountId`) REFERENCES `chart_accounts`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `cash_vouchers` ADD CONSTRAINT `cash_vouchers_customerId_customers_id_fk` FOREIGN KEY (`customerId`) REFERENCES `customers`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `cash_vouchers` ADD CONSTRAINT `cash_vouchers_journalEntryId_journal_entries_id_fk` FOREIGN KEY (`journalEntryId`) REFERENCES `journal_entries`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `cash_vouchers` ADD CONSTRAINT `cash_vouchers_createdByUserId_users_id_fk` FOREIGN KEY (`createdByUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `chart_accounts` ADD CONSTRAINT `chart_accounts_organizationId_organizations_id_fk` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `chat_messages` ADD CONSTRAINT `chat_messages_organizationId_organizations_id_fk` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `chat_messages` ADD CONSTRAINT `chat_messages_threadId_chat_threads_id_fk` FOREIGN KEY (`threadId`) REFERENCES `chat_threads`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `chat_messages` ADD CONSTRAINT `chat_messages_senderUserId_users_id_fk` FOREIGN KEY (`senderUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `chat_threads` ADD CONSTRAINT `chat_threads_organizationId_organizations_id_fk` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `chat_threads` ADD CONSTRAINT `chat_threads_customerId_customers_id_fk` FOREIGN KEY (`customerId`) REFERENCES `customers`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `competition_entries` ADD CONSTRAINT `competition_entries_competitionId_competitions_id_fk` FOREIGN KEY (`competitionId`) REFERENCES `competitions`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `competition_entries` ADD CONSTRAINT `competition_entries_customerId_customers_id_fk` FOREIGN KEY (`customerId`) REFERENCES `customers`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `competition_questions` ADD CONSTRAINT `competition_questions_competitionId_competitions_id_fk` FOREIGN KEY (`competitionId`) REFERENCES `competitions`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `competitions` ADD CONSTRAINT `competitions_organizationId_organizations_id_fk` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `competitions` ADD CONSTRAINT `competitions_createdByUserId_users_id_fk` FOREIGN KEY (`createdByUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `custom_roles` ADD CONSTRAINT `custom_roles_organizationId_organizations_id_fk` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `custom_roles` ADD CONSTRAINT `custom_roles_createdByUserId_users_id_fk` FOREIGN KEY (`createdByUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `customer_point_balances` ADD CONSTRAINT `customer_point_balances_organizationId_organizations_id_fk` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `customer_point_balances` ADD CONSTRAINT `customer_point_balances_customerId_customers_id_fk` FOREIGN KEY (`customerId`) REFERENCES `customers`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `monitor_samples` ADD CONSTRAINT `monitor_samples_organizationId_organizations_id_fk` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `monitor_settings` ADD CONSTRAINT `monitor_settings_organizationId_organizations_id_fk` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `point_ledger_entries` ADD CONSTRAINT `point_ledger_entries_organizationId_organizations_id_fk` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `point_ledger_entries` ADD CONSTRAINT `point_ledger_entries_customerId_customers_id_fk` FOREIGN KEY (`customerId`) REFERENCES `customers`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `point_ledger_entries` ADD CONSTRAINT `point_ledger_entries_createdByUserId_users_id_fk` FOREIGN KEY (`createdByUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `points_benefit_tiers` ADD CONSTRAINT `points_benefit_tiers_organizationId_organizations_id_fk` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `points_settings` ADD CONSTRAINT `points_settings_organizationId_organizations_id_fk` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `print_jobs` ADD CONSTRAINT `print_jobs_organizationId_organizations_id_fk` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `print_jobs` ADD CONSTRAINT `print_jobs_batchId_voucher_batches_id_fk` FOREIGN KEY (`batchId`) REFERENCES `voucher_batches`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `print_jobs` ADD CONSTRAINT `print_jobs_designId_card_designs_id_fk` FOREIGN KEY (`designId`) REFERENCES `card_designs`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `print_jobs` ADD CONSTRAINT `print_jobs_fileId_files_id_fk` FOREIGN KEY (`fileId`) REFERENCES `files`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `print_jobs` ADD CONSTRAINT `print_jobs_createdByUserId_users_id_fk` FOREIGN KEY (`createdByUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `report_definitions` ADD CONSTRAINT `report_definitions_organizationId_organizations_id_fk` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `report_definitions` ADD CONSTRAINT `report_definitions_createdByUserId_users_id_fk` FOREIGN KEY (`createdByUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `report_exports` ADD CONSTRAINT `report_exports_organizationId_organizations_id_fk` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `report_exports` ADD CONSTRAINT `report_exports_reportDefinitionId_report_definitions_id_fk` FOREIGN KEY (`reportDefinitionId`) REFERENCES `report_definitions`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `report_exports` ADD CONSTRAINT `report_exports_fileId_files_id_fk` FOREIGN KEY (`fileId`) REFERENCES `files`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `report_exports` ADD CONSTRAINT `report_exports_createdByUserId_users_id_fk` FOREIGN KEY (`createdByUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `report_schedules` ADD CONSTRAINT `report_schedules_organizationId_organizations_id_fk` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `report_schedules` ADD CONSTRAINT `report_schedules_reportDefinitionId_report_definitions_id_fk` FOREIGN KEY (`reportDefinitionId`) REFERENCES `report_definitions`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `role_permissions` ADD CONSTRAINT `role_permissions_roleId_custom_roles_id_fk` FOREIGN KEY (`roleId`) REFERENCES `custom_roles`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sms_messages` ADD CONSTRAINT `sms_messages_organizationId_organizations_id_fk` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sms_messages` ADD CONSTRAINT `sms_messages_customerId_customers_id_fk` FOREIGN KEY (`customerId`) REFERENCES `customers`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sms_messages` ADD CONSTRAINT `sms_messages_createdByUserId_users_id_fk` FOREIGN KEY (`createdByUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sms_settings` ADD CONSTRAINT `sms_settings_organizationId_organizations_id_fk` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `stock_transfers` ADD CONSTRAINT `stock_transfers_organizationId_organizations_id_fk` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `stock_transfers` ADD CONSTRAINT `stock_transfers_fromWarehouseId_warehouses_id_fk` FOREIGN KEY (`fromWarehouseId`) REFERENCES `warehouses`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `stock_transfers` ADD CONSTRAINT `stock_transfers_toWarehouseId_warehouses_id_fk` FOREIGN KEY (`toWarehouseId`) REFERENCES `warehouses`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `stock_transfers` ADD CONSTRAINT `stock_transfers_createdByUserId_users_id_fk` FOREIGN KEY (`createdByUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `voucher_categories` ADD CONSTRAINT `voucher_categories_organizationId_organizations_id_fk` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `voucher_category_prices` ADD CONSTRAINT `voucher_category_prices_categoryId_voucher_categories_id_fk` FOREIGN KEY (`categoryId`) REFERENCES `voucher_categories`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `voucher_groups` ADD CONSTRAINT `voucher_groups_organizationId_organizations_id_fk` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `voucher_groups` ADD CONSTRAINT `voucher_groups_categoryId_voucher_categories_id_fk` FOREIGN KEY (`categoryId`) REFERENCES `voucher_categories`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `voucher_groups` ADD CONSTRAINT `voucher_groups_speedProfileId_speed_profiles_id_fk` FOREIGN KEY (`speedProfileId`) REFERENCES `speed_profiles`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `warehouses` ADD CONSTRAINT `warehouses_organizationId_organizations_id_fk` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `warehouses` ADD CONSTRAINT `warehouses_accountId_chart_accounts_id_fk` FOREIGN KEY (`accountId`) REFERENCES `chart_accounts`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `backup_job_org_idx` ON `backup_jobs` (`organizationId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `cash_box_org_idx` ON `cash_boxes` (`organizationId`);--> statement-breakpoint
CREATE INDEX `chart_account_org_parent_idx` ON `chart_accounts` (`organizationId`,`parentId`);--> statement-breakpoint
CREATE INDEX `chat_message_thread_idx` ON `chat_messages` (`threadId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `chat_thread_org_status_idx` ON `chat_threads` (`organizationId`,`status`,`lastMessageAt`);--> statement-breakpoint
CREATE INDEX `competition_question_idx` ON `competition_questions` (`competitionId`);--> statement-breakpoint
CREATE INDEX `competition_org_status_idx` ON `competitions` (`organizationId`,`status`);--> statement-breakpoint
CREATE INDEX `monitor_sample_org_created_idx` ON `monitor_samples` (`organizationId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `point_ledger_org_customer_idx` ON `point_ledger_entries` (`organizationId`,`customerId`);--> statement-breakpoint
CREATE INDEX `points_tier_org_idx` ON `points_benefit_tiers` (`organizationId`);--> statement-breakpoint
CREATE INDEX `print_job_org_status_idx` ON `print_jobs` (`organizationId`,`status`);--> statement-breakpoint
CREATE INDEX `report_export_org_idx` ON `report_exports` (`organizationId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `report_schedule_org_idx` ON `report_schedules` (`organizationId`);--> statement-breakpoint
CREATE INDEX `sms_message_org_created_idx` ON `sms_messages` (`organizationId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `warehouse_org_idx` ON `warehouses` (`organizationId`);--> statement-breakpoint
CREATE INDEX `member_custom_role_idx` ON `organization_members` (`customRoleId`);