import { useState } from "react";
import SectionCard from "../components/common/SectionCard";
import SourceStatusBanner from "../components/common/SourceStatusBanner";
import StatCard from "../components/common/StatCard";
import StatusPill from "../components/common/StatusPill";
import { runtimeConfig } from "../config/runtimeConfig";
import { buildSourceStatusLines, summarizeSourceStatus } from "../i18n/sourceStatusCN";
import { zhCN } from "../i18n/zhCN";
import {
  type OptimizeDraftDetailsDto,
  type OptimizeDraftErrorDto,
  postOptimizeDraft
} from "../services/bffClient";

function localizeOptimizeConfidence(value: string | undefined): string {
  if (!value) {
    return zhCN.optimizeDemo.pendingValue;
  }
  if (value === "rule-based-draft-stable") {
    return "规则型稳定草案";
  }
  if (value === "rule-based-draft-partial") {
    return "规则型部分草案";
  }
  if (value === "rule-based-draft-degraded") {
    return "规则型降级草案";
  }
  return value;
}

function localizeOptimizeSummary(text: string | undefined): string {
  if (!text) {
    return zhCN.optimizeDemo.pendingValue;
  }

  let match = text.match(
    /^context-backed draft derived from overview, anomalies \((\d+)\), and recommendation cards \((\d+)\); requested scenario (.+)$/
  );
  if (match) {
    const [, alarms, cards, scenario] = match;
    return `当前草案基于总览、异常（${alarms}）和建议卡片（${cards}）生成；请求场景为 ${scenario}`;
  }

  match = text.match(
    /^context-backed draft derived from current station overview; no recommendation cards matched, requested scenario (.+)$/
  );
  if (match) {
    return `当前草案基于站点现态总览生成；当前没有匹配的建议卡片；请求场景为 ${match[1]}`;
  }

  return text;
}

function localizeOptimizeStep(step: string): string {
  let match = step.match(/^Review active alarms first: critical=(\d+), major=(\d+)$/);
  if (match) {
    return `优先核查当前活动告警：紧急=${match[1]}，严重=${match[2]}`;
  }

  match = step.match(/^Review recommendation card: (.+)$/);
  if (match) {
    return `优先查看建议卡片：${match[1]}`;
  }

  match = step.match(/^Use current station snapshot as draft baseline: COP=(.+), totalPowerKw=(.+)$/);
  if (match) {
    return `以当前站点现态作为草案基线：COP=${match[1]}，总功率=${match[2]}`;
  }

  if (step === "Current station efficiency snapshot is incomplete; keep optimize output at draft level.") {
    return "当前站点能效快照不完整，优化结果维持在解释型草案层级。";
  }

  match = step.match(
    /^Requested scenario implies much higher draft power than the current snapshot \(ratio=(.+)\); treat the draft as directional only$/
  );
  if (match) {
    return `请求场景推导出的草案功率显著高于当前快照（倍率=${match[1]}），当前草案仅作方向性参考。`;
  }

  match = step.match(
    /^Requested scenario implies lower draft power than the current snapshot \(ratio=(.+)\); validate whether the current equipment mix can be relaxed$/
  );
  if (match) {
    return `请求场景推导出的草案功率低于当前快照（倍率=${match[1]}），请核查当前设备组合是否存在放宽空间。`;
  }

  if (step === "Current COP snapshot is unavailable or non-positive; keep optimize interpretation at explanatory draft level") {
    return "当前 COP 快照不可用或不为正值，优化解释维持在说明型草案层级。";
  }

  match = step.match(
    /^Rule diagnostics still have (\d+) skipped item\(s\); keep draft review focused on observable signals first$/
  );
  if (match) {
    return `规则诊断仍有 ${match[1]} 个跳过项；当前草案请优先依据可观测信号进行判断。`;
  }

  match = step.match(/^Requested scenario fixed for draft review: loadKw=(.+), outdoorTempC=(.+), mode=(.+)$/);
  if (match) {
    return `本次草案评审固定场景：负荷=${match[1]} kW，室外温度=${match[2]} ℃，模式=${match[3]}`;
  }

  return step;
}

