import { useState, type FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { runtimeConfig } from "../config/runtimeConfig";
import { completeAdminLogin, loginWithLegacy, resolveAdminDestination } from "../services/adminAuth";

export default function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorText, setErrorText] = useState("");
  const sessionExpired = searchParams.get("reason") === "expired";

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!username || !password || submitting) {
      return;
    }

    setSubmitting(true);
    setErrorText("");
    try {
      const loginResult = await loginWithLegacy(username, password);
      const session = await completeAdminLogin(loginResult);
      const destination = resolveAdminDestination(session, searchParams.get("redirect"));

      if (destination.kind === "external") {
        window.location.replace(destination.path);
        return;
      }

      navigate(destination.path, { replace: true });
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : "登录失败");
    } finally {
      setSubmitting(false);
    }
  }

  const showRuntimeNotice = runtimeConfig.appMode !== "local" || runtimeConfig.readOnlyMode || runtimeConfig.useMockData;
  const runtimeNoticeDetail = runtimeConfig.useMockData
    ? "当前使用显式本地 MOCK，只用于联调页面和表单，不读取或写入真实配置库。"
    : runtimeConfig.readOnlyMode
      ? "当前连接管理接口但写入总闸保持关闭；可核验站点、权限和真实清单，不会提交配置变更。"
      : "当前运行环境会读取真实管理接口；所有写入仍需通过站点权限和服务端安全门禁。";

  return (
    <div className="admin-login-page">
      <div className="admin-login-shell">
        <section className="admin-login-visual">
          <div>
            <p className="admin-eyebrow">Multi-project control center</p>
            <h1>把站点配置、权限和审计收拢到一个后台里</h1>
            <p className="admin-copy">
              这个后台专门面向项目运维。它复用 legacy 登录，但把站点、成员、接入配置和运行参数分开管理，适合多项目逐步扩展。
            </p>
            <div className="admin-chip-row" style={{ marginTop: 16 }}>
              <span className="admin-chip neutral">站点管理</span>
              <span className="admin-chip neutral">成员权限</span>
              <span className="admin-chip neutral">运行配置</span>
              <span className="admin-chip neutral">审计日志</span>
            </div>
          </div>

          <div className="admin-login-cards">
            <article className="admin-login-stat">
              <span>默认入口</span>
              <strong>/sites</strong>
            </article>
            <article className="admin-login-stat">
              <span>站点模型</span>
              <strong>siteId</strong>
            </article>
            <article className="admin-login-stat">
              <span>首登策略</span>
              <strong>auto import</strong>
            </article>
            <article className="admin-login-stat">
              <span>只读保护</span>
              <strong>enabled</strong>
            </article>
          </div>
        </section>

        <section className="admin-login-card">
          <div className="admin-hero">
            <p className="admin-eyebrow">Admin Login</p>
            <h2 className="admin-title">登录后台</h2>
            <p className="admin-copy">输入 legacy 账号密码后，系统会自动调用 `/admin/v1/me` 完成后台权限初始化。</p>
          </div>

          {showRuntimeNotice ? (
            <div className="admin-banner warn">
              <div>
                {runtimeConfig.appModeLabel}
                {runtimeConfig.readOnlyMode ? " · 只读模式已开启" : ""}
                {runtimeConfig.useMockData ? " · 已启用本地 mock 回退" : ""}
              </div>
              <div className="admin-banner-detail">{runtimeNoticeDetail}</div>
            </div>
          ) : null}

          {sessionExpired ? (
            <div className="admin-banner warn" role="alert">
              <div>登录凭证已失效</div>
              <div className="admin-banner-detail">已清除本地会话，请重新登录后继续原页面。</div>
            </div>
          ) : null}

          <form className="admin-login-form" onSubmit={handleSubmit}>
            <label className="admin-field">
              <span>用户名</span>
              <input autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} />
            </label>
            <label className="admin-field">
              <span>密码</span>
              <input
                autoComplete="current-password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="请输入 legacy 密码"
              />
            </label>
            <div className="admin-actions">
              <button className="admin-button is-primary" type="submit" disabled={submitting}>
                {submitting ? "登录中..." : "进入后台"}
              </button>
            </div>
          </form>

          {errorText ? <p className="admin-error">{errorText}</p> : null}
          <p className="admin-note">
            默认环境变量请查看 `.env.example`。如果你还没接后端，打开 `VITE_ADMIN_USE_MOCKS=true` 可以直接使用本地 mock 数据。
          </p>
        </section>
      </div>
    </div>
  );
}
