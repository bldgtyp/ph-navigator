-- Runs once when a fresh Postgres volume is initialized.
-- Creates the dedicated pytest database alongside the dev database so
-- backend test fixtures (which TRUNCATE every table) can never touch
-- the developer's local data. See docs/plans/2026-05-24/plan-10-separate-test-database.md.
CREATE DATABASE ph_navigator_v2_test OWNER phn;
