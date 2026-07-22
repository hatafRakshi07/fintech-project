import { Router, type IRouter } from "express";
import { requireAuth, requireRole } from "../middleware/auth";
import healthRouter from "./health";
import authRouter from "./auth";
import dashboardRouter from "./dashboard";
import branchesRouter from "./branches";
import customersRouter from "./customers";
import collectorsRouter from "./collectors";
import committeesRouter from "./committees";
import tokensRouter from "./tokens";
import loansRouter from "./loans";
import collectionsRouter from "./collections";
import lotteriesRouter from "./lotteries";
import reportsRouter from "./reports";
import giftsRouter from "./gifts";
import interestsRouter from "./interests";
import recoveryRouter from "./recovery";
import officeRouter from "./office";
import importsRouter from "./imports";
import notificationsRouter from "./notifications";
import invoicesRouter from "./invoices";
import profileRouter from "./profile";
import accountingRouter from "./accounting";

const router: IRouter = Router();

router.use(healthRouter);
// Public: login, logout, me
router.use(authRouter);
// All routes below require a valid session token
router.use(requireAuth);

router.use(dashboardRouter);

// Branches — super_admin and owner only
router.use(requireRole("super_admin", "owner"), branchesRouter);

// Customers — everyone except customer-role (they only see their own data via profile)
router.use(requireRole("super_admin", "owner", "branch_manager", "collector", "accountant"), customersRouter);

// Collectors — managers and above
router.use(requireRole("super_admin", "owner", "branch_manager"), collectorsRouter);

// Committees & tokens — managers and above
router.use(requireRole("super_admin", "owner", "branch_manager"), committeesRouter);
router.use(requireRole("super_admin", "owner", "branch_manager"), tokensRouter);

// Loans — finance roles
router.use(requireRole("super_admin", "owner", "branch_manager", "accountant"), loansRouter);

// Collections — all authenticated roles (collectors record; customers view receipts)
router.use(collectionsRouter);

// Lotteries — managers and above
router.use(requireRole("super_admin", "owner", "branch_manager"), lotteriesRouter);

// Reports — finance roles
router.use(requireRole("super_admin", "owner", "branch_manager", "accountant"), reportsRouter);

// Gifts — managers and above
router.use(requireRole("super_admin", "owner", "branch_manager", "accountant"), giftsRouter);

// Interests — finance roles
router.use(requireRole("super_admin", "owner", "branch_manager", "accountant"), interestsRouter);

// Recovery — managers, accountants, collectors
router.use(requireRole("super_admin", "owner", "branch_manager", "accountant", "collector"), recoveryRouter);

// Office — managers and above
router.use(requireRole("super_admin", "owner", "branch_manager", "accountant"), officeRouter);

// Imports — managers and above
router.use(requireRole("super_admin", "owner", "branch_manager"), importsRouter);

// Notifications — all authenticated roles
router.use(notificationsRouter);

// Invoices — finance roles
router.use(requireRole("super_admin", "owner", "branch_manager", "accountant"), invoicesRouter);

// Accounting / Ledgers / Tally — finance roles
router.use(requireRole("super_admin", "owner", "branch_manager", "accountant"), accountingRouter);

// Customer self-service profile — all authenticated roles (customers read their own data)
router.use(profileRouter);

export default router;
