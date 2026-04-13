-- ============================================================
-- Lead8X v2 — Database Migration
-- Run this in phpMyAdmin AFTER the original schema.sql
-- Safe to re-run (all changes use IF NOT EXISTS / column checks)
-- ============================================================

-- Add new columns to leads table
ALTER TABLE `leads`
  ADD COLUMN IF NOT EXISTS `entry_id`   VARCHAR(100) NULL AFTER `id`,
  ADD COLUMN IF NOT EXISTS `refer_url`  TEXT         NULL AFTER `remark`,
  ADD COLUMN IF NOT EXISTS `ip_address` VARCHAR(45)  NULL AFTER `refer_url`,
  ADD COLUMN IF NOT EXISTS `country`    VARCHAR(100) NULL AFTER `ip_address`,
  ADD COLUMN IF NOT EXISTS `is_nri`     TINYINT(1)   NOT NULL DEFAULT 0 AFTER `country`,
  ADD COLUMN IF NOT EXISTS `deleted_at` DATETIME     NULL AFTER `updated_at`;

-- Add indexes (ignore errors if they already exist)
ALTER TABLE `leads`
  ADD INDEX IF NOT EXISTS `idx_is_nri`  (`is_nri`),
  ADD INDEX IF NOT EXISTS `idx_deleted` (`deleted_at`);

-- ============================================================
-- TABLE: projects
-- ============================================================
CREATE TABLE IF NOT EXISTS `projects` (
  `id`         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `name`       VARCHAR(200) NOT NULL,
  `location`   VARCHAR(200) NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `uq_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Backfill projects table from existing leads data
INSERT IGNORE INTO `projects` (`name`)
SELECT DISTINCT `project` FROM `leads`
WHERE `project` IS NOT NULL AND `project` != '';
