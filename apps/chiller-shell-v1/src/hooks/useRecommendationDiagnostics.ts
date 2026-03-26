import { startTransition, useEffect, useState } from "react";
import {
  type RecommendationDto,
  fetchRecommendations
} from "../services/bffClient";
import { buildSourceStatusLines } from "../i18n/sourceStatusCN";
import { zhCN } from "../i18n/zhCN";

type RecommendationDiagnosticsState = {
  recommendation: RecommendationDto | null;
  ruleEvaluation: RecommendationDto["ruleEvaluation"] | null;
  diagnosticHint: string;
  sourceStatusLines: string[];
  sourceStatusLinesCompact: string[];
  loading: boolean;
  loadError: string | null;
};

export default function useRecommendationDiagnostics(siteId: string): RecommendationDiagnosticsState {
  const [recommendation, setRecommendation] = useState<RecommendationDto | null>(null);
  const [ruleEvaluation, setRuleEvaluation] = useState<RecommendationDto["ruleEvaluation"] | null>(null);
  const [diagnosticHint, setDiagnosticHint] = useState<string>(zhCN.diagnostics.loading);
  const [sourceStatusLines, setSourceStatusLines] = useState<string[]>([]);
  const [sourceStatusLinesCompact, setSourceStatusLinesCompact] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      startTransition(() => {
        setLoading(true);
        setLoadError(null);
      });

      try {
        const next = await fetchRecommendations(siteId);
        if (!active) {
          return;
        }
        startTransition(() => {
          setRecommendation(next);
          setRuleEvaluation(next.ruleEvaluation || null);
          setSourceStatusLines(buildSourceStatusLines([next.sourceStatus]));
          setSourceStatusLinesCompact(buildSourceStatusLines([next.sourceStatus], { labelMode: "short" }));
          setDiagnosticHint(
            next.ruleEvaluation
              ? zhCN.diagnostics.loaded
              : zhCN.diagnostics.notReturned
          );
          setLoading(false);
        });
      } catch {
        if (!active) {
          return;
        }
        startTransition(() => {
          setRecommendation(null);
          setRuleEvaluation(null);
          setSourceStatusLines([]);
          setSourceStatusLinesCompact([]);
          setDiagnosticHint(zhCN.diagnostics.endpointUnavailable);
          setLoading(false);
          setLoadError(zhCN.diagnostics.loadError);
        });
      }
    }

    load();
    return () => {
      active = false;
    };
  }, [siteId]);

  return {
    recommendation,
    ruleEvaluation,
    diagnosticHint,
    sourceStatusLines,
    sourceStatusLinesCompact,
    loading,
    loadError
  };
}
