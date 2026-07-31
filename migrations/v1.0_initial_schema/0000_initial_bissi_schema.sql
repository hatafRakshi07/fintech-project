-- Migration v1.0: Initial Bissi Database Schema
BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

COMMIT;
