import { useState, type FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { zhCN } from "../i18n/zhCN";
import { loginWithLegacy, resolveAuthDestination } from "../services/auth";

export default function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorText, setErrorText] = useState("");

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!username || !password || submitting) {
      return;
    }
    setSubmitting(true);
    setErrorText("");
    try {
      const session = await loginWithLegacy(username, password);
      const destination = resolveAuthDestination(session, searchParams.get("redirect"));

      if (destination.kind === "external") {
        window.location.replace(destination.path);
        return;
      }

      navigate(destination.path, { replace: true });
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : zhCN.login.errorFallback);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-overlay" />
      <div className="login-shell">
        <section className="login-intro">
          <p className="eyebrow">{zhCN.login.eyebrow}</p>
          <h1>{zhCN.login.heading}</h1>
          <p className="login-intro-copy">统一查看项目运行、设备状态与能效分析。</p>
          <p className="login-intro-copy">登录后会保留当前入口，并进入对应项目页面继续操作。</p>
          <div className="login-intro-grid">
            <article>
              <span>{zhCN.appShell.navDashboard}</span>
              <strong>{zhCN.dashboard.sectionRealtimeStatus}</strong>
            </article>
            <article>
              <span>{zhCN.appShell.navSystemOverview}</span>
              <strong>{zhCN.systemOverview.sectionTopology}</strong>
            </article>
            <article>
              <span>{zhCN.appShell.navTrendAnalysis}</span>
              <strong>{zhCN.dashboard.sectionTrend}</strong>
            </article>
          </div>
        </section>

        <section className="login-card">
          <h2>账号登录</h2>
          <form onSubmit={handleSubmit}>
            <label>
              {zhCN.login.username}
              <input
                autoComplete="username"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
              />
            </label>
            <label>
              {zhCN.login.password}
              <input
                autoComplete="current-password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder={zhCN.login.passwordPlaceholder}
              />
            </label>
            <button type="submit" disabled={submitting}>
              {submitting ? zhCN.login.submitting : zhCN.login.submit}
            </button>
          </form>
          {errorText ? <p className="login-error">{errorText}</p> : null}
          <p className="login-hint">适合远端联调和日常登录，默认会返回你刚才打开的页面。</p>
        </section>
      </div>
    </div>
  );
}
