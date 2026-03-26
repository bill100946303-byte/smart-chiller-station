import { Sparkles } from "lucide-react";
import StatusPill from "../common/StatusPill";
import { normalizeRiskLevel } from "../../i18n/hvacCopybook";
import { zhCN } from "../../i18n/zhCN";

type Recommendation = {
  title: string;
  description: string;
  impact: string;
  risk: string;
};

export default function RecommendationCard({ item }: { item: Recommendation }) {
  const riskLevel = normalizeRiskLevel(item.risk);
  const tone = riskLevel === "low" ? "good" : riskLevel === "high" ? "danger" : "warn";

  return (
    <article className="recommendation-card">
      <header>
        <div className="rec-title">
          <Sparkles size={16} />
          <h4>{item.title}</h4>
        </div>
        <StatusPill label={`${zhCN.recommendations.riskPrefix} ${item.risk}`} tone={tone} />
      </header>
      <p>{item.description}</p>
      <div className="rec-impact">{item.impact}</div>
      <button type="button">{zhCN.recommendations.viewAction}</button>
    </article>
  );
}
