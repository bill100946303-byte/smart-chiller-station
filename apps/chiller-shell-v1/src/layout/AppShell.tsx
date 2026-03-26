import { BellRing, BookOpen, Box, ChartColumnIncreasing, ClipboardList, Cpu, FileText, Gauge, LayoutGrid, LineChart, LogOut, Sparkles, Wind, Wrench } from "lucide-react";
import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import StatusPill from "../components/common/StatusPill";
import { runtimeConfig } from "../config/runtimeConfig";
import { getCurrentLocale, getLocaleOptions, setCurrentLocale, zhCN } from "../i18n/zhCN";
import { clearAuthSession, getAuthSession, getCurrentProject, selectAuthProject } from "../services/auth";

function formatNowLabel(locale: string): string {
  return new Date().toLocaleString(locale, {
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function formatProjectOptionLabel(siteName: string, siteCode?: string): string {
  if (!siteCode || siteCode === siteName) {
    return siteName;
  }
  return `${siteName} · ${siteCode}`;
}

export default function AppShell() {
  const navigate = useNavigate();
  const location = useLocation();
  const locale = getCurrentLocale();
  const localeOptions = getLocaleOptions();
  const [nowLabel, setNowLabel] = useState(() => formatNowLabel(locale));
  const [switchingProjectId, setSwitchingProjectId] = useState<string | null>(null);
  const session = getAuthSession();
  const currentProject = getCurrentProject(session);
  const availableProjects = session?.projects || [];
  const showRuntimeBadge = runtimeConfig.appMode !== "local";
  const navSections = [
    {
      title: "值班",
      items: [
        { to: "/dashboard", icon: <Gauge size={14} />, label: zhCN.appShell.navDashboard },
        { to: "/alarms", icon: <BellRing size={14} />, label: zhCN.appShell.navAlarms },
        { to: "/cold-station-logs", icon: <FileText size={14} />, label: zhCN.appShell.navColdStationLog },
        { to: "/operation-records", icon: <ClipboardList size={14} />, label: zhCN.appShell.navOperationRecords },
        { to: "/work-orders", icon: <Wrench size={14} />, label: zhCN.appShell.navWorkOrders }
      ]
    },
    {
      title: "诊断",
      items: [
        { to: "/system-overview", icon: <LayoutGrid size={14} />, label: zhCN.appShell.navSystemOverview },
        { to: "/devices", icon: <Cpu size={14} />, label: zhCN.appShell.navDevices },
        { to: "/scene-control", icon: <Box size={14} />, label: zhCN.appShell.navSceneControl },
        { to: "/environment-conditions", icon: <Wind size={14} />, label: zhCN.appShell.navEnvironment }
      ]
    },
    {
      title: "分析",
      items: [
        { to: "/trend-analysis", icon: <ChartColumnIncreasing size={14} />, label: zhCN.appShell.navTrendAnalysis },
        { to: "/energy-analysis", icon: <LineChart size={14} />, label: zhCN.appShell.navEnergyAnalysis },
        { to: "/energy-efficiency", icon: <FileText size={14} />, label: zhCN.appShell.navEnergyEfficiency },
        { to: "/meter-readings", icon: <FileText size={14} />, label: zhCN.appShell.navMeterReadings },
        { to: "/performance-report", icon: <FileText size={14} />, label: zhCN.appShell.navPerformanceReport },
        { to: "/report-records", icon: <FileText size={14} />, label: zhCN.appShell.navReportRecords }
      ]
    },
    {
      title: "配置与知识",
      items: [
        { to: "/energy-parameters", icon: <FileText size={14} />, label: zhCN.appShell.navEnergyParameters },
        { to: "/knowledge-base", icon: <BookOpen size={14} />, label: zhCN.appShell.navKnowledgeBase },
        { to: "/optimize-demo", icon: <Sparkles size={14} />, label: zhCN.appShell.navOptimizeDemo }
      ]
    }
  ];

  function handleLocaleChange(value: string) {
    if (value !== "zh-CN" && value !== "en-US" && value !== "vi-VN") {
      return;
    }
    if (value === locale) {
      return;
    }
    setCurrentLocale(value);
    window.location.reload();
  }

  useEffect(() => {
    setNowLabel(formatNowLabel(locale));
    const timer = window.setInterval(() => {
      setNowLabel(formatNowLabel(locale));
    }, 30 * 1000);
    return () => {
      window.clearInterval(timer);
    };
  }, [locale]);

  function handleSignOut() {
    clearAuthSession();
    navigate("/login", { replace: true });
  }

  function handleProjectChange(value: string) {
    if (!value || value === currentProject?.siteId || switchingProjectId) {
      return;
    }

    setSwitchingProjectId(value);
    const nextSession = selectAuthProject(value);
    if (!nextSession) {
      setSwitchingProjectId(null);
      return;
    }

    const nextPath = location.pathname === "/projects" ? "/dashboard" : `${location.pathname}${location.search}${location.hash}`;
    window.location.assign(nextPath);
  }

  return (
    <div className="app-shell">
      <aside className="left-nav">
        <div className="nav-brand">
          <p className="nav-eyebrow">{zhCN.appShell.title}</p>
          <h1>{currentProject?.siteName || zhCN.appShell.projectPending}</h1>
          <p className="nav-subtitle">
            {currentProject
              ? `${currentProject.siteCode ? `${currentProject.siteCode} · ` : ""}${currentProject.siteId}${currentProject.city ? ` · ${currentProject.city}` : ""}`
              : zhCN.projectSwitcher.pendingHint}
          </p>
          <div className="nav-status-row">
            <span className="nav-user-chip">{session?.username || zhCN.common.unknown}</span>
            {showRuntimeBadge ? (
              <span className="runtime-mode-chip">{runtimeConfig.appModeLabel}</span>
            ) : null}
            {runtimeConfig.readOnlyMode ? (
              <span className="runtime-mode-chip runtime-mode-chip-warn">{zhCN.runtimeMode.readOnlyBadge}</span>
            ) : null}
          </div>
        </div>
        <div className="nav-scroll">
          <nav className="nav-links">
            {navSections.map((section) => (
              <section key={section.title} className="nav-section">
                <p className="nav-section-label">{section.title}</p>
                <div className="nav-link-stack">
                  {section.items.map((item) => (
                    <NavLink key={item.to} to={item.to}>
                      {item.icon}
                      {item.label}
                    </NavLink>
                  ))}
                </div>
              </section>
            ))}
          </nav>
        </div>
        <button className="exit-link" type="button" onClick={handleSignOut}>
          <LogOut size={14} /> {zhCN.appShell.signOut}
        </button>
      </aside>
      <main>
        <header className="top-bar">
          <div className="top-left">
            <div className="top-heading">
              <strong>{currentProject?.siteName || zhCN.appShell.projectPending}</strong>
              <span>
                {currentProject
                  ? `${zhCN.appShell.projectLabel} · ${currentProject.siteId}`
                  : zhCN.projectSwitcher.pendingHint}
              </span>
            </div>
            <StatusPill
              label={currentProject ? zhCN.appShell.optimizationRunning : zhCN.appShell.projectPending}
              tone={currentProject ? "good" : "neutral"}
            />
            {showRuntimeBadge ? <StatusPill label={runtimeConfig.appModeLabel} tone="warn" /> : null}
            {runtimeConfig.readOnlyMode ? <StatusPill label={zhCN.runtimeMode.readOnlyBadge} tone="warn" /> : null}
          </div>
          <div className="top-right">
            {availableProjects.length > 1 ? (
              <label className="project-switcher">
                {zhCN.appShell.projectLabel}
                <select
                  value={currentProject?.siteId || ""}
                  onChange={(event) => handleProjectChange(event.target.value)}
                  disabled={Boolean(switchingProjectId)}
                >
                  {!currentProject ? (
                    <option value="">{zhCN.appShell.projectSelectPlaceholder}</option>
                  ) : null}
                  {availableProjects.map((project) => (
                    <option key={project.siteId} value={project.siteId}>
                      {formatProjectOptionLabel(project.siteName, project.siteCode)}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <span className="top-user">
              {zhCN.appShell.currentUserPrefix}
              {session?.username || zhCN.common.unknown}
            </span>
            <span className="top-time" title={nowLabel}>{nowLabel}</span>
            <label className="locale-switcher">
              {zhCN.appShell.languageLabel}
              <select value={locale} onChange={(event) => handleLocaleChange(event.target.value)}>
                {localeOptions.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </header>
        <div className="content">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
