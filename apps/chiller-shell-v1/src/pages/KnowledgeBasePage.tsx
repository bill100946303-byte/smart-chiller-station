import { startTransition, useEffect, useState } from "react";
import StatusPill from "../components/common/StatusPill";
import { runtimeConfig } from "../config/runtimeConfig";
import { formatSourceStatusLineCompact, summarizeSourceStatus } from "../i18n/sourceStatusCN";
import { zhCN } from "../i18n/zhCN";
import {
  type SourceEndpointStatusDto,
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
const KNOWLEDGE_COUNT_FORMATTER = new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 0 });

function formatCount(value: number | null | undefined): string {
  const numericValue = typeof value === "number" && Number.isFinite(value) ? value : 0;
  return KNOWLEDGE_COUNT_FORMATTER.format(numericValue);
}

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

function buildSourceRow(label: string, source: SourceEndpointStatusDto | undefined, fallbackRows: number | null) {
  const rowCount = typeof source?.rows === "number" ? source.rows : fallbackRows;
  return {
    label: source ? formatSourceStatusLineCompact(source) : label,
    state: source?.ok === false ? "异常" : "正常",
    ok: source?.ok !== false,
    detail: typeof rowCount === "number" ? `${formatCount(rowCount)} 行` : "行数未知"
  };
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
  const sourceSummaryText = actionState?.message
    || loadError
    || typeError
    || (loading ? zhCN.knowledgePage.loading : sourceSummary.text);
  const sourceReady = !loadError && !typeError && !sourceSummary.warn && !loading;
  const sourceStateLabel = sourceReady ? zhCN.knowledgePage.summaryStateReady : zhCN.knowledgePage.summaryStateFallback;
  const latestFetchText = formatDateTime(documents?.generatedAt || types?.generatedAt);
  const documentSource = documents?.sourceStatus?.sources?.[0];
  const typeSource = types?.sourceStatus?.sources?.[0];
  const summaryItems = [
    { title: zhCN.knowledgePage.summaryTotal, value: formatCount(total), unit: zhCN.common.unitItem, tone: total > 0 ? "good" : "neutral" },
    { title: zhCN.knowledgePage.summaryTypes, value: formatCount(typeOptions.length), unit: zhCN.common.unitItem, tone: typeOptions.length > 0 ? "neutral" : "warn" },
    { title: zhCN.knowledgePage.summaryPage, value: `${formatCount(page)} / ${formatCount(pageCount)}`, unit: "", tone: "neutral" },
    { title: zhCN.knowledgePage.summaryState, value: sourceStateLabel, unit: "", tone: sourceReady ? "good" : "warn" }
  ];
  const sourceRows = [
    buildSourceRow("说明书来源", documentSource, total),
    buildSourceRow("设备类型来源", typeSource, typeOptions.length),
    { label: "维护权限", state: runtimeConfig.readOnlyMode ? "只读" : "可用", ok: !runtimeConfig.readOnlyMode, detail: runtimeConfig.readOnlyMode ? "当前禁止写入" : "新增 / 编辑 / 删除 / 附件维护" }
  ];
  const maintenanceFields = [
    { label: zhCN.knowledgePage.formName, value: "必填" },
    { label: zhCN.knowledgePage.formType, value: `${formatCount(typeOptions.length)} 项可选` },
    { label: zhCN.knowledgePage.formDescription, value: "可选" },
    { label: zhCN.knowledgePage.formFile, value: "可沿用旧路径" }
  ];
  const operationItems = [
    { label: `${zhCN.knowledgePage.actionPreview} / ${zhCN.knowledgePage.actionDownload}`, value: "需要文件路径" },
    { label: zhCN.knowledgePage.actionEdit, value: runtimeConfig.readOnlyMode ? "只读禁用" : "可写入" },
    { label: zhCN.knowledgePage.actionDelete, value: runtimeConfig.readOnlyMode ? "只读禁用" : "需二次确认" },
    { label: "分页", value: `${formatCount(page)} / ${formatCount(pageCount)}` }
  ];

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
    <div className="knowledge-page knowledge-page--compact page-enter">
      <section className="knowledge-compact-head" aria-label={zhCN.knowledgePage.heading}>
        <div>
          <p className="knowledge-eyebrow">{`${runtimeConfig.appModeLabel} / 配置与知识 / ${zhCN.knowledgePage.heading}`}</p>
          <h2>{zhCN.knowledgePage.heading}</h2>
        </div>
        <div className="knowledge-compact-status">
          <span className={sourceReady ? "is-good" : "is-warn"}>{loading ? "加载中" : sourceReady ? "来源正常" : "来源异常"}</span>
          <span>{runtimeConfig.readOnlyMode ? "只读" : "可维护"}</span>
          <span>{`最近拉取 ${latestFetchText}`}</span>
        </div>
      </section>

      <section className="knowledge-compact-summary" aria-label="知识库摘要">
        {summaryItems.map((item) => (
          <article key={item.title} className="knowledge-compact-stat">
            <span>{item.title}</span>
            <strong className={item.tone === "good" ? "is-good" : item.tone === "warn" ? "is-warn" : undefined}>
              {item.value}
              {item.unit ? <em>{item.unit}</em> : null}
            </strong>
          </article>
        ))}
        <div className="knowledge-compact-toolbar">
          <div className="knowledge-compact-toolbar-meta">
            <span>{`${zhCN.knowledgePage.rowsPerPage} ${formatCount(pageSize)} ${zhCN.common.unitItem}`}</span>
            <span>来源：说明书列表 / 设备类型</span>
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
                    {formatCount(option)}
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
      </section>

      <section className="knowledge-compact-workspace" aria-label="知识库维护工作区">
        <article className="knowledge-compact-panel knowledge-compact-list-panel">
          <header>
            <h3>{zhCN.knowledgePage.sectionList}</h3>
            <span>名称 / 类型 / 描述 / 文件 / 操作</span>
          </header>
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
                {rows.length > 0 ? (
                  rows.map((item) => {
                    const documentId = String(item.id || "");
                    const canOpenFile = Boolean(buildLegacyFileUrl(item.filePath));
                    const isDeleting = deletingId === documentId;
                    return (
                      <tr key={documentId || `${item.name}-${item.typeName}`}>
                        <td>{item.name || "--"}</td>
                        <td>{item.typeName || "--"}</td>
                        <td>
                          <span title={item.description || "--"}>{item.description || "--"}</span>
                        </td>
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
                            <button
                              type="button"
                              title={zhCN.knowledgePage.actionPreview}
                              onClick={() => handlePreview(item)}
                              disabled={!canOpenFile || isDeleting}
                            >
                              {zhCN.knowledgePage.actionPreview}
                            </button>
                            <button
                              type="button"
                              title={zhCN.knowledgePage.actionDownload}
                              onClick={() => handleDownload(item)}
                              disabled={!canOpenFile || isDeleting}
                            >
                              {zhCN.knowledgePage.actionDownload}
                            </button>
                            <button
                              type="button"
                              title={zhCN.knowledgePage.actionEdit}
                              onClick={() => openEditDialog(item)}
                              disabled={isDeleting}
                            >
                              {zhCN.knowledgePage.actionEdit}
                            </button>
                            <button
                              type="button"
                              title={zhCN.knowledgePage.actionDelete}
                              onClick={() => handleDelete(item)}
                              disabled={isDeleting || submitting}
                            >
                              {isDeleting ? zhCN.knowledgePage.deleting : zhCN.knowledgePage.actionDelete}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr className="knowledge-empty-row">
                    <td colSpan={5}>
                      <div className="knowledge-empty">
                        <strong>{loading ? zhCN.knowledgePage.loading : zhCN.knowledgePage.empty}</strong>
                        <span>{loading ? "加载中" : sourceReady ? "来源正常，可直接新增说明书" : sourceSummaryText}</span>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="knowledge-empty-detail-grid">
            <article>
              <strong>维护字段</strong>
              {maintenanceFields.map((item) => (
                <span key={item.label}>
                  <em>{item.label}</em>
                  <b>{item.value}</b>
                </span>
              ))}
            </article>
            <article>
              <strong>列表操作</strong>
              {operationItems.map((item) => (
                <span key={item.label}>
                  <em>{item.label}</em>
                  <b>{item.value}</b>
                </span>
              ))}
            </article>
          </div>
          <div className="knowledge-pagination">
            <button
              type="button"
              className="knowledge-button"
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              disabled={page <= 1 || loading || submitting || deletingId !== null}
            >
              {zhCN.knowledgePage.prevPage}
            </button>
            <span>{`${zhCN.knowledgePage.pageInfo} ${formatCount(page)} / ${formatCount(pageCount)}`}</span>
            <button
              type="button"
              className="knowledge-button"
              onClick={() => setPage((current) => Math.min(pageCount, current + 1))}
              disabled={page >= pageCount || loading || submitting || deletingId !== null}
            >
              {zhCN.knowledgePage.nextPage}
            </button>
          </div>
        </article>

        <aside className="knowledge-compact-side">
          <article className="knowledge-compact-panel knowledge-type-panel">
            <header>
              <h3>{zhCN.knowledgePage.summaryTypes}</h3>
              <span>{`${formatCount(typeOptions.length)} ${zhCN.common.unitItem}`}</span>
            </header>
            <div className="knowledge-type-grid">
              {typeOptions.length > 0 ? (
                typeOptions.map((item) => <span key={item.id}>{item.label}</span>)
              ) : (
                <p className="knowledge-compact-empty">{typeError || "--"}</p>
              )}
            </div>
          </article>

          <article className="knowledge-compact-panel knowledge-source-panel">
            <header>
              <h3>数据口径</h3>
              <span>来源校验</span>
            </header>
            <div className="knowledge-source-list">
              {sourceRows.map((item) => (
                <article key={item.label}>
                  <span>{item.label}</span>
                  <strong className={item.ok ? "is-good" : "is-warn"}>{item.state}</strong>
                  <em>{item.detail}</em>
                </article>
              ))}
            </div>
          </article>

          <article className="knowledge-compact-panel knowledge-strategy-panel">
            <header>
              <h3>{zhCN.knowledgePage.sectionStrategy}</h3>
              <span>值班复盘</span>
            </header>
            <div className="knowledge-strategy-list">
              {strategyCards.map((item) => (
                <article key={item.title}>
                  <strong>{item.title}</strong>
                  <span>{item.action}</span>
                </article>
              ))}
            </div>
          </article>
        </aside>
      </section>

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
