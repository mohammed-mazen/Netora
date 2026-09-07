CREATE TABLE `network_change_journal` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`routerId` int,
	`actorId` int NOT NULL,
	`intent` varchar(255) NOT NULL,
	`desiredState` json NOT NULL,
	`actualStateBefore` json,
	`diff` json,
	`validationResult` varchar(50) NOT NULL,
	`approvalStatus` enum('pending','approved','rejected','bypassed') NOT NULL DEFAULT 'pending',
	`executionResult` varchar(50) NOT NULL,
	`actualStateAfter` json,
	`verificationResult` varchar(50) NOT NULL,
	`rollbackStatus` varchar(50),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `network_change_journal_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `network_change_journal` ADD CONSTRAINT `network_change_journal_organizationId_organizations_id_fk` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `network_change_journal` ADD CONSTRAINT `network_change_journal_routerId_routers_id_fk` FOREIGN KEY (`routerId`) REFERENCES `routers`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `network_change_journal` ADD CONSTRAINT `network_change_journal_actorId_users_id_fk` FOREIGN KEY (`actorId`) REFERENCES `users`(`id`) ON DELETE restrict ON UPDATE no action;