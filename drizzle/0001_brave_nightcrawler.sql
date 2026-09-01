CREATE TABLE `router_credentials` (
	`id` int AUTO_INCREMENT NOT NULL,
	`routerId` int NOT NULL,
	`ciphertext` text NOT NULL,
	`iv` varchar(32) NOT NULL,
	`authTag` varchar(32) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `router_credentials_id` PRIMARY KEY(`id`),
	CONSTRAINT `router_credentials_routerId_unique` UNIQUE(`routerId`)
);
--> statement-breakpoint
ALTER TABLE `router_credentials` ADD CONSTRAINT `router_credentials_routerId_routers_id_fk` FOREIGN KEY (`routerId`) REFERENCES `routers`(`id`) ON DELETE no action ON UPDATE no action;