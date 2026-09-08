
-- Drop foreign keys that depend on the indexes we need to drop
-- Since this is just local sqlite emulation failing, and we're dealing with MariaDB we should ignore Drizzle's auto index drops if they fail in the migration

ALTER TABLE `point_ledger_entries` ADD `reference` varchar(160);--> statement-breakpoint
ALTER TABLE `network_sessions` DROP INDEX `session_acct_unique`;--> statement-breakpoint
ALTER TABLE `network_sessions` ADD CONSTRAINT `session_acct_unique` UNIQUE(`organizationId`,`routerId`,`acctUniqueId`);--> statement-breakpoint
ALTER TABLE `point_ledger_entries` ADD CONSTRAINT `point_ledger_reference_idx` UNIQUE(`organizationId`,`reference`);--> statement-breakpoint
ALTER TABLE `webhook_events` ADD CONSTRAINT `provider_event_idx` UNIQUE(`provider`,`eventId`);
