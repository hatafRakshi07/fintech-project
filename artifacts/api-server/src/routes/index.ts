import { Router, type IRouter } from "express";
import { requireAuth, requireRole } from "../middleware/auth";
import healthRouter from "./health";
import authRouter from "./auth";
import collectorV2Router from "./collector-v2";
import dashboardV2Routes from "./dashboard-v2";
import migrationV2Routes from "./migration-v2";

const router: IRouter = Router();

router.use(healthRouter);
// Public: login, logout, me
router.use(authRouter);
// All routes below require a valid session token
router.use(requireAuth);

// NEW: Minimal API specifically rebuilt for the Collector Split Workflow
router.use("/v2/collector", collectorV2Router);

export default router;

