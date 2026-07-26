
import { pgTable, uuid, varchar, text, boolean, timestamp } from 'drizzle-orm/pg-core';
import { timestamps } from './utils';
import { roleEnum } from './enums';

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  username: varchar('username', { length: 50 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  role: roleEnum('role').default('CUSTOMER').notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  ...timestamps
});

export const employees = pgTable('employees', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  name: varchar('name', { length: 100 }).notNull(),
  phone: varchar('phone', { length: 20 }).notNull(),
  email: varchar('email', { length: 100 }),
  ...timestamps
});

export const collectors = pgTable('collectors', {
  id: uuid('id').defaultRandom().primaryKey(),
  employeeId: uuid('employee_id').references(() => employees.id).notNull(),
  area: varchar('area', { length: 100 }),
  commissionRate: varchar('commission_rate', { length: 10 }),
  ...timestamps
});

export const roles_permissions = pgTable('roles_permissions', {
  id: uuid('id').defaultRandom().primaryKey(),
  role: roleEnum('role').notNull(),
  permission: varchar('permission', { length: 50 }).notNull(),
  ...timestamps
});
