import { Router } from "express";
import {
  getHisDepartments,
  getHisPatients,
  searchPatientsFromHis
} from "../controllers/hisController.js";
import { requireAuth } from "../middlewares/authMiddleware.js";

const router = Router();

router.get("/patients", requireAuth, getHisPatients);
router.get("/patients/search", requireAuth, searchPatientsFromHis);
router.get("/departments", requireAuth, getHisDepartments);

export default router;
