import { Router } from "express";
import type { AuthenticatedRequest } from "../middleware/auth";
import { getUserContext } from "../services/copilotClient";

const router = Router();

router.get("/context", async (req: AuthenticatedRequest, res) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: "Missing user context" });
    }

    const result = await getUserContext(user);
    return res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    const status =
      message.includes("COPILOT_CONNECTION_STRING") ||
      message.includes("DATABASE_URL") ||
      message.includes("COPILOT settings")
        ? 503
        : message.includes("User not found")
          ? 404
          : 500;
    return res.status(status).json({ error: message });
  }
});

export default router;
