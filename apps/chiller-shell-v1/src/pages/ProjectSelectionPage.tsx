import { ChevronRight, Layers3, MapPinned, Search, X } from "lucide-react";
import { startTransition, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { runtimeConfig } from "../config/runtimeConfig";
import { zhCN } from "../i18n/zhCN";
import { getProjectVisitStats, getStoredProjectSelection, recordProjectVisit } from "../services/projectSession";
import {
  getAuthSession,
  getCurrentProject,
  getSwitchableProjects,
  resolveAuthProjectId,
  selectAuthProject,
  resolveAuthProjectDisplayName,
  type AuthProject
} from "../services/auth";
import { type DashboardOverviewDto, fetchDashboardOverviewForProject } from "../services/bffClient";
import {
  buildProjectDropdownEntries,
  flattenProjectDropdownTargets
} from "../services/projectDropdownEntries";
import { appendSiteIdToPath } from "../services/siteRouting";

type ProjectOverviewState =
  | {
      status: "loading";
    }
  | {
      status: "ready";
      overview: DashboardOverviewDto;
    }
  | {
      status: "error";
    };

type ProjectLiveStateTone = "neutral" | "good" | "warn";

type ProjectLiveState = {
  label: string;
  hint: string;
  tone: ProjectLiveStateTone;
};

const PLACEHOLDER_PROJECT_LABELS = new Set(["默认", "default", "榛樿"]);

function isMeaningfulProjectLabel(label: string | null | undefined): boolean {
  const normalized = String(label || "").trim();
  if (!normalized) {
    return false;
  }
  if (PLACEHOLDER_PROJECT_LABELS.has(normalized.toLowerCase())) {
    return false;
  }
  if (/^\d{1,6}$/.test(normalized)) {
    return false;
  }
  return true;
}

function resolveProjectCardName(project: AuthProject | null | undefined): string {
  if (!project) {
    return zhCN.projectSwitcher.currentPending;
  }
  const candidates = [
    project.parentProjectLabel,
    project.appExplain,
    project.siteName,
    project.siteCode,
    resolveAuthProjectDisplayName(project, ""),
    project.siteId
  ];
  const preferred = candidates.find((candidate) => isMeaningfulProjectLabel(candidate));
  return String(preferred || project.siteId || zhCN.projectSwitcher.currentPending);
}

function resolveProjectOptionId(project: AuthProject | null | undefined): string {
  return project ? resolveAuthProjectId(project) : "";
}

function formatNumber(value: number | null | undefined, digits = 1): string {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return zhCN.projectSwitcher.metricPending;
  }
  return value.toFixed(digits);
}

function resolveCopNumber(state: ProjectOverviewState | undefined): number | null {
  if (!state || state.status !== "ready") {
    return null;
  }
  const currentCop = state.overview.energyCards?.currentCop;
  if (typeof currentCop !== "number" || !Number.isFinite(currentCop) || currentCop <= 0) {
    return null;
  }
  return currentCop;
}

function resolveCopTone(state: ProjectOverviewState | undefined): ProjectLiveStateTone | null {
  const currentCop = resolveCopNumber(state);
  if (currentCop === null) {
    return null;
  }
  if (currentCop >= 5) {
    return "good";
  }
  if (currentCop >= 4.15) {
    return "neutral";
  }
  return "warn";
}

function resolveCopValue(state: ProjectOverviewState | undefined): string {
  const currentCop = resolveCopNumber(state);
  if (currentCop === null) {
    return zhCN.projectSwitcher.metricPending;
  }
  return formatNumber(currentCop, 2);
}

function formatVisitTime(value: string | null | undefined): string {
  if (!value) {
    return zhCN.common.timeUnknown;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return zhCN.common.timeUnknown;
  }
  return date.toLocaleString();
}

