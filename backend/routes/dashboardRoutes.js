import { Router } from "express";
import { dashboardSummary, dashboardTokenTable } from "../controllers/dashboardController.js";
import { authorizeRoles, requireAuth } from "../middlewares/authMiddleware.js";

const router = Router();

router.get(
  "/summary",
  requireAuth,
  authorizeRoles("admin", "doctor", "nurse"),
  dashboardSummary
);
router.get(
  "/tokens",
  requireAuth,
  authorizeRoles("admin", "doctor", "nurse"),
  dashboardTokenTable
);

export default router;
