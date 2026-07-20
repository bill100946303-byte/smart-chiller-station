import {
  ArrowRight,
  BookOpenCheck,
  ExternalLink,
  Factory,
  Gauge,
  RefreshCw,
  Settings2,
  ShieldCheck
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import "./PowerMonitoringShared.css";
import "./ConfigCenterEntryExtracted.css";
import { runtimeConfig } from "../config/runtimeConfig";
import {
  getCurrentProject,
  resolveAuthProjectDisplayName,
  resolveEnergyConfigSiteId
} from "../services/auth";
import { appendSiteIdToPath, normalizeRouteSiteId } from "../services/siteRouting";

type AdminEntryPath = "subsystems" | "stations";
type AdminEntryState = "checking" | "available" | "unavailable";

const ADMIN_ENTRY_PROBE_TIMEOUT_MS = 1_500;

function buildAdminProjectUrl(siteId: string, entry: AdminEntryPath): string {
  const pathname = `/sites/${encodeURIComponent(siteId)}/${entry}`;
  if (typeof window === "undefined") {
    return `http://127.0.0.1:3002${pathname}`;
  }
  return `${window.location.protocol}//${window.location.hostname}:3002${pathname}`;
}

export default function ConfigCenterEntryPage() {
  const currentProject = getCurrentProject();
  const configSiteId = resolveEnergyConfigSiteId(currentProject, runtimeConfig.siteId);
  const routeSiteId = normalizeRouteSiteId(currentProject?.siteId || runtimeConfig.siteId)
    || currentProject?.siteId
    || runtimeConfig.siteId;
  const projectName = resolveAuthProjectDisplayName(currentProject, routeSiteId);
  const subsystemAdminUrl = buildAdminProjectUrl(configSiteId, "subsystems");
  const stationRegistryUrl = buildAdminProjectUrl(configSiteId, "stations");
  const adminOrigin = useMemo(() => new URL(stationRegistryUrl).origin, [stationRegistryUrl]);
  const [adminEntryState, setAdminEntryState] = useState<AdminEntryState>("checking");
  const energyParametersUrl = appendSiteIdToPath("/energy-parameters", routeSiteId);
  const knowledgeBaseUrl = appendSiteIdToPath("/knowledge-base", routeSiteId);

  const probeAdminEntry = useCallback(async () => {
    setAdminEntryState("checking");
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), ADMIN_ENTRY_PROBE_TIMEOUT_MS);
    try {
      await fetch(`${adminOrigin}/`, {
        method: "GET",
        mode: "no-cors",
        cache: "no-store",
        signal: controller.signal
      });
      setAdminEntryState("available");
    } catch {
      setAdminEntryState("unavailable");
    } finally {
      window.clearTimeout(timeoutId);
    }
  }, [adminOrigin]);

  useEffect(() => {
    void probeAdminEntry();
  }, [probeAdminEntry]);

  const adminEntryStateLabel = adminEntryState === "available"
    ? "3002 配置中心可达"
    : adminEntryState === "checking"
      ? "正在核验 3002 配置中心"
      : "3002 配置中心未启动";

  const renderAdminEntryAction = (href: string, label: string) => adminEntryState === "available" ? (
    <a href={href} target="_blank" rel="noreferrer">
      {label}
      <ExternalLink size={14} aria-hidden="true" />
    </a>
  ) : (
    <button
      type="button"
      className="config-center-admin-retry"
      onClick={() => void probeAdminEntry()}
      disabled={adminEntryState === "checking"}
      aria-label={adminEntryState === "checking" ? "正在核验3002配置中心" : "3002配置中心未启动，重新核验"}
    >
      {adminEntryState === "checking" ? "正在核验配置中心" : "配置中心未启动 · 重试"}
      <RefreshCw size={14} aria-hidden="true" />
    </button>
  );

  return (
    <div
      className="config-center-entry-page"
      data-config-center-scope="project"
      data-config-site-id={configSiteId}
    >
      <section className="section-card config-center-hero">
        <header className="section-card-header">
          <div>
            <span className="config-center-eyebrow">PROJECT CONFIGURATION</span>
            <h1>项目配置中心</h1>
            <p className="power-monitor-subtitle">
              先建立能源对象，再登记真实物理站房；运行端只读取已发布配置和已验证的数据范围证据。
            </p>
          </div>
          <span className="status-pill warn">当前项目 · 不继承站房上下文</span>
        </header>
        <div className="section-card-body config-center-identity-wrap">
          <div className="config-center-project-identity">
            <span className="config-center-project-icon" aria-hidden="true"><Settings2 size={22} /></span>
            <div>
              <span>当前项目</span>
              <strong>{projectName}</strong>
              <small>运行项目 ID {routeSiteId} · 配置键 {configSiteId}</small>
            </div>
          </div>
          <div className="config-center-scope-proof">
            <span>配置作用域</span>
            <strong>当前项目</strong>
            <small>不会沿用冷冻站、空压站或锅炉房的临时关联上下文</small>
          </div>
        </div>
      </section>

      <section className="config-center-hub" aria-labelledby="config-center-hub-title">
        <header className="config-center-section-heading">
          <div>
            <span>接入与身份</span>
            <h2 id="config-center-hub-title">多能源站上线入口</h2>
          </div>
          <small
            className={`config-center-admin-state is-${adminEntryState}`}
            data-admin-entry-state={adminEntryState}
            aria-live="polite"
          >
            {adminEntryStateLabel} · 身份与运行数据边界分层管理
          </small>
        </header>

        <div className="config-center-hub-grid">
          <article className="config-center-module-card is-primary" data-config-module="energy-objects">
            <span className="config-center-module-icon" aria-hidden="true"><Gauge size={22} /></span>
            <div className="config-center-module-copy">
              <span>P0 · 第一步</span>
              <h3>能源对象接入</h3>
              <p>配置冷冻站、空压站、锅炉房、电力与空调末端的启用状态、点位角色和发布版本。</p>
              <small>类型级配置 · 未发布内容不会进入 3001</small>
            </div>
            {renderAdminEntryAction(subsystemAdminUrl, "打开能源对象接入")}
          </article>

          <article className="config-center-module-card is-station" data-config-module="physical-stations">
            <span className="config-center-module-icon" aria-hidden="true"><Factory size={22} /></span>
            <div className="config-center-module-copy">
              <span>P0 · 第二步</span>
              <h3>物理站房登记</h3>
              <p>在所属供能站房类型下登记冷冻站 A/B、空压站 1/2 等真实实例，并进入运行绑定。</p>
              <small>身份登记不等于实时，也不等于运行数据已按站房过滤</small>
            </div>
            {renderAdminEntryAction(stationRegistryUrl, "打开物理站房登记")}
          </article>

          <article className="config-center-module-card" data-config-module="energy-parameters">
            <span className="config-center-module-icon" aria-hidden="true"><Settings2 size={22} /></span>
            <div className="config-center-module-copy">
              <span>项目工具</span>
              <h3>能源参数</h3>
              <p>维护电价时段、计费边界和项目级能源参数，不绑定单个物理站房。</p>
              <small>当前项目 · 运行端权限继续生效</small>
            </div>
            <Link to={energyParametersUrl}>
              查看能源参数
              <ArrowRight size={14} aria-hidden="true" />
            </Link>
          </article>

          <article className="config-center-module-card" data-config-module="knowledge-base">
            <span className="config-center-module-icon" aria-hidden="true"><BookOpenCheck size={22} /></span>
            <div className="config-center-module-copy">
              <span>项目工具</span>
              <h3>知识库</h3>
              <p>归档设备资料、运行策略和验收依据，为工程人员提供可追溯的项目知识。</p>
              <small>文档与策略 · 不直接生成 PLC 写入</small>
            </div>
            <Link to={knowledgeBaseUrl}>
              进入知识库
              <ArrowRight size={14} aria-hidden="true" />
            </Link>
          </article>
        </div>
      </section>

      <section className="section-card config-center-flow" aria-labelledby="config-center-flow-title">
        <header className="section-card-header">
          <div>
            <h2 id="config-center-flow-title">多站房上线顺序</h2>
            <p className="power-monitor-subtitle">每一步都必须有独立证据，不能用“已发布”替代实时与站房筛选证明。</p>
          </div>
          <span className="status-pill good">安全边界</span>
        </header>
        <div className="section-card-body config-center-flow-body">
          <ol className="config-center-flow-steps">
            <li><span>1</span><div><strong>发布能源对象</strong><small>确认类型、状态与点位角色</small></div></li>
            <li><span>2</span><div><strong>登记物理站房</strong><small>稳定站房标识归属正确类型</small></div></li>
            <li><span>3</span><div><strong>验证运行绑定</strong><small>真实只读目录与设备白名单通过</small></div></li>
            <li><span>4</span><div><strong>运行端消费证据</strong><small>响应证明 station_binding 后才展示本站数据</small></div></li>
          </ol>
          <aside className="config-center-safety-note">
            <ShieldCheck size={18} aria-hidden="true" />
            <div>
              <strong>AI 与配置中心不直接控制 PLC</strong>
              <small>安全联锁、最终执行和异常回退仍由 PLC 与现场权限链负责。</small>
            </div>
          </aside>
        </div>
      </section>
    </div>
  );
}
