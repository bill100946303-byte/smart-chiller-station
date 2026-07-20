import { ArrowLeft, Factory, RefreshCw, Settings2, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import SectionCard from "../components/common/SectionCard";
import SourceStatusBanner from "../components/common/SourceStatusBanner";
import StatCard from "../components/common/StatCard";
import StatusPill from "../components/common/StatusPill";
import { getAdminSession } from "../services/adminAuth";
import {
  getAdminSourceConfigBundle,
  getAdminRuntimeConfig,
  getAdminSite,
  listAdminAuditLogs,
  listAdminMembers,
  type AdminAuditLog,
  type AdminEffectiveSourceConfig,
  type AdminMember,
  type AdminRuntimeConfig,
  type AdminSiteDetail,
  type AdminSourceConfig
} from "../services/adminClient";

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

function formatMemberRole(value: string): string {
  const labels: Record<string, string> = {
    platform_admin: "平台管理员",
    site_admin: "站点管理员",
    auditor: "审计员"
  };
  return labels[value] || value;
}

function formatMemberScope(value: string): string {
  const labels: Record<string, string> = {
    site: "站点范围",
    platform: "平台范围"
  };
  return labels[value] || value;
}

function safeJson(value?: string): string {
  if (!value) {
    return "{}";
  }
  try {
    return JSON.stringify(JSON.parse(value), null, 2);
  } catch {
    return value;
  }
}

function readTowerApproachMinCondenserInletTempC(value?: string): string | null {
  if (!value) {
    return null;
  }
  try {
    const parsed = JSON.parse(value) as {
      towerApproach?: {
        minCondenserInletTempC?: number | string | null;
      };
    };
    const minTemp = parsed?.towerApproach?.minCondenserInletTempC;
    if (typeof minTemp === "number" && Number.isFinite(minTemp)) {
      return `${minTemp} °C`;
    }
    if (typeof minTemp === "string" && minTemp.trim()) {
      return `${minTemp.trim()} °C`;
    }
    return null;
  } catch {
    return null;
  }
}

function readTowerApproachThresholdSummary(value?: string): string | null {
  if (!value) {
    return null;
  }
  try {
    const parsed = JSON.parse(value) as {
      towerApproach?: {
        minCondenserInletTempC?: number | string | null;
        minCondenserInletTempCByModel?: Record<string, unknown>;
        minCondenserInletTempCByChiller?: Record<string, unknown>;
      };
    };
    const towerApproach = parsed?.towerApproach;
    if (!towerApproach || typeof towerApproach !== "object") {
      return null;
    }
    const segments: string[] = [];
    const defaultMin = readTowerApproachMinCondenserInletTempC(value);
    if (defaultMin) {
      segments.push(`default ${defaultMin}`);
    }
    const byModelCount =
      towerApproach.minCondenserInletTempCByModel &&
      typeof towerApproach.minCondenserInletTempCByModel === "object" &&
      !Array.isArray(towerApproach.minCondenserInletTempCByModel)
        ? Object.keys(towerApproach.minCondenserInletTempCByModel).length
        : 0;
    if (byModelCount > 0) {
      segments.push(`byModel ${byModelCount}`);
    }
    const byChillerCount =
      towerApproach.minCondenserInletTempCByChiller &&
      typeof towerApproach.minCondenserInletTempCByChiller === "object" &&
      !Array.isArray(towerApproach.minCondenserInletTempCByChiller)
        ? Object.keys(towerApproach.minCondenserInletTempCByChiller).length
        : 0;
    if (byChillerCount > 0) {
      segments.push(`byChiller ${byChillerCount}`);
    }
    return segments.length > 0 ? segments.join(" / ") : null;
  } catch {
    return null;
  }
}

function kvRow(label: string, value?: string | number | null) {
  return (
    <div className="admin-kv-row">
      <dt>{label}</dt>
      <dd>{value || "未设置"}</dd>
    </div>
  );
}

function formatDeviceQueryLabel(config: AdminEffectiveSourceConfig | null): string {
  const query = config?.defaultDeviceQuery;
  if (!query) {
    return "未配置";
  }
  const parts = [];
  if (typeof query.build === "number") {
    parts.push(`build=${query.build}`);
  }
  if (typeof query.floor === "number") {
    parts.push(`floor=${query.floor}`);
  }
  if (typeof query.mock === "boolean") {
    parts.push(`mock=${query.mock ? 1 : 0}`);
  }
  return parts.length > 0 ? parts.join(", ") : "未配置";
}

export default function SiteDetailPage() {
  const navigate = useNavigate();
  const { siteId = "" } = useParams();
  const session = getAdminSession();
  const [loading, setLoading] = useState(true);
  const [errorText, setErrorText] = useState("");
  const [site, setSite] = useState<AdminSiteDetail | null>(null);
  const [sourceConfig, setSourceConfig] = useState<AdminSourceConfig | null>(null);
  const [effectiveSourceConfig, setEffectiveSourceConfig] = useState<AdminEffectiveSourceConfig | null>(null);
  const [runtimeConfig, setRuntimeConfig] = useState<AdminRuntimeConfig | null>(null);
  const [members, setMembers] = useState<AdminMember[]>([]);
  const [logs, setLogs] = useState<AdminAuditLog[]>([]);

  async function loadDetail() {
    if (!session || !siteId) {
      return;
    }
    setLoading(true);
    setErrorText("");
    try {
      const [siteRecord, sourceBundle, runtimeRecord, memberRecords, logRecords] = await Promise.all([
        getAdminSite(session.token, session.userId, siteId),
        getAdminSourceConfigBundle(session.token, session.userId, siteId),
        getAdminRuntimeConfig(session.token, session.userId, siteId),
        listAdminMembers(session.token, session.userId, siteId),
        listAdminAuditLogs(session.token, session.userId, { siteId })
      ]);
      setSite(siteRecord);
      setSourceConfig(sourceBundle.sourceConfig);
      setEffectiveSourceConfig(sourceBundle.effectiveSourceConfig);
      setRuntimeConfig(runtimeRecord);
      setMembers(memberRecords);
      setLogs(logRecords);
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : "站点详情加载失败");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadDetail();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.token, siteId]);

  return (
    <div className="admin-page-stack">
      <section className="admin-panel">
        <div className="admin-section-header">
          <div className="admin-hero-panel" style={{ flex: 1 }}>
            <p className="admin-eyebrow">站点详情</p>
            <h2>{site?.siteName || siteId || "未选择站点"}</h2>
            <p>{site?.siteId || "siteId 未加载"}</p>
            <div className="admin-chip-row" style={{ marginTop: 14 }}>
              <StatusPill label={site?.status || "unknown"} tone={statusTone(site?.status)} />
              <StatusPill label={`接入 ${site?.sourceStatus || "unknown"}`} tone={statusTone(site?.sourceStatus)} />
              <StatusPill label={`运行 ${site?.runtimeStatus || "unknown"}`} tone={statusTone(site?.runtimeStatus)} />
              <StatusPill label={`${members.length} 个成员`} tone="neutral" />
            </div>
          </div>

          <div className="admin-actions" style={{ alignSelf: "stretch" }}>
            <button className="admin-button" type="button" onClick={() => navigate("/sites")}>
              <ArrowLeft size={14} />
              返回列表
            </button>
            <button className="admin-button" type="button" onClick={() => void loadDetail()}>
              <RefreshCw size={14} />
              刷新
            </button>
            <button className="admin-button is-primary" type="button" onClick={() => navigate(`/sites/${encodeURIComponent(siteId)}/source-config`)}>
              <Settings2 size={14} />
              编辑接入
            </button>
            <button className="admin-button is-primary" type="button" onClick={() => navigate(`/sites/${encodeURIComponent(siteId)}/runtime-config`)}>
              <Settings2 size={14} />
              编辑运行
            </button>
            <button className="admin-button is-primary" type="button" onClick={() => navigate(`/sites/${encodeURIComponent(siteId)}/subsystems`)}>
              <Settings2 size={14} />
              子系统配置
            </button>
            <button className="admin-button is-primary" type="button" onClick={() => navigate(`/sites/${encodeURIComponent(siteId)}/stations`)}>
              <Factory size={14} />
              物理站房登记
            </button>
            <button className="admin-button is-primary" type="button" onClick={() => navigate(`/sites/${encodeURIComponent(siteId)}/members`)}>
              <Users size={14} />
              成员权限
            </button>
          </div>
        </div>
      </section>

      <div className="admin-summary-grid">
        <StatCard title="成员数量" value={String(members.length)} delta="权限绑定" tone="neutral" />
        <StatCard title="接入状态" value={site?.sourceStatus || "unknown"} delta="source" tone={statusTone(site?.sourceStatus)} />
        <StatCard title="运行状态" value={site?.runtimeStatus || "unknown"} delta="runtime" tone={statusTone(site?.runtimeStatus)} />
        <StatCard title="当前版本" value={runtimeConfig?.version || "v1"} delta="runtime-config" tone="good" />
      </div>

      {errorText ? <p className="admin-error">{errorText}</p> : null}

      {loading ? (
        <div className="admin-loading-grid">
          <div className="admin-skeleton" />
          <div className="admin-skeleton" />
          <div className="admin-skeleton" />
          <div className="admin-skeleton" />
        </div>
      ) : (
        <>
          <SourceStatusBanner
            summary={`站点 ${site?.siteName || siteId} 的接入状态为 ${site?.sourceStatus || "unknown"}，运行状态为 ${site?.runtimeStatus || "unknown"}.`}
            warn={(site?.sourceStatus || "unknown") !== "ok" || (site?.runtimeStatus || "unknown") !== "ok"}
            detailLines={[
              `负责人：${site?.ownerName || "未设置"}`,
              `城市：${site?.city || "未设置"}`,
              `备注：${site?.remark || "无"}`
            ]}
          />

          <div className="admin-detail-grid">
            <SectionCard title="基础信息">
              <dl className="admin-kv">
                {kvRow("siteId", site?.siteId)}
                {kvRow("站点名称", site?.siteName)}
                {kvRow("站点编码", site?.siteCode)}
                {kvRow("城市", site?.city)}
                {kvRow("负责人", site?.ownerName)}
                {kvRow("备注", site?.remark)}
              </dl>
            </SectionCard>

            <SectionCard title="接入配置">
              <dl className="admin-kv">
                {kvRow("legacyBaseUrl", sourceConfig?.legacyBaseUrl)}
                {kvRow("ipAddress", sourceConfig?.ipAddress)}
                {kvRow("port", sourceConfig?.port)}
                {kvRow("databaseKey", sourceConfig?.databaseKey)}
                {kvRow("modelKey", sourceConfig?.modelKey)}
                {kvRow("preferredProjectKey", sourceConfig?.preferredProjectKey)}
                {kvRow("template", sourceConfig?.template)}
                {kvRow("controlMode", sourceConfig?.controlMode)}
                {kvRow("status", sourceConfig?.status)}
              </dl>
              <div className="admin-section-stack" style={{ marginTop: 14 }}>
                <p className="admin-note">生效设备数据接口</p>
                <dl className="admin-kv">
                  {kvRow("deviceDataProjectKey", effectiveSourceConfig?.deviceDataProjectKey)}
                  {kvRow("defaultDeviceQuery", formatDeviceQueryLabel(effectiveSourceConfig))}
                </dl>
                {effectiveSourceConfig?.deviceDataInterfaces?.length ? (
                  <div className="admin-table-shell" role="region" aria-label="设备数据接口表，可横向滚动查看更多字段" tabIndex={0}>
                    <table className="admin-table">
                      <thead>
                        <tr>
                          <th>标签</th>
                          <th>类型</th>
                          <th>默认参数</th>
                          <th>接口路径</th>
                        </tr>
                      </thead>
                      <tbody>
                        {effectiveSourceConfig.deviceDataInterfaces.map((item) => (
                          <tr key={`${item.projectKey}:${item.label}:${item.endpoint}`}>
                            <td>{item.label}</td>
                            <td>{item.endpointKind}</td>
                            <td>
                              {[
                                typeof item.build === "number" ? `build=${item.build}` : "",
                                typeof item.floor === "number" ? `floor=${item.floor}` : "",
                                typeof item.mock === "boolean" ? `mock=${item.mock ? 1 : 0}` : ""
                              ].filter(Boolean).join(", ") || "无"}
                            </td>
                            <td>
                              <code>{item.endpoint}</code>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="admin-empty-state">当前站点没有命中内置设备数据接口注册表。</div>
                )}
              </div>
            </SectionCard>
          </div>

          <div className="admin-detail-grid">
            <SectionCard
              title="运行配置"
              action={
                <button className="admin-inline-action" type="button" onClick={() => navigate(`/sites/${encodeURIComponent(siteId)}/runtime-config`)}>
                  打开运行配置
                </button>
              }
            >
              <dl className="admin-kv">
                {kvRow("version", runtimeConfig?.version)}
                {kvRow("updatedAt", runtimeConfig?.updatedAt)}
                {kvRow("updatedBy", runtimeConfig?.updatedBy)}
                {kvRow("towerApproach.minCondenserInletTempC", readTowerApproachMinCondenserInletTempC(runtimeConfig?.ruleThresholdsJson))}
                {kvRow("towerApproach.thresholdSummary", readTowerApproachThresholdSummary(runtimeConfig?.ruleThresholdsJson))}
              </dl>
              <div className="admin-section-stack" style={{ marginTop: 14 }}>
                <div>
                  <p className="admin-note">energyParamsJson</p>
                  <pre className="admin-json">{safeJson(runtimeConfig?.energyParamsJson)}</pre>
                </div>
                <div>
                  <p className="admin-note">ruleThresholdsJson</p>
                  <pre className="admin-json">{safeJson(runtimeConfig?.ruleThresholdsJson)}</pre>
                </div>
              </div>
            </SectionCard>

            <SectionCard title="成员预览" action={<button className="admin-inline-action" type="button" onClick={() => navigate(`/sites/${encodeURIComponent(siteId)}/members`)}>打开管理页</button>}>
              {members.length > 0 ? (
                <div className="admin-table-shell" role="region" aria-label="站点成员预览表，可横向滚动查看更多字段" tabIndex={0}>
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>账号</th>
                        <th>角色</th>
                        <th>范围</th>
                      </tr>
                    </thead>
                    <tbody>
                      {members.slice(0, 4).map((member) => (
                        <tr key={member.bindingId}>
                          <td>{member.username}</td>
                          <td>{formatMemberRole(member.role)}</td>
                          <td>{formatMemberScope(member.scopeType)}{member.scopeId ? ` · ${member.scopeId}` : ""}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="admin-empty-state">暂无成员数据。</div>
              )}
            </SectionCard>
          </div>

          <SectionCard title="最近审计">
            {logs.length > 0 ? (
              <div className="admin-table-shell" role="region" aria-label="最近审计记录表，可横向滚动查看更多字段" tabIndex={0}>
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>时间</th>
                      <th>操作者</th>
                      <th>动作</th>
                      <th>目标</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.slice(0, 6).map((log) => (
                      <tr key={log.id}>
                        <td>{log.ts}</td>
                        <td>{log.actor}</td>
                        <td>{log.action}</td>
                        <td>{log.targetType} · {log.targetId}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="admin-empty-state">暂无审计记录。</div>
            )}
          </SectionCard>
        </>
      )}
    </div>
  );
}
