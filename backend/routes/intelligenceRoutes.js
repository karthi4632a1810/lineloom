import { Router } from "express";
import {
  intelligenceForecastHandler,
  intelligenceSummaryHandler,
  modelRefreshHandler,
  modelVersionHandler,
  recordActionHandler
} from "../controllers/intelligenceController.js";
import { authorizeRoles, requireAuth } from "../middlewares/authMiddleware.js";

const router = Router();

router.use(requireAuth);

router.get("/summary", authorizeRoles("admin", "doctor", "nurse"), intelligenceSummaryHandler);
router.get("/forecast", authorizeRoles("admin", "doctor", "nurse"), intelligenceForecastHandler);
router.post("/actions", authorizeRoles("admin", "doctor", "nurse"), recordActionHandler);
router.post("/model-refresh", authorizeRoles("admin"), modelRefreshHandler);
router.get("/model-version", authorizeRoles("admin", "doctor", "nurse"), modelVersionHandler);

export default router;
