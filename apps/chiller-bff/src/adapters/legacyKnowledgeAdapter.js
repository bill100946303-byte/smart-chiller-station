import { fetchLegacyJson, requestLegacy } from "../lib/http.js";

function asTrimmedString(value, fallback = "") {
  if (value == null) {
    return fallback;
  }
  const normalized = String(value).trim();
  return normalized || fallback;
}

function extractMessage(payload, fallback = null) {
  if (!payload || typeof payload !== "object") {
    return fallback;
  }
  const raw = payload.msg ?? payload.message ?? payload.statusText;
  return raw == null ? fallback : String(raw);
}

function toPositiveInteger(value, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return Math.floor(parsed);
}

function toArray(value) {
  if (Array.isArray(value)) {
    return value;
  }
  if (value == null || value === "") {
    return [];
  }
  return [value];
}

function deriveFileName(filePath) {
  const normalized = asTrimmedString(filePath, "");
  if (!normalized) {
    return "";
  }
  const parts = normalized.split("/").filter(Boolean);
  const last = parts[parts.length - 1] || normalized;
  try {
    return decodeURIComponent(last);
  } catch (_error) {
    return last;
  }
}

function normalizeDocument(item, index) {
  const filePath = asTrimmedString(item?.filepath || item?.filePath || item?.path || "");
  return {
    id: asTrimmedString(item?.id || item?.instructionsid || `knowledge-${index + 1}`),
    name: asTrimmedString(item?.instructionsName || item?.name || "--"),
    typeId: asTrimmedString(item?.instructionsTypeid || item?.drtypeid || ""),
    typeName: asTrimmedString(item?.drtypename || item?.typeName || "--"),
    description: asTrimmedString(item?.instructionsExplain || item?.description || "--"),
    filePath,
    fileName: deriveFileName(filePath)
  };
}

function normalizeTypeNode(node, index, parentId = null) {
  const id = asTrimmedString(node?.drtypeid || node?.id || `knowledge-type-${index + 1}`);
  const childrenRaw = Array.isArray(node?.drtypeinfoList) ? node.drtypeinfoList : [];
  return {
    id,
    label: asTrimmedString(node?.drtypenameCNEN || node?.drtypename || node?.name || id),
    parentId,
    children: childrenRaw.map((child, childIndex) => normalizeTypeNode(child, childIndex, id))
  };
}

function buildDocumentListEndpoint(siteId, options) {
  const search = new URLSearchParams();
  search.set("pageCurrent", String(options.page));
  search.set("pageSize", String(options.pageSize));
  return `/zsqy/instructions/${siteId}/findObject?${search.toString()}`;
}

function buildDeviceTypeEndpoint(siteId) {
  return `/zsqy/Drtypeinfo/${siteId}/findObject`;
}

function buildCreateEndpoint(siteId) {
  return `/zsqy/instructions/${siteId}/save`;
}

function buildUpdateEndpoint(siteId) {
  return `/zsqy/instructions/${siteId}/update`;
}

function buildDeleteEndpoint(siteId, documentId) {
  const search = new URLSearchParams();
  search.set("id", documentId);
  return `/zsqy/instructions/${siteId}/delete?${search.toString()}`;
}

async function mutateDocument(baseUrl, endpoint, options = {}) {
  const response = await requestLegacy(baseUrl, endpoint, {
    method: options.method,
    headers: options.headers,
    body: options.body
  });
  const message = extractMessage(response.payload, response.ok ? "OK" : null);
  return {
    ok: response.ok,
    status: response.status ?? null,
    endpoint,
    message,
    error: response.ok ? null : response.error || message || "Legacy request failed"
  };
}

export async function loadKnowledgeDocuments(baseUrl, siteId, options = {}) {
  const page = toPositiveInteger(options.page, 1);
  const pageSize = toPositiveInteger(options.pageSize, 10);
  const endpoint = buildDocumentListEndpoint(siteId, { page, pageSize });
  const response = await fetchLegacyJson(baseUrl, endpoint);
  const payload = response.ok && response.payload && typeof response.payload === "object" ? response.payload : null;
  const rows = toArray(payload?.data?.records);
  const totalRaw = payload?.data?.rowCount ?? rows.length;
  const total = Number.isFinite(Number(totalRaw)) ? Number(totalRaw) : rows.length;

  return {
    items: rows.map(normalizeDocument),
    total,
    page,
    pageSize,
    sourceStatus: {
      endpoint,
      ok: response.ok,
      status: response.status ?? null,
      message: response.ok ? extractMessage(response.payload, "OK") : null,
      rows: response.ok ? rows.length : null,
      error: response.ok ? null : response.error
    }
  };
}

export async function loadKnowledgeDeviceTypes(baseUrl, siteId) {
  const endpoint = buildDeviceTypeEndpoint(siteId);
  const response = await fetchLegacyJson(baseUrl, endpoint);
  const payload = response.ok && response.payload && typeof response.payload === "object" ? response.payload : null;
  const rows = toArray(payload?.data);

  return {
    items: rows.map((item, index) => normalizeTypeNode(item, index)),
    sourceStatus: {
      endpoint,
      ok: response.ok,
      status: response.status ?? null,
      message: response.ok ? extractMessage(response.payload, "OK") : null,
      rows: response.ok ? rows.length : null,
      error: response.ok ? null : response.error
    }
  };
}

export async function createKnowledgeDocument(baseUrl, siteId, options = {}) {
  return mutateDocument(baseUrl, buildCreateEndpoint(siteId), {
    method: "POST",
    headers: options.contentType
      ? {
          "content-type": options.contentType
        }
      : undefined,
    body: options.body
  });
}

export async function updateKnowledgeDocument(baseUrl, siteId, options = {}) {
  return mutateDocument(baseUrl, buildUpdateEndpoint(siteId), {
    method: "PUT",
    headers: options.contentType
      ? {
          "content-type": options.contentType
        }
      : undefined,
    body: options.body
  });
}

export async function deleteKnowledgeDocument(baseUrl, siteId, documentId) {
  const normalizedId = asTrimmedString(documentId, "");
  return mutateDocument(baseUrl, buildDeleteEndpoint(siteId, normalizedId), {
    method: "DELETE"
  });
}
