import { useMemo, useState } from "react";
import { getCurrentLocale, zhCN } from "../../i18n/zhCN";

type SourceStatusBannerProps = {
  summary: string;
  warn: boolean;
  detailLines?: string[];
  detailLinesCompact?: string[];
  collapsedLimit?: number;
  hideDetailsUntilExpanded?: boolean;
};

export default function SourceStatusBanner({
  summary,
  warn,
  detailLines = [],
  detailLinesCompact = [],
  collapsedLimit = 4,
  hideDetailsUntilExpanded = false
}: SourceStatusBannerProps) {
  const [expanded, setExpanded] = useState(false);
  const hasOverflow = detailLines.length > collapsedLimit;
  const hiddenCount = Math.max(detailLines.length - collapsedLimit, 0);
  const collapsedSource = detailLinesCompact.length > 0 ? detailLinesCompact : detailLines;
  const canToggle = hideDetailsUntilExpanded ? detailLines.length > 0 : hasOverflow;
  const visibleLines = useMemo(
    () =>
      hideDetailsUntilExpanded && !expanded
        ? []
        : expanded || !hasOverflow
          ? detailLines
          : collapsedSource.slice(0, collapsedLimit),
    [collapsedLimit, collapsedSource, detailLines, expanded, hasOverflow, hideDetailsUntilExpanded]
  );
  const locale = getCurrentLocale();
  const hiddenCountSuffix =
    locale === "zh-CN" ? `（+${hiddenCount}）` : ` (+${hiddenCount})`;

  return (
    <div className={`source-banner ${warn ? "warn" : "good"}`}>
      <div>{summary}</div>
      {visibleLines.length > 0 ? <div className="source-banner-detail">{visibleLines.join("；")}</div> : null}
      {canToggle ? (
        <button
          type="button"
          className="source-banner-toggle"
          onClick={() => setExpanded((value) => !value)}
          aria-expanded={expanded}
        >
          {expanded
            ? zhCN.sourceBanner.collapse
            : `${zhCN.sourceBanner.expand}${hasOverflow ? hiddenCountSuffix : ""}`}
        </button>
      ) : null}
    </div>
  );
}
