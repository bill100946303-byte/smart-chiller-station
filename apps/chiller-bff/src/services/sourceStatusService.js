function normalizeOptionalText(value) {
  if (value == null) {
    return null;
  }
  const normalized = String(value).trim();
  return normalized ? normalized : null;
}

function normalizeBaseUrl(value) {
  const normalized = normalizeOptionalText(value);
  return normalized ? normalized.replace(/\/+$/, "") : null;
}

export function annotateSourceEntry(input, metadata = {}) {
  if (!input || typeof input !== "object") {
    return input;
  }

  const baseUrl = normalizeBaseUrl(metadata.baseUrl);
  const interfaceKind = normalizeOptionalText(metadata.interfaceKind);
  const originLabel = normalizeOptionalText(metadata.originLabel);

  return {
    ...input,
    ...(baseUrl ? { baseUrl } : {}),
    ...(interfaceKind ? { interfaceKind } : {}),
    ...(originLabel ? { originLabel } : {})
  };
}

function normalizeOne(input) {
  return {
    key: String(input?.key || "unknown"),
    endpoint: String(input?.endpoint || ""),
    ok: Boolean(input?.ok),
    fallback: input?.fallback === true,
    reasonCode: input?.reasonCode == null ? null : String(input.reasonCode),
    status:
      typeof input?.status === "number" && Number.isFinite(input.status) ? input.status : null,
    message: input?.message == null ? null : String(input.message),
    error: input?.error == null ? null : String(input.error),
    rows: typeof input?.rows === "number" && Number.isFinite(input.rows) ? input.rows : null,
    baseUrl: normalizeBaseUrl(input?.baseUrl),
    interfaceKind: normalizeOptionalText(input?.interfaceKind),
    originLabel: normalizeOptionalText(input?.originLabel)
  };
}

export function buildSourceStatus(sourcesInput) {
  const sources = Array.isArray(sourcesInput)
    ? sourcesInput.map(normalizeOne)
    : [normalizeOne(sourcesInput)];

  const okCount = sources.filter((source) => source.ok).length;
  const hasFallback = sources.some((source) => source.fallback === true);
  const overall =
    okCount === sources.length
      ? hasFallback
        ? "partial"
        : "ok"
      : okCount === 0
        ? "failed"
        : "partial";

  return {
    overall,
    sources
  };
}
