-- Feature 4 (Product Search, Task 7.1): Schema Doc §7 specifies unaccent applied at query time
-- for diacritic-insensitive full-text search, but the Database feature's initial migration
-- never actually created the extension — closing that gap here, additive only.
CREATE EXTENSION IF NOT EXISTS unaccent;
