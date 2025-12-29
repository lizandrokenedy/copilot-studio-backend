export const env = {
  port: Number.parseInt(process.env.PORT ?? "3000", 10),
  copilotDirectLineSecret: process.env.COPILOT_DIRECT_LINE_SECRET ?? "",
  directLineBaseUrl: process.env.DIRECT_LINE_BASE_URL ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  jwtSecret: process.env.JWT_SECRET ?? "",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? "7d",
};
