import { useEffect } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import AdminShell from "./layout/AdminShell";
import { getAdminSession, resolveAdminDestination } from "./services/adminAuth";
import LoginPage from "./pages/LoginPage";
import SiteListPage from "./pages/SiteListPage";
import SiteDetailPage from "./pages/SiteDetailPage";
import SourceConfigPage from "./pages/SourceConfigPage";
import RuntimeConfigPage from "./pages/RuntimeConfigPage";
import SubsystemConfigPage from "./pages/SubsystemConfigPage";
import FcuWorkOrderDetailPage from "./pages/FcuWorkOrderDetailPage";
import MembersPage from "./pages/MembersPage";
import AuditLogsPage from "./pages/AuditLogsPage";
import StationRegistryPage from "./pages/StationRegistryPage";
import StationRuntimeBindingPage from "./pages/StationRuntimeBindingPage";

function ExternalRedirect({ to }: { to: string }) {
  useEffect(() => {
    window.location.replace(to);
  }, [to]);

  return <div>正在跳转...</div>;
}

function ProtectedShell() {
  const location = useLocation();
  const session = getAdminSession();
  if (!session) {
    const redirect = `${location.pathname}${location.search}${location.hash}`;
    return <Navigate to={`/login?redirect=${encodeURIComponent(redirect)}`} replace />;
  }
  return <AdminShell />;
}

function LoginEntry() {
  const location = useLocation();
  const session = getAdminSession();
  if (session) {
    const params = new URLSearchParams(location.search);
    const destination = resolveAdminDestination(session, params.get("redirect"));
    if (destination.kind === "external") {
      return <ExternalRedirect to={destination.path} />;
    }
    return <Navigate to={destination.path} replace />;
  }
  return <LoginPage />;
}

function RootEntry() {
  const session = getAdminSession();
  if (!session) {
    return <Navigate to="/login" replace />;
  }
  const destination = resolveAdminDestination(session);
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
        <Route path="/sites" element={<SiteListPage />} />
        <Route path="/sites/:siteId" element={<SiteDetailPage />} />
        <Route path="/sites/:siteId/source-config" element={<SourceConfigPage />} />
        <Route path="/sites/:siteId/runtime-config" element={<RuntimeConfigPage />} />
        <Route path="/sites/:siteId/subsystems" element={<SubsystemConfigPage />} />
        <Route path="/sites/:siteId/stations" element={<StationRegistryPage />} />
        <Route path="/sites/:siteId/stations/:stationId/runtime-binding" element={<StationRuntimeBindingPage />} />
        <Route path="/sites/:siteId/subsystems/fcu/:workOrderId" element={<FcuWorkOrderDetailPage />} />
        <Route path="/sites/:siteId/members" element={<MembersPage />} />
        <Route path="/audit-logs" element={<AuditLogsPage />} />
      </Route>
      <Route path="/" element={<RootEntry />} />
      <Route path="*" element={<RootEntry />} />
    </Routes>
  );
}
