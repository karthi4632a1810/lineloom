import { Router } from "express";
import { getHisPatients, searchPatientsFromHis } from "../controllers/hisController.js";
import { requireAuth } from "../middlewares/authMiddleware.js";

const router = Router();

router.get("/patients", requireAuth, getHisPatients);
router.get("/patients/search", requireAuth, searchPatientsFromHis);

export default router;
