import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt, { type Secret, type SignOptions } from "jsonwebtoken";
import type { StringValue } from "ms";
import { prisma } from "../config/prisma";
import { env } from "../config/env";

const router = Router();

function assertAuthConfigured() {
  if (!env.jwtSecret) {
    throw new Error("JWT_SECRET is not set");
  }
  if (!env.databaseUrl) {
    throw new Error("DATABASE_URL is not set");
  }
}

router.post("/register", async (req, res) => {
  try {
    assertAuthConfigured();
    const { email, password, displayName } = req.body ?? {};

    if (typeof email !== "string" || !email.trim()) {
      return res.status(400).json({ error: "Invalid email" });
    }
    if (typeof password !== "string" || password.length < 6) {
      return res.status(400).json({ error: "Invalid password" });
    }
    if (displayName !== undefined && typeof displayName !== "string") {
      return res.status(400).json({ error: "Invalid displayName" });
    }

    const existing = await prisma.user.findUnique({
      where: { email: email.trim() },
    });
    if (existing) {
      return res.status(409).json({ error: "Email already registered" });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const created = await prisma.user.create({
      data: {
        email: email.trim(),
        passwordHash,
        displayName: displayName?.trim() || null,
      },
    });

    const jwtSecret = env.jwtSecret as Secret;
    const jwtOptions: SignOptions = {
      expiresIn: env.jwtExpiresIn as StringValue,
    };
    const token = jwt.sign(
      { sub: created.id, email: created.email },
      jwtSecret,
      jwtOptions
    );

    return res.status(201).json({
      token,
      user: {
        id: created.id,
        email: created.email,
        displayName: created.displayName,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    const status = message.includes("JWT_SECRET") || message.includes("DATABASE_URL")
      ? 503
      : 500;
    return res.status(status).json({ error: message });
  }
});

router.post("/login", async (req, res) => {
  try {
    assertAuthConfigured();
    const { email, password } = req.body ?? {};

    if (typeof email !== "string" || !email.trim()) {
      return res.status(400).json({ error: "Invalid email" });
    }
    if (typeof password !== "string" || !password) {
      return res.status(400).json({ error: "Invalid password" });
    }

    const user = await prisma.user.findUnique({
      where: { email: email.trim() },
    });
    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const jwtSecret = env.jwtSecret as Secret;
    const jwtOptions: SignOptions = {
      expiresIn: env.jwtExpiresIn as StringValue,
    };
    const token = jwt.sign(
      { sub: user.id, email: user.email },
      jwtSecret,
      jwtOptions
    );

    return res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    const status = message.includes("JWT_SECRET") || message.includes("DATABASE_URL")
      ? 503
      : 500;
    return res.status(status).json({ error: message });
  }
});

export default router;
