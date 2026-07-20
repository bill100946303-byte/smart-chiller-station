import {
  ArrowLeft,
  CheckCircle2,
  Database,
  RefreshCw,
  Save,
  ShieldAlert,
  UploadCloud
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import StatCard from "../components/common/StatCard";
import StatusPill from "../components/common/StatusPill";
import { runtimeConfig } from "../config/runtimeConfig";
import {
  canAdminSessionWriteSite,
  clearAdminSession,
  getAdminSession
} from "../services/adminAuth";
import {
  AdminApiError,
  getAdminBackendHealth,
  getStationRuntimeBinding,
  listStationInstances,
  publishStationRuntimeBindingDraft,
  saveStationRuntimeBindingDraft,
  validateStationRuntimeBindingDraft,
  type AdminBackendHealth,
  type AdminStationInstance,
  type AdminStationRuntimeBinding,
  type AdminStationRuntimeBindingState,
  type AdminStationRuntimeBindingStatus
} from "../services/adminClient";
import "./StationRuntimeBindingPage.css";

type BindingForm = {
  databaseKey: string;
  projectKey: string;
  template: string;
  deviceIds: string;
  deviceCodes: string;
  pointCodes: string;
  notes: string;
};

const EMPTY_FORM: BindingForm = {
  databaseKey: "",
  projectKey: "",
  template: "",
  deviceIds: "",
  deviceCodes: "",
  pointCodes: "",
  notes: ""
};

const UNKNOWN_BACKEND_HEALTH: AdminBackendHealth = {
  reachable: false,
  ok: false,
  readOnlyMode: null,
  writeAllowed: false,
  checkedAt: "",
  source: "unavailable",
  reason: "正在核验服务端写入总闸。"
};

const STATUS_LABELS: Record<AdminStationRuntimeBindingStatus, string> = {
  draft: "绑定草稿",
  validated: "验证通过、尚未发布",
  published: "已发布、等待运行端观测",
  superseded: "已被新版本替代",
  disabled: "已停用"
};

const VALIDATION_ERROR_LABELS: Record<string, string> = {
  CATALOG_UNAVAILABLE: "真实设备目录不可用",
  CATALOG_EMPTY: "真实设备目录返回 0 行",
  PLACEHOLDER_OR_FALLBACK_FORBIDDEN: "检测到占位、模拟或回退数据",
  DEVICE_ALLOWLIST_EMPTY: "设备白名单为空",
  DEVICE_IDS_UNMATCHED: "存在未匹配的设备 ID",
  DEVICE_IDS_AMBIGUOUS: "真实设备目录中存在重复设备 ID，无法确定唯一设备",
  DEVICE_CODES_UNMATCHED: "存在未匹配的设备编码",
  DEVICE_ID_CODE_PAIRING_MISMATCH: "设备 ID 与设备编码未一一对应",
  POINT_SOURCE_UNAVAILABLE: "真实点位目录不可用",
  POINT_CODES_UNMATCHED: "存在未匹配的点位编码",
  POINT_CODES_AMBIGUOUS: "点位编码跨设备或记录存在歧义",
  POINT_CODES_AMBIGUOUS_ACROSS_DEVICES: "点位编码跨设备存在歧义"
};

function bindingTone(status?: string | null): "good" | "warn" | "danger" | "neutral" {
  if (status === "published" || status === "validated") {
    return "good";
  }
  if (status === "draft") {
    return "warn";
  }
  if (status === "disabled") {
    return "danger";
  }
  return "neutral";
}

function formatDateTime(value?: string | null): string {
  if (!value) {
    return "未记录";
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString("zh-CN", { hour12: false });
}

function formatHash(value?: string | null): string {
  if (!value) {
    return "--";
  }
  return value.length > 20 ? `${value.slice(0, 12)}…${value.slice(-8)}` : value;
}

function splitExactList(value: string): string[] {
  return Array.from(new Set(
    value
      .split(/[\n,]/)
      .map((item) => item.trim())
      .filter(Boolean)
  ));
}

function formFromBinding(binding: AdminStationRuntimeBinding | null): BindingForm {
  if (!binding) {
    return EMPTY_FORM;
  }
  return {
    databaseKey: binding.source.databaseKey || "",
    projectKey: binding.source.projectKey || "",
    template: binding.source.template || "",
    deviceIds: binding.selectors.deviceIds.join("\n"),
    deviceCodes: binding.selectors.deviceCodes.join("\n"),
    pointCodes: binding.selectors.pointCodes.join("\n"),
    notes: binding.notes || ""
  };
}

function validateForm(form: BindingForm): string[] {
  const issues: string[] = [];
  const stableKeyPattern = /^[A-Za-z0-9_-]+$/;
  const deviceIds = splitExactList(form.deviceIds);
  const deviceCodes = splitExactList(form.deviceCodes);
  const pointCodes = splitExactList(form.pointCodes);
  if (deviceIds.length === 0) {
    issues.push("必须至少填写一个真实设备 ID，运行端才能在访问上游前完成授权判断");
  }
  if (deviceCodes.length > 0 && deviceCodes.length !== deviceIds.length) {
    issues.push("填写设备编码时，数量必须与设备 ID 一致并一一对应");
  }
  if (form.databaseKey && !stableKeyPattern.test(form.databaseKey.trim())) {
    issues.push("databaseKey 仅允许字母、数字、下划线和短横线");
  }
  if (form.projectKey && !stableKeyPattern.test(form.projectKey.trim())) {
    issues.push("projectKey 仅允许字母、数字、下划线和短横线");
  }
  const wildcard = [...deviceIds, ...deviceCodes, ...pointCodes].find((item) => (
    /[*?]/.test(item) || /^(all|any)$/i.test(item)
  ));
  if (wildcard) {
    issues.push(`禁止通配或全量选择器：${wildcard}`);
  }
  return issues;
}

function describeError(error: unknown): string {
  if (!(error instanceof AdminApiError)) {
    return error instanceof Error ? error.message : "站房运行绑定请求失败";
  }
  if (error.status === 401) {
    return "登录已失效，请重新登录后再操作。";
  }
  if (error.code === "READ_ONLY_MODE") {
    return "服务端处于只读模式，本次没有写入配置库。";
  }
  if (error.status === 409) {
    return `版本或发布门禁冲突：${error.message}。页面将重新读取最新版本。`;
  }
  if (error.status === 403) {
    return `当前账号没有此操作权限：${error.message}`;
  }
  if (error.status === 422) {
    return "真实只读验证未通过；请查看下方验证证据。";
  }
  return `${error.message}（HTTP ${error.status}）`;
}

function BindingVersionCard({
  title,
  binding
}: {
  title: string;
  binding: AdminStationRuntimeBinding | null;
}) {
  return (
    <article className="station-binding-version-card">
      <div>
        <span>{title}</span>
        <StatusPill
          label={binding ? STATUS_LABELS[binding.status] : "无版本"}
          tone={bindingTone(binding?.status)}
        />
      </div>
      <strong>{binding ? `v${binding.bindingVersion}` : "--"}</strong>
      <small>payload {formatHash(binding?.payloadHash)}</small>
      <small>
        {binding?.status === "published"
          ? `发布 ${formatDateTime(binding.publishedAt)}`
          : `更新 ${formatDateTime(binding?.updatedAt)}`}
      </small>
    </article>
  );
}

export default function StationRuntimeBindingPage() {
  const navigate = useNavigate();
  const { siteId = "", stationId = "" } = useParams();
  const session = getAdminSession();
  const [station, setStation] = useState<AdminStationInstance | null>(null);
  const [bindingState, setBindingState] = useState<AdminStationRuntimeBindingState | null>(null);
  const [backendHealth, setBackendHealth] = useState<AdminBackendHealth>(UNKNOWN_BACKEND_HEALTH);
  const [form, setForm] = useState<BindingForm>(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [busyAction, setBusyAction] = useState<"save" | "validate" | "publish" | "">("");
  const [errorText, setErrorText] = useState("");
  const [notice, setNotice] = useState("");
  const [publishConfirmed, setPublishConfirmed] = useState(false);

  const roleCanWrite = canAdminSessionWriteSite(session, siteId);
  const canWrite = Boolean(
    roleCanWrite
    && backendHealth.writeAllowed
    && backendHealth.source === "server"
    && !runtimeConfig.readOnlyMode
    && station
  );
  const isPlatformAdmin = session?.roles?.platformRole === "platform_admin";
  const draft = bindingState?.draftBinding || null;
  const published = bindingState?.publishedBinding || null;
  const expectedSaveVersion = bindingState?.draftVersion ?? bindingState?.publishedVersion ?? 0;
  const validation = bindingState?.validation || draft?.validation || null;
  const editorIds = new Set([draft?.createdBy, draft?.updatedBy].filter(Boolean));
  const selfApprovalBlocked = Boolean(session?.userId && editorIds.has(session.userId));
  const canPublish = Boolean(
    canWrite
    && isPlatformAdmin
    && draft?.status === "validated"
    && draft.validation?.ok === true
    && draft.payloadHash
    && draft.payloadHash === draft.validatedHash
    && station?.status === "enabled"
    && station?.published
    && !selfApprovalBlocked
  );

  const writeGateText = useMemo(() => {
    if (!session?.roles) return "会话缺少明确角色证据。";
    if (!roleCanWrite) return "当前账号仅可查看此站点。";
    if (runtimeConfig.readOnlyMode) return "管理前端只读总闸已开启。";
    if (backendHealth.source === "mock") return "本地 MOCK 不能验证或发布真实运行绑定。";
    if (!backendHealth.writeAllowed) return backendHealth.reason;
    return "可保存草稿并发起真实只读验证；不会产生 BA/PLC 写入。";
  }, [backendHealth, roleCanWrite, session?.roles]);

  async function loadData(preserveForm = false) {
    if (!session || !siteId || !stationId) {
      return;
    }
    setLoading(true);
    setErrorText("");
    try {
      const [stations, nextBindingState, health] = await Promise.all([
        listStationInstances(session.token, session.userId, siteId),
        getStationRuntimeBinding(session.token, session.userId, siteId, stationId),
        getAdminBackendHealth()
      ]);
      const nextStation = stations.items.find((item) => item.stationId === stationId) || null;
      if (!nextStation) {
        throw new Error("当前站点不存在该物理站房，未加载运行绑定。 ");
      }
      setStation(nextStation);
      setBindingState(nextBindingState);
      setBackendHealth(health);
      if (!preserveForm) {
        setForm(formFromBinding(nextBindingState.draftBinding || nextBindingState.publishedBinding));
      }
      setPublishConfirmed(false);
    } catch (error) {
      setErrorText(describeError(error));
      setBackendHealth(await getAdminBackendHealth());
      if (error instanceof AdminApiError && error.status === 401) {
        clearAdminSession();
        navigate(`/login?redirect=${encodeURIComponent(`/sites/${siteId}/stations/${stationId}/runtime-binding`)}`, { replace: true });
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.token, siteId, stationId]);

  function patchForm(patch: Partial<BindingForm>) {
    setForm((current) => ({ ...current, ...patch }));
  }

  async function handleSave() {
    if (!session || !canWrite || busyAction) return;
    const issues = validateForm(form);
    if (issues.length > 0) {
      setErrorText(issues.join("；"));
      return;
    }
    setBusyAction("save");
    setErrorText("");
    setNotice("");
    try {
      const health = await getAdminBackendHealth();
      setBackendHealth(health);
      if (!health.writeAllowed || health.source !== "server") {
        throw new Error(health.reason);
      }
      const next = await saveStationRuntimeBindingDraft(
        session.token,
        session.userId,
        siteId,
        stationId,
        {
          expectedVersion: expectedSaveVersion,
          source: {
            databaseKey: form.databaseKey.trim() || null,
            projectKey: form.projectKey.trim() || null,
            template: form.template.trim() || null
          },
          selectors: {
            deviceIds: splitExactList(form.deviceIds),
            deviceCodes: splitExactList(form.deviceCodes),
            pointCodes: splitExactList(form.pointCodes)
          },
          notes: form.notes.trim() || null
        }
      );
      setBindingState(next);
      setForm(formFromBinding(next.draftBinding));
      setPublishConfirmed(false);
      setNotice(
        next.publishedBinding
          ? `草稿 v${next.draftVersion} 已保存；当前已发布 v${next.publishedVersion} 仍继续服务。`
          : `绑定草稿 v${next.draftVersion} 已保存，尚未验证或发布。`
      );
    } catch (error) {
      setErrorText(describeError(error));
      if (error instanceof AdminApiError && error.status === 409) {
        await loadData(true);
      }
    } finally {
      setBusyAction("");
    }
  }

  async function handleValidate() {
    if (!session || !canWrite || !draft || busyAction) return;
    setBusyAction("validate");
    setErrorText("");
    setNotice("");
    try {
      const next = await validateStationRuntimeBindingDraft(
        session.token,
        session.userId,
        siteId,
        stationId,
        draft.bindingVersion
      );
      setBindingState(next);
      const result = next.validation || next.draftBinding?.validation;
      setNotice(result?.ok
        ? `真实只读验证通过：设备 ${result.matched?.deviceCount ?? 0} 台，点位 ${result.matched?.pointCount ?? 0} 项。`
        : "真实只读验证未通过；没有发布，也没有切换当前运行版本。"
      );
    } catch (error) {
      setErrorText(describeError(error));
      if (error instanceof AdminApiError && error.status === 409) {
        await loadData(true);
      }
    } finally {
      setBusyAction("");
    }
  }

  async function handlePublish() {
    if (!session || !draft || !canPublish || !publishConfirmed || busyAction) return;
    setBusyAction("publish");
    setErrorText("");
    setNotice("");
    try {
      const next = await publishStationRuntimeBindingDraft(
        session.token,
        session.userId,
        siteId,
        stationId,
        draft.bindingVersion
      );
      setBindingState(next);
      setForm(formFromBinding(next.publishedBinding));
      setPublishConfirmed(false);
      setNotice(`运行绑定 v${next.publishedVersion} 已发布；仍需等待运行接口返回站房筛选证据，不能据此宣称实时。`);
    } catch (error) {
      setErrorText(describeError(error));
      if (error instanceof AdminApiError && error.status === 409) {
        await loadData(true);
      }
    } finally {
      setBusyAction("");
    }
  }

  const validationErrors = validation?.errors || [];
  const unmatchedCount = [
    ...(validation?.unmatched?.deviceIds || []),
    ...(validation?.unmatched?.deviceCodes || []),
    ...(validation?.unmatched?.pointCodes || []),
    ...(validation?.ambiguous?.deviceIds || []),
    ...(validation?.ambiguous?.pointCodes || [])
  ].length;

  return (
    <div className="admin-page-stack station-binding-page" data-station-runtime-binding-page>
      <section className="admin-panel station-binding-hero">
        <div className="admin-section-header">
          <div className="admin-hero-panel">
            <p className="admin-eyebrow">Physical station runtime binding</p>
            <h2>{station?.stationName || stationId || "未选择站房"}</h2>
            <p>把稳定站房身份绑定到真实数据源、设备白名单与点位白名单；全流程保持只读数据访问。</p>
            <div className="admin-chip-row station-binding-chips">
              <StatusPill label={`siteId ${siteId || "N/A"}`} tone="neutral" />
              <StatusPill label={`stationId ${stationId || "N/A"}`} tone="neutral" />
              <StatusPill label="不写 PLC" tone="good" />
            </div>
          </div>
          <div className="admin-actions station-binding-actions">
            <button className="admin-button" type="button" onClick={() => navigate(`/sites/${encodeURIComponent(siteId)}/stations`)}>
              <ArrowLeft size={14} />返回站房清单
            </button>
            <button className="admin-button" type="button" onClick={() => void loadData()} disabled={loading || Boolean(busyAction)}>
              <RefreshCw size={14} />重新读取
            </button>
          </div>
        </div>
      </section>

      <div className="admin-summary-grid">
        <StatCard title="身份登记" value={station?.published ? "已发布" : station ? "未发布" : "--"} delta={station?.status || "待读取"} tone={station?.published ? "good" : "warn"} />
        <StatCard title="绑定草稿" value={draft ? `v${draft.bindingVersion}` : "无"} delta={draft ? STATUS_LABELS[draft.status] : "未保存"} tone={bindingTone(draft?.status)} />
        <StatCard title="当前发布" value={published ? `v${published.bindingVersion}` : "无"} delta={published ? "运行端可申请使用" : "尚未发布"} tone={published ? "good" : "neutral"} />
        <StatCard title="运行端观测" value="待响应" delta="发布不等于运行已验证" tone="warn" />
      </div>

      <section className={`station-binding-gate ${canWrite ? "is-open" : "is-closed"}`} data-binding-write-state={canWrite ? "allowed" : "blocked"}>
        <ShieldAlert size={18} />
        <div>
          <strong>{canWrite ? "运行绑定草稿可写" : "运行绑定保持只读"}</strong>
          <span>{writeGateText}</span>
          <small>安全边界：只允许读取真实设备/点位目录进行校验；不允许密码、任意 URL、通配规则或控制点写入。</small>
        </div>
      </section>

      {errorText ? <p className="admin-error" role="alert">{errorText}</p> : null}
      {notice ? <p className="admin-success" role="status">{notice}</p> : null}

      <section className="section-card" data-binding-version-separation>
        <div className="section-card-header">
          <div>
            <h3>版本状态</h3>
            <p className="admin-note">草稿与当前发布版本独立保存；保存新草稿不会让已发布版本下线。</p>
          </div>
          <StatusPill label={loading ? "读取中" : "版本已核对"} tone={loading ? "warn" : "good"} />
        </div>
        <div className="section-card-body station-binding-version-grid">
          <BindingVersionCard title="编辑中的草稿" binding={draft} />
          <BindingVersionCard title="当前已发布" binding={published} />
        </div>
      </section>

      <section className="section-card" data-binding-draft-editor>
        <div className="section-card-header">
          <div>
            <h3>1. 数据源与设备边界</h3>
            <p className="admin-note">这里只填写服务端登记过的稳定键和精确白名单，不录入密码或任意地址。</p>
          </div>
          <StatusPill label={`expectedVersion ${expectedSaveVersion}`} tone="neutral" />
        </div>
        <div className="section-card-body">
          <fieldset className="station-binding-fieldset" disabled={!canWrite || Boolean(busyAction) || loading}>
            <div className="station-binding-source-grid">
              <label className="admin-field">
                <span>databaseKey</span>
                <input value={form.databaseKey} onChange={(event) => patchForm({ databaseKey: event.target.value })} placeholder="稳定数据源键，可留空继承站点配置" autoComplete="off" />
              </label>
              <label className="admin-field">
                <span>projectKey</span>
                <input value={form.projectKey} onChange={(event) => patchForm({ projectKey: event.target.value })} placeholder="稳定项目键，可留空继承站点配置" autoComplete="off" />
              </label>
              <label className="admin-field">
                <span>template</span>
                <input value={form.template} onChange={(event) => patchForm({ template: event.target.value })} placeholder="只读适配模板，可选" autoComplete="off" />
              </label>
            </div>
            <div className="station-binding-selector-grid">
              <label className="admin-field">
                <span>设备 ID 白名单（必填）</span>
                <textarea value={form.deviceIds} onChange={(event) => patchForm({ deviceIds: event.target.value })} placeholder={"每行一个真实 deviceId\n禁止 * / all / any"} />
                <small>运行端在访问设备详情上游前先校验此白名单。</small>
              </label>
              <label className="admin-field">
                <span>设备编码白名单</span>
                <textarea value={form.deviceCodes} onChange={(event) => patchForm({ deviceCodes: event.target.value })} placeholder="每行一个真实 deviceCode，与设备 ID 一一对应" />
                <small>填写后数量必须与设备 ID 一致，验证时核对配对关系。</small>
              </label>
              <label className="admin-field">
                <span>点位编码白名单</span>
                <textarea value={form.pointCodes} onChange={(event) => patchForm({ pointCodes: event.target.value })} placeholder="每行一个真实 pointCode，可选" />
                <small>只允许读点；跨设备歧义或未匹配点位会阻断验证。</small>
              </label>
            </div>
            <label className="admin-field station-binding-notes">
              <span>变更说明</span>
              <textarea value={form.notes} onChange={(event) => patchForm({ notes: event.target.value })} placeholder="说明站房边界、设备归属和本次变更原因；不要填写凭据或控制命令。" />
            </label>
          </fieldset>
          <div className="station-binding-editor-footer">
            <span className="admin-note">保存后状态回到“绑定草稿”，旧验证哈希不能复用。</span>
            <button className="admin-button is-primary" type="button" onClick={() => void handleSave()} disabled={!canWrite || Boolean(busyAction) || loading}>
              <Save size={14} />{busyAction === "save" ? "正在保存" : "保存新草稿"}
            </button>
          </div>
        </div>
      </section>

      <section className="section-card" data-binding-validation-evidence>
        <div className="section-card-header">
          <div>
            <h3>2. 真实只读验证证据</h3>
            <p className="admin-note">验证会读取真实设备目录和点位目录；200 但 0 行、placeholder、fallback 或 ID/编码错配都视为失败。</p>
          </div>
          <StatusPill
            label={validation ? (validation.ok ? "验证通过" : "验证失败") : "尚未验证"}
            tone={validation ? (validation.ok ? "good" : "danger") : "neutral"}
          />
        </div>
        <div className="section-card-body">
          <div className="station-binding-evidence-grid">
            <div><span>验证时间</span><strong>{formatDateTime(validation?.checkedAt)}</strong></div>
            <div><span>匹配设备</span><strong>{validation ? validation.matched?.deviceCount ?? 0 : "--"}</strong></div>
            <div><span>匹配点位</span><strong>{validation ? validation.matched?.pointCount ?? 0 : "--"}</strong></div>
            <div><span>未匹配/歧义</span><strong>{validation ? unmatchedCount : "--"}</strong></div>
            <div><span>选择器模式</span><strong>{validation?.selectorMode || "--"}</strong></div>
            <div><span>目录哈希</span><strong title={validation?.catalogHash || ""}>{formatHash(validation?.catalogHash)}</strong></div>
          </div>
          {validationErrors.length > 0 ? (
            <div className="station-binding-validation-errors" role="alert">
              <strong>阻断项</strong>
              <ul>
                {validationErrors.map((item) => <li key={item}>{VALIDATION_ERROR_LABELS[item] || item}</li>)}
              </ul>
            </div>
          ) : null}
          <div className="station-binding-validation-action">
            <span className="admin-note">验证只针对当前草稿 v{draft?.bindingVersion || "--"}；任何字段变化都必须重新验证。</span>
            <button className="admin-button" type="button" onClick={() => void handleValidate()} disabled={!canWrite || !draft || Boolean(busyAction) || loading}>
              <Database size={14} />{busyAction === "validate" ? "正在读取真实源" : "执行真实只读验证"}
            </button>
          </div>
        </div>
      </section>

      <section className="section-card" data-binding-publish-gate>
        <div className="section-card-header">
          <div>
            <h3>3. 审批与发布</h3>
            <p className="admin-note">仅平台管理员可发布；当前草稿编辑者不能自批，设备不得与其他已发布站房重叠。</p>
          </div>
          <StatusPill label={canPublish ? "发布门禁通过" : "发布门禁阻断"} tone={canPublish ? "good" : "warn"} />
        </div>
        <div className="section-card-body station-binding-publish-body">
          <div className="station-binding-publish-checks">
            <span className={station?.status === "enabled" ? "is-pass" : ""}><CheckCircle2 size={14} />站房身份已启用</span>
            <span className={station?.published ? "is-pass" : ""}><CheckCircle2 size={14} />站房身份已发布</span>
            <span className={draft?.status === "validated" && draft.validation?.ok ? "is-pass" : ""}><CheckCircle2 size={14} />当前草稿真实验证通过</span>
            <span className={isPlatformAdmin ? "is-pass" : ""}><CheckCircle2 size={14} />当前账号为平台管理员</span>
            <span className={!selfApprovalBlocked ? "is-pass" : ""}><CheckCircle2 size={14} />发布人与草稿编辑者分离</span>
          </div>
          <label className="station-binding-publish-confirm">
            <input type="checkbox" checked={publishConfirmed} onChange={(event) => setPublishConfirmed(event.target.checked)} disabled={!canPublish || Boolean(busyAction)} />
            <span>
              <strong>我确认发布当前验证哈希对应的绑定版本</strong>
              <small>发布后运行端只会在受支持接口上申请使用；仍需接口响应证明 stationId 与 bindingVersion 实际生效。</small>
            </span>
          </label>
          <div className="station-binding-publish-footer">
            <span className="admin-note">当前发布：v{published?.bindingVersion || "--"}；候选草稿：v{draft?.bindingVersion || "--"}</span>
            <button className="admin-button is-primary" type="button" onClick={() => void handlePublish()} disabled={!canPublish || !publishConfirmed || Boolean(busyAction)}>
              <UploadCloud size={14} />{busyAction === "publish" ? "正在原子切换" : "发布验证版本"}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
