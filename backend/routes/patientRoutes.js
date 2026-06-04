import { Router } from "express";
import {
  downloadPatientReportHandler,
  getPatientRecordHandler,
  searchPatientRecordsHandler
} from "../controllers/patientController.js";
import { requireAuth } from "../middlewares/authMiddleware.js";

const router = Router();

router.use(requireAuth);
router.get("/search", searchPatientRecordsHandler);
router.get("/report/download", downloadPatientReportHandler);
router.get("/:patientId/records", getPatientRecordHandler);

export default router;
