import { useMemo, useState } from "react";
import { getCurrentLocale, zhCN } from "../../i18n/zhCN";

type SourceStatusBannerProps = {
  summary: string;
  warn: boolean;
  detailLines?: string[];
  detailLinesCompact?: string[];
  collapsedLimit?: number;
};

export default function SourceStatusBanner({
  summary,
  warn,
  detailLines = [],
  detailLinesCompact = [],
  collapsedLimit = 4
}: SourceStatusBannerProps) {
  const [expanded, setExpanded] = useState(false);
  const hasOverflow = detailLines.length > collapsedLimit;
  const hiddenCount = Math.max(detailLines.length - collapsedLimit, 0);
  const collapsedSource = detailLinesCompact.length > 0 ? detailLinesCompact : detailLines;
  const visibleLines = useMemo(
    () => (expanded || !hasOverflow ? detailLines : collapsedSource.slice(0, collapsedLimit)),
    [collapsedLimit, collapsedSource, detailLines, expanded, hasOverflow]
  );
  const locale = getCurrentLocale();
  const hiddenCountSuffix =
    locale === "zh-CN" ? `（+${hiddenCount}）` : ` (+${hiddenCount})`;

  return (
    <div className={`source-banner ${warn ? "warn" : "good"}`}>
      <div>{summary}</div>
      {visibleLines.length > 0 ? <div className="source-banner-detail">{visibleLines.join("；")}</div> : null}
      {hasOverflow ? (
        <button
          type="button"
          className="source-banner-toggle"
          onClick={() => setExpanded((value) => !value)}
          aria-expanded={expanded}
        >
          {expanded
            ? zhCN.sourceBanner.collapse
            : `${zhCN.sourceBanner.expand}${hiddenCountSuffix}`}
        </button>
      ) : null}
    </div>
  );
}
