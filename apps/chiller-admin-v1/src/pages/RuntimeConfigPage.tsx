import { ArrowLeft, RefreshCw, Save } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import SectionCard from "../components/common/SectionCard";
import StatusPill from "../components/common/StatusPill";
import { getAdminSession } from "../services/adminAuth";
import {
  getAdminRuntimeConfig,
  getAdminSite,
  updateAdminRuntimeConfig,
  type AdminRuntimeConfig,
  type AdminSiteDetail
} from "../services/adminClient";

type RuntimeFormState = AdminRuntimeConfig;

const emptyRuntimeState: RuntimeFormState = {
  energyParamsJson: "{}",
  ruleThresholdsJson: "{}",
  featureFlagsJson: "{}",
  version: "",
  updatedAt: "",
  updatedBy: ""
};

function normalizeJson(value: string): string {
  if (!value.trim()) {
    return "{}";
  }
  return JSON.stringify(JSON.parse(value), null, 2);
}

function parseJsonObject(value: string): Record<string, unknown> | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return {};
  }
  try {
    const parsed = JSON.parse(trimmed);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return null;
    }
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

function readTowerApproachMinCondenserInletTempC(ruleThresholdsJson: string): string {
  const parsed = parseJsonObject(ruleThresholdsJson);
  const towerApproach =
    parsed?.towerApproach && typeof parsed.towerApproach === "object" && !Array.isArray(parsed.towerApproach)
      ? (parsed.towerApproach as Record<string, unknown>)
      : null;
  const value = towerApproach?.minCondenserInletTempC;
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }
  return "";
}

function upsertTowerApproachMinCondenserInletTempC(ruleThresholdsJson: string, rawValue: string): string {
  const parsed = parseJsonObject(ruleThresholdsJson);
  if (!parsed) {
    throw new Error("ruleThresholdsJson 不是合法 JSON，对结构化阈值的编辑已暂停。");
  }

  const next = { ...parsed };
  const existingTowerApproach =
    next.towerApproach && typeof next.towerApproach === "object" && !Array.isArray(next.towerApproach)
      ? { ...(next.towerApproach as Record<string, unknown>) }
      : {};
  const trimmed = rawValue.trim();

  if (!trimmed) {
    delete existingTowerApproach.minCondenserInletTempC;
  } else {
    const parsedNumber = Number(trimmed);
    if (!Number.isFinite(parsedNumber) || parsedNumber <= 0) {
      throw new Error("最低冷凝器进水温必须是大于 0 的数字。");
    }
    existingTowerApproach.minCondenserInletTempC = parsedNumber;
  }

  if (Object.keys(existingTowerApproach).length > 0) {
    next.towerApproach = existingTowerApproach;
  } else {
    delete next.towerApproach;
  }

  return JSON.stringify(next, null, 2);
}

