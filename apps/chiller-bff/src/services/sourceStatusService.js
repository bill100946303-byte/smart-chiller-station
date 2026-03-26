function normalizeOne(input) {
  return {
    key: String(input?.key || "unknown"),
    endpoint: String(input?.endpoint || ""),
    ok: Boolean(input?.ok),
    fallback: input?.fallback === true,
    status:
      typeof input?.status === "number" && Number.isFinite(input.status) ? input.status : null,
    message: input?.message == null ? null : String(input.message),
    error: input?.error == null ? null : String(input.error),
    rows: typeof input?.rows === "number" && Number.isFinite(input.rows) ? input.rows : null
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
