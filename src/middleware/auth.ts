import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import type { AuthenticatedUser } from "../types";
import { env } from "../config/env";

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}

export function authMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  const header = req.headers.authorization ?? "";
  if (!header.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing bearer token" });
  }

  const token = header.slice("Bearer ".length).trim();
  if (!token) {
    return res.status(401).json({ error: "Empty bearer token" });
  }

  if (!env.jwtSecret) {
    return res.status(503).json({ error: "JWT_SECRET is not set" });
  }

  try {
    const payload = jwt.verify(token, env.jwtSecret) as {
      sub?: string;
      email?: string;
    };
    if (!payload?.sub || !payload?.email) {
      return res.status(401).json({ error: "Invalid token" });
    }

    req.user = { id: payload.sub, email: payload.email };
  } catch (_error) {
    return res.status(401).json({ error: "Invalid token" });
  }

  return next();
}
