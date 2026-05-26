import { Router } from "express";
import { getPatientRecordHandler } from "../controllers/patientController.js";
import { requireAuth } from "../middlewares/authMiddleware.js";

const router = Router();

router.use(requireAuth);
router.get("/:patientId/records", getPatientRecordHandler);

export default router;
