import { Suspense, lazy, useEffect, useState, type ComponentType, type LazyExoticComponent, type ReactNode } from "react";
import { Route, Routes, useLocation } from "react-router-dom";
import { zhCN } from "./i18n/zhCN";
import AppShell from "./layout/AppShell";
import {
  clearAuthSession,
  getAuthSession,
  getCurrentProject,
  getSwitchableProjects,
  resolveAuthProjectId,
  resolveAuthDestination,
  selectAuthProject
} from "./services/auth";
import { buildScopedLocationPath, readSiteIdFromSearch } from "./services/siteRouting";

const LoginPage = lazy(() => import("./pages/LoginPage"));
const DashboardPage = lazy(() => import("./pages/DashboardPage"));
const SystemOverviewPage = lazy(() => import("./pages/SystemOverviewPage"));
const TrendAnalysisPage = lazy(() => import("./pages/TrendAnalysisPage"));
const AlarmPage = lazy(() => import("./pages/AlarmPage"));
const ColdStationLogPage = lazy(() => import("./pages/ColdStationLogPage"));
const DeviceOverviewPage = lazy(() => import("./pages/DeviceOverviewPage"));
const EnergyAnalysisPage = lazy(() => import("./pages/EnergyAnalysisPage"));
const EnergyEfficiencyPage = lazy(() => import("./pages/EnergyEfficiencyPage"));
const EnergyParametersPage = lazy(() => import("./pages/EnergyParametersPage"));
const MeterReadingPage = lazy(() => import("./pages/MeterReadingPage"));
const OperationRecordsPage = lazy(() => import("./pages/OperationRecordsPage"));
const PerformanceReportPage = lazy(() => import("./pages/PerformanceReportPage"));
const ReportRecordsPage = lazy(() => import("./pages/ReportRecordsPage"));
const AiOverviewPage = lazy(() => import("./pages/AiOverviewPage"));
const OptimizeDemoPage = lazy(() => import("./pages/OptimizeDemoPage"));
const OperationalDiagnosticsPage = lazy(() => import("./pages/OperationalDiagnosticsPage"));
const SceneControlPage = lazy(() => import("./pages/SceneControlPage"));
const VideoLegacyPage = lazy(() => import("./pages/VideoLegacyPage"));
const KnowledgeBasePage = lazy(() => import("./pages/KnowledgeBasePage"));
const WorkOrdersPage = lazy(() => import("./pages/WorkOrdersPage"));
const EnvironmentConditionsPage = lazy(() => import("./pages/EnvironmentConditionsPage"));
const ProjectSelectionPage = lazy(() => import("./pages/ProjectSelectionPage"));

type LazyPageComponent = LazyExoticComponent<ComponentType<object>>;
type RedirectHistoryEntry = {
  from: string;
  to: string;
  at: number;
};

const REDIRECT_HISTORY_STORAGE_KEY = "chiller-shell-route-redirect-history-v1";
const REDIRECT_HISTORY_WINDOW_MS = 1600;
const REDIRECT_HISTORY_LIMIT = 6;

function pruneRedirectHistory(entries: RedirectHistoryEntry[], now: number): RedirectHistoryEntry[] {
  return entries
    .filter((entry) => now - entry.at <= REDIRECT_HISTORY_WINDOW_MS)
    .slice(-REDIRECT_HISTORY_LIMIT);
}

function readRedirectHistory(now = Date.now()): RedirectHistoryEntry[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.sessionStorage.getItem(REDIRECT_HISTORY_STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw) as RedirectHistoryEntry[];
    if (!Array.isArray(parsed)) {
      return [];
    }
    return pruneRedirectHistory(
      parsed.filter(
        (entry) =>
          entry &&
          typeof entry.from === "string" &&
          typeof entry.to === "string" &&
          typeof entry.at === "number" &&
          Number.isFinite(entry.at)
      ),
      now
    );
  } catch {
    return [];
  }
}

