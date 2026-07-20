import { RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import SectionCard from "../components/common/SectionCard";
import StatusPill from "../components/common/StatusPill";
import { getAdminSession } from "../services/adminAuth";
import { listAdminAuditLogs, type AdminAuditLog } from "../services/adminClient";

function safeJson(value?: string): string {
  if (!value) {
    return "";
  }
  try {
    return JSON.stringify(JSON.parse(value), null, 2);
  } catch {
    return value;
  }
}

export default function AuditLogsPage() {
  const session = getAdminSession();
  const [loading, setLoading] = useState(true);
  const [errorText, setErrorText] = useState("");
  const [logs, setLogs] = useState<AdminAuditLog[]>([]);
  const [siteId, setSiteId] = useState("");
  const [action, setAction] = useState("");
  const [keyword, setKeyword] = useState("");

  async function loadLogs() {
    if (!session) {
      return;
    }
    setLoading(true);
    setErrorText("");
    try {
      const items = await listAdminAuditLogs(session.token, session.userId, {
        siteId: siteId.trim() || undefined,
        action: action.trim() || undefined,
        keyword: keyword.trim() || undefined
      });
      setLogs(items);
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : "审计日志加载失败");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.token]);

  return (
    <div className="admin-page-stack">
      <SectionCard
        title="审计日志"
        action={
          <div className="admin-actions">
            <button className="admin-button" type="button" onClick={() => void loadLogs()}>
              <RefreshCw size={14} />
              刷新
            </button>
          </div>
        }
      >
        <div className="admin-section-stack">
          <div className="admin-hero-panel">
            <p className="admin-eyebrow">Audit Trail</p>
            <h2>所有管理操作都会记录下来</h2>
            <p>这里可以快速检索站点配置、成员绑定和权限修改的历史记录。</p>
          </div>

          <div className="admin-actions">
            <label className="admin-toolbar-field">
              <span>siteId</span>
              <input value={siteId} onChange={(event) => setSiteId(event.target.value)} placeholder="126lnoffice" />
            </label>
            <label className="admin-toolbar-field">
              <span>action</span>
              <input value={action} onChange={(event) => setAction(event.target.value)} placeholder="update_site" />
            </label>
            <label className="admin-toolbar-field">
              <span>keyword</span>
              <input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="王工 / source_config / audit" />
            </label>
            <button className="admin-button is-primary" type="button" onClick={() => void loadLogs()}>
              查询
            </button>
          </div>

          {errorText ? <p className="admin-error">{errorText}</p> : null}

          {loading ? (
            <div className="admin-loading-grid">
              <div className="admin-skeleton" />
              <div className="admin-skeleton" />
              <div className="admin-skeleton" />
              <div className="admin-skeleton" />
            </div>
          ) : logs.length > 0 ? (
            <div className="admin-table-shell" role="region" aria-label="审计日志表，可横向滚动查看更多字段" tabIndex={0}>
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>时间</th>
                    <th>操作者</th>
                    <th>动作</th>
                    <th>目标</th>
                    <th>请求 ID</th>
                    <th>详情</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log.id}>
                      <td>{log.ts}</td>
                      <td>{log.actor}</td>
                      <td>
                        <StatusPill label={log.action} tone="neutral" />
                      </td>
                      <td>
                        <div>{log.targetType}</div>
                        <div className="admin-table-cell-muted">{log.targetId}</div>
                      </td>
                      <td className="admin-table-cell-muted">{log.requestId}</td>
                      <td>
                        <details>
                          <summary>展开</summary>
                          {log.beforeJson ? (
                            <>
                              <p className="admin-note">before</p>
                              <pre className="admin-json">{safeJson(log.beforeJson)}</pre>
                            </>
                          ) : null}
                          {log.afterJson ? (
                            <>
                              <p className="admin-note">after</p>
                              <pre className="admin-json">{safeJson(log.afterJson)}</pre>
                            </>
                          ) : null}
                          {log.details ? <pre className="admin-json">{log.details}</pre> : null}
                        </details>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="admin-empty-state">暂无审计数据。</div>
          )}
        </div>
      </SectionCard>
    </div>
  );
}
