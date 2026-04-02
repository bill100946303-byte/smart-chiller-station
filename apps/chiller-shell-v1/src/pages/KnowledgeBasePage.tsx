import { startTransition, useEffect, useState } from "react";
import SectionCard from "../components/common/SectionCard";
import SourceStatusBanner from "../components/common/SourceStatusBanner";
import StatCard from "../components/common/StatCard";
import StatusPill from "../components/common/StatusPill";
import { runtimeConfig } from "../config/runtimeConfig";
import { buildSourceStatusLines, summarizeSourceStatus } from "../i18n/sourceStatusCN";
import { zhCN } from "../i18n/zhCN";
import {
  type KnowledgeDeviceTypeDto,
  type KnowledgeDeviceTypeNodeDto,
  type KnowledgeDocumentItemDto,
  type KnowledgeDocumentListDto,
  createKnowledgeDocument,
  deleteKnowledgeDocument,
  fetchKnowledgeDeviceTypes,
  fetchKnowledgeDocuments,
  updateKnowledgeDocument
} from "../services/bffClient";

type SummaryCard = {
  title: string;
  value: string;
  unit: string;
  delta: string;
  tone: "neutral" | "good" | "warn";
};

type TypeOption = {
  id: string;
  label: string;
};

type EditorState = {
  mode: "create" | "edit";
  id: string;
  name: string;
  typeId: string;
  description: string;
  file: File | null;
  currentFileName: string;
  currentFilePath: string;
};

const PAGE_SIZE_OPTIONS = [10, 20, 50];

function flattenTypeOptions(nodes: KnowledgeDeviceTypeNodeDto[], depth = 0): TypeOption[] {
  const prefix = depth > 0 ? `${"  ".repeat(Math.max(depth - 1, 0))}${depth === 1 ? "└ " : "└└ "}` : "";
  return nodes.flatMap((node) => {
    const id = String(node.id || "");
    const label = `${prefix}${node.label || id}`;
    const current = id ? [{ id, label }] : [];
    const children = Array.isArray(node.children) ? flattenTypeOptions(node.children, depth + 1) : [];
    return [...current, ...children];
  });
}

function buildLegacyFileUrl(filePath: string | null | undefined): string | null {
  const normalized = String(filePath || "").trim();
  if (!normalized) {
    return null;
  }
  try {
    return new URL(normalized, runtimeConfig.legacyBaseUrl).toString();
  } catch (_error) {
    return null;
  }
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) {
    return zhCN.common.timeUnknown;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return zhCN.common.timeUnknown;
  }
  return date.toLocaleString();
}

function buildSummaryCards(
  documents: KnowledgeDocumentListDto | null,
  typeOptions: TypeOption[],
  loading: boolean
): SummaryCard[] {
  const total = typeof documents?.total === "number" ? documents.total : 0;
  const page = typeof documents?.page === "number" ? documents.page : 1;
  const pageSize = typeof documents?.pageSize === "number" ? documents.pageSize : 10;
  const sourceReady = documents?.sourceStatus?.overall === "ok" && !loading;

  return [
    {
      title: zhCN.knowledgePage.summaryTotal,
      value: String(total),
      unit: zhCN.common.unitItem,
      delta: zhCN.knowledgePage.summaryTotalHint,
      tone: total > 0 ? "good" : "neutral"
    },
    {
      title: zhCN.knowledgePage.summaryTypes,
      value: String(typeOptions.length),
      unit: zhCN.common.unitItem,
      delta: zhCN.knowledgePage.summaryTypesHint,
      tone: typeOptions.length > 0 ? "neutral" : "warn"
    },
    {
      title: zhCN.knowledgePage.summaryPage,
      value: String(page),
      unit: "",
      delta: `${zhCN.knowledgePage.summaryPageHint} ${pageSize}`,
      tone: "neutral"
    },
    {
      title: zhCN.knowledgePage.summaryState,
      value: sourceReady ? zhCN.knowledgePage.summaryStateReady : zhCN.knowledgePage.summaryStateFallback,
      unit: "",
      delta: zhCN.knowledgePage.summaryStateHint,
      tone: sourceReady ? "good" : "warn"
    }
  ];
}

function buildEmptyEditor(mode: "create" | "edit", typeOptions: TypeOption[]): EditorState {
  return {
    mode,
    id: "",
    name: "",
    typeId: typeOptions[0]?.id || "",
    description: "",
    file: null,
    currentFileName: "",
    currentFilePath: ""
  };
}

function buildStrategyCards() {
  return [
    {
      title: zhCN.knowledgePage.strategyCoolingTitle,
      source: zhCN.knowledgePage.strategyCoolingSource,
      appliesTo: zhCN.knowledgePage.strategyCoolingApply,
      action: zhCN.knowledgePage.strategyCoolingAction
    },
    {
      title: zhCN.knowledgePage.strategyChilledTitle,
      source: zhCN.knowledgePage.strategyChilledSource,
      appliesTo: zhCN.knowledgePage.strategyChilledApply,
      action: zhCN.knowledgePage.strategyChilledAction
    },
    {
      title: zhCN.knowledgePage.strategyGateTitle,
      source: zhCN.knowledgePage.strategyGateSource,
      appliesTo: zhCN.knowledgePage.strategyGateApply,
      action: zhCN.knowledgePage.strategyGateAction
    },
    {
      title: zhCN.knowledgePage.strategyVerifyTitle,
      source: zhCN.knowledgePage.strategyVerifySource,
      appliesTo: zhCN.knowledgePage.strategyVerifyApply,
      action: zhCN.knowledgePage.strategyVerifyAction
    }
  ];
}