function localizeOptimizeDiagnostic(item: string): string {
  let match = item.match(/^overview\.sourceStatus=(.+)$/);
  if (match) {
    return `总览来源状态=${match[1]}`;
  }

  match = item.match(/^anomalySummary\.sourceStatus=(.+), totalAlarms=(\d+)$/);
  if (match) {
    return `异常摘要来源状态=${match[1]}，异常总数=${match[2]}`;
  }

  match = item.match(/^recommendations\.sourceStatus=(.+), cards=(\d+)$/);
  if (match) {
    return `建议来源状态=${match[1]}，卡片数=${match[2]}`;
  }

  match = item.match(/^ruleEvaluation\.matched=(\d+), skipped=(\d+)$/);
  if (match) {
    return `规则评估：命中=${match[1]}，跳过=${match[2]}`;
  }

  if (item === "optimize engine is not implemented; current response is a context-backed draft only") {
    return "优化引擎尚未实现；当前响应仅为基于现态的解释型草案。";
  }

  return item;
}

function localizeOptimizeError(text: string | undefined): string | undefined {
  if (!text) {
    return text;
  }
  if (text === "Optimize engine is not implemented yet; returning a context-backed draft") {
    return "优化引擎尚未实现；当前返回基于现态的解释型草案。";
  }
  return text;
}

function readOptimizeDetails(error: OptimizeDraftErrorDto | null): OptimizeDraftDetailsDto | null {
  if (!error?.details || Array.isArray(error.details)) {
    return null;
  }
  const details = error.details as Record<string, unknown>;
  if (!("decision" in details) && !("sourceStatus" in details)) {
    return null;
  }
  return details as OptimizeDraftDetailsDto;
}

function mapOptimizeStatusLabel(code: string | undefined, fallback: string): string {
  if (!code) {
    return fallback;
  }
  if (code === "NOT_IMPLEMENTED") {
    return zhCN.optimizeDemo.statusDraft;
  }
  if (code === "UNKNOWN") {
    return zhCN.optimizeDemo.statusUnknown;
  }
  return code;
}

