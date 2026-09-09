ALTER TABLE `webhook_events` DROP INDEX `webhook_events_eventId_unique`;--> statement-breakpoint
ALTER TABLE `point_ledger_entries` ADD `reference` varchar(160);--> statement-breakpoint
ALTER TABLE `point_ledger_entries` ADD CONSTRAINT `point_ledger_reference_idx` UNIQUE(`organizationId`,`reference`);--> statement-breakpoint
ALTER TABLE `webhook_events` ADD CONSTRAINT `provider_event_idx` UNIQUE(`provider`,`eventId`);