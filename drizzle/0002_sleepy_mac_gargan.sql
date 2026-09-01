ALTER TABLE `routers` DROP INDEX `router_nas_unique`;--> statement-breakpoint
ALTER TABLE `routers` ADD CONSTRAINT `router_nas_unique` UNIQUE(`nasIdentifier`);