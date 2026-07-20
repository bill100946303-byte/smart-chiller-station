import {
  ArrowLeft,
  Factory,
  Plus,
  RefreshCw,
  Save,
  ShieldAlert
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
  listSiteSubsystems,
  listStationInstances,
  listStationParentSubsystems,
  updateStationInstances,
  type AdminBackendHealth,
  type AdminSiteSubsystemCapability,
  type AdminStationInstance,
  type AdminStationInstanceList,
  type AdminSubsystemRegistryItem,
  type AdminSubsystemStatus
} from "../services/adminClient";
import "./StationRegistryPage.css";

const STATUS_LABELS: Record<AdminSubsystemStatus, string> = {
  enabled: "已启用",
  not_configured: "未配置",
  not_applicable: "不适用"
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

function formatDateTime(value?: string | null): string {
  if (!value) {
    return "未记录";
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleString("zh-CN", { hour12: false });
}

function statusTone(value: string): "good" | "warn" | "danger" | "neutral" {
  if (value === "enabled" || value === "ok" || value === "fresh") {
    return "good";
  }
  if (value === "not_configured" || value === "partial" || value === "stale" || value === "waiting_points") {
    return "warn";
  }
  if (value === "failed") {
    return "danger";
  }
  return "neutral";
}

function formatBindingState(item: AdminStationInstance): string {
  const publishedVersion = item.publishedBindingVersion;
  const draftVersion = item.draftBindingVersion;
  if (publishedVersion && draftVersion) {
    return `运行 v${publishedVersion} · 草稿 v${draftVersion}`;
  }
  if (publishedVersion) {
    return `已发布 v${publishedVersion}`;
  }
  if (draftVersion) {
    return `${item.bindingState === "validated" ? "已验证" : "草稿"} v${draftVersion}`;
  }
  return "未配置";
}

function createBlankStation(siteId: string, sortOrder: number): AdminStationInstance {
  return {
    siteId,
    stationId: "",
    stationName: "",
    parentSubsystemType: "",
    status: "not_configured",
    enabled: false,
    sourceStatus: "not_configured",
    freshnessStatus: "not_configured",
    alarmCount: null,
    bindingState: "unconfigured",
    bindingVersion: null,
    draftBindingVersion: null,
    publishedBindingVersion: null,
    sortOrder,
    published: false,
    notes: ""
  };
}

function cloneStation(item: AdminStationInstance): AdminStationInstance {
  return { ...item };
}

function describeAdminError(error: unknown): string {
  if (!(error instanceof AdminApiError)) {
    return error instanceof Error ? error.message : "物理站房登记请求失败";
  }
  if (error.status === 401) {
    return "登录已失效，请重新登录后再操作。";
  }
  if (error.code === "READ_ONLY_MODE") {
    return "服务端处于只读模式，本次未写入任何站房登记。";
  }
  if (error.code === "ADMIN_FORBIDDEN" || error.status === 403) {
    return "当前账号没有此站点的管理员写权限，本次未写入。";
  }
  if (error.status === 409) {
    return `stationId 或同类型站房名称冲突：${error.message}`;
  }
  if (error.status === 400) {
    return `登记字段不符合服务端合同：${error.message}`;
  }
  return `${error.message}（HTTP ${error.status}，本地表单已保留）`;
}

function validateStation(
  draft: AdminStationInstance,
  existingItems: AdminStationInstance[],
  parentRegistry: AdminSubsystemRegistryItem[],
  persistedStationId: string | null
): string[] {
  const issues: string[] = [];
  const stationId = draft.stationId.trim();
  const stationName = draft.stationName.trim();
  const parentSubsystemType = draft.parentSubsystemType.trim();
  if (!stationId) {
    issues.push("stationId 不能为空");
  } else if (!persistedStationId && !/^[A-Za-z0-9](?:[A-Za-z0-9._-]{0,62}[A-Za-z0-9])?$/.test(stationId)) {
    issues.push("新 stationId 需为 1–64 位字母、数字、点、下划线或短横线，且首尾必须为字母或数字");
  }
  if (!stationName) {
    issues.push("站房名称不能为空");
  }
  if (!parentSubsystemType) {
    issues.push("必须选择所属供能站房类型");
  } else if (!parentRegistry.some((item) => item.subsystemType === parentSubsystemType)) {
    issues.push("所属类型不是可登记的物理供能站房类型");
  }
  if (!Number.isInteger(draft.sortOrder) || draft.sortOrder < 0) {
    issues.push("排序必须为不小于 0 的整数");
  }
  const duplicateId = existingItems.some((item) => (
    item.stationId === stationId && item.stationId !== persistedStationId
  ));
  if (duplicateId) {
    issues.push("stationId 已存在；已保存标识不可复用或改名");
  }
  const duplicateName = existingItems.some((item) => (
    item.stationId !== persistedStationId &&
    item.parentSubsystemType === parentSubsystemType &&
    item.stationName.trim().toLocaleLowerCase("zh-CN") === stationName.toLocaleLowerCase("zh-CN")
  ));
  if (duplicateName) {
    issues.push("同一能源对象类型下已存在同名站房");
  }
  return issues;
}

export default function StationRegistryPage() {
  const navigate = useNavigate();
  const { siteId = "" } = useParams();
  const session = getAdminSession();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [errorText, setErrorText] = useState("");
  const [notice, setNotice] = useState("");
  const [parentRegistry, setParentRegistry] = useState<AdminSubsystemRegistryItem[]>([]);
  const [parentCapabilities, setParentCapabilities] = useState<AdminSiteSubsystemCapability[]>([]);
  const [stationList, setStationList] = useState<AdminStationInstanceList>({
    siteId,
    generatedAt: "",
    items: [],
    total: 0
  });
  const [backendHealth, setBackendHealth] = useState<AdminBackendHealth>(UNKNOWN_BACKEND_HEALTH);
  const [draft, setDraft] = useState<AdminStationInstance | null>(null);
  const [persistedStationId, setPersistedStationId] = useState<string | null>(null);
  const [publishConfirmArmed, setPublishConfirmArmed] = useState(false);

  const siteName = session?.visibleSites.find((site) => site.siteId === siteId)?.siteName || siteId;
  const roleWriteAllowed = canAdminSessionWriteSite(session, siteId);
  const canWrite = Boolean(
    roleWriteAllowed &&
    backendHealth.writeAllowed &&
    runtimeConfig.readOnlyMode !== true &&
    dataLoaded
  );
  const persistedRecord = persistedStationId
    ? stationList.items.find((item) => item.stationId === persistedStationId) || null
    : null;
  const persistedRecordLocked = persistedRecord?.published === true;
  const canEditDraft = canWrite && !persistedRecordLocked;

  const writeBlockReason = useMemo(() => {
    if (!session?.roles) {
      return "当前会话缺少 /admin/v1/me 的站点角色证据，请重新登录。";
    }
    if (!roleWriteAllowed) {
      return "当前账号不是此站点的站点管理员，且没有平台管理员权限。";
    }
    if (runtimeConfig.readOnlyMode) {
      return "管理前端已开启只读保护。";
    }
    if (backendHealth.source === "mock") {
      return `${backendHealth.reason} 本地 MOCK 不写真实配置库。`;
    }
    if (!backendHealth.writeAllowed) {
      return backendHealth.reason;
    }
    if (!dataLoaded) {
      return "真实站房清单尚未加载完成。";
    }
    return "服务端与当前站点角色均已核验，可登记物理站房。";
  }, [backendHealth, dataLoaded, roleWriteAllowed, session?.roles]);

  const summary = useMemo(() => {
    const enabled = stationList.items.filter((item) => item.status === "enabled").length;
    const published = stationList.items.filter((item) => item.published).length;
    const runtimeBound = stationList.items.filter((item) => item.publishedBindingVersion != null).length;
    return { enabled, published, runtimeBound };
  }, [stationList.items]);
  const parentCapabilityByType = new Map(parentCapabilities.map((item) => [item.subsystemType, item]));
  const enabledParentTypeCount = parentCapabilities.filter((item) => item.status === "enabled").length;
  const pendingParentTypeCount = parentCapabilities.filter((item) => item.status !== "enabled").length;

  async function loadData(preferredStationId?: string) {
    if (!session || !siteId) {
      return;
    }
    setLoading(true);
    setDataLoaded(false);
    setErrorText("");
    setNotice("");
    const healthPromise = getAdminBackendHealth();
    try {
      const [registryItems, siteSubsystems, stations, health] = await Promise.all([
        listStationParentSubsystems(session.token, session.userId),
        listSiteSubsystems(session.token, session.userId, siteId),
        listStationInstances(session.token, session.userId, siteId),
        healthPromise
      ]);
      const parentTypeSet = new Set(registryItems.map((item) => item.subsystemType));
      setParentRegistry(registryItems);
      setParentCapabilities(siteSubsystems.filter((item) => parentTypeSet.has(item.subsystemType)));
      setStationList(stations);
      setBackendHealth(health);
      setDataLoaded(true);
      const nextStation = stations.items.find((item) => item.stationId === preferredStationId)
        || stations.items[0]
        || null;
      setDraft(nextStation ? cloneStation(nextStation) : null);
      setPersistedStationId(nextStation?.stationId || null);
      setPublishConfirmArmed(false);
    } catch (error) {
      setBackendHealth(await healthPromise);
      setErrorText(describeAdminError(error));
      if (error instanceof AdminApiError && error.status === 401) {
        clearAdminSession();
        navigate(`/login?redirect=${encodeURIComponent(`/sites/${siteId}/stations`)}`, { replace: true });
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.token, siteId]);

  function selectStation(item: AdminStationInstance) {
    setDraft(cloneStation(item));
    setPersistedStationId(item.stationId);
    setPublishConfirmArmed(false);
    setErrorText("");
    setNotice("");
  }

  function startNewStation() {
    if (!canWrite) {
      return;
    }
    const nextSortOrder = stationList.items.reduce((max, item) => Math.max(max, item.sortOrder), 0) + 10;
    setDraft(createBlankStation(siteId, nextSortOrder));
    setPersistedStationId(null);
    setPublishConfirmArmed(false);
    setErrorText("");
    setNotice("已打开空白登记表；未保存前不会产生站房记录。"
    );
  }

  function patchDraft(patch: Partial<AdminStationInstance>) {
    setDraft((current) => current ? { ...current, ...patch } : current);
  }

  function changeStatus(status: AdminSubsystemStatus) {
    patchDraft({
      status,
      enabled: status === "enabled"
    });
  }

  async function handleSave() {
    const latestSession = getAdminSession();
    if (!draft || !latestSession || !siteId || saving) {
      return;
    }
    setSaving(true);
    setErrorText("");
    setNotice("");
    try {
      const latestHealth = await getAdminBackendHealth();
      setBackendHealth(latestHealth);
      const latestRoleAllowed = canAdminSessionWriteSite(latestSession, siteId);
      if (runtimeConfig.readOnlyMode || !latestHealth.writeAllowed || !latestRoleAllowed) {
        throw new Error(
          !latestRoleAllowed
            ? "当前会话没有此站点的明确写权限，本次未发起 PUT。"
            : latestHealth.reason
        );
      }
      if (draft.published && !publishConfirmArmed) {
        throw new Error("勾选发布后，必须先确认该身份会立即进入 3001 运行端清单。"
        );
      }
      const latestStations = await listStationInstances(
        latestSession.token,
        latestSession.userId,
        siteId
      );
      setStationList(latestStations);
      const latestPersisted = persistedStationId
        ? latestStations.items.find((item) => item.stationId === persistedStationId)
        : null;
      if (latestPersisted?.published) {
        setDraft(cloneStation(latestPersisted));
        throw new Error("该站房已发布，页面已重新读取并锁定；变更需先完善版本化流程。"
        );
      }
      const issues = validateStation(draft, latestStations.items, parentRegistry, persistedStationId);
      if (issues.length) {
        throw new Error(issues.join("；"));
      }
      const payload: Partial<AdminStationInstance> = {
        stationId: draft.stationId.trim(),
        stationName: draft.stationName.trim(),
        parentSubsystemType: draft.parentSubsystemType.trim(),
        status: draft.status,
        sortOrder: Math.max(0, Math.round(draft.sortOrder)),
        published: draft.published,
        notes: draft.notes?.trim() || null
      };
      const updated = await updateStationInstances(
        latestSession.token,
        latestSession.userId,
        siteId,
        [payload]
      );
      setStationList(updated);
      setDataLoaded(true);
      const saved = updated.items.find((item) => item.stationId === payload.stationId) || null;
      setDraft(saved ? cloneStation(saved) : null);
      setPersistedStationId(saved?.stationId || null);
      setPublishConfirmArmed(false);
      setNotice(
        saved?.published
          ? "站房登记已写入并立即进入运行端已发布清单；这不代表数据已按 stationId 筛选。"
          : "站房登记已写入但尚未发布，运行端不会显示该实例。"
      );
    } catch (error) {
      setErrorText(describeAdminError(error));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="admin-page-stack station-registry-page" data-station-registry-page>
      <section className="admin-panel station-registry-hero">
        <div className="admin-section-header">
          <div className="admin-hero-panel">
            <p className="admin-eyebrow">Physical station registry</p>
            <h2>{siteName || "未选择站点"}</h2>
            <p>登记项目下的真实物理站房身份，并关联所属能源对象类型。</p>
            <div className="admin-chip-row station-registry-safety-row">
              <StatusPill label={`siteId ${siteId || "N/A"}`} tone="neutral" />
              <StatusPill
                label={roleWriteAllowed ? "当前站点角色已核验" : "当前站点角色只读"}
                tone={roleWriteAllowed ? "good" : "warn"}
              />
              <StatusPill
                label={backendHealth.source === "mock"
                  ? "本地 MOCK｜不写真实配置库"
                  : backendHealth.writeAllowed
                    ? "服务端允许管理写入"
                    : "服务端写入已阻断"}
                tone={backendHealth.source === "mock" ? "warn" : backendHealth.writeAllowed ? "good" : "danger"}
              />
            </div>
          </div>
          <div className="admin-actions station-registry-actions">
            <button className="admin-button" type="button" onClick={() => navigate(`/sites/${encodeURIComponent(siteId)}`)}>
              <ArrowLeft size={14} />
              返回站点
            </button>
            <button className="admin-button" type="button" onClick={() => void loadData(persistedStationId || undefined)} disabled={loading || saving}>
              <RefreshCw size={14} />
              重新读取
            </button>
            <button
              className={`admin-button${canWrite ? " is-primary" : ""}`}
              type="button"
              onClick={startNewStation}
              disabled={!canWrite || saving}
              title={!canWrite ? writeBlockReason : undefined}
              aria-describedby="station-registry-write-gate"
              data-station-create-action
            >
              <Plus size={14} />
              {canWrite ? "登记站房" : "登记站房（只读）"}
            </button>
          </div>
        </div>
      </section>

      <div className="admin-summary-grid">
        <StatCard
          title="登记总数"
          value={dataLoaded ? String(stationList.total) : "--"}
          delta={backendHealth.source === "mock" ? "本地 MOCK 返回" : "真实 GET 返回"}
          tone="neutral"
        />
        <StatCard title="身份已发布" value={dataLoaded ? String(summary.published) : "--"} delta={`${summary.enabled} 个身份已启用`} tone="warn" />
        <StatCard
          title="绑定已发布"
          value={dataLoaded ? String(summary.runtimeBound) : "--"}
          delta="仅代表运行端可申请使用"
          tone={summary.runtimeBound > 0 ? "good" : "neutral"}
        />
        <StatCard
          title="可登记供能类型"
          value={dataLoaded ? String(parentRegistry.length) : "--"}
          delta={dataLoaded
            ? parentRegistry.length > 0
              ? `已启用 ${enabledParentTypeCount} · 待配置 ${pendingParentTypeCount}`
              : "当前项目未发布可登记类型"
            : "等待真实能力清单"}
          tone={parentRegistry.length > 0 ? "good" : "neutral"}
        />
      </div>

      <section
        id="station-registry-write-gate"
        className={`station-registry-gate ${canWrite ? "is-open" : "is-closed"}`}
        data-station-write-state={canWrite ? "allowed" : "blocked"}
      >
        <ShieldAlert size={18} />
        <div>
          <strong>{backendHealth.source === "mock" && canWrite
            ? "本地 MOCK 登记可写（非真实配置库）"
            : canWrite
              ? "站房身份登记可写"
              : "站房身份登记保持只读"}</strong>
          <span>{writeBlockReason}</span>
          <small>本页不配置点位、不修改控制策略、不触碰 PLC；已发布身份会立即影响 3001 站房清单。</small>
        </div>
      </section>

      {errorText ? <p className="admin-error" role="alert">{errorText}</p> : null}
      {notice ? <p className="admin-success" role="status">{notice}</p> : null}

      <section className="section-card">
        <div className="section-card-header">
          <div>
            <h3>物理站房清单</h3>
            <p className="admin-note">
              仅展示服务端实际返回记录；空清单不会自动生成冷冻站、空压站或锅炉房。
            </p>
          </div>
          <span className="admin-chip neutral">读取时间：{formatDateTime(stationList.generatedAt)}</span>
        </div>
        <div className="section-card-body">
          {loading ? (
            <div className="admin-loading-grid" aria-label="正在读取物理站房">
              <div className="admin-skeleton" />
              <div className="admin-skeleton" />
            </div>
          ) : !dataLoaded ? (
            <div className="admin-empty-state">
              <ShieldAlert size={22} />
              <strong>真实站房清单读取失败</strong>
              <span>未使用生产 mock 回退，也不会把失败解释为 0 个站房。</span>
            </div>
          ) : stationList.items.length === 0 ? (
            <div className="admin-empty-state">
              <Factory size={22} />
              <strong>尚未登记物理站房</strong>
              <span>{canWrite
                ? "请由当前站点管理员手工登记首个真实站房。"
                : roleWriteAllowed
                  ? "当前写入保护已开启；请在受控配置变更窗口开放后登记，本页不会自动创建默认站房。"
                  : "当前账号只有只读权限，请联系此站点管理员在受控变更窗口登记。"}</span>
              <div className="station-registry-empty-types" data-station-parent-count={parentRegistry.length}>
                <small>当前项目可登记供能类型</small>
                <div className="admin-chip-row">
                  {parentRegistry.length > 0 ? parentRegistry.map((item) => (
                    <span key={item.subsystemType} className="admin-chip neutral">
                      {item.displayName} · {STATUS_LABELS[parentCapabilityByType.get(item.subsystemType)?.status || "not_configured"]}
                    </span>
                  )) : (
                    <span className="admin-chip warn">尚未发布可登记类型</span>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="admin-table-shell station-registry-table-shell" data-station-registry-table role="region" aria-label="物理站房登记表，可横向滚动查看更多字段" tabIndex={0}>
              <table className="admin-table station-registry-table">
                <thead>
                  <tr>
                    <th>站房</th>
                    <th>所属类型</th>
                    <th>登记状态</th>
                    <th>运行绑定</th>
                    <th>数据状态</th>
                    <th>排序</th>
                    <th>可见性</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {stationList.items.map((item) => (
                    <tr key={item.stationId} className={persistedStationId === item.stationId ? "is-selected" : undefined}>
                      <td>
                        <strong>{item.stationName}</strong>
                        <div className="admin-table-cell-muted station-registry-id">{item.stationId}</div>
                      </td>
                      <td>{parentRegistry.find((entry) => entry.subsystemType === item.parentSubsystemType)?.displayName || item.parentSubsystemType}</td>
                      <td><StatusPill label={STATUS_LABELS[item.status]} tone={statusTone(item.status)} /></td>
                      <td>
                        <StatusPill
                          label={formatBindingState(item)}
                          tone={item.publishedBindingVersion ? "good" : item.draftBindingVersion ? "warn" : "neutral"}
                        />
                      </td>
                      <td>
                        <span>{item.sourceStatus}</span>
                        <div className="admin-table-cell-muted">{item.freshnessStatus}</div>
                      </td>
                      <td>{item.sortOrder}</td>
                      <td><StatusPill label={item.published ? "已发布" : "未发布"} tone={item.published ? "good" : "neutral"} /></td>
                      <td>
                        <div className="station-registry-row-actions">
                          <button className="admin-inline-action" type="button" onClick={() => selectStation(item)}>
                            {canWrite && !item.published ? "查看 / 编辑" : "查看"}
                          </button>
                          <button
                            className="admin-inline-action"
                            type="button"
                            onClick={() => navigate(`/sites/${encodeURIComponent(siteId)}/stations/${encodeURIComponent(item.stationId)}/runtime-binding`)}
                          >
                            运行绑定
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {draft ? (
        <section className="section-card station-registry-editor" data-station-editor>
          <div className="section-card-header">
            <div>
              <h3>{persistedStationId ? `站房详情 · ${draft.stationName || persistedStationId}` : "登记新物理站房"}</h3>
              <p className="admin-note">
                stationId 保存后不可修改；站名、归属、登记状态和排序可由授权管理员调整。
              </p>
            </div>
            <StatusPill label={persistedStationId ? "已登记身份" : "未保存空白表单"} tone={persistedStationId ? "good" : "warn"} />
          </div>
          {persistedRecordLocked ? (
            <div className="station-registry-published-lock" role="note">
              <ShieldAlert size={17} />
              <span>
                <strong>已发布实例已锁定</strong>
                <small>站房身份发布后保持锁定；运行数据绑定请在独立页面按草稿、真实验证和发布版本维护。</small>
              </span>
            </div>
          ) : null}
          <fieldset className="station-registry-fieldset" disabled={!canEditDraft || saving}>
            <div className="station-registry-form-grid">
              <label className="admin-field">
                <span>稳定 stationId</span>
                <input
                  className="station-registry-mono-input"
                  value={draft.stationId}
                  onChange={(event) => patchDraft({ stationId: event.target.value })}
                  placeholder="chilled-plant-a"
                  disabled={Boolean(persistedStationId) || !canEditDraft || saving}
                  autoComplete="off"
                />
                <small>仅新建时填写；允许字母、数字、点、下划线和短横线，首尾必须为字母或数字。</small>
              </label>
              <label className="admin-field">
                <span>站房名称</span>
                <input value={draft.stationName} onChange={(event) => patchDraft({ stationName: event.target.value })} placeholder="1# 冷冻站" />
              </label>
              <label className="admin-field">
                <span>所属供能站房类型</span>
                <select value={draft.parentSubsystemType} onChange={(event) => patchDraft({ parentSubsystemType: event.target.value })}>
                  <option value="">请选择冷冻站、空压站或锅炉房</option>
                  {parentRegistry.map((item) => (
                    <option key={item.subsystemType} value={item.subsystemType}>
                      {item.displayName} · {item.subsystemType} · {STATUS_LABELS[parentCapabilityByType.get(item.subsystemType)?.status || "not_configured"]}{item.reserved ? "（预留）" : ""}
                    </option>
                  ))}
                </select>
              </label>
              <label className="admin-field">
                <span>登记状态</span>
                <select value={draft.status} onChange={(event) => changeStatus(event.target.value as AdminSubsystemStatus)}>
                  {Object.entries(STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </label>
              <div className="station-registry-derived-status" data-station-runtime-status-derived>
                <span>运行数据状态</span>
                <strong>由运行绑定与实际响应派生</strong>
                <small>
                  身份登记不能手工声明实时接入、数据新鲜度或活动告警数。当前服务端返回：
                  {draft.sourceStatus || "unknown"} / {draft.freshnessStatus || "unknown"}
                  {typeof draft.alarmCount === "number" ? ` / ${draft.alarmCount} 条告警` : " / 告警待核"}。
                </small>
              </div>
              <label className="admin-field">
                <span>排序 sortOrder</span>
                <input type="number" min="0" step="1" value={draft.sortOrder} onChange={(event) => patchDraft({ sortOrder: Number(event.target.value) })} />
              </label>
              <label className="admin-field station-registry-notes-field">
                <span>登记备注</span>
                <textarea value={draft.notes || ""} onChange={(event) => patchDraft({ notes: event.target.value })} placeholder="记录站房边界、现场名称或接入说明；不要填写控制命令。" />
              </label>
            </div>
            <label className="station-registry-publish-check">
              <input type="checkbox" checked={draft.published} onChange={(event) => {
                patchDraft({ published: event.target.checked });
                setPublishConfirmArmed(false);
              }} />
              <span>
                <strong>发布到 3001 运行端站房清单</strong>
                <small>发布只代表身份可见，不代表设备、点位或趋势已按 stationId 过滤。</small>
              </span>
            </label>
            {draft.published && !persistedRecordLocked ? (
              <label className="station-registry-publish-confirm">
                <input type="checkbox" checked={publishConfirmArmed} onChange={(event) => setPublishConfirmArmed(event.target.checked)} />
                <span>
                  <strong>我确认：保存后该身份会立即进入 3001 运行端站房清单</strong>
                  <small>这只是导航身份发布，不代表数据已经按物理站房筛选；发布后本行将锁定。</small>
                </span>
              </label>
            ) : null}
          </fieldset>
          <div className="station-registry-editor-footer">
            <div className="admin-note">
              最近更新：{formatDateTime(draft.updatedAt)} · {draft.updatedBy || "未记录"}
            </div>
            <div className="admin-actions">
              {!persistedStationId ? (
                <button className="admin-button" type="button" onClick={() => {
                  const first = stationList.items[0];
                  setDraft(first ? cloneStation(first) : null);
                  setPersistedStationId(first?.stationId || null);
                  setPublishConfirmArmed(false);
                  setNotice("");
                  setErrorText("");
                }} disabled={saving}>
                  取消登记
                </button>
              ) : null}
              {canEditDraft ? (
                <button className="admin-button is-primary" type="button" onClick={() => void handleSave()} disabled={saving || (draft.published && !publishConfirmArmed)}>
                  <Save size={14} />
                  {saving ? "正在写入" : "确认写入登记"}
                </button>
              ) : null}
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}
