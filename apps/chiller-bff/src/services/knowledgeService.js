import {
  createKnowledgeDocument as createLegacyKnowledgeDocument,
  deleteKnowledgeDocument as deleteLegacyKnowledgeDocument,
  loadKnowledgeDeviceTypes,
  loadKnowledgeDocuments,
  updateKnowledgeDocument as updateLegacyKnowledgeDocument
} from "../adapters/legacyKnowledgeAdapter.js";
import { applyFieldNullStrategy, buildGeneratedAt } from "./fieldPolicyService.js";
import { buildSourceStatus } from "./sourceStatusService.js";

function normalizeOptionalText(value) {
  if (typeof value !== "string") {
    return "";
  }
  return value.trim();
}

function resolveKnowledgeLegacySiteId(config, siteId) {
  return (
    normalizeOptionalText(config?.siteSourceConfig?.databaseKey)
    || normalizeOptionalText(config?.siteSourceConfig?.deviceDataProjectKey)
    || normalizeOptionalText(siteId)
  );
}

function mapSite(config, siteId) {
  return {
    siteId: applyFieldNullStrategy(config, "site_id", siteId, siteId),
    siteName: applyFieldNullStrategy(config, "site_name", siteId, siteId)
  };
}

export async function getKnowledgeDocuments(config, siteId, options = {}) {
  const documents = await loadKnowledgeDocuments(
    config.legacyBaseUrl,
    resolveKnowledgeLegacySiteId(config, siteId),
    options
  );

  return {
    site: mapSite(config, siteId),
    generatedAt: buildGeneratedAt(config),
    items: documents.items,
    total: documents.total,
    page: documents.page,
    pageSize: documents.pageSize,
    sourceStatus: buildSourceStatus([{ key: "knowledgeDocuments", ...documents.sourceStatus }])
  };
}

export async function getKnowledgeDeviceTypes(config, siteId) {
  const types = await loadKnowledgeDeviceTypes(
    config.legacyBaseUrl,
    resolveKnowledgeLegacySiteId(config, siteId)
  );

  return {
    site: mapSite(config, siteId),
    generatedAt: buildGeneratedAt(config),
    items: types.items,
    sourceStatus: buildSourceStatus([{ key: "knowledgeDeviceTypes", ...types.sourceStatus }])
  };
}

function buildMutationResult(config, siteId, result) {
  if (!result.ok) {
    return {
      ok: false,
      status: result.status,
      endpoint: result.endpoint,
      error: result.error || "Legacy update failed"
    };
  }

  return {
    ok: true,
    site: mapSite(config, siteId),
    generatedAt: buildGeneratedAt(config),
    message: result.message || "OK"
  };
}

export async function createKnowledgeDocument(config, siteId, options = {}) {
  const result = await createLegacyKnowledgeDocument(
    config.legacyBaseUrl,
    resolveKnowledgeLegacySiteId(config, siteId),
    options
  );
  return buildMutationResult(config, siteId, result);
}

export async function updateKnowledgeDocument(config, siteId, options = {}) {
  const result = await updateLegacyKnowledgeDocument(
    config.legacyBaseUrl,
    resolveKnowledgeLegacySiteId(config, siteId),
    options
  );
  return buildMutationResult(config, siteId, result);
}

export async function deleteKnowledgeDocument(config, siteId, documentId) {
  const result = await deleteLegacyKnowledgeDocument(
    config.legacyBaseUrl,
    resolveKnowledgeLegacySiteId(config, siteId),
    documentId
  );
  return buildMutationResult(config, siteId, result);
}