export default function RuntimeConfigPage() {
  const navigate = useNavigate();
  const { siteId = "" } = useParams();
  const session = getAdminSession();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorText, setErrorText] = useState("");
  const [site, setSite] = useState<AdminSiteDetail | null>(null);
  const [formState, setFormState] = useState<RuntimeFormState>(emptyRuntimeState);
  const [towerApproachMinInput, setTowerApproachMinInput] = useState("");

  async function loadData() {
    if (!session || !siteId) {
      return;
    }
    setLoading(true);
    setErrorText("");
    try {
      const [siteRecord, runtimeRecord] = await Promise.all([
        getAdminSite(session.token, session.userId, siteId),
        getAdminRuntimeConfig(session.token, session.userId, siteId)
      ]);
      setSite(siteRecord);
      setFormState(runtimeRecord);
      setTowerApproachMinInput(readTowerApproachMinCondenserInletTempC(runtimeRecord.ruleThresholdsJson || "{}"));
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : "运行配置加载失败");
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
      const normalizedEnergyParamsJson = normalizeJson(formState.energyParamsJson);
      const normalizedRuleThresholdsJson = normalizeJson(formState.ruleThresholdsJson);
      const normalizedFeatureFlagsJson = normalizeJson(formState.featureFlagsJson);
      const updated = await updateAdminRuntimeConfig(session.token, session.userId, siteId, {
        energyParamsJson: normalizedEnergyParamsJson,
        ruleThresholdsJson: normalizedRuleThresholdsJson,
        featureFlagsJson: normalizedFeatureFlagsJson
      });
      setFormState(updated);
      setTowerApproachMinInput(readTowerApproachMinCondenserInletTempC(updated.ruleThresholdsJson || "{}"));
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : "保存运行配置失败");
    } finally {
      setSaving(false);
    }
  }

  function handleApplyTowerApproachThreshold() {
    try {
      const nextRuleThresholdsJson = upsertTowerApproachMinCondenserInletTempC(
        formState.ruleThresholdsJson || "{}",
        towerApproachMinInput
      );
      setFormState((current) => ({
        ...current,
        ruleThresholdsJson: nextRuleThresholdsJson
      }));
      setErrorText("");
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : "接近度阈值写入失败");
    }
  }

  const ruleThresholdsValid = parseJsonObject(formState.ruleThresholdsJson || "{}") !== null;
  const towerApproachThresholdState = !ruleThresholdsValid
    ? { label: "ruleThresholdsJson 待修正", tone: "danger" as const }
    : towerApproachMinInput.trim()
      ? { label: "接近度阈值已写入", tone: "good" as const }
      : { label: "接近度阈值未设置", tone: "warn" as const };

  return (
    <div className="admin-page-stack">
      <SectionCard
        title="站点运行配置"
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
              <StatusPill label={formState.version || "v1"} tone="neutral" />
            </div>
            <p className="admin-note">
              运行参数仍以 JSON 为权威来源；这里额外提供接近度阈值助手，便于把
              `ruleThresholds.towerApproach.minCondenserInletTempC` 正确写入 live 配置。
            </p>

            {errorText ? <p className="admin-error">{errorText}</p> : null}

            <form className="admin-form" onSubmit={handleSubmit}>
              <div className="admin-detail-card">
                <h4>接近度阈值助手</h4>
                <div className="admin-chip-row" style={{ marginTop: 12, marginBottom: 12 }}>
                  <StatusPill label={towerApproachThresholdState.label} tone={towerApproachThresholdState.tone} />
                  <StatusPill label={formState.version || "v1"} tone="neutral" />
                </div>
                <p className="admin-note">
                  建议按机组型号填写最低允许冷凝器进水温。保存后，BFF 会把它合并到
                  `towerApproach` 门禁里，用于判断目标 Tcws 是否需要降回人工复核。
                </p>
                <p className="admin-muted">
                  高级结构仍可直接写在 `ruleThresholdsJson`：
                  `towerApproach.minCondenserInletTempCByModel`、
                  `towerApproach.minCondenserInletTempCByChiller`。
                </p>
                {!ruleThresholdsValid ? (
                  <p className="admin-error">当前 `ruleThresholdsJson` 不是合法 JSON，请先修正后再用结构化输入。</p>
                ) : null}
                <div className="admin-form-grid" style={{ marginTop: 14 }}>
                  <label className="admin-field">
                    <span>最低冷凝器进水温 (°C)</span>
                    <input
                      inputMode="decimal"
                      placeholder="例如 30.0"
                      value={towerApproachMinInput}
                      onChange={(event) => setTowerApproachMinInput(event.target.value)}
                    />
                  </label>
                  <div className="admin-field">
                    <span>结构化操作</span>
                    <div className="admin-actions">
                      <button
                        className="admin-button"
                        type="button"
                        disabled={!ruleThresholdsValid}
                        onClick={handleApplyTowerApproachThreshold}
                      >
                        写入 ruleThresholdsJson
                      </button>
                      <button
                        className="admin-button is-ghost"
                        type="button"
                        disabled={!ruleThresholdsValid}
                        onClick={() => {
                          setTowerApproachMinInput("");
                          try {
                            const nextRuleThresholdsJson = upsertTowerApproachMinCondenserInletTempC(
                              formState.ruleThresholdsJson || "{}",
                              ""
                            );
                            setFormState((current) => ({
                              ...current,
                              ruleThresholdsJson: nextRuleThresholdsJson
                            }));
                            setErrorText("");
                          } catch (error) {
                            setErrorText(error instanceof Error ? error.message : "接近度阈值清空失败");
                          }
                        }}
                      >
                        清空阈值
                      </button>
                    </div>
                  </div>
                </div>
                <p className="admin-muted">`version / updatedAt / updatedBy` 由后端自动维护，这里只展示，不手工写入。</p>
              </div>

              <div className="admin-form-grid">
                <label className="admin-field is-full">
                  <span>energyParamsJson</span>
                  <textarea
                    value={formState.energyParamsJson}
                    onChange={(event) => setFormState((current) => ({ ...current, energyParamsJson: event.target.value }))}
                  />
                </label>
                <label className="admin-field is-full">
                  <span>ruleThresholdsJson</span>
                  <textarea
                    value={formState.ruleThresholdsJson}
                    onChange={(event) => {
                      const nextValue = event.target.value;
                      setFormState((current) => ({ ...current, ruleThresholdsJson: nextValue }));
                      const nextStructuredValue = readTowerApproachMinCondenserInletTempC(nextValue);
                      setTowerApproachMinInput(nextStructuredValue);
                    }}
                  />
                </label>
                <label className="admin-field is-full">
                  <span>featureFlagsJson</span>
                  <textarea
                    value={formState.featureFlagsJson}
                    onChange={(event) => setFormState((current) => ({ ...current, featureFlagsJson: event.target.value }))}
                  />
                </label>
                <div className="admin-detail-card is-full">
                  <h4>运行配置元数据</h4>
                  <dl className="admin-kv" style={{ marginTop: 12 }}>
                    <div className="admin-kv-row">
                      <dt>version</dt>
                      <dd>{formState.version || "v1"}</dd>
                    </div>
                    <div className="admin-kv-row">
                      <dt>updatedBy</dt>
                      <dd>{formState.updatedBy || "未设置"}</dd>
                    </div>
                    <div className="admin-kv-row">
                      <dt>updatedAt</dt>
                      <dd>{formState.updatedAt || "未设置"}</dd>
                    </div>
                  </dl>
                </div>
              </div>
              <div className="admin-form-actions">
                <button className="admin-button" type="button" onClick={() => navigate(`/sites/${encodeURIComponent(siteId)}`)}>
                  取消
                </button>
                <button className="admin-button is-primary" type="submit" disabled={saving}>
                  <Save size={14} />
                  {saving ? "保存中..." : "保存运行配置"}
                </button>
              </div>
            </form>
          </div>
        )}
      </SectionCard>
    </div>
  );
}
