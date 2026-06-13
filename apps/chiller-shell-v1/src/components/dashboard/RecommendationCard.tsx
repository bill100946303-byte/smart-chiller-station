import { useState } from "react";
import { Sparkles } from "lucide-react";
import StatusPill from "../common/StatusPill";
import { normalizeRiskLevel } from "../../i18n/hvacCopybook";
import { zhCN } from "../../i18n/zhCN";

type Recommendation = {
  id?: string;
  title: string;
  description: string;
  impact: string;
  risk: string;
  diagnosisSummary?: string;
  diagnosisItems?: string[];
  actionItems?: string[];
  verificationItems?: string[];
};

type RecommendationCardProps = {
  item: Recommendation;
  isActive?: boolean;
  onView?: (item: Recommendation) => void;
};

export default function RecommendationCard({ item, isActive = false, onView }: RecommendationCardProps) {
  const [expanded, setExpanded] = useState(false);
  const riskLevel = normalizeRiskLevel(item.risk);
  const tone = riskLevel === "low" ? "good" : riskLevel === "high" ? "danger" : "warn";
  const detailVisible = onView ? isActive : expanded;
  const riskPrefix = String(zhCN.recommendations.riskPrefix || "").trim();
  const riskValue = String(item.risk || "").trim();
  const riskPillLabel = !riskValue
    ? riskPrefix
    : riskValue.includes(riskPrefix)
      ? riskValue
      : `${riskValue} ${riskPrefix}`;

  function handleView() {
    if (onView) {
      onView(item);
      return;
    }
    setExpanded((value) => !value);
  }

  return (
    <article className={isActive ? "recommendation-card is-active" : "recommendation-card"}>
      <header>
        <div className="rec-title">
          <Sparkles size={16} />
          <h4>{item.title}</h4>
        </div>
        <StatusPill label={riskPillLabel} tone={tone} />
      </header>
      <p>{item.description}</p>
      <div className="rec-impact">{item.impact}</div>
      <button type="button" onClick={handleView} aria-pressed={detailVisible}>
        {zhCN.recommendations.viewAction}
      </button>
      {detailVisible ? (
        <div className="rec-view-panel">
          <strong>{item.title}</strong>
          <div className="rec-view-section">
            <span className="rec-view-label">{"\u8BCA\u65AD\u62A5\u544A"}</span>
            <p>{item.diagnosisSummary || item.description}</p>
          </div>
          {item.diagnosisItems && item.diagnosisItems.length > 0 ? (
            <div className="rec-view-section">
              <span className="rec-view-label">{"\u5173\u952E\u8BCA\u65AD"}</span>
              <ul className="rec-view-list">
                {item.diagnosisItems.map((line) => (
                  <li key={`${item.id || item.title}-diagnosis-${line}`}>{line}</li>
                ))}
              </ul>
            </div>
          ) : null}
          <div className="rec-view-section">
            <span className="rec-view-label">{"\u5904\u7406\u5EFA\u8BAE"}</span>
            {item.actionItems && item.actionItems.length > 0 ? (
              <ul className="rec-view-list">
                {item.actionItems.map((line) => (
                  <li key={`${item.id || item.title}-action-${line}`}>{line}</li>
                ))}
              </ul>
            ) : (
              <p>{item.impact}</p>
            )}
          </div>
          {item.verificationItems && item.verificationItems.length > 0 ? (
            <div className="rec-view-section">
              <span className="rec-view-label">{"\u590D\u6838\u91CD\u70B9"}</span>
              <ul className="rec-view-list">
                {item.verificationItems.map((line) => (
                  <li key={`${item.id || item.title}-check-${line}`}>{line}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}
