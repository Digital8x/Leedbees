-- 20260417_privacy_and_consent.sql
-- Privacy compliance: consent and retention tracking

ALTER TABLE leads
  ADD COLUMN user_consent     TINYINT(1) DEFAULT 0,
  ADD COLUMN retention_date    DATETIME NULL;

ALTER TABLE leads
  ADD INDEX idx_consent (user_consent),
  ADD INDEX idx_retention (retention_date);
