import { Plus, RefreshCw, Settings2, Table2, Users } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { useNavigate } from "react-router-dom";
import SectionCard from "../components/common/SectionCard";
import SourceStatusBanner from "../components/common/SourceStatusBanner";
import StatCard from "../components/common/StatCard";
import StatusPill from "../components/common/StatusPill";
import { getAdminSession } from "../services/adminAuth";
import {
  createAdminSite,
  listAdminSites,
  type AdminSiteStatus,
  type AdminSiteSummary
} from "../services/adminClient";

type CreateFormState = {
  siteId: string;
  siteName: string;
  siteCode: string;
  city: string;
  ownerName: string;
  remark: string;
  status: AdminSiteStatus;
};

const initialFormState: CreateFormState = {
  siteId: "",
  siteName: "",
  siteCode: "",
  city: "",
  ownerName: "",
  remark: "",
  status: "active"
};

function statusTone(value?: string): "good" | "warn" | "danger" | "neutral" {
  if (value === "active" || value === "ok") {
    return "good";
  }
  if (value === "pending" || value === "partial") {
    return "warn";
  }
  if (value === "disabled" || value === "failed" || value === "error") {
    return "danger";
  }
  return "neutral";
}

function formatSummary(site: AdminSiteSummary): string {
  const parts = [site.city, site.ownerName, site.remark].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : "暂无补充信息";
}

