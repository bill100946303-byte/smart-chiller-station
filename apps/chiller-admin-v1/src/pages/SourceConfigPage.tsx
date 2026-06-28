import { ArrowLeft, RefreshCw, Save } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import SectionCard from "../components/common/SectionCard";
import StatusPill from "../components/common/StatusPill";
import { getAdminSession } from "../services/adminAuth";
import {
  getAdminSourceConfigBundle,
  getAdminSite,
  updateAdminSourceConfigBundle,
  type AdminSiteDetail,
  type AdminEffectiveSourceConfig,
  type AdminSourceConfig
} from "../services/adminClient";

type SourceFormState = AdminSourceConfig;

const emptyFormState: SourceFormState = {
  legacyBaseUrl: "",
  ipAddress: "",
  port: "",
  databaseKey: "",
  modelKey: "",
  preferredProjectKey: "",
  template: "",
  controlMode: "",
  status: "connected",
  note: ""
};

function formatDefaultDeviceQuery(config: AdminEffectiveSourceConfig | null): string {
  const query = config?.defaultDeviceQuery;
  if (!query) {
    return "未配置";
  }
  const parts = [];
  if (typeof query.build === "number") {
    parts.push(`build=${query.build}`);
  }
  if (typeof query.floor === "number") {
    parts.push(`floor=${query.floor}`);
  }
  if (typeof query.mock === "boolean") {
    parts.push(`mock=${query.mock ? 1 : 0}`);
  }
  return parts.length > 0 ? parts.join(", ") : "未配置";
}

