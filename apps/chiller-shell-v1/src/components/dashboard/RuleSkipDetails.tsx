import type { RecommendationDto } from "../../services/bffClient";
import {
  getRuleCopy,
  getSkippedCategoryDetail,
  getSkippedCategoryLabel,
  preferChineseText
} from "../../i18n/hvacCopybook";
import { zhCN } from "../../i18n/zhCN";

type RuleEvaluation = RecommendationDto["ruleEvaluation"];

function formatCategory(value: string | undefined): string {
  return getSkippedCategoryLabel(value);
}

function categoryTone(value: string | undefined): "danger" | "warn" | "neutral" {
  if (value === "upstream_unreachable") {
    return "danger";
  }
  if (value === "field_missing_or_invalid") {
    return "warn";
  }
  return "neutral";
}

export default function RuleSkipDetails({ ruleEvaluation }: { ruleEvaluation: RuleEvaluation | null }) {
  if (!ruleEvaluation) {
    return <p className="empty-hint">{zhCN.ruleSkip.unavailableInDegraded}</p>;
  }

  if (ruleEvaluation.rulesLoaded === false) {
    return (
      <p className="empty-hint">
        {zhCN.ruleSkip.engineUnavailablePrefix}
        {ruleEvaluation.error ? `：${ruleEvaluation.error}` : "。"}
      </p>
    );
  }

  const details = ruleEvaluation.skippedRuleDetails || [];
  if (details.length === 0) {
    return <p className="empty-hint">{zhCN.ruleSkip.noSkippedRules}</p>;
  }

  return (
    <ul className="rule-skip-list">
      {details.map((detail, idx) => (
        <li key={`${detail.ruleId || "rule"}-${idx}`} className="rule-skip-item">
          <div className="rule-skip-header">
            <strong>
              {getRuleCopy(detail.ruleId)?.nameZh || zhCN.ruleSkip.unknownRule}
              {detail.ruleId ? `（${detail.ruleId}）` : ""}
            </strong>
            <span>{preferChineseText(detail.reason, zhCN.ruleSkip.missingMetricReason)}</span>
          </div>
          <div className="rule-skip-metrics">
            {(detail.missingMetrics || []).map((metric, metricIdx) => (
              <div key={`${metric.metric || "metric"}-${metricIdx}`} className="rule-skip-metric">
                <div className="rule-skip-metric-main">
                  <code>{metric.metric || zhCN.ruleSkip.unknownMetric}</code>
                  <span className={`rule-skip-category ${categoryTone(metric.category)}`}>
                    {formatCategory(metric.category)}
                  </span>
                </div>
                <small>{getSkippedCategoryDetail(metric.category, metric.message)}</small>
              </div>
            ))}
          </div>
        </li>
      ))}
    </ul>
  );
}
