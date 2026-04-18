import { Router } from "express";
import {
  acknowledgeAlertHandler,
  listAlertsHandler,
  recommendationsHandler
} from "../controllers/alertController.js";
import { authorizeRoles, requireAuth } from "../middlewares/authMiddleware.js";

const router = Router();

router.use(requireAuth);

router.get("/", authorizeRoles("admin", "doctor", "nurse"), listAlertsHandler);
router.get("/recommendations", authorizeRoles("admin", "doctor", "nurse"), recommendationsHandler);
router.post("/:id/acknowledge", authorizeRoles("admin", "doctor", "nurse"), acknowledgeAlertHandler);

export default router;
