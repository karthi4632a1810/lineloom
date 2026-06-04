import { Router } from "express";
import {
  getPatientRecordHandler,
  searchPatientRecordsHandler
} from "../controllers/patientController.js";
import { requireAuth } from "../middlewares/authMiddleware.js";

const router = Router();

router.use(requireAuth);
router.get("/search", searchPatientRecordsHandler);
router.get("/:patientId/records", getPatientRecordHandler);

export default router;
