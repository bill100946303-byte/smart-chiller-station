import { ArrowRight, LayoutDashboard, MapPinned, RouteOff } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { runtimeConfig } from "../config/runtimeConfig";
import { appendSiteIdToPath, readSiteIdFromSearch } from "../services/siteRouting";
import "./NotFoundPage.css";

export default function NotFoundPage() {
  const location = useLocation();
  const currentSiteId = readSiteIdFromSearch(location.search) || runtimeConfig.siteId;
  const dashboardPath = appendSiteIdToPath("/dashboard", currentSiteId);
  const projectsPath = appendSiteIdToPath("/projects", currentSiteId);

  return (
    <div className="not-found-page page-enter" data-route-status="not-found">
      <section className="not-found-panel" aria-labelledby="not-found-heading">
        <div className="not-found-icon" aria-hidden="true">
          <RouteOff size={30} />
        </div>
        <div className="not-found-copy">
          <span>ROUTE NOT REGISTERED</span>
          <h1 id="not-found-heading">页面路径不存在</h1>
          <p>
            系统未识别该地址，已停留在当前项目，不会默认跳转到冷冻站或其他能源对象。
          </p>
          <code>{location.pathname}</code>
        </div>
        <div className="not-found-actions" aria-label="页面恢复操作">
          <Link className="not-found-action primary" to={dashboardPath}>
            <LayoutDashboard size={17} aria-hidden="true" />
            返回项目总览
            <ArrowRight size={16} aria-hidden="true" />
          </Link>
          <Link className="not-found-action secondary" to={projectsPath}>
            <MapPinned size={17} aria-hidden="true" />
            选择其他项目
          </Link>
        </div>
      </section>
    </div>
  );
}
