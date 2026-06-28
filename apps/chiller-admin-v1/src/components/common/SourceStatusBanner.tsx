import { useState } from "react";

export default function SourceStatusBanner({
  summary,
  warn,
  detailLines = [],
  detailLinesCompact = [],
  collapsedLimit = 4
}: {
  summary: string;
  warn: boolean;
  detailLines?: string[];
  detailLinesCompact?: string[];
  collapsedLimit?: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const hasOverflow = detailLines.length > collapsedLimit;
  const hiddenCount = Math.max(detailLines.length - collapsedLimit, 0);
  const collapsedSource = detailLinesCompact.length > 0 ? detailLinesCompact : detailLines;
  const visibleLines = expanded || !hasOverflow ? detailLines : collapsedSource.slice(0, collapsedLimit);

  return (
    <div className={`admin-banner ${warn ? "warn" : "good"}`}>
      <div>{summary}</div>
      {visibleLines.length > 0 ? <div className="admin-banner-detail">{visibleLines.join("；")}</div> : null}
      {hasOverflow ? (
        <button
          type="button"
          className="admin-banner-toggle"
          onClick={() => setExpanded((value) => !value)}
          aria-expanded={expanded}
        >
          {expanded ? "收起" : `展开更多（+${hiddenCount}）`}
        </button>
      ) : null}
    </div>
  );
}
