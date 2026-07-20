import { LogOut, Settings2, ShieldCheck, Table2 } from "lucide-react";
import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import StatusPill from "../components/common/StatusPill";
import { runtimeConfig } from "../config/runtimeConfig";
import { clearAdminSession, getAdminSession } from "../services/adminAuth";
import { ADMIN_AUTH_EXPIRED_EVENT } from "../services/adminClient";

function formatNowLabel(): string {
  return new Date().toLocaleString("zh-CN", {
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function formatRoleLabel(value?: string): string {
  switch (value) {
    case "platform_admin":
      return "平台管理员";
    case "site_admin":
      return "站点管理员";
    case "auditor":
      return "审计员";
    default:
      return value || "站点管理员";
  }
}

function resolveTitle(pathname: string): string {
  if (/^\/sites\/[^/]+\/stations\/[^/]+\/runtime-binding$/.test(pathname)) {
    return "站房运行绑定";
  }
  if (pathname.startsWith("/sites/") && pathname.endsWith("/source-config")) {
    return "站点接入配置";
  }
  if (pathname.startsWith("/sites/") && pathname.endsWith("/runtime-config")) {
    return "站点运行配置";
  }
  if (pathname.startsWith("/sites/") && pathname.endsWith("/subsystems")) {
    return "子系统配置";
  }
  if (pathname.startsWith("/sites/") && pathname.endsWith("/stations")) {
    return "物理站房登记";
  }
  if (pathname.startsWith("/sites/") && pathname.endsWith("/members")) {
    return "成员权限";
  }
  if (pathname.startsWith("/sites/")) {
    return "站点详情";
  }
  if (pathname.startsWith("/audit-logs")) {
    return "审计日志";
  }
  return "站点管理";
}

export default function AdminShell() {
  const navigate = useNavigate();
  const location = useLocation();
  const session = getAdminSession();
  const [nowLabel, setNowLabel] = useState(() => formatNowLabel());

  useEffect(() => {
    setNowLabel(formatNowLabel());
    const timer = window.setInterval(() => {
      setNowLabel(formatNowLabel());
    }, 30 * 1000);
    return () => {
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    function handleExpiredSession() {
      const redirect = `${location.pathname}${location.search}${location.hash}`;
      clearAdminSession();
      navigate(`/login?reason=expired&redirect=${encodeURIComponent(redirect)}`, { replace: true });
    }

    window.addEventListener(ADMIN_AUTH_EXPIRED_EVENT, handleExpiredSession);
    return () => {
      window.removeEventListener(ADMIN_AUTH_EXPIRED_EVENT, handleExpiredSession);
    };
  }, [location.hash, location.pathname, location.search, navigate]);

  function handleSignOut() {
    clearAdminSession();
    navigate("/login", { replace: true });
  }

  const navGroups = [
    {
      label: "总览",
      items: [
        { to: "/sites", icon: <Table2 size={14} />, label: "站点管理" },
        { to: "/audit-logs", icon: <ShieldCheck size={14} />, label: "审计日志" }
      ]
    },
    {
      label: "最近访问",
      items: session?.visibleSites.slice(0, 4).map((site) => ({
        to: `/sites/${encodeURIComponent(site.siteId)}`,
        icon: <Settings2 size={14} />,
        label: site.siteName
      })) || []
    }
  ];

  const currentSiteId = location.pathname.startsWith("/sites/") ? location.pathname.split("/")[2] : "";

  return (
    <div className="admin-root admin-shell">
      <a className="admin-skip-link" href="#admin-main-content">
        跳到主要内容
      </a>
      <aside className="admin-sidebar" aria-label="后台导航区">
        <div className="admin-brand">
          <p className="admin-eyebrow">Chiller Admin</p>
          <div className="admin-brand-title">多项目后台</div>
          <p className="admin-note">
            {session?.username || "未登录"} · {formatRoleLabel(session?.role)}
          </p>
          <div className="admin-chip-row" style={{ marginTop: 12 }}>
            <span className="admin-chip neutral">{session?.visibleSites.length || 0} 个站点</span>
            <span className="admin-chip neutral">{runtimeConfig.appModeLabel}</span>
            {runtimeConfig.readOnlyMode ? <span className="admin-chip warn">只读模式</span> : null}
          </div>
        </div>

        <nav className="admin-nav" aria-label="后台主导航">
          {navGroups.map((group) => (
            <section key={group.label} className="admin-nav-section" aria-label={group.label}>
              <p className="admin-nav-label">{group.label}</p>
              <div className="admin-nav-links">
                {group.items.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    title={item.label}
                    className={({ isActive }) => (isActive ? "active" : undefined)}
                  >
                    {item.icon}
                    <span>{item.label}</span>
                  </NavLink>
                ))}
              </div>
            </section>
          ))}
        </nav>

        <div className="admin-sidebar-footer">
          <div className="admin-brand" style={{ padding: 14 }}>
            <p className="admin-note">当前页面</p>
            <strong>{resolveTitle(location.pathname)}</strong>
            {currentSiteId ? <p className="admin-note">站点：{currentSiteId}</p> : null}
            <p className="admin-note">更新时间：{nowLabel}</p>
          </div>
          <button className="admin-button admin-signout" type="button" onClick={handleSignOut}>
            <LogOut size={14} />
            <span>退出登录</span>
          </button>
        </div>
      </aside>

      <main className="admin-main">
        <header className="admin-topbar">
          <div className="admin-topbar-left">
            <div className="admin-topbar-title">
              <h1>{resolveTitle(location.pathname)}</h1>
              <span>{session?.visibleSites.length ? "可以管理多个站点" : "请先登录后再使用后台"}</span>
            </div>
            <StatusPill label={formatRoleLabel(session?.role)} tone="good" />
            <StatusPill label={runtimeConfig.appModeLabel} tone="warn" />
          </div>
          <div className="admin-topbar-right">
            <span className="admin-chip neutral">用户：{session?.username || "未知"}</span>
            <span className="admin-chip neutral">ID：{session?.userId || "N/A"}</span>
            <span className="admin-chip neutral">时间：{nowLabel}</span>
          </div>
        </header>

        <div id="admin-main-content" className="admin-content" tabIndex={-1}>
          <Outlet />
        </div>
      </main>
    </div>
  );
}
