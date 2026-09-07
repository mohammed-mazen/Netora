ALTER TABLE `background_jobs` ADD `leaseOwner` varchar(120);--> statement-breakpoint
ALTER TABLE `background_jobs` ADD `leaseVersion` int DEFAULT 0 NOT NULL;