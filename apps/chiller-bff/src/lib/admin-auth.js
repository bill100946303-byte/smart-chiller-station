import { unauthorized } from "./admin-errors.js";

function parseBearerToken(headerValue) {
  if (typeof headerValue !== "string") {
    return "";
  }
  const match = headerValue.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : "";
}

export function createAdminAuthMiddleware(authService) {
  return async function adminAuthMiddleware(req, _res, next) {
    try {
      const token = parseBearerToken(req.get("authorization"));
      const hintedUserId = req.get("x-chiller-user-id") || "";
      if (!token) {
        throw unauthorized("Missing Bearer token");
      }

      const user = await authService.authenticateToken(token, hintedUserId);
      req.adminToken = token;
      req.adminUser = user;
      next();
    } catch (error) {
      next(error);
    }
  };
}