export default function SiteListPage() {
  const navigate = useNavigate();
  const session = getAdminSession();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [sites, setSites] = useState<AdminSiteSummary[]>([]);
  const [errorText, setErrorText] = useState("");
  const [keyword, setKeyword] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [formState, setFormState] = useState<CreateFormState>(initialFormState);
  const createModalRef = useRef<HTMLDivElement | null>(null);
  const createSiteIdInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!showCreateModal) {
      return;
    }

    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    window.requestAnimationFrame(() => createSiteIdInputRef.current?.focus());
    return () => {
      previousFocus?.focus();
    };
  }, [showCreateModal]);

  function handleCreateModalKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      setShowCreateModal(false);
      return;
    }
    if (event.key !== "Tab") {
      return;
    }

    const focusable = Array.from(
      createModalRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'
      ) || []
    ).filter((element) => !element.hasAttribute("hidden"));
    if (focusable.length === 0) {
      return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  async function loadSites() {
    if (!session) {
      return;
    }
    setLoading(true);
    setErrorText("");
    try {
      const items = await listAdminSites(session.token, session.userId, {
        keyword: keyword.trim() || undefined,
        status: statusFilter === "all" ? undefined : statusFilter
      });
      setSites(items);
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : "站点列表加载失败");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadSites();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.token, statusFilter]);

  const summary = useMemo(() => {
    const active = sites.filter((site) => site.status === "active").length;
    const pending = sites.filter((site) => site.status === "paused" || site.status === "pending").length;
    const withWarnings = sites.filter((site) => site.sourceStatus !== "ok" || site.runtimeStatus !== "ok").length;
    const members = sites.reduce((total, site) => total + (site.memberCount || 0), 0);
    return { active, pending, withWarnings, members };
  }, [sites]);

  async function handleCreateSite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session || submitting) {
      return;
    }
    setSubmitting(true);
    setErrorText("");
    try {
      const created = await createAdminSite(session.token, session.userId, {
        ...formState,
        siteId: formState.siteId.trim(),
        siteName: formState.siteName.trim(),
        siteCode: formState.siteCode.trim(),
        city: formState.city.trim(),
        ownerName: formState.ownerName.trim(),
        remark: formState.remark.trim(),
        status: formState.status
      });
      setShowCreateModal(false);
      setFormState(initialFormState);
      navigate(`/sites/${encodeURIComponent(created.siteId)}`);
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : "创建站点失败");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="admin-page-stack">
      <section className="admin-panel">
        <div className="admin-hero-grid">
          <div className="admin-hero-panel">
            <p className="admin-eyebrow">站点总览</p>
            <h2>统一管理多个 Site</h2>
            <p>
              这里展示平台当前可见的全部站点。登录后会自动导入缺失站点，站点信息可以在这里继续完善和维护。
            </p>
            <div className="admin-actions" style={{ marginTop: 16 }}>
              <button className="admin-button is-primary" type="button" onClick={() => setShowCreateModal(true)}>
                <Plus size={14} />
                新建站点
              </button>
              <button className="admin-button" type="button" onClick={() => void loadSites()}>
                <RefreshCw size={14} />
                刷新列表
              </button>
            </div>
          </div>

          <div className="admin-hero-kpis">
            <article className="admin-kpi">
              <span>总站点数</span>
              <strong>{sites.length}</strong>
            </article>
            <article className="admin-kpi">
              <span>运行中</span>
              <strong>{summary.active}</strong>
            </article>
            <article className="admin-kpi">
              <span>待完善</span>
              <strong>{summary.pending}</strong>
            </article>
          </div>
        </div>
      </section>

      <div className="admin-summary-grid">
        <StatCard title="站点总数" value={String(sites.length)} delta="siteId 维度" tone="neutral" />
        <StatCard title="正常站点" value={String(summary.active)} delta="active" tone="good" />
        <StatCard title="配置异常" value={String(summary.withWarnings)} delta="source/runtime" tone="warn" />
        <StatCard title="成员总数" value={String(summary.members)} delta="绑定关系" tone="neutral" />
      </div>

      <SectionCard
        title="站点列表"
        action={
          <div className="admin-actions">
            <label className="admin-toolbar-field">
              <span>关键词</span>
              <input
                value={keyword}
                onChange={(event) => setKeyword(event.target.value)}
                placeholder="站点名称 / 站点 ID"
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void loadSites();
                  }
                }}
              />
            </label>
            <label className="admin-toolbar-field">
              <span>状态</span>
              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                <option value="all">全部</option>
                <option value="active">active</option>
                <option value="paused">paused</option>
                <option value="disabled">disabled</option>
              </select>
            </label>
            <button className="admin-button" type="button" onClick={() => void loadSites()}>
              <RefreshCw size={14} />
              查询
            </button>
          </div>
        }
      >
        {errorText ? <p className="admin-error">{errorText}</p> : null}

        {loading ? (
          <div className="admin-loading-grid">
            <div className="admin-skeleton" />
            <div className="admin-skeleton" />
            <div className="admin-skeleton" />
            <div className="admin-skeleton" />
          </div>
        ) : sites.length > 0 ? (
          <div className="admin-table-shell" role="region" aria-label="站点列表，可横向滚动查看更多字段" tabIndex={0}>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>站点</th>
                  <th>状态</th>
                  <th>配置</th>
                  <th>成员</th>
                  <th>最近更新</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {sites.map((site) => (
                  <tr key={site.siteId}>
                    <td>
                      <strong>{site.siteName}</strong>
                      <div className="admin-table-cell-muted">{site.siteId}</div>
                      <div className="admin-table-cell-muted">{formatSummary(site)}</div>
                    </td>
                    <td>
                      <div className="admin-chip-row">
                        <StatusPill label={site.status || "active"} tone={statusTone(site.status)} />
                        <StatusPill label={site.city || "未知城市"} tone="neutral" />
                      </div>
                    </td>
                    <td>
                      <div className="admin-chip-row">
                        <StatusPill
                          label={`接入 ${site.sourceStatus || "unknown"}`}
                          tone={statusTone(site.sourceStatus)}
                        />
                        <StatusPill
                          label={`运行 ${site.runtimeStatus || "unknown"}`}
                          tone={statusTone(site.runtimeStatus)}
                        />
                      </div>
                    </td>
                    <td>
                      <div className="admin-chip-row">
                        <StatusPill label={`${site.memberCount || 0} 人`} tone="neutral" />
                        <StatusPill label={site.ownerName || "未设置负责人"} tone="neutral" />
                      </div>
                    </td>
                    <td>
                      <div className="admin-table-cell-muted">
                        {site.updatedAt || site.sourceUpdatedAt || site.runtimeUpdatedAt || "暂无"}
                      </div>
                    </td>
                    <td>
                      <div className="admin-table-actions">
                        <button className="admin-inline-action" type="button" onClick={() => navigate(`/sites/${encodeURIComponent(site.siteId)}`)}>
                          <Table2 size={14} /> 详情
                        </button>
                        <button className="admin-inline-action" type="button" onClick={() => navigate(`/sites/${encodeURIComponent(site.siteId)}/source-config`)}>
                          <Settings2 size={14} /> 接入
                        </button>
                        <button className="admin-inline-action" type="button" onClick={() => navigate(`/sites/${encodeURIComponent(site.siteId)}/members`)}>
                          <Users size={14} /> 成员
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="admin-empty-state">
            <p>暂无站点数据。</p>
            <p>如果后端还没接上，打开 `VITE_ADMIN_USE_MOCKS=true` 也可以直接使用本地 mock 数据。</p>
          </div>
        )}
      </SectionCard>

      <SourceStatusBanner
        summary={`当前已加载 ${sites.length} 个站点，${summary.withWarnings} 个站点存在配置差异。`}
        warn={summary.withWarnings > 0}
        detailLines={[
          `active: ${summary.active}`,
          `paused: ${summary.pending}`,
          `members: ${summary.members}`
        ]}
      />

      {showCreateModal ? (
        <div className="admin-modal-backdrop" onClick={() => setShowCreateModal(false)} role="presentation">
          <div
            ref={createModalRef}
            className="admin-modal"
            onClick={(event) => event.stopPropagation()}
            onKeyDown={handleCreateModalKeyDown}
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-site-dialog-title"
          >
            <header className="admin-modal-header">
              <div>
                <p className="admin-eyebrow">创建站点</p>
                <h3 id="create-site-dialog-title">登记一个已有 siteId</h3>
              </div>
              <button
                className="admin-modal-close"
                type="button"
                aria-label="关闭新建站点对话框"
                onClick={() => setShowCreateModal(false)}
              >
                ×
              </button>
            </header>

            <form className="admin-form" onSubmit={handleCreateSite}>
              <div className="admin-form-grid">
                <label className="admin-field">
                  <span>siteId</span>
                  <input
                    ref={createSiteIdInputRef}
                    value={formState.siteId}
                    onChange={(event) => setFormState((current) => ({ ...current, siteId: event.target.value }))}
                    required
                  />
                </label>
                <label className="admin-field">
                  <span>站点名称</span>
                  <input
                    value={formState.siteName}
                    onChange={(event) => setFormState((current) => ({ ...current, siteName: event.target.value }))}
                    required
                  />
                </label>
                <label className="admin-field">
                  <span>站点编码</span>
                  <input
                    value={formState.siteCode}
                    onChange={(event) => setFormState((current) => ({ ...current, siteCode: event.target.value }))}
                  />
                </label>
                <label className="admin-field">
                  <span>城市</span>
                  <input
                    value={formState.city}
                    onChange={(event) => setFormState((current) => ({ ...current, city: event.target.value }))}
                  />
                </label>
                <label className="admin-field">
                  <span>负责人</span>
                  <input
                    value={formState.ownerName}
                    onChange={(event) => setFormState((current) => ({ ...current, ownerName: event.target.value }))}
                  />
                </label>
                <label className="admin-field">
                  <span>状态</span>
                  <select
                    value={formState.status}
                    onChange={(event) =>
                      setFormState((current) => ({ ...current, status: event.target.value as AdminSiteStatus }))
                    }
                  >
                    <option value="active">active</option>
                    <option value="paused">paused</option>
                    <option value="disabled">disabled</option>
                  </select>
                </label>
                <label className="admin-field is-full">
                  <span>备注</span>
                  <textarea
                    value={formState.remark}
                    onChange={(event) => setFormState((current) => ({ ...current, remark: event.target.value }))}
                  />
                </label>
              </div>

              <div className="admin-form-actions">
                <button className="admin-button" type="button" onClick={() => setShowCreateModal(false)}>
                  取消
                </button>
                <button className="admin-button is-primary" type="submit" disabled={submitting}>
                  {submitting ? "保存中..." : "创建站点"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
