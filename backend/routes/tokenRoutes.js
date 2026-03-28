import { Router } from "express";
import {
  branchTokenHandler,
  createTokenHandler,
  endCare,
  endConsult,
  getLiveQueueHandler,
  getTokenDetailHandler,
  startCare,
  startConsult,
  startWaiting
} from "../controllers/tokenController.js";
import { authorizeRoles, requireAuth } from "../middlewares/authMiddleware.js";

const router = Router();

router.use(requireAuth);

router.get("/queue/live", getLiveQueueHandler);
router.get("/:id", getTokenDetailHandler);
router.post("/", authorizeRoles("admin", "nurse"), createTokenHandler);
router.post("/:id/start-waiting", authorizeRoles("admin", "nurse"), startWaiting);
router.post("/:id/start-consult", authorizeRoles("admin", "doctor"), startConsult);
router.post("/:id/end-consult", authorizeRoles("admin", "doctor"), endConsult);
router.post("/:id/start-care", authorizeRoles("admin", "nurse"), startCare);
router.post("/:id/end-care", authorizeRoles("admin", "nurse"), endCare);
router.post("/:id/start-treatment", authorizeRoles("admin", "nurse"), startCare);
router.post("/:id/end-treatment", authorizeRoles("admin", "nurse"), endCare);
router.post("/:id/branch", authorizeRoles("admin", "nurse", "doctor"), branchTokenHandler);

export default router;