function writeRedirectHistory(entries: RedirectHistoryEntry[]): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    if (entries.length === 0) {
      window.sessionStorage.removeItem(REDIRECT_HISTORY_STORAGE_KEY);
      return;
    }
    window.sessionStorage.setItem(REDIRECT_HISTORY_STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // Ignore sessionStorage failures and continue with best-effort redirect.
  }
}

function replaceDocumentLocation(
  to: string,
  options: {
    clearAuthOnLoop?: boolean;
    fallbackPath?: string;
  } = {}
): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  const currentUrl = new URL(window.location.href);
  const nextUrl = new URL(to, currentUrl);
  if (currentUrl.toString() === nextUrl.toString()) {
    return false;
  }

  if (currentUrl.origin === nextUrl.origin) {
    const now = Date.now();
    const redirectHistory = readRedirectHistory(now);
    const samePairCount = redirectHistory.filter(
      (entry) => entry.from === currentUrl.toString() && entry.to === nextUrl.toString()
    ).length;

    if (samePairCount >= 2 || redirectHistory.length >= REDIRECT_HISTORY_LIMIT) {
      writeRedirectHistory([]);
      if (options.clearAuthOnLoop) {
        clearAuthSession();
      }
      const fallbackUrl = new URL(options.fallbackPath || "/login", currentUrl);
      if (fallbackUrl.toString() !== currentUrl.toString()) {
        window.location.replace(fallbackUrl.toString());
        return true;
      }
      return false;
    }

    writeRedirectHistory(
      pruneRedirectHistory(
        [
          ...redirectHistory,
          {
            from: currentUrl.toString(),
            to: nextUrl.toString(),
            at: now
          }
        ],
        now
      )
    );
  }

  window.location.replace(nextUrl.toString());
  return true;
}

function RouteSuspense({ children }: { children: ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="page-route-fallback" role="status" aria-live="polite">
          <span className="page-route-fallback-spinner" aria-hidden="true" />
          <span>{zhCN.common.routeLoading}</span>
        </div>
      }
    >
      {children}
    </Suspense>
  );
}

function renderLazyPage(Page: LazyPageComponent) {
  return (
    <RouteSuspense>
      <Page />
    </RouteSuspense>
  );
}

function BrowserRedirect({
  to,
  label = "正在跳转...",
  clearAuthOnLoop = false
}: {
  to: string;
  label?: string;
  clearAuthOnLoop?: boolean;
}) {
  useEffect(() => {
    replaceDocumentLocation(to, {
      clearAuthOnLoop,
      fallbackPath: "/login"
    });
  }, [clearAuthOnLoop, to]);

  return <div>{label}</div>;
}

function LegacyPathRedirect({
  to,
  mergeQuery = {}
}: {
  to: string;
  mergeQuery?: Record<string, string | null | undefined>;
}) {
  const location = useLocation();
  const search = new URLSearchParams(location.search);
  Object.entries(mergeQuery).forEach(([key, value]) => {
    if (!value) {
      search.delete(key);
      return;
    }
    search.set(key, value);
  });
  const nextSearch = search.toString();
  return <BrowserRedirect to={`${to}${nextSearch ? `?${nextSearch}` : ""}${location.hash}`} />;
}