export default function SourceConfigPage() {
  const navigate = useNavigate();
  const { siteId = "" } = useParams();
  const session = getAdminSession();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorText, setErrorText] = useState("");
  const [site, setSite] = useState<AdminSiteDetail | null>(null);
  const [formState, setFormState] = useState<SourceFormState>(emptyFormState);
  const [effectiveSourceConfig, setEffectiveSourceConfig] = useState<AdminEffectiveSourceConfig | null>(null);

  async function loadData() {
    if (!session || !siteId) {
      return;
    }
    setLoading(true);
    setErrorText("");
    try {
      const [siteRecord, sourceBundle] = await Promise.all([
        getAdminSite(session.token, session.userId, siteId),
        getAdminSourceConfigBundle(session.token, session.userId, siteId)
      ]);
      setSite(siteRecord);
      setFormState(sourceBundle.sourceConfig);
      setEffectiveSourceConfig(sourceBundle.effectiveSourceConfig);
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : "接入配置加载失败");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.token, siteId]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session || !siteId || saving) {
      return;
    }
    setSaving(true);
    setErrorText("");
    try {
      const updatedBundle = await updateAdminSourceConfigBundle(session.token, session.userId, siteId, {
        legacyBaseUrl: formState.legacyBaseUrl.trim(),
        ipAddress: formState.ipAddress.trim(),
        port: formState.port.trim(),
        databaseKey: formState.databaseKey.trim(),
        modelKey: formState.modelKey.trim(),
        preferredProjectKey: formState.preferredProjectKey.trim(),
        template: formState.template.trim(),
        controlMode: formState.controlMode.trim(),
        status: formState.status.trim(),
        note: formState.note.trim()
      });
      setFormState(updatedBundle.sourceConfig);
      setEffectiveSourceConfig(updatedBundle.effectiveSourceConfig);
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : "保存接入配置失败");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="admin-page-stack">
      <SectionCard
        title="站点接入配置"
        action={
          <div className="admin-actions">
            <button className="admin-button" type="button" onClick={() => navigate(`/sites/${encodeURIComponent(siteId)}`)}>
              <ArrowLeft size={14} />
              返回详情
            </button>
            <button className="admin-button" type="button" onClick={() => void loadData()}>
              <RefreshCw size={14} />
              刷新
            </button>
          </div>
        }
      >
        {loading ? (
          <div className="admin-loading-grid">
            <div className="admin-skeleton" />
            <div className="admin-skeleton" />
          </div>
        ) : (
          <div className="admin-section-stack">
            <div className="admin-chip-row">
              <StatusPill label={site?.siteName || siteId} tone="good" />
              <StatusPill label={site?.status || "active"} tone="neutral" />
            </div>
            <p className="admin-note">
              这里的 `legacyBaseUrl` 会优先影响该站点的业务上游地址。`preferredProjectKey` 用于显式指定稳定可用的 legacy 项目标识，优先级高于 `databaseKey/modelKey`。
            </p>
            <div className="admin-detail-grid">
              <SectionCard title="生效设备数据接口">
                <dl className="admin-kv">
                  <div className="admin-kv-row">
                    <dt>deviceDataProjectKey</dt>
                    <dd>{effectiveSourceConfig?.deviceDataProjectKey || "未命中内置项目接口"}</dd>
                  </div>
                  <div className="admin-kv-row">
                    <dt>defaultDeviceQuery</dt>
                    <dd>{formatDefaultDeviceQuery(effectiveSourceConfig)}</dd>
                  </div>
                </dl>
                <p className="admin-note" style={{ marginTop: 12 }}>
                  这一块是系统按 `sourceConfig + 内置项目接口注册表` 计算出来的只读结果，不直接参与保存。
                </p>
                {effectiveSourceConfig?.deviceDataInterfaces?.length ? (
                  <div className="admin-table-shell" style={{ marginTop: 12 }}>
                    <table className="admin-table">
                      <thead>
                        <tr>
                          <th>标签</th>
                          <th>接口类型</th>
                          <th>默认参数</th>
                          <th>接口路径</th>
                        </tr>
                      </thead>
                      <tbody>
                        {effectiveSourceConfig.deviceDataInterfaces.map((item) => (
                          <tr key={`${item.projectKey}:${item.label}:${item.endpoint}`}>
                            <td>{item.label}</td>
                            <td>{item.endpointKind}</td>
                            <td>
                              {[
                                typeof item.build === "number" ? `build=${item.build}` : "",
                                typeof item.floor === "number" ? `floor=${item.floor}` : "",
                                typeof item.mock === "boolean" ? `mock=${item.mock ? 1 : 0}` : ""
                              ].filter(Boolean).join(", ") || "无"}
                            </td>
                            <td>
                              <code>{item.endpoint}</code>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="admin-empty-state" style={{ marginTop: 12 }}>
                    当前站点没有命中内置设备数据接口注册表。
                  </div>
                )}
              </SectionCard>
            </div>

            {errorText ? <p className="admin-error">{errorText}</p> : null}

            <form className="admin-form" onSubmit={handleSubmit}>
              <div className="admin-form-grid">
                <label className="admin-field">
                  <span>legacyBaseUrl</span>
                  <input value={formState.legacyBaseUrl} onChange={(event) => setFormState((current) => ({ ...current, legacyBaseUrl: event.target.value }))} />
                </label>
                <label className="admin-field">
                  <span>ipAddress</span>
                  <input value={formState.ipAddress} onChange={(event) => setFormState((current) => ({ ...current, ipAddress: event.target.value }))} />
                </label>
                <label className="admin-field">
                  <span>port</span>
                  <input value={formState.port} onChange={(event) => setFormState((current) => ({ ...current, port: event.target.value }))} />
                </label>
                <label className="admin-field">
                  <span>databaseKey</span>
                  <input value={formState.databaseKey} onChange={(event) => setFormState((current) => ({ ...current, databaseKey: event.target.value }))} />
                </label>
                <label className="admin-field">
                  <span>modelKey</span>
                  <input value={formState.modelKey} onChange={(event) => setFormState((current) => ({ ...current, modelKey: event.target.value }))} />
                </label>
                <label className="admin-field">
                  <span>preferredProjectKey</span>
                  <input
                    value={formState.preferredProjectKey}
                    onChange={(event) =>
                      setFormState((current) => ({ ...current, preferredProjectKey: event.target.value }))
                    }
                  />
                </label>
                <label className="admin-field">
                  <span>template</span>
                  <input value={formState.template} onChange={(event) => setFormState((current) => ({ ...current, template: event.target.value }))} />
                </label>
                <label className="admin-field">
                  <span>controlMode</span>
                  <input value={formState.controlMode} onChange={(event) => setFormState((current) => ({ ...current, controlMode: event.target.value }))} />
                </label>
                <label className="admin-field">
                  <span>status</span>
                  <input value={formState.status} onChange={(event) => setFormState((current) => ({ ...current, status: event.target.value }))} />
                </label>
                <label className="admin-field is-full">
                  <span>note</span>
                  <textarea value={formState.note} onChange={(event) => setFormState((current) => ({ ...current, note: event.target.value }))} />
                </label>
              </div>
              <div className="admin-form-actions">
                <button className="admin-button" type="button" onClick={() => navigate(`/sites/${encodeURIComponent(siteId)}`)}>
                  取消
                </button>
                <button className="admin-button is-primary" type="submit" disabled={saving}>
                  <Save size={14} />
                  {saving ? "保存中..." : "保存接入配置"}
                </button>
              </div>
            </form>
          </div>
        )}
      </SectionCard>
    </div>
  );
}
