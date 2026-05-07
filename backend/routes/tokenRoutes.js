import { Router } from "express";
import {
  branchTokenHandler,
  completeVisit,
  createTokenHandler,
  endCare,
  endBillingHandler,
  endConsult,
  orderLabs,
  endLab,
  endPharmacyHandler,
  deleteBillingPaymentHandler,
  getCompletedTokensHandler,
  getLiveQueueHandler,
  getTokenJourneyHandler,
  getTokenDetailHandler,
  recordBillingPaymentHandler,
  updateBillingPaymentHandler,
  startBillingHandler,
  startCare,
  startConsult,
  startLab,
  startPharmacyHandler,
  stopBillingHandler,
  stopPharmacyHandler,
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
  "/:id/order-labs",
  authorizeRoles("admin", "doctor", "nurse"),
  orderLabs
);
router.post(
  "/:id/start-billing",
  authorizeRoles("admin", "doctor", "nurse"),
  startBillingHandler
);
router.post(
  "/:id/stop-billing",
  authorizeRoles("admin", "doctor", "nurse"),
  stopBillingHandler
);
router.post(
  "/:id/end-billing",
  authorizeRoles("admin", "doctor", "nurse"),
  endBillingHandler
);
router.post(
  "/:id/record-billing-payment",
  authorizeRoles("admin", "doctor", "nurse"),
  recordBillingPaymentHandler
);
router.patch(
  "/:id/billing-payments/:paymentId",
  authorizeRoles("admin"),
  updateBillingPaymentHandler
);
router.delete(
  "/:id/billing-payments/:paymentId",
  authorizeRoles("admin"),
  deleteBillingPaymentHandler
);
router.post(
  "/:id/start-pharmacy",
  authorizeRoles("admin", "doctor", "nurse"),
  startPharmacyHandler
);
router.post(
  "/:id/stop-pharmacy",
  authorizeRoles("admin", "doctor", "nurse"),
  stopPharmacyHandler
);
router.post(
  "/:id/end-pharmacy",
  authorizeRoles("admin", "doctor", "nurse"),
  endPharmacyHandler
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
