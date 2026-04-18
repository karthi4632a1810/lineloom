import { Router } from "express";
import { departmentFunnelHandler } from "../controllers/journeyController.js";
import { authorizeRoles, requireAuth } from "../middlewares/authMiddleware.js";

const router = Router();

router.get(
  "/department-funnel",
  requireAuth,
  authorizeRoles("admin", "doctor", "nurse"),
  departmentFunnelHandler
);

export default router;
