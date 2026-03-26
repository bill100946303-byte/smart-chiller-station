import { useEffect } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import AppShell from "./layout/AppShell";
import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import SystemOverviewPage from "./pages/SystemOverviewPage";
import TrendAnalysisPage from "./pages/TrendAnalysisPage";
import AlarmPage from "./pages/AlarmPage";
import ColdStationLogPage from "./pages/ColdStationLogPage";
import DeviceOverviewPage from "./pages/DeviceOverviewPage";
import EnergyAnalysisPage from "./pages/EnergyAnalysisPage";
import EnergyEfficiencyPage from "./pages/EnergyEfficiencyPage";
import EnergyParametersPage from "./pages/EnergyParametersPage";
import MeterReadingPage from "./pages/MeterReadingPage";
import OperationRecordsPage from "./pages/OperationRecordsPage";
import PerformanceReportPage from "./pages/PerformanceReportPage";
import ReportRecordsPage from "./pages/ReportRecordsPage";
import OptimizeDemoPage from "./pages/OptimizeDemoPage";
import SceneControlPage from "./pages/SceneControlPage";
import VideoLegacyPage from "./pages/VideoLegacyPage";
import KnowledgeBasePage from "./pages/KnowledgeBasePage";
import WorkOrdersPage from "./pages/WorkOrdersPage";
import EnvironmentConditionsPage from "./pages/EnvironmentConditionsPage";
import ProjectSelectionPage from "./pages/ProjectSelectionPage";
import { getAuthSession, resolveAuthDestination } from "./services/auth";

function ExternalRedirect({ to }: { to: string }) {
  useEffect(() => {
    window.location.replace(to);
  }, [to]);

  return <div>正在跳转旧系统...</div>;
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
  return <Navigate to={`${to}${nextSearch ? `?${nextSearch}` : ""}${location.hash}`} replace />;
}

function ProtectedShell() {
  const location = useLocation();
  const session = getAuthSession();

  if (!session) {
    const redirect = `${location.pathname}${location.search}${location.hash}`;
    return <Navigate to={`/login?redirect=${encodeURIComponent(redirect)}`} replace />;
  }

  const destination = resolveAuthDestination(session, `${location.pathname}${location.search}${location.hash}`);
  if (destination.kind === "external") {
    return <ExternalRedirect to={destination.path} />;
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
      return <ExternalRedirect to={destination.path} />;
    }
    return <Navigate to={destination.path} replace />;
  }
  return <LoginPage />;
}

function RootEntry() {
  const session = getAuthSession();
  if (!session) {
    return <Navigate to="/login" replace />;
  }

  const destination = resolveAuthDestination(session);
  if (destination.kind === "external") {
    return <ExternalRedirect to={destination.path} />;
  }
  return <Navigate to={destination.path} replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginEntry />} />
      <Route element={<ProtectedShell />}>
        <Route path="/projects" element={<ProjectSelectionPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/trend-analysis" element={<TrendAnalysisPage />} />
        <Route path="/cold-station-logs" element={<ColdStationLogPage />} />
        <Route path="/operation-records" element={<OperationRecordsPage />} />
        <Route path="/energy-analysis" element={<EnergyAnalysisPage />} />
        <Route path="/energy-efficiency" element={<EnergyEfficiencyPage />} />
        <Route path="/energy-parameters" element={<EnergyParametersPage />} />
        <Route path="/meter-readings" element={<MeterReadingPage />} />
        <Route path="/performance-report" element={<PerformanceReportPage />} />
        <Route path="/report-records" element={<ReportRecordsPage />} />
        <Route path="/knowledge-base" element={<KnowledgeBasePage />} />
        <Route path="/work-orders" element={<WorkOrdersPage />} />
        <Route path="/environment-conditions" element={<EnvironmentConditionsPage />} />
        <Route path="/alarms" element={<AlarmPage />} />
        <Route path="/devices" element={<DeviceOverviewPage />} />
        <Route path="/optimize-demo" element={<OptimizeDemoPage />} />
        <Route path="/scene-control" element={<SceneControlPage />} />
        <Route path="/video-monitor" element={<VideoLegacyPage />} />
        <Route path="/system-overview" element={<SystemOverviewPage />} />
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
