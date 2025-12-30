import { Router } from "express";
import type { AuthenticatedRequest } from "../middleware/auth";
import {
  addConversationMessage,
  createConversation,
  deleteUserConversations,
  getConversationDetail,
  listUserConversations,
} from "../services/copilotClient";

const router = Router();

function mapErrorToStatus(message: string) {
  if (
    message.includes("COPILOT_CONNECTION_STRING") ||
    message.includes("DATABASE_URL") ||
    message.includes("COPILOT settings") ||
    message.includes("COPILOT_DIRECT_LINE_SECRET") ||
    message.includes("Direct Line") ||
    message.includes("Copilot conversation id not returned")
  ) {
    return 503;
  }

  if (message.includes("Conversation not found")) {
    return 404;
  }

  if (message.includes("User not found")) {
    return 404;
  }

  if (message.includes("CONVERSATION_BUSY")) {
    return 429;
  }

  return 500;
}

router.get("/conversations", async (req: AuthenticatedRequest, res) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: "Missing user context" });
    }

    const result = await listUserConversations(user);
    return res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return res.status(mapErrorToStatus(message)).json({ error: message });
  }
});

router.post("/conversations", async (req: AuthenticatedRequest, res) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: "Missing user context" });
    }

    const { title } = req.body ?? {};
    if (title !== undefined && typeof title !== "string") {
      return res.status(400).json({ error: "Invalid title" });
    }

    const result = await createConversation(user, { title });
    return res.status(201).json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return res.status(mapErrorToStatus(message)).json({ error: message });
  }
});

router.delete("/conversations", async (req: AuthenticatedRequest, res) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: "Missing user context" });
    }

    const result = await deleteUserConversations(user);
    return res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return res.status(mapErrorToStatus(message)).json({ error: message });
  }
});

router.get("/conversations/:id", async (req: AuthenticatedRequest, res) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: "Missing user context" });
    }

    const result = await getConversationDetail(user, req.params.id);
    return res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return res.status(mapErrorToStatus(message)).json({ error: message });
  }
});

router.post(
  "/conversations/:id/messages",
  async (req: AuthenticatedRequest, res) => {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({ error: "Missing user context" });
      }

      const { role, content } = req.body ?? {};
      const allowedRoles = ["user", "assistant", "system"] as const;
      const isAllowedRole = (
        value: string
      ): value is (typeof allowedRoles)[number] =>
        allowedRoles.includes(value as (typeof allowedRoles)[number]);

      if (typeof role !== "string" || !isAllowedRole(role)) {
        return res.status(400).json({ error: "Invalid role" });
      }

      if (typeof content !== "string" || !content.trim()) {
        return res.status(400).json({ error: "Invalid content" });
      }

      const result = await addConversationMessage(user, req.params.id, {
        role,
        content: content.trim(),
      });
      return res.status(201).json(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unexpected error";
      return res.status(mapErrorToStatus(message)).json({ error: message });
    }
  }
);

export default router;