export default function KnowledgeBasePage() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [refreshToken, setRefreshToken] = useState(0);
  const [documents, setDocuments] = useState<KnowledgeDocumentListDto | null>(null);
  const [types, setTypes] = useState<KnowledgeDeviceTypeDto | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [typeError, setTypeError] = useState<string | null>(null);
  const [actionState, setActionState] = useState<{ kind: "success" | "error"; message: string } | null>(null);
  const [dialog, setDialog] = useState<EditorState | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const typeOptions = flattenTypeOptions(types?.items || []);
  const total = typeof documents?.total === "number" ? documents.total : 0;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const rows = documents?.items || [];
  const summaryCards = buildSummaryCards(documents, typeOptions, loading);
  const strategyCards = buildStrategyCards();

  useEffect(() => {
    let active = true;

    async function loadTypes() {
      try {
        const result = await fetchKnowledgeDeviceTypes(runtimeConfig.siteId);
        if (!active) {
          return;
        }
        startTransition(() => {
          setTypes(result);
          setTypeError(null);
        });
      } catch (_error) {
        if (!active) {
          return;
        }
        startTransition(() => {
          setTypes(null);
          setTypeError(zhCN.knowledgePage.typeLoadFailed);
        });
      }
    }

    loadTypes();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    async function loadDocuments() {
      setLoading(true);
      try {
        const result = await fetchKnowledgeDocuments(runtimeConfig.siteId, {
          page,
          pageSize
        });
        if (!active) {
          return;
        }
        startTransition(() => {
          setDocuments(result);
          setLoadError(null);
          setLoading(false);
        });
      } catch (_error) {
        if (!active) {
          return;
        }
        startTransition(() => {
          setDocuments(null);
          setLoadError(zhCN.knowledgePage.loadFailed);
          setLoading(false);
        });
      }
    }

    loadDocuments();
    return () => {
      active = false;
    };
  }, [page, pageSize, refreshToken]);

  useEffect(() => {
    if (page > pageCount) {
      setPage(pageCount);
    }
  }, [page, pageCount]);

  useEffect(() => {
    if (!dialog || dialog.typeId || typeOptions.length === 0) {
      return;
    }
    setDialog((current) => {
      if (!current || current.typeId) {
        return current;
      }
      return {
        ...current,
        typeId: typeOptions[0]?.id || ""
      };
    });
  }, [dialog, typeOptions]);

  const sourceSummary = summarizeSourceStatus([documents?.sourceStatus, types?.sourceStatus]);
  const sourceStatusLines = buildSourceStatusLines([documents?.sourceStatus, types?.sourceStatus]);
  const sourceStatusLinesCompact = buildSourceStatusLines([documents?.sourceStatus, types?.sourceStatus], {
    labelMode: "short"
  });
  const bannerText = actionState?.message
    || loadError
    || typeError
    || (loading ? zhCN.knowledgePage.loading : sourceSummary.text);
  const bannerWarn = Boolean(loadError || typeError || actionState?.kind === "error") || sourceSummary.warn;

  function resetActionState() {
    setActionState(null);
  }

  function triggerRefresh(nextPage?: number) {
    if (typeof nextPage === "number") {
      setPage(nextPage);
    }
    setRefreshToken((current) => current + 1);
  }

  function openCreateDialog() {
    resetActionState();
    setDialog(buildEmptyEditor("create", typeOptions));
  }

  function openEditDialog(item: KnowledgeDocumentItemDto) {
    resetActionState();
    setDialog({
      mode: "edit",
      id: String(item.id || ""),
      name: String(item.name || ""),
      typeId: String(item.typeId || ""),
      description: item.description === "--" ? "" : String(item.description || ""),
      file: null,
      currentFileName: String(item.fileName || ""),
      currentFilePath: String(item.filePath || "")
    });
  }

  function updateDialogField<K extends keyof EditorState>(key: K, value: EditorState[K]) {
    setDialog((current) => (current ? { ...current, [key]: value } : current));
  }

  async function handleSubmit() {
    if (!dialog) {
      return;
    }
    if (runtimeConfig.readOnlyMode) {
      setActionState({
        kind: "error",
        message: zhCN.runtimeMode.writeBlocked
      });
      return;
    }
    const name = dialog.name.trim();
    if (!name) {
      setActionState({
        kind: "error",
        message: zhCN.knowledgePage.requiredName
      });
      return;
    }
    if (!dialog.typeId) {
      setActionState({
        kind: "error",
        message: zhCN.knowledgePage.requiredType
      });
      return;
    }

    const formData = new FormData();
    if (dialog.mode === "edit") {
      formData.append("id", dialog.id);
    }
    formData.append("instructionsName", name);
    formData.append("instructionsTypeid", dialog.typeId);
    formData.append("instructionsExplain", dialog.description.trim());
    if (dialog.file) {
      formData.append("file", dialog.file);
    }

    setSubmitting(true);
    resetActionState();

    try {
      if (dialog.mode === "create") {
        await createKnowledgeDocument(runtimeConfig.siteId, formData);
      } else {
        await updateKnowledgeDocument(runtimeConfig.siteId, formData);
      }

      startTransition(() => {
        setSubmitting(false);
        setDialog(null);
        setActionState({
          kind: "success",
          message: dialog.mode === "create" ? zhCN.knowledgePage.created : zhCN.knowledgePage.updated
        });
      });
      triggerRefresh(dialog.mode === "create" ? 1 : undefined);
    } catch (_error) {
      startTransition(() => {
        setSubmitting(false);
        setActionState({
          kind: "error",
          message: zhCN.knowledgePage.saveFailed
        });
      });
    }
  }

  async function handleDelete(item: KnowledgeDocumentItemDto) {
    const documentId = String(item.id || "");
    if (!documentId) {
      return;
    }
    if (runtimeConfig.readOnlyMode) {
      setActionState({
        kind: "error",
        message: zhCN.runtimeMode.writeBlocked
      });
      return;
    }
    const accepted = window.confirm(`${zhCN.knowledgePage.deleteConfirm} ${item.name || documentId}?`);
    if (!accepted) {
      return;
    }

    setDeletingId(documentId);
    resetActionState();
    try {
      await deleteKnowledgeDocument(runtimeConfig.siteId, documentId);
      startTransition(() => {
        setDeletingId(null);
        setActionState({
          kind: "success",
          message: zhCN.knowledgePage.deleted
        });
      });

      if (rows.length === 1 && page > 1) {
        triggerRefresh(page - 1);
        return;
      }
      triggerRefresh();
    } catch (_error) {
      startTransition(() => {
        setDeletingId(null);
        setActionState({
          kind: "error",
          message: zhCN.knowledgePage.deleteFailed
        });
      });
    }
  }

  function handlePreview(item: KnowledgeDocumentItemDto) {
    const url = buildLegacyFileUrl(item.filePath);
    if (!url) {
      setActionState({
        kind: "error",
        message: zhCN.knowledgePage.fileMissing
      });
      return;
    }
    window.open(url, "_blank", "noopener,noreferrer");
  }

  function handleDownload(item: KnowledgeDocumentItemDto) {
    const url = buildLegacyFileUrl(item.filePath);
    if (!url) {
      setActionState({
        kind: "error",
        message: zhCN.knowledgePage.fileMissing
      });
      return;
    }
    window.location.href = url;
  }

  return (
    <div className="knowledge-page page-enter">
      <SourceStatusBanner
        summary={bannerText}
        warn={bannerWarn}
        detailLines={sourceStatusLines}
        detailLinesCompact={sourceStatusLinesCompact}
      />

      <section className="knowledge-header">
        <h2>{zhCN.knowledgePage.heading}</h2>
        <p>{zhCN.knowledgePage.subtitle}</p>
      </section>

      <div className="knowledge-summary-grid">
        {summaryCards.map((item) => (
          <StatCard
            key={item.title}
            title={item.title}
            value={item.value}
            unit={item.unit}
            delta={item.delta}
            tone={item.tone}
          />
        ))}
      </div>

      <SectionCard title={zhCN.knowledgePage.sectionStrategy}>
        <div className="knowledge-strategy-grid">
          {strategyCards.map((item) => (
            <article key={item.title} className="knowledge-strategy-card">
              <strong>{item.title}</strong>
              <div className="knowledge-strategy-meta">
                <span>{zhCN.knowledgePage.strategySourceTitle}：{item.source}</span>
                <span>{zhCN.knowledgePage.strategyApplyTitle}：{item.appliesTo}</span>
              </div>
              <p>{zhCN.knowledgePage.strategyActionTitle}：{item.action}</p>
            </article>
          ))}
        </div>
      </SectionCard>

      <SectionCard title={zhCN.knowledgePage.sectionList}>
        <div className="knowledge-toolbar">
          <div className="knowledge-meta">
            <span>{`${zhCN.knowledgePage.latestFetch} ${formatDateTime(documents?.generatedAt)}`}</span>
            <span>{`${zhCN.knowledgePage.pageInfo} ${page}/${pageCount}`}</span>
            <span>{`${zhCN.knowledgePage.typeCount} ${typeOptions.length}${zhCN.common.unitItem}`}</span>
          </div>
          <div className="knowledge-toolbar-actions">
            <label className="knowledge-toolbar-field">
              <span>{zhCN.knowledgePage.rowsPerPage}</span>
              <select
                value={pageSize}
                onChange={(event) => {
                  setPageSize(Number(event.target.value));
                  setPage(1);
                }}
                disabled={loading || submitting || deletingId !== null}
              >
                {PAGE_SIZE_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className="knowledge-button"
              onClick={() => triggerRefresh()}
              disabled={loading || submitting || deletingId !== null}
            >
              {zhCN.knowledgePage.refresh}
            </button>
            <button
              type="button"
              className="knowledge-button is-primary"
              onClick={openCreateDialog}
              disabled={submitting || deletingId !== null || typeOptions.length === 0}
            >
              {zhCN.knowledgePage.create}
            </button>
          </div>
        </div>

        {rows.length > 0 ? (
          <div className="knowledge-table-shell">
            <table className="knowledge-table">
              <thead>
                <tr>
                  <th>{zhCN.knowledgePage.tableName}</th>
                  <th>{zhCN.knowledgePage.tableType}</th>
                  <th>{zhCN.knowledgePage.tableDescription}</th>
                  <th>{zhCN.knowledgePage.tableFile}</th>
                  <th>{zhCN.knowledgePage.tableActions}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((item) => {
                  const documentId = String(item.id || "");
                  const canOpenFile = Boolean(buildLegacyFileUrl(item.filePath));
                  const isDeleting = deletingId === documentId;
                  return (
                    <tr key={documentId || `${item.name}-${item.typeName}`}>
                      <td>{item.name || "--"}</td>
                      <td>{item.typeName || "--"}</td>
                      <td>{item.description || "--"}</td>
                      <td>
                        <div className="knowledge-file-cell">
                          <span>{item.fileName || zhCN.knowledgePage.fileMissing}</span>
                          <StatusPill
                            label={canOpenFile ? zhCN.knowledgePage.summaryStateReady : zhCN.knowledgePage.summaryStateFallback}
                            tone={canOpenFile ? "good" : "warn"}
                          />
                        </div>
                      </td>
                      <td>
                        <div className="knowledge-actions">
                          <button type="button" onClick={() => handlePreview(item)} disabled={!canOpenFile || isDeleting}>
                            {zhCN.knowledgePage.actionPreview}
                          </button>
                          <button type="button" onClick={() => handleDownload(item)} disabled={!canOpenFile || isDeleting}>
                            {zhCN.knowledgePage.actionDownload}
                          </button>
                          <button type="button" onClick={() => openEditDialog(item)} disabled={isDeleting}>
                            {zhCN.knowledgePage.actionEdit}
                          </button>
                          <button type="button" onClick={() => handleDelete(item)} disabled={isDeleting || submitting}>
                            {isDeleting ? zhCN.knowledgePage.deleting : zhCN.knowledgePage.actionDelete}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="knowledge-empty">
            {loading ? zhCN.knowledgePage.loading : zhCN.knowledgePage.empty}
          </div>
        )}

        <div className="knowledge-pagination">
          <button
            type="button"
            className="knowledge-button"
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            disabled={page <= 1 || loading || submitting || deletingId !== null}
          >
            {zhCN.knowledgePage.prevPage}
          </button>
          <span>{`${zhCN.knowledgePage.pageInfo} ${page}/${pageCount}`}</span>
          <button
            type="button"
            className="knowledge-button"
            onClick={() => setPage((current) => Math.min(pageCount, current + 1))}
            disabled={page >= pageCount || loading || submitting || deletingId !== null}
          >
            {zhCN.knowledgePage.nextPage}
          </button>
        </div>
      </SectionCard>

      {dialog ? (
        <div className="knowledge-modal-backdrop" role="presentation" onClick={() => !submitting && setDialog(null)}>
          <div className="knowledge-modal" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
            <div className="knowledge-modal-header">
              <h3>
                {dialog.mode === "create" ? zhCN.knowledgePage.sectionEditorCreate : zhCN.knowledgePage.sectionEditorEdit}
              </h3>
              <button type="button" className="knowledge-modal-close" onClick={() => setDialog(null)} disabled={submitting}>
                ×
              </button>
            </div>
            <div className="knowledge-form-grid">
              <label className="knowledge-form-field">
                <span>{zhCN.knowledgePage.formName}</span>
                <input
                  type="text"
                  value={dialog.name}
                  onChange={(event) => updateDialogField("name", event.target.value)}
                  disabled={submitting}
                />
              </label>
              <label className="knowledge-form-field">
                <span>{zhCN.knowledgePage.formType}</span>
                <select
                  value={dialog.typeId}
                  onChange={(event) => updateDialogField("typeId", event.target.value)}
                  disabled={submitting || typeOptions.length === 0}
                >
                  <option value="">{zhCN.knowledgePage.formSelectType}</option>
                  {typeOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="knowledge-form-field is-full">
                <span>{zhCN.knowledgePage.formDescription}</span>
                <textarea
                  rows={4}
                  value={dialog.description}
                  onChange={(event) => updateDialogField("description", event.target.value)}
                  disabled={submitting}
                />
              </label>
              <label className="knowledge-form-field is-full">
                <span>{zhCN.knowledgePage.formFile}</span>
                <input
                  type="file"
                  onChange={(event) => updateDialogField("file", event.target.files?.[0] || null)}
                  disabled={submitting}
                />
                <small>{zhCN.knowledgePage.formFileHint}</small>
                {dialog.currentFileName ? (
                  <small>{`${zhCN.knowledgePage.formCurrentFile} ${dialog.currentFileName}`}</small>
                ) : null}
              </label>
            </div>
            <div className="knowledge-modal-actions">
              <button type="button" className="knowledge-button" onClick={() => setDialog(null)} disabled={submitting}>
                {zhCN.knowledgePage.cancel}
              </button>
              <button type="button" className="knowledge-button is-primary" onClick={handleSubmit} disabled={submitting}>
                {submitting
                  ? dialog.mode === "create"
                    ? zhCN.knowledgePage.creating
                    : zhCN.knowledgePage.saving
                  : dialog.mode === "create"
                    ? zhCN.knowledgePage.submitCreate
                    : zhCN.knowledgePage.submitUpdate}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
