CREATE TABLE `platform_invoices` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`number` varchar(80) NOT NULL,
	`status` enum('draft','issued','paid','void','overdue') NOT NULL DEFAULT 'draft',
	`total` decimal(12,2) NOT NULL,
	`issuedAt` timestamp,
	`dueAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `platform_invoices_id` PRIMARY KEY(`id`),
	CONSTRAINT `platform_invoices_number_unique` UNIQUE(`number`)
);
--> statement-breakpoint
CREATE TABLE `platform_payments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`invoiceId` int,
	`amount` decimal(12,2) NOT NULL,
	`method` enum('bank','gateway','manual') NOT NULL,
	`status` enum('pending','confirmed','failed','refunded') NOT NULL DEFAULT 'pending',
	`reference` varchar(160),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `platform_payments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `platform_invoices` ADD CONSTRAINT `platform_invoices_organizationId_organizations_id_fk` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `platform_payments` ADD CONSTRAINT `platform_payments_organizationId_organizations_id_fk` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `platform_payments` ADD CONSTRAINT `platform_payments_invoiceId_platform_invoices_id_fk` FOREIGN KEY (`invoiceId`) REFERENCES `platform_invoices`(`id`) ON DELETE no action ON UPDATE no action;