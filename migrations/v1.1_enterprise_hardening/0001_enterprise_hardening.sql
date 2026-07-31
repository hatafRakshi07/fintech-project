-- Migration v1.1: Enterprise Hardening & ENUM Types
BEGIN;

CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS fuzzystrmatch;

COMMIT;
