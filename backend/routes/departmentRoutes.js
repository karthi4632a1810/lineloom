import { Router } from "express";
import {
  createHandler,
  deleteHandler,
  listActiveHandler,
  listAllHandler,
  updateHandler
} from "../controllers/departmentController.js";
import { authorizeRoles, requireAuth } from "../middlewares/authMiddleware.js";

const router = Router();

router.get("/", requireAuth, listActiveHandler);
router.get("/all", requireAuth, authorizeRoles("admin"), listAllHandler);
router.post("/", requireAuth, authorizeRoles("admin"), createHandler);
router.patch("/:id", requireAuth, authorizeRoles("admin"), updateHandler);
router.delete("/:id", requireAuth, authorizeRoles("admin"), deleteHandler);

export default router;
