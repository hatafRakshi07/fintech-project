import { pgTable, uuid, varchar, jsonb } from 'drizzle-orm/pg-core';
import { timestamps } from './utils';
import { orgRoleEnum } from './enums';

export const organizations = pgTable('organizations', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 150 }).notNull(),
  code: varchar('code', { length: 50 }).notNull().unique(),
  settings: jsonb('settings').default({}).notNull(),
  ...timestamps
});

export const userOrganizations = pgTable('user_organizations', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull(),
  organizationId: uuid('organization_id').references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
  role: orgRoleEnum('role').default('STAFF').notNull(),
  ...timestamps
});

export const employees = pgTable('employees', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
  code: varchar('code', { length: 50 }).notNull(),
  name: varchar('name', { length: 100 }).notNull(),
  phone: varchar('phone', { length: 20 }).notNull(),
  role: orgRoleEnum('role').default('COLLECTOR').notNull(),
  status: varchar('status', { length: 20 }).default('ACTIVE').notNull(),
  ...timestamps
});

// Alias export for backwards compatibility
export const users = userOrganizations;
export const collectors = employees;
