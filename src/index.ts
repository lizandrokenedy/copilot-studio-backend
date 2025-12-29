import "dotenv/config";
import express from "express";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import cors from "cors";
import { env } from "./config/env";
import { authMiddleware } from "./middleware/auth";
import conversationsRouter from "./routes/conversations";
import contextRouter from "./routes/context";
import usersRouter from "./routes/users";
import authRouter from "./routes/auth";

const app = express();
const packageJsonPath = join(__dirname, "..", "package.json");
const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8")) as {
  name?: string;
  version?: string;
};

app.use(cors());
app.use(express.json());

app.get("/", (_req, res) => {
  res.json({
    name: packageJson.name ?? "api",
    version: packageJson.version ?? "unknown",
  });
});

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/auth", authRouter);
app.use("/api", authMiddleware);
app.use("/api", conversationsRouter);
app.use("/api", contextRouter);
app.use("/api", usersRouter);

app.use((
  err: Error,
  _req: express.Request,
  res: express.Response,
  _next: express.NextFunction,
) => {
  const message = err?.message ?? "Unexpected error";
  res.status(500).json({ error: message });
});

app.listen(env.port, () => {
  console.log(`Server running on port ${env.port}`);
});
