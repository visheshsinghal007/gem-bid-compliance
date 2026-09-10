CREATE TABLE `bids` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`title` text NOT NULL,
	`reference` text NOT NULL,
	`buyer` text NOT NULL,
	`deadline` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`payload` text NOT NULL
);

--> statement-breakpoint
CREATE INDEX `idx_bids_owner_updated` ON `bids` (`owner`,`updated_at`);