function ProtectedShell() {
  const location = useLocation();
  const [, forceProjectSyncRender] = useState(0);
  const session = getAuthSession();
  const requestedSiteId = readSiteIdFromSearch(location.search);
  const availableProjects = getSwitchableProjects(session?.projects || []);
  const currentProject = getCurrentProject(session);
  const requestedProject = requestedSiteId
    ? availableProjects.find((project) => project.siteId === requestedSiteId) || null
    : null;
  const currentPath = `${location.pathname}${location.search}${location.hash}`;
  const requestedProjectSyncNeeded = Boolean(
    requestedProject && requestedProject.siteId !== currentProject?.siteId
  );

  useEffect(() => {
    if (!session || !requestedProject || requestedProject.siteId === currentProject?.siteId) {
      return;
    }

    const nextSession = selectAuthProject(resolveAuthProjectId(requestedProject));
    if (!nextSession) {
      return;
    }

    const nextPath = buildScopedLocationPath(
      location.pathname,
      location.search,
      location.hash,
      requestedProject.siteId
    );

    if (nextPath !== currentPath) {
      replaceDocumentLocation(nextPath, {
        clearAuthOnLoop: true,
        fallbackPath: "/login"
      });
      return;
    }

    forceProjectSyncRender((current) => current + 1);
  }, [
    currentPath,
    currentProject?.siteId,
    location.hash,
    location.pathname,
    location.search,
    requestedProject?.siteId,
    requestedProject,
    session
  ]);

  if (!session) {
    return (
      <BrowserRedirect
        to={`/login?redirect=${encodeURIComponent(currentPath)}`}
        clearAuthOnLoop
      />
    );
  }

  if (requestedProjectSyncNeeded) {
    return null;
  }

  const destination = resolveAuthDestination(session, currentPath);
  if (destination.kind === "external") {
    return <BrowserRedirect to={destination.path} label="正在跳转旧系统..." />;
  }

  if (currentProject) {
    const scopedPath = buildScopedLocationPath(location.pathname, location.search, location.hash, currentProject.siteId);
    if (scopedPath !== currentPath) {
      return <BrowserRedirect to={scopedPath} clearAuthOnLoop />;
    }
  }

  return <AppShell />;
}

function LoginEntry() {
  const location = useLocation();
  const session = getAuthSession();

  if (session) {
    const params = new URLSearchParams(location.search);
    const destination = resolveAuthDestination(session, params.get("redirect"));
    if (destination.kind === "external") {
      return <BrowserRedirect to={destination.path} label="正在跳转旧系统..." />;
    }
    return <BrowserRedirect to={destination.path} clearAuthOnLoop />;
  }
  return renderLazyPage(LoginPage);
}

