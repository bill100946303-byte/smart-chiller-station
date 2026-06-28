import { ExternalLink, Settings2 } from "lucide-react";
import { runtimeConfig } from "../config/runtimeConfig";
import { getCurrentProject, resolveEnergyConfigSiteId } from "../services/auth";

function buildAdminSubsystemUrl(siteId: string): string {
  if (typeof window === "undefined") {
    return `http://127.0.0.1:3002/sites/${encodeURIComponent(siteId)}/subsystems`;
  }
  return `${window.location.protocol}//${window.location.hostname}:3002/sites/${encodeURIComponent(siteId)}/subsystems`;
}

export default function ConfigCenterEntryPage() {
  const currentProject = getCurrentProject();
  const siteId = resolveEnergyConfigSiteId(currentProject, runtimeConfig.siteId);
  const projectNumber = siteId;
  const adminUrl = buildAdminSubsystemUrl(siteId);

  return (
    <div className="config-center-entry-page">
      <section className="section-card">
        <header className="section-card-header">
          <div>
            <h3>子系统配置入口</h3>
            <p className="power-monitor-subtitle">运行端只读取已发布配置；子系统启停、点位映射和发布回滚在 3002 配置中心完成。</p>
          </div>
          <span className="status-pill warn">read-only runtime</span>
        </header>
        <div className="section-card-body">
          <div className="config-center-entry-card">
            <Settings2 size={28} />
            <div>
              <strong>能源站配置中心</strong>
              <span>项目编号：{projectNumber}</span>
            </div>
            <a href={adminUrl} target="_blank" rel="noreferrer">
              打开 3002
              <ExternalLink size={14} />
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
