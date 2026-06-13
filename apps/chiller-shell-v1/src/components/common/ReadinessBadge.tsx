import { useEffect, useState } from "react";
import { runtimeConfig } from "../../config/runtimeConfig";
import type { LocaleCode } from "../../i18n/zhCN";
import { getCurrentLocale } from "../../i18n/zhCN";
import { fetchUiBadgeState, type UiBadgeDecisionDto, type UiBadgeStateDto } from "../../services/bffClient";

type ReadinessBadgeProps = {
  pageKey: "dashboard" | "systemOverview";
  liveViewModel?: ReadinessBadgeViewModel | null;
};

export type ReadinessBadgeViewModel = {
  pass: boolean;
  text: string;
};

type BadgeViewModel = ReadinessBadgeViewModel;

function pickLocaleText(decision: UiBadgeDecisionDto | undefined, locale: LocaleCode): string | null {
  const textMap = decision?.text;
  if (!textMap) {
    return null;
  }
  return textMap[locale] || textMap["zh-CN"] || textMap["en-US"] || textMap["vi-VN"] || null;
}

function resolveBadgeViewModel(
  state: UiBadgeStateDto,
  pageKey: ReadinessBadgeProps["pageKey"],
  locale: LocaleCode
): BadgeViewModel | null {
  const pageDecision = state.pages?.[pageKey];
  const pass =
    typeof pageDecision?.pass === "boolean"
      ? pageDecision.pass
      : typeof state.global?.pass === "boolean"
        ? state.global.pass
        : null;
  if (pass === null) {
    return null;
  }
  const text = pickLocaleText(pageDecision, locale) || pickLocaleText(state.global, locale);
  if (!text) {
    return null;
  }
  return { pass, text };
}

export default function ReadinessBadge({ pageKey, liveViewModel = null }: ReadinessBadgeProps) {
  const [viewModel, setViewModel] = useState<BadgeViewModel | null>(null);

  useEffect(() => {
    if (liveViewModel) {
      return;
    }
    let active = true;

    async function load() {
      try {
        const state = await fetchUiBadgeState(runtimeConfig.badgeStateUrl);
        if (!active) {
          return;
        }
        setViewModel(resolveBadgeViewModel(state, pageKey, getCurrentLocale()));
      } catch {
        if (!active) {
          return;
        }
        setViewModel(null);
      }
    }

    load();
    return () => {
      active = false;
    };
  }, [pageKey, liveViewModel]);

  const resolvedViewModel = liveViewModel || viewModel;

  if (!resolvedViewModel) {
    return null;
  }

  return (
    <div className="readiness-badge-row">
      <span className={`status-pill readiness-badge-pill ${resolvedViewModel.pass ? "good" : "warn"}`}>
        {resolvedViewModel.text}
      </span>
    </div>
  );
}