function RootEntry() {
  const session = getAuthSession();
  if (!session) {
    return <BrowserRedirect to="/login" clearAuthOnLoop />;
  }

  const destination = resolveAuthDestination(session);
  if (destination.kind === "external") {
    return <BrowserRedirect to={destination.path} label="正在跳转旧系统..." />;
  }
  return <BrowserRedirect to={destination.path} clearAuthOnLoop />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginEntry />} />
      <Route element={<ProtectedShell />}>
        <Route path="/projects" element={renderLazyPage(ProjectSelectionPage)} />
        <Route path="/dashboard" element={renderLazyPage(DashboardPage)} />
        <Route path="/trend-analysis" element={renderLazyPage(TrendAnalysisPage)} />
        <Route path="/cold-station-logs" element={renderLazyPage(ColdStationLogPage)} />
        <Route path="/operation-records" element={renderLazyPage(OperationRecordsPage)} />
        <Route path="/energy-analysis" element={renderLazyPage(EnergyAnalysisPage)} />
        <Route path="/energy-efficiency" element={renderLazyPage(EnergyEfficiencyPage)} />
        <Route path="/energy-parameters" element={renderLazyPage(EnergyParametersPage)} />
        <Route path="/meter-readings" element={renderLazyPage(MeterReadingPage)} />
        <Route path="/performance-report" element={renderLazyPage(PerformanceReportPage)} />
        <Route path="/report-records" element={renderLazyPage(ReportRecordsPage)} />
        <Route path="/knowledge-base" element={renderLazyPage(KnowledgeBasePage)} />
        <Route path="/work-orders" element={renderLazyPage(WorkOrdersPage)} />
        <Route path="/environment-conditions" element={renderLazyPage(EnvironmentConditionsPage)} />
        <Route path="/alarms" element={renderLazyPage(AlarmPage)} />
        <Route path="/devices" element={renderLazyPage(DeviceOverviewPage)} />
        <Route path="/operational-diagnostics" element={renderLazyPage(OperationalDiagnosticsPage)} />
        <Route path="/ai-overview" element={renderLazyPage(AiOverviewPage)} />
        <Route path="/optimize-demo" element={renderLazyPage(OptimizeDemoPage)} />
        <Route path="/scene-control" element={renderLazyPage(SceneControlPage)} />
        <Route path="/video-monitor" element={renderLazyPage(VideoLegacyPage)} />
        <Route path="/system-overview" element={renderLazyPage(SystemOverviewPage)} />
        <Route path="/systemhomepage" element={<LegacyPathRedirect to="/dashboard" />} />
        <Route path="/defaultpage" element={<LegacyPathRedirect to="/scene-control" />} />
        <Route path="/totalalarm" element={<LegacyPathRedirect to="/alarms" />} />
        <Route path="/alertrun" element={<LegacyPathRedirect to="/alarms" />} />
        <Route path="/alertrun/index" element={<LegacyPathRedirect to="/alarms" />} />
        <Route path="/dataDetails" element={<LegacyPathRedirect to="/trend-analysis" />} />
        <Route path="/dataDetails/index" element={<LegacyPathRedirect to="/trend-analysis" />} />
        <Route path="/logrizi" element={<LegacyPathRedirect to="/cold-station-logs" />} />
        <Route path="/logrizi/index" element={<LegacyPathRedirect to="/cold-station-logs" />} />
        <Route path="/operationRecords" element={<LegacyPathRedirect to="/operation-records" />} />
        <Route path="/operationRecords/index" element={<LegacyPathRedirect to="/operation-records" />} />
        <Route path="/consumption" element={<LegacyPathRedirect to="/energy-analysis" />} />
        <Route path="/consumption/index" element={<LegacyPathRedirect to="/energy-analysis" />} />
        <Route path="/energy-test" element={<LegacyPathRedirect to="/energy-efficiency" />} />
        <Route path="/energy-test/index" element={<LegacyPathRedirect to="/energy-efficiency" />} />
        <Route path="/params" element={<LegacyPathRedirect to="/energy-parameters" />} />
        <Route path="/params/index" element={<LegacyPathRedirect to="/energy-parameters" />} />
        <Route path="/meteringInstrument" element={<LegacyPathRedirect to="/meter-readings" />} />
        <Route path="/meteringInstrument/index" element={<LegacyPathRedirect to="/meter-readings" />} />
        <Route path="/PerformanceReport" element={<LegacyPathRedirect to="/performance-report" />} />
        <Route path="/PerformanceReport/index" element={<LegacyPathRedirect to="/performance-report" />} />
        <Route path="/report" element={<LegacyPathRedirect to="/report-records" />} />
        <Route path="/report/index" element={<LegacyPathRedirect to="/report-records" />} />
        <Route
          path="/front/dialog"
          element={<LegacyPathRedirect to="/scene-control" mergeQuery={{ legacyView: "dialog" }} />}
        />
        <Route
          path="/front/online"
          element={<LegacyPathRedirect to="/scene-control" mergeQuery={{ legacyView: "online" }} />}
        />
        <Route
          path="/systemhomepage/components/side/video"
          element={<LegacyPathRedirect to="/video-monitor" />}
        />
        <Route path="/environment" element={<LegacyPathRedirect to="/environment-conditions" />} />
        <Route path="/environment/index" element={<LegacyPathRedirect to="/environment-conditions" />} />
        <Route path="/knowlege" element={<LegacyPathRedirect to="/knowledge-base" />} />
        <Route path="/knowlege/index" element={<LegacyPathRedirect to="/knowledge-base" />} />
        <Route path="/work" element={<LegacyPathRedirect to="/work-orders" />} />
        <Route path="/work/index" element={<LegacyPathRedirect to="/work-orders" />} />
      </Route>
      <Route path="/" element={<RootEntry />} />
      <Route path="*" element={<RootEntry />} />
    </Routes>
  );
}
