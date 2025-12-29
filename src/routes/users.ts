import { Router } from "express";
import type { AuthenticatedRequest } from "../middleware/auth";
import { env } from "../config/env";
import { prisma } from "../config/prisma";

const router = Router();

function assertDatabaseConfigured() {
  if (!env.databaseUrl) {
    throw new Error("DATABASE_URL is not set");
  }
}

router.get("/users/me", async (req: AuthenticatedRequest, res) => {
  try {
    assertDatabaseConfigured();
    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: "Missing user context" });
    }

    const existing = await prisma.user.findUnique({
      where: { id: user.id },
    });

    if (!existing) {
      return res.status(404).json({ error: "User not found" });
    }

    return res.json({
      user: {
        id: existing.id,
        email: existing.email,
        displayName: existing.displayName,
        createdAt: existing.createdAt.toISOString(),
        updatedAt: existing.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    const status = message.includes("DATABASE_URL") ? 503 : 500;
    return res.status(status).json({ error: message });
  }
});

router.patch("/users/me", async (req: AuthenticatedRequest, res) => {
  try {
    assertDatabaseConfigured();
    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: "Missing user context" });
    }

    const { displayName } = req.body ?? {};
    if (displayName !== undefined && typeof displayName !== "string") {
      return res.status(400).json({ error: "Invalid displayName" });
    }

    const existing = await prisma.user.findUnique({
      where: { id: user.id },
    });

    if (!existing) {
      return res.status(404).json({ error: "User not found" });
    }

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        displayName:
          displayName === undefined ? undefined : displayName.trim() || null,
      },
    });

    return res.json({
      user: {
        id: updated.id,
        email: updated.email,
        displayName: updated.displayName,
        createdAt: updated.createdAt.toISOString(),
        updatedAt: updated.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    const status = message.includes("DATABASE_URL") ? 503 : 500;
    return res.status(status).json({ error: message });
  }
});

router.delete("/users/me", async (req: AuthenticatedRequest, res) => {
  try {
    assertDatabaseConfigured();
    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: "Missing user context" });
    }

    const existing = await prisma.user.findUnique({
      where: { id: user.id },
    });

    if (!existing) {
      return res.status(404).json({ error: "User not found" });
    }

    await prisma.user.delete({
      where: { id: user.id },
    });

    return res.status(204).send();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    const status = message.includes("DATABASE_URL") ? 503 : 500;
    return res.status(status).json({ error: message });
  }
});

export default router;
