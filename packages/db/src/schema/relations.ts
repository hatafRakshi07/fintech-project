import { relations } from 'drizzle-orm';
import { organizations } from './organizations';
import { customers } from './customers';
import { committees, committeeRules } from './committees';
import { committeeMonths } from './committee_months';
import { tokens, tokenStatusHistory } from './tokens';
import { installmentSchedules, installments, collectionRegisters } from './installments';
import { drawEvents, drawResults } from './draws';
import { giftCatalog, committeeMonthGifts, giftWinners } from './gifts';
import { loans, loanRepayments } from './loans';
import { settlements } from './settlements';
import { financialTransactions, cashbookEntries, expenses, expenseCategories } from './finance';
import { employees, userOrganizations } from './employees';

export const organizationsRelations = relations(organizations, ({ many }) => ({
  customers: many(customers),
  committees: many(committees),
  employees: many(employees),
}));

export const customersRelations = relations(customers, ({ one, many }) => ({
  organization: one(organizations, { fields: [customers.organizationId], references: [organizations.id] }),
  tokens: many(tokens),
  loans: many(loans),
  settlements: many(settlements),
}));

export const committeesRelations = relations(committees, ({ one, many }) => ({
  organization: one(organizations, { fields: [committees.organizationId], references: [organizations.id] }),
  committeeMonths: many(committeeMonths),
  rules: one(committeeRules, { fields: [committees.id], references: [committeeRules.committeeId] }),
  tokens: many(tokens),
}));

export const committeeMonthsRelations = relations(committeeMonths, ({ one, many }) => ({
  committee: one(committees, { fields: [committeeMonths.committeeId], references: [committees.id] }),
  installmentSchedules: many(installmentSchedules),
  drawEvent: one(drawEvents, { fields: [committeeMonths.id], references: [drawEvents.committeeMonthId] }),
  gifts: many(committeeMonthGifts),
}));

export const tokensRelations = relations(tokens, ({ one, many }) => ({
  committee: one(committees, { fields: [tokens.committeeId], references: [committees.id] }),
  customer: one(customers, { fields: [tokens.customerId], references: [customers.id] }),
  schedules: many(installmentSchedules),
  installments: many(installments),
  drawResults: many(drawResults),
  loans: many(loans),
  settlement: one(settlements, { fields: [tokens.id], references: [settlements.tokenId] }),
  statusHistory: many(tokenStatusHistory),
}));

export const installmentSchedulesRelations = relations(installmentSchedules, ({ one }) => ({
  committeeMonth: one(committeeMonths, { fields: [installmentSchedules.committeeMonthId], references: [committeeMonths.id] }),
  token: one(tokens, { fields: [installmentSchedules.tokenId], references: [tokens.id] }),
}));

export const installmentsRelations = relations(installments, ({ one }) => ({
  committeeMonth: one(committeeMonths, { fields: [installments.committeeMonthId], references: [committeeMonths.id] }),
  token: one(tokens, { fields: [installments.tokenId], references: [tokens.id] }),
  schedule: one(installmentSchedules, { fields: [installments.scheduleId], references: [installmentSchedules.id] }),
  collector: one(employees, { fields: [installments.collectorId], references: [employees.id] }),
}));

export const drawEventsRelations = relations(drawEvents, ({ one, many }) => ({
  committeeMonth: one(committeeMonths, { fields: [drawEvents.committeeMonthId], references: [committeeMonths.id] }),
  results: many(drawResults),
}));

export const drawResultsRelations = relations(drawResults, ({ one }) => ({
  drawEvent: one(drawEvents, { fields: [drawResults.drawEventId], references: [drawEvents.id] }),
  token: one(tokens, { fields: [drawResults.tokenId], references: [tokens.id] }),
}));

export const loansRelations = relations(loans, ({ one, many }) => ({
  committee: one(committees, { fields: [loans.committeeId], references: [committees.id] }),
  customer: one(customers, { fields: [loans.customerId], references: [customers.id] }),
  token: one(tokens, { fields: [loans.tokenId], references: [tokens.id] }),
  repayments: many(loanRepayments),
}));

export const loanRepaymentsRelations = relations(loanRepayments, ({ one }) => ({
  loan: one(loans, { fields: [loanRepayments.loanId], references: [loans.id] }),
}));