function formatCompactVisitTime(value: string | null | undefined): string {
  if (!value) {
    return zhCN.common.timeUnknown;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return zhCN.common.timeUnknown;
  }
  return date.toLocaleString(undefined, {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function resolveVisitTimestamp(value: string | null | undefined): number {
  if (!value) {
    return 0;
  }
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function formatMetricValue(
  value: number | null | undefined,
  options: {
    maximumFractionDigits?: number;
    minimumFractionDigits?: number;
    unit?: string;
  } = {}
): string {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return zhCN.projectSwitcher.metricPending;
  }
  const formatted = new Intl.NumberFormat("zh-CN", {
    minimumFractionDigits: options.minimumFractionDigits ?? 0,
    maximumFractionDigits: options.maximumFractionDigits ?? 0
  }).format(value);
  return options.unit ? `${formatted} ${options.unit}` : formatted;
}

function resolveProjectLiveState(state: ProjectOverviewState | undefined): ProjectLiveState {
  if (!state || state.status === "loading") {
    return {
      label: zhCN.projectSwitcher.liveLoading,
      hint: zhCN.projectSwitcher.liveLoadingHint,
      tone: "neutral"
    };
  }

  if (state.status === "error") {
    return {
      label: zhCN.projectSwitcher.liveUnavailable,
      hint: zhCN.projectSwitcher.liveUnavailableHint,
      tone: "warn"
    };
  }

  const overall = state.overview.sourceStatus?.overall;
  if (overall === "failed") {
    return {
      label: zhCN.projectSwitcher.liveUnavailable,
      hint: zhCN.projectSwitcher.liveUnavailableHint,
      tone: "warn"
    };
  }

  if (state.overview.freshness?.stale || overall === "partial") {
    return {
      label: overall === "partial" ? zhCN.projectSwitcher.livePartial : zhCN.projectSwitcher.liveStale,
      hint: zhCN.projectSwitcher.liveWarnHint,
      tone: "warn"
    };
  }

  return {
    label: zhCN.projectSwitcher.liveReady,
    hint: zhCN.projectSwitcher.liveReadyHint,
    tone: "good"
  };
}

function resolvePowerValue(state: ProjectOverviewState | undefined): string {
  if (!state || state.status !== "ready") {
    return zhCN.projectSwitcher.metricPending;
  }
  return formatMetricValue(state.overview.energyCards?.totalPowerKw, {
    maximumFractionDigits: 0,
    unit: "kW"
  });
}

function resolveAlarmValue(state: ProjectOverviewState | undefined): string {
  if (!state || state.status !== "ready") {
    return zhCN.projectSwitcher.metricPending;
  }
  return formatMetricValue(state.overview.alarmSummary?.total ?? state.overview.energyCards?.activeAnomalyCount, {
    maximumFractionDigits: 0
  });
}

function resolveLatestOverviewTime(state: ProjectOverviewState | undefined): string {
  if (!state) {
    return zhCN.projectSwitcher.latestPending;
  }
  if (state.status === "loading") {
    return zhCN.projectSwitcher.latestPending;
  }
  if (state.status === "error") {
    return zhCN.common.timeUnknown;
  }
  return formatVisitTime(state.overview.freshness?.latestTimestamp || state.overview.generatedAt || null);
}

function resolveProjectConfigLabel(project: AuthProject): string {
  if (project.modelKey) {
    return `${zhCN.projectSwitcher.modelLabel} ${project.modelKey}`;
  }
  if (project.template) {
    return `${zhCN.projectSwitcher.templateLabel} ${project.template}`;
  }
  return `${zhCN.projectSwitcher.modelLabel} ${zhCN.projectSwitcher.modelMissing}`;
}

function normalizeProjectSearchValue(value: string | null | undefined): string {
  return String(value || "").trim().toLowerCase();
}

export default function ProjectSelectionPage() {
  const session = getAuthSession();
  const [searchParams] = useSearchParams();
  const sessionProjects = session?.projects || [];
  const currentProject = getCurrentProject(session);
  const currentProjectOptionId = resolveProjectOptionId(currentProject);
  const switchableProjects = getSwitchableProjects(sessionProjects);
  const projectDropdownEntries = buildProjectDropdownEntries(
    sessionProjects,
    switchableProjects,
    currentProjectOptionId
  );
  const dropdownTargets = flattenProjectDropdownTargets(projectDropdownEntries);
  const queueProjects = dropdownTargets
    .map((target) => sessionProjects.find((project) => resolveProjectOptionId(project) === target.optionId) || null)
    .filter((project): project is AuthProject => Boolean(project));
  const projectLabelByOptionId = Object.fromEntries(
    dropdownTargets.map((target) => [target.optionId, target.label])
  ) as Record<string, string>;
  const projectSignature = queueProjects
    .map((project) => resolveProjectOptionId(project))
    .join("|");
  const [switchingProjectId, setSwitchingProjectId] = useState<string | null>(null);
  const [projectSearchQuery, setProjectSearchQuery] = useState("");
  const autoEnterTriggeredRef = useRef(false);
  const [projectOverviewMap, setProjectOverviewMap] = useState<Record<string, ProjectOverviewState>>({});
  const projectVisitStats = getProjectVisitStats();
  const storedProjectSelection = getStoredProjectSelection();
  const redirectPath = searchParams.get("redirect");
  const landingPath =
    redirectPath && redirectPath.startsWith("/") && !redirectPath.startsWith("/projects")
      ? redirectPath
      : "/scene-control";

  function resolveQueueDisplayName(project: AuthProject | null | undefined): string {
    const optionId = resolveProjectOptionId(project);
    const mappedLabel = projectLabelByOptionId[optionId];
    if (isMeaningfulProjectLabel(mappedLabel)) {
      return mappedLabel;
    }
    return resolveProjectCardName(project);
  }

  useEffect(() => {
    if (!queueProjects.length) {
      startTransition(() => setProjectOverviewMap({}));
      return;
    }

    const pendingState = Object.fromEntries(
      queueProjects.map((project) => [resolveProjectOptionId(project), { status: "loading" } satisfies ProjectOverviewState])
    );
    startTransition(() => setProjectOverviewMap(pendingState));

    let active = true;

    queueProjects.forEach((project) => {
      const projectOptionId = resolveProjectOptionId(project);
      void fetchDashboardOverviewForProject(project)
        .then((overview) => {
          if (!active) {
            return;
          }
          startTransition(() =>
            setProjectOverviewMap((previous) => ({
              ...previous,
              [projectOptionId]: {
                status: "ready",
                overview
              }
            }))
          );
        })
        .catch(() => {
          if (!active) {
            return;
          }
          startTransition(() =>
            setProjectOverviewMap((previous) => ({
              ...previous,
              [projectOptionId]: {
                status: "error"
              }
            }))
          );
        });
    });

    return () => {
      active = false;
    };
  }, [projectSignature]);

  function handleProjectEnter(projectOptionId: string) {
    if (switchingProjectId) {
      return;
    }
    const targetProject = queueProjects.find((project) => resolveProjectOptionId(project) === projectOptionId);
    if (!targetProject) {
      return;
    }

    setSwitchingProjectId(projectOptionId);
    const nextSession = selectAuthProject(projectOptionId);
    const nextPath = appendSiteIdToPath(landingPath, targetProject.siteId);

    if (!nextSession) {
      setSwitchingProjectId(null);
      return;
    }

    recordProjectVisit(targetProject.siteId, resolveQueueDisplayName(targetProject));
    window.location.assign(nextPath);
  }

  const siteProjectCountMap = queueProjects.reduce<Record<string, number>>((acc, project) => {
    acc[project.siteId] = (acc[project.siteId] || 0) + 1;
    return acc;
  }, {});
  const activeSiteId = String(
    currentProject?.siteId ||
      storedProjectSelection?.siteId ||
      searchParams.get("siteId") ||
      runtimeConfig.siteId ||
      ""
  ).trim();
  const activeModelKey = String(currentProject?.modelKey || session?.defaultProjectKey || "").trim();
  const activeProjectName = String(storedProjectSelection?.siteName || "").trim();
  const activeProjectIdHint = String(session?.currentProjectId || "").trim();

  function isProjectCurrentInQueue(project: AuthProject): boolean {
    const projectOptionId = resolveProjectOptionId(project);
    if (currentProjectOptionId && projectOptionId === currentProjectOptionId) {
      return true;
    }

    const projectModelKey = String(project.modelKey || "").trim();
    const isCurrentBySite = Boolean(activeSiteId && activeSiteId === project.siteId);
    const isCurrentByModel = isCurrentBySite && Boolean(activeModelKey) && activeModelKey === projectModelKey;
    const isCurrentByStoredName =
      isCurrentBySite &&
      Boolean(activeProjectName) &&
      [
        resolveQueueDisplayName(project),
        String(project.appExplain || "").trim(),
        String(project.siteName || "").trim(),
        String(project.siteCode || "").trim()
      ].includes(activeProjectName);
    const isCurrentBySessionId =
      Boolean(activeProjectIdHint) &&
      (activeProjectIdHint === projectOptionId || activeProjectIdHint === project.siteId);
    const isCurrentBySingleSiteCard = isCurrentBySite && (siteProjectCountMap[project.siteId] || 0) === 1;
    return isCurrentBySessionId || isCurrentByModel || isCurrentByStoredName || isCurrentBySingleSiteCard;
  }

  const summaryCurrentText = resolveQueueDisplayName(currentProject);
  const sortedProjects = [...queueProjects].sort((left, right) => {
    const leftOptionId = resolveProjectOptionId(left);
    const rightOptionId = resolveProjectOptionId(right);
    const leftIsCurrent = isProjectCurrentInQueue(left);
    const rightIsCurrent = isProjectCurrentInQueue(right);
    if (leftIsCurrent !== rightIsCurrent) {
      return leftIsCurrent ? -1 : 1;
    }

    const leftVisitStat = projectVisitStats[left.siteId];
    const rightVisitStat = projectVisitStats[right.siteId];
    const visitCountDiff = (rightVisitStat?.visitCount || 0) - (leftVisitStat?.visitCount || 0);
    if (visitCountDiff !== 0) {
      return visitCountDiff;
    }

    const lastVisitedDiff =
      resolveVisitTimestamp(rightVisitStat?.lastVisitedAt) -
      resolveVisitTimestamp(leftVisitStat?.lastVisitedAt);
    if (lastVisitedDiff !== 0) {
      return lastVisitedDiff;
    }

    const leftName = resolveQueueDisplayName(left);
    const rightName = resolveQueueDisplayName(right);
    const nameDiff = leftName.localeCompare(rightName, "zh-CN", {
      numeric: true,
      sensitivity: "base"
    });
    if (nameDiff !== 0) {
      return nameDiff;
    }
    return leftOptionId.localeCompare(rightOptionId, "zh-CN", {
      numeric: true,
      sensitivity: "base"
    });
  });
  const normalizedProjectSearchQuery = normalizeProjectSearchValue(projectSearchQuery);
  const visibleProjects = normalizedProjectSearchQuery
    ? sortedProjects.filter((project) => {
        const optionId = resolveProjectOptionId(project);
        const searchText = [
          resolveQueueDisplayName(project),
          project.siteId,
          project.siteName,
          project.siteCode,
          project.appExplain,
          project.city,
          project.modelKey,
          project.template,
          optionId
        ]
          .map((item) => normalizeProjectSearchValue(item))
          .filter(Boolean)
          .join(" ");
        return searchText.includes(normalizedProjectSearchQuery);
      })
    : sortedProjects;
  const queueHeadProject = visibleProjects[0] || sortedProjects[0] || null;
  const selectedProjectOptionId = (() => {
    const matchedProject = queueProjects.find((project) => isProjectCurrentInQueue(project));
    if (matchedProject) {
      return resolveProjectOptionId(matchedProject);
    }

    return queueHeadProject ? resolveProjectOptionId(queueHeadProject) : "";
  })();
  const focusProject = currentProject || queueHeadProject;
  const focusProjectName = resolveQueueDisplayName(focusProject);
  const focusOverviewState = focusProject ? projectOverviewMap[resolveProjectOptionId(focusProject)] : undefined;
  const focusLiveState = resolveProjectLiveState(focusOverviewState);
  const focusVisitStat = focusProject ? projectVisitStats[focusProject.siteId] : undefined;
  const focusVisitCount = focusVisitStat?.visitCount || 0;
  const focusLastVisited = formatVisitTime(focusVisitStat?.lastVisitedAt || null);
  const commandTags = [
    { label: zhCN.projectSwitcher.summaryProjects, value: String(queueProjects.length) },
    { label: zhCN.projectSwitcher.summaryCurrent, value: summaryCurrentText },
    {
      label: "队列头部",
      value: queueHeadProject ? resolveQueueDisplayName(queueHeadProject) : zhCN.projectSwitcher.currentPending
    },
    { label: zhCN.projectSwitcher.summaryMode, value: zhCN.projectSwitcher.modeLive }
  ];
  const commandHeadline = currentProject
    ? `当前项目 ${summaryCurrentText}`
    : queueHeadProject
      ? `优先进入 ${focusProjectName}`
      : zhCN.projectSwitcher.pendingHint;
  const commandStats = [
    {
      title: zhCN.projectSwitcher.summaryProjects,
      value: `${queueProjects.length} 项`
    },
    {
      title: zhCN.projectSwitcher.summaryCurrent,
      value: summaryCurrentText
    },
    {
      title: "默认落点",
      value: landingPath
    },
    {
      title: "最近进入",
      value: focusVisitCount > 0 ? `${focusVisitCount} 次` : "无记录"
    }
  ];
  const workspaceTitle = focusProject ? focusProjectName : zhCN.projectSwitcher.title;
  const workspaceMeta = [
    focusProject ? focusLiveState.label : zhCN.projectSwitcher.latestPending,
    `${zhCN.projectSwitcher.metricCop} ${resolveCopValue(focusOverviewState)}`,
    `${zhCN.projectSwitcher.metricPower} ${resolvePowerValue(focusOverviewState)}`,
    `${zhCN.projectSwitcher.metricAlarms} ${resolveAlarmValue(focusOverviewState)}`,
    `默认落点 ${landingPath}`,
    focusProject ? `上次进入 ${focusLastVisited}` : null,
    `${zhCN.projectSwitcher.latestDataLabel} ${resolveLatestOverviewTime(focusOverviewState)}`
  ].filter((item): item is string => Boolean(item));

  useEffect(() => {
    if (autoEnterTriggeredRef.current) {
      return;
    }
    if (switchingProjectId || currentProjectOptionId) {
      return;
    }
    const firstProject = sortedProjects[0];
    if (!firstProject) {
      return;
    }

    autoEnterTriggeredRef.current = true;
    handleProjectEnter(resolveProjectOptionId(firstProject));
  }, [currentProjectOptionId, sortedProjects, switchingProjectId]);

  return (
    <div className="project-switch-page page-enter">
      <section className="project-switch-header subpage-command-board">
        <div className="project-switch-command-copy subpage-command-copy">
          <p className="project-switch-command-eyebrow">{runtimeConfig.appModeLabel}</p>
          <h2>{zhCN.projectSwitcher.title}</h2>
          <div className="project-switch-command-tags">
            {commandTags.map((item) => (
              <span key={item.label}>
                <strong>{item.label}</strong>
                <em>{item.value}</em>
              </span>
            ))}
            <label className="project-switch-search">
              <Search size={14} />
              <input
                type="search"
                value={projectSearchQuery}
                onChange={(event) => setProjectSearchQuery(event.target.value)}
                placeholder="搜索项目"
                aria-label="搜索项目"
              />
              {projectSearchQuery ? (
                <button type="button" onClick={() => setProjectSearchQuery("")} aria-label="清空项目搜索">
                  <X size={13} />
                </button>
              ) : null}
            </label>
          </div>
          <div className="project-switch-command-summary-grid">
            {commandStats.map((item) => (
              <article key={`${item.title}-${item.value}`} className="project-switch-command-stat">
                <span>{item.title}</span>
                <strong>{item.value}</strong>
              </article>
            ))}
          </div>
        </div>
        <div className="project-switch-command-side subpage-command-side">
          <span className="project-switch-command-side-label">当前判断</span>
          <div className="project-switch-command-note">
            <strong>{commandHeadline}</strong>
          </div>
        </div>
      </section>

      {queueProjects.length > 0 ? (
        <>
          <div className="project-switch-workspace-stage">
            <div className="project-switch-workspace-stage-copy">
              <strong>{workspaceTitle}</strong>
            </div>
            <div className="project-switch-workspace-stage-meta">
              {workspaceMeta.map((item) => (
                <span key={item}>{item}</span>
              ))}
            </div>
          </div>

          <section className="project-switch-queue-shell">
            <div className="project-switch-queue-head">
              <div>
                <span>项目队列</span>
              </div>
            </div>

            <section className="project-switch-grid">
              {visibleProjects.length > 0 ? (
                visibleProjects.map((project, index) => {
                  const projectOptionId = resolveProjectOptionId(project);
                  const isCurrent = selectedProjectOptionId === projectOptionId;
                  const isSwitching = switchingProjectId === projectOptionId;
                  const overviewState = projectOverviewMap[projectOptionId];
                  const liveState = resolveProjectLiveState(overviewState);
                  const copValue = resolveCopValue(overviewState);
                  const copTone = resolveCopTone(overviewState);
                  const powerValue = resolvePowerValue(overviewState);
                  const alarmValue = resolveAlarmValue(overviewState);
                  const displayName = resolveQueueDisplayName(project);
                  const visitStat = projectVisitStats[project.siteId];
                  const visitCount = visitStat?.visitCount || 0;
                  const lastVisitedAt = formatCompactVisitTime(visitStat?.lastVisitedAt || null);
                  const cardMetaItems = [
                    `${zhCN.projectSwitcher.siteIdLabel} ${project.siteId}`,
                    resolveProjectConfigLabel(project),
                    `上次 ${lastVisitedAt}`
                  ];

                  return (
                    <article
                      key={projectOptionId}
                      data-project-id={projectOptionId}
                      data-site-id={project.siteId}
                      data-site-name={displayName}
                      className={`project-switch-card${isCurrent ? " is-current project-switch-card--selected" : ""} tone-${liveState.tone}`}
                    >
                      <div className="project-switch-card-top">
                        <div className="project-switch-card-head">
                          <span className="project-switch-rank">{`队列 ${String(index + 1).padStart(2, "0")}`}</span>
                          <strong title={displayName}>{displayName}</strong>
                          <small>
                            {isCurrent
                              ? "当前项目"
                              : visitCount > 0
                                ? `访问 ${visitCount} 次 / ${lastVisitedAt}`
                                : "未访问"}
                          </small>
                        </div>
                        <div className="project-switch-card-pills">
                          {isCurrent ? <span className="project-switch-state-pill is-current">{zhCN.projectSwitcher.currentTag}</span> : null}
                          <span className={`project-switch-state-pill tone-${liveState.tone}`}>{liveState.label}</span>
                        </div>
                      </div>

                      <div className="project-switch-card-band">
                        <article>
                          <span>{zhCN.projectSwitcher.metricCop}</span>
                          <strong
                            className={
                              copValue === zhCN.projectSwitcher.metricPending
                                ? "is-pending"
                                : copTone
                                  ? `tone-${copTone}`
                                  : undefined
                            }
                          >
                            {copValue}
                          </strong>
                        </article>
                        <article>
                          <span>{zhCN.projectSwitcher.metricPower}</span>
                          <strong className={powerValue === zhCN.projectSwitcher.metricPending ? "is-pending" : undefined}>{powerValue}</strong>
                        </article>
                        <article>
                          <span>{zhCN.projectSwitcher.metricAlarms}</span>
                          <strong className={alarmValue === zhCN.projectSwitcher.metricPending ? "is-pending" : undefined}>{alarmValue}</strong>
                        </article>
                      </div>

                      <div className="project-switch-card-meta">
                        <span className="project-switch-location" title={project.city || zhCN.common.unknown}>
                          <MapPinned size={14} />
                          {project.city || zhCN.common.unknown}
                        </span>
                        {cardMetaItems.map((item) => (
                          <span key={item} title={item}>{item}</span>
                        ))}
                      </div>

                      <button
                        className="project-switch-cta"
                        type="button"
                        data-site-id={project.siteId}
                        onClick={() => handleProjectEnter(projectOptionId)}
                        disabled={Boolean(switchingProjectId)}
                      >
                        <Layers3 size={15} />
                        {isSwitching
                          ? zhCN.projectSwitcher.switching
                          : isCurrent
                            ? zhCN.projectSwitcher.enterAction
                            : zhCN.projectSwitcher.switchAction}
                        <ChevronRight size={15} />
                      </button>
                    </article>
                  );
                })
              ) : (
                <div className="project-switch-empty-search" role="status">
                  <strong>无匹配项目</strong>
                </div>
              )}
            </section>
          </section>
        </>
      ) : (
        <section className="section-card">
          <div className="section-card-header">
            <h3>{zhCN.projectSwitcher.emptyTitle}</h3>
          </div>
          <div className="section-card-body">
            <p>{zhCN.projectSwitcher.emptySubtitle}</p>
          </div>
        </section>
      )}
    </div>
  );
}