export default function OptimizeDemoPage() {
  const [loadKw, setLoadKw] = useState("1200");
  const [outdoorTempC, setOutdoorTempC] = useState("32.5");
  const [mode, setMode] = useState("cooling");
  const [submitting, setSubmitting] = useState(false);
  const [resultError, setResultError] = useState<OptimizeDraftErrorDto | null>(null);

  const details = readOptimizeDetails(resultError);
  const isDraftResponse = resultError?.code === "NOT_IMPLEMENTED" && Boolean(details);
  const hasValidationError = Boolean(resultError) && !isDraftResponse;
  const sourceSummary = summarizeSourceStatus([details?.sourceStatus]);
  const sourceStatusLines = buildSourceStatusLines([details?.sourceStatus]);
  const sourceStatusLinesCompact = buildSourceStatusLines([details?.sourceStatus], {
    limit: 4,
    labelMode: "short"
  });

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    try {
      await postOptimizeDraft(runtimeConfig.siteId, {
        context: {
          siteId: runtimeConfig.siteId
        },
        inputs: {
          loadKw: Number(loadKw),
          outdoorTempC: Number(outdoorTempC),
          mode
        }
      });
      setResultError(null);
    } catch (error) {
      const payload = (error as { payload?: OptimizeDraftErrorDto })?.payload || {
        code: "UNKNOWN",
        error: String((error as Error)?.message || error)
      };
      setResultError(payload);
    } finally {
      setSubmitting(false);
    }
  }

  const responseReady = Boolean(details);
  const requestDelta =
    details?.request?.loadKw != null && details?.request?.outdoorTempC != null
      ? `${details.request.loadKw} kW / ${details.request.outdoorTempC} °C`
      : zhCN.optimizeDemo.pendingHint;
  const statusLabel = mapOptimizeStatusLabel(resultError?.code, zhCN.optimizeDemo.statusDraft);
  const localizedError = localizeOptimizeError(resultError?.error);

  return (
    <div className="optimize-page page-enter">
      <SourceStatusBanner
        summary={
          responseReady
            ? sourceSummary.text
            : hasValidationError
              ? localizedError || zhCN.optimizeDemo.bannerIdle
              : zhCN.optimizeDemo.bannerIdle
        }
        warn={hasValidationError || sourceSummary.warn}
        detailLines={responseReady ? sourceStatusLines : []}
        detailLinesCompact={responseReady ? sourceStatusLinesCompact : []}
      />

      <section className="optimize-page-header">
        <h2>{zhCN.optimizeDemo.heading}</h2>
        <p>{zhCN.optimizeDemo.subtitle}</p>
      </section>

      <div className="optimize-summary-grid">
        <StatCard
          title={zhCN.optimizeDemo.summaryRoute}
          value={zhCN.optimizeDemo.summaryRouteValue}
          unit=""
          delta={`${zhCN.optimizeDemo.summaryRouteHint} /bff/v1/sites/{siteId}/optimize`}
          tone="good"
        />
        <StatCard
          title={zhCN.optimizeDemo.summaryStatus}
          value={statusLabel}
          unit=""
          delta={
            isDraftResponse
              ? zhCN.optimizeDemo.summaryStatusDraftHint
              : localizedError || zhCN.optimizeDemo.summaryStatusHint
          }
          tone={hasValidationError ? "warn" : "neutral"}
        />
        <StatCard
          title={zhCN.optimizeDemo.summaryInput}
          value={responseReady ? zhCN.optimizeDemo.requestAccepted : zhCN.optimizeDemo.requestPending}
          unit=""
          delta={requestDelta}
          tone={responseReady ? "good" : "neutral"}
        />
      </div>

      <div className="optimize-page-grid">
        <SectionCard title={zhCN.optimizeDemo.sectionInputs}>
          <form className="optimize-form" onSubmit={handleSubmit}>
            <label>
              <span>{zhCN.optimizeDemo.inputLoadKw}</span>
              <input type="number" step="1" value={loadKw} onChange={(event) => setLoadKw(event.target.value)} />
            </label>
            <label>
              <span>{zhCN.optimizeDemo.inputOutdoorTempC}</span>
              <input
                type="number"
                step="0.1"
                value={outdoorTempC}
                onChange={(event) => setOutdoorTempC(event.target.value)}
              />
            </label>
            <label>
              <span>{zhCN.optimizeDemo.inputMode}</span>
              <select value={mode} onChange={(event) => setMode(event.target.value)}>
                <option value="cooling">{zhCN.optimizeDemo.modeCooling}</option>
              </select>
            </label>
            <div className="optimize-form-actions">
              <button type="submit" disabled={submitting}>
                {submitting ? zhCN.optimizeDemo.submitLoading : zhCN.optimizeDemo.submit}
              </button>
              <small>{zhCN.optimizeDemo.formFootnote}</small>
            </div>
          </form>
        </SectionCard>

        <SectionCard title={zhCN.optimizeDemo.sectionResponse}>
          <div className="optimize-response">
            <div className="optimize-response-header">
              <div>
                <strong>{zhCN.optimizeDemo.responseTitle}</strong>
                <p>{zhCN.optimizeDemo.responseHint}</p>
              </div>
              <StatusPill
                label={statusLabel}
                tone={hasValidationError ? "warn" : "neutral"}
              />
            </div>

            <div className="optimize-response-grid">
              <article className="optimize-response-card">
                <span>{zhCN.optimizeDemo.responseSummary}</span>
                <strong>{localizeOptimizeSummary(details?.decision?.summary) || zhCN.optimizeDemo.pendingValue}</strong>
              </article>
              <article className="optimize-response-card">
                <span>{zhCN.optimizeDemo.responseConfidence}</span>
                <strong>{localizeOptimizeConfidence(details?.decision?.confidence)}</strong>
              </article>
              <article className="optimize-response-card">
                <span>{zhCN.optimizeDemo.responseSystemCop}</span>
                <strong>{details?.recommendation?.systemCop ?? zhCN.optimizeDemo.pendingValue}</strong>
              </article>
              <article className="optimize-response-card">
                <span>{zhCN.optimizeDemo.responseTotalPower}</span>
                <strong>{details?.recommendation?.totalPowerKw ?? zhCN.optimizeDemo.pendingValue}</strong>
              </article>
            </div>

            <div className="optimize-response-block">
              <h4>{zhCN.optimizeDemo.responseSteps}</h4>
              {details?.recommendation?.steps?.length ? (
                <ul>
                  {details.recommendation.steps.map((step, index) => (
                    <li key={`${step}-${index + 1}`}>{localizeOptimizeStep(step)}</li>
                  ))}
                </ul>
              ) : (
                <p>{zhCN.optimizeDemo.stepsEmpty}</p>
              )}
            </div>

            <div className="optimize-response-block">
              <h4>{zhCN.optimizeDemo.responseDiagnostics}</h4>
              {details?.diagnostics?.length ? (
                <ul>
                  {details.diagnostics.map((item, index) => (
                    <li key={`${item}-${index + 1}`}>{localizeOptimizeDiagnostic(item)}</li>
                  ))}
                </ul>
              ) : (
                <p>
                  {hasValidationError
                    ? localizedError || zhCN.optimizeDemo.diagnosticsEmpty
                    : zhCN.optimizeDemo.diagnosticsEmpty}
                </p>
              )}
              <small>{details?.generatedAt || zhCN.optimizeDemo.generatedAtPending}</small>
            </div>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
