CREATE TABLE `webhook_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`provider` varchar(40) NOT NULL,
	`eventId` varchar(120) NOT NULL,
	`payload` text NOT NULL,
	`processedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `webhook_events_id` PRIMARY KEY(`id`),
	CONSTRAINT `webhook_events_eventId_unique` UNIQUE(`eventId`)
);
