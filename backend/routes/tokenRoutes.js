import { Router } from "express";
import {
  branchTokenHandler,
  completeVisit,
  createTokenHandler,
  endCare,
  endConsult,
  endLab,
  getCompletedTokensHandler,
  getLiveQueueHandler,
  getTokenJourneyHandler,
  getTokenDetailHandler,
  recordBillingPaymentHandler,
  startCare,
  startConsult,
  startLab,
  startWaiting,
  revertToAnchor,
  stepBack
} from "../controllers/tokenController.js";
import { authorizeRoles, requireAuth } from "../middlewares/authMiddleware.js";

const router = Router();

router.use(requireAuth);

router.get("/queue/live", getLiveQueueHandler);
router.get("/queue/completed", getCompletedTokensHandler);
router.get("/:id/journey", getTokenJourneyHandler);
router.post(
  "/:id/step-back",
  authorizeRoles("admin", "doctor", "nurse"),
  stepBack
);
router.post(
  "/:id/revert",
  authorizeRoles("admin", "doctor", "nurse"),
  revertToAnchor
);
router.get("/:id", getTokenDetailHandler);
router.post("/", authorizeRoles("admin", "nurse"), createTokenHandler);
router.post("/:id/start-waiting", authorizeRoles("admin", "nurse"), startWaiting);
router.post("/:id/start-consult", authorizeRoles("admin", "doctor"), startConsult);
router.post("/:id/end-consult", authorizeRoles("admin", "doctor"), endConsult);
router.post(
  "/:id/record-billing-payment",
  authorizeRoles("admin", "doctor", "nurse"),
  recordBillingPaymentHandler
);
router.post("/:id/start-lab", authorizeRoles("admin", "doctor", "nurse"), startLab);
router.post("/:id/end-lab", authorizeRoles("admin", "doctor", "nurse"), endLab);
router.post("/:id/start-care", authorizeRoles("admin", "nurse"), startCare);
router.post("/:id/end-care", authorizeRoles("admin", "nurse"), endCare);
router.post("/:id/start-treatment", authorizeRoles("admin", "nurse"), startCare);
router.post("/:id/end-treatment", authorizeRoles("admin", "nurse"), endCare);
router.post(
  "/:id/complete-visit",
  authorizeRoles("admin", "doctor", "nurse"),
  completeVisit
);
router.post("/:id/branch", authorizeRoles("admin", "nurse", "doctor"), branchTokenHandler);

export default router;
