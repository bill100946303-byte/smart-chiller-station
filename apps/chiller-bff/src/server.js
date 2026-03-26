import cors from "cors";
import express from "express";
import { config } from "./config.js";
import { buildV1Router } from "./routes/v1.js";

const app = express();
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

app.use(cors());
app.use(express.json());

app.get("/healthz", (_req, res) => {
  res.json({
    ok: true,
    service: "chiller-bff",
    port: config.port,
    appMode: config.appMode,
    appModeLabel: config.appModeLabel,
    readOnlyMode: config.readOnlyMode,
    legacyBaseUrl: config.legacyBaseUrl
  });
});

app.use("/bff/v1", (req, res, next) => {
  if (!config.readOnlyMode || SAFE_METHODS.has(req.method)) {
    next();
    return;
  }

  if (req.method === "POST" && req.path.endsWith("/optimize")) {
    next();
    return;
  }

  res.status(403).json({
    ok: false,
    code: "READ_ONLY_MODE",
    error: `${config.appModeLabel}已启用只读保护，当前环境禁止新增、编辑和删除操作。`,
    requestId: `req-${Date.now()}`,
    details: {
      appMode: config.appMode,
      appModeLabel: config.appModeLabel,
      readOnlyMode: config.readOnlyMode,
      legacyBaseUrl: config.legacyBaseUrl
    }
  });
});

app.use("/bff/v1", buildV1Router(config));

app.use((error, _req, res, _next) => {
  res.status(500).json({
    ok: false,
    error: String(error?.message || error || "Unhandled error")
  });
});

app.listen(config.port, "127.0.0.1", () => {
  // eslint-disable-next-line no-console
  console.log(`[chiller-bff] listening on http://127.0.0.1:${config.port}`);
});
