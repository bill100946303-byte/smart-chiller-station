import { ArrowLeftRight, BellRing, BookOpen, Box, ChartColumnIncreasing, ChevronDown, ChevronRight, ClipboardList, Cpu, Fan, FileText, Gauge, LayoutGrid, LineChart, LogOut, PlugZap, Settings2, Sparkles, Video, Wind, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { runtimeConfig } from "../config/runtimeConfig";
import { ShellProjectDisplayProvider } from "../context/ShellProjectDisplayContext";
import { getCurrentLocale, getLocaleOptions, setCurrentLocale, zhCN } from "../i18n/zhCN";
import { getProjectVisitStats, recordProjectVisit } from "../services/projectSession";
import {
  type AuthProject,
  clearAuthSession,
  getAuthSession,
  getCurrentProject,
  resolveAuthProjectId,
  getSwitchableProjects,
  resolveAuthProjectDisplayName,
  selectAuthProject
} from "../services/auth";
import { appendSiteIdToPath, buildScopedLocationPath, siteIdsEquivalent } from "../services/siteRouting";
import { preloadSceneFloorModels } from "../services/sceneFloorModelCache";

type CascadedProjectNode = {
  key: string;
  label: string;
  optionId?: string;
  project?: AuthProject;
  order: number;
  children: CascadedProjectNode[];
};

type CascadedProjectTree = {
  roots: CascadedProjectNode[];
  ancestorKeysByOptionId: Record<string, string[]>;
};

type ProjectDropdownEntry =
  | {
      type: "single";
      key: string;
      label: string;
      optionId: string;
      order: number;
    }
  | {
      type: "group";
      key: string;
      label: string;
      order: number;
      children: ProjectDropdownOption[];
    };

type ProjectDropdownOption = {
  key: string;
  label: string;
  optionId: string;
  order: number;
};

const DEFAULT_INTERMEDIATE_PROJECT_LABELS = new Set(["默认", "default"]);

function scoreDropdownLabel(value: string): number {
  const normalized = normalizeProjectLabel(value);
  if (!normalized) {
    return 0;
  }
  if (/[\u3400-\u9fff]/.test(normalized)) {
    return 5;
  }
  if (/^\d+$/.test(normalized)) {
    return 1;
  }
  if (/^[A-Za-z0-9._-]+$/.test(normalized)) {
    return 2;
  }
  return 3;
}

function pickDropdownLabel(...candidates: Array<string | null | undefined>): string {
  let best = "";
  let bestScore = -1;
  candidates.forEach((candidate) => {
    const normalized = normalizeProjectLabel(candidate);
    if (!normalized) {
      return;
    }
    const score = scoreDropdownLabel(normalized) * 1000 + normalized.length;
    if (score > bestScore) {
      best = normalized;
      bestScore = score;
    }
  });
  return best;
}

function resolveCurrentProjectDisplayNameFromDropdown(
  currentOptionId: string,
  fallbackLabel: string,
  entries: ProjectDropdownEntry[],
  projects: AuthProject[]
): string {
  const optionItems: Array<{ optionId: string; label: string }> = [];
  entries.forEach((entry) => {
    if (entry.type === "single") {
      optionItems.push({
        optionId: entry.optionId,
        label: entry.label
      });
      return;
    }
    entry.children.forEach((child) => {
      optionItems.push({
        optionId: child.optionId,
        label: child.label
      });
    });
  });

  if (!currentOptionId) {
    return fallbackLabel;
  }

  const matchedByOptionId = optionItems.find((item) => item.optionId === currentOptionId);
  if (matchedByOptionId?.label) {
    return matchedByOptionId.label;
  }

  const currentProject = projects.find((project) => resolveAuthProjectId(project) === currentOptionId) || null;
  const currentSiteId = normalizeProjectLabel(currentProject?.siteId);
  if (!currentSiteId) {
    return fallbackLabel;
  }

  const sameSiteOptions = optionItems
    .map((item) => {
      const project = projects.find((candidate) => resolveAuthProjectId(candidate) === item.optionId);
      if (!project || !siteIdsEquivalent(project.siteId, currentSiteId)) {
        return null;
      }
      return item;
    })
    .filter((item): item is { optionId: string; label: string } => item != null);

  if (sameSiteOptions.length > 0) {
    const preferred = sameSiteOptions
      .slice()
      .sort((left, right) => {
        const scoreDiff = scoreDropdownLabel(right.label) - scoreDropdownLabel(left.label);
        if (scoreDiff !== 0) {
          return scoreDiff;
        }
        return right.label.length - left.label.length;
      })[0];
    if (preferred?.label) {
      return preferred.label;
    }
  }

  return fallbackLabel;
}

function resolveProjectCardDisplayNameFromDropdown(
  currentOptionId: string,
  fallbackLabel: string,
  entries: ProjectDropdownEntry[]
): string {
  if (!currentOptionId) {
    return fallbackLabel;
  }

  for (const entry of entries) {
    if (entry.type === "single") {
      if (entry.optionId === currentOptionId) {
        return entry.label || fallbackLabel;
      }
      continue;
    }

    const matchedChild = entry.children.find((child) => child.optionId === currentOptionId);
    if (!matchedChild) {
      continue;
    }

    const parentLabel = normalizeProjectLabel(entry.label);
    const childLabel = normalizeProjectLabel(matchedChild.label);
    if (!parentLabel) {
      return childLabel || fallbackLabel;
    }
    if (!childLabel || childLabel === parentLabel || childLabel.startsWith(`${parentLabel}-`)) {
      return childLabel || parentLabel || fallbackLabel;
    }
    return `${parentLabel}-${childLabel}`;
  }

  return fallbackLabel;
}

function formatNowLabel(locale: string): string {
  return new Date().toLocaleString(locale, {
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

const PROJECT_CASCADE_SPLITTER = /^(.+?)\s*[-\uFF0D\u2014\u2013]\s*(.+)$/;

function normalizeProjectLabel(value: string | null | undefined): string {
  return String(value || "").trim();
}

function splitProjectCascadeLabel(label: string): { parentLabel: string; childLabel: string } | null {
  const normalized = normalizeProjectLabel(label);
  if (!normalized) {
    return null;
  }
  const matched = normalized.match(PROJECT_CASCADE_SPLITTER);
  if (!matched) {
    return null;
  }
  const parentLabel = String(matched[1] || "").trim();
  const childLabel = String(matched[2] || "").trim();
  if (!parentLabel || !childLabel) {
    return null;
  }
  return {
    parentLabel,
    childLabel
  };
}

function resolveProjectNodeMeta(project: AuthProject): {
  optionId: string;
  displayLabel: string;
  nodeLabel: string;
  parentLabel: string;
  parentProjectId: string;
  lookupLabels: string[];
} {
  const optionId = resolveAuthProjectId(project);
  const displayLabel = resolveAuthProjectDisplayName(project, project.siteId);
  const explicitParentLabel = normalizeProjectLabel(project.parentProjectLabel);
  const explicitParentProjectId = normalizeProjectLabel(project.parentProjectId);
  const displaySplit = splitProjectCascadeLabel(displayLabel);
  const fallbackSplit =
    splitProjectCascadeLabel(normalizeProjectLabel(project.siteCode || "")) ||
    splitProjectCascadeLabel(normalizeProjectLabel(project.siteName || "")) ||
    splitProjectCascadeLabel(normalizeProjectLabel(project.appExplain || ""));
  const parentLabel = explicitParentLabel || displaySplit?.parentLabel || fallbackSplit?.parentLabel || "";
  const nodeLabel =
    (displaySplit && (!explicitParentLabel || displaySplit.parentLabel === explicitParentLabel))
      ? displaySplit.childLabel
      : displayLabel;

  const lookupLabels = Array.from(
    new Set(
      [
        nodeLabel,
        displayLabel,
        normalizeProjectLabel(project.siteName),
        normalizeProjectLabel(project.siteCode),
        normalizeProjectLabel(project.appExplain)
      ].filter(Boolean)
    )
  );

  return {
    optionId,
    displayLabel,
    nodeLabel,
    parentLabel,
    parentProjectId: explicitParentProjectId,
    lookupLabels
  };
}

function sortProjectTreeNodes(nodes: CascadedProjectNode[]): CascadedProjectNode[] {
  return nodes
    .slice()
    .sort((left, right) => left.order - right.order)
    .map((node) => ({
      ...node,
      children: sortProjectTreeNodes(node.children)
    }));
}

function buildCascadedProjectTree(projects: AuthProject[]): CascadedProjectTree {
  if (!projects.length) {
    return {
      roots: [],
      ancestorKeysByOptionId: {}
    };
  }

  const projectNodeByKey = new Map<string, CascadedProjectNode>();
  const parentLabelByNodeKey = new Map<string, string>();
  const parentProjectIdByNodeKey = new Map<string, string>();
  const nodeKeyByModelKey = new Map<string, string>();
  const labelIndex = new Map<string, string[]>();

  projects.forEach((project, index) => {
    const { optionId, nodeLabel, parentLabel, parentProjectId, lookupLabels } = resolveProjectNodeMeta(project);
    const node: CascadedProjectNode = {
      key: optionId,
      label: nodeLabel,
      optionId,
      project,
      order: index,
      children: []
    };
    projectNodeByKey.set(optionId, node);
    if (parentLabel) {
      parentLabelByNodeKey.set(optionId, parentLabel);
    }
    if (parentProjectId) {
      parentProjectIdByNodeKey.set(optionId, parentProjectId);
    }
    const modelKey = normalizeProjectLabel(project.modelKey);
    if (modelKey && !nodeKeyByModelKey.has(modelKey)) {
      nodeKeyByModelKey.set(modelKey, optionId);
    }
    lookupLabels.forEach((label) => {
      const normalized = normalizeProjectLabel(label);
      if (!normalized) {
        return;
      }
      const current = labelIndex.get(normalized) || [];
      labelIndex.set(normalized, [...current, optionId]);
    });
  });

  const virtualNodeByParentLabel = new Map<string, CascadedProjectNode>();
  const parentKeyByNodeKey = new Map<string, string>();

  function resolveOrCreateVirtualNode(parentLabel: string, order: number): CascadedProjectNode {
    const normalizedParentLabel = normalizeProjectLabel(parentLabel);
    const existing = virtualNodeByParentLabel.get(normalizedParentLabel);
    if (existing) {
      if (order < existing.order) {
        existing.order = order;
      }
      return existing;
    }
    const created: CascadedProjectNode = {
      key: `virtual::${normalizedParentLabel}`,
      label: parentLabel,
      order,
      children: []
    };
    virtualNodeByParentLabel.set(normalizedParentLabel, created);
    return created;
  }

  projects.forEach((project, index) => {
    const optionId = resolveAuthProjectId(project);
    const childNode = projectNodeByKey.get(optionId);
    if (!childNode) {
      return;
    }
    const explicitParentProjectId = parentProjectIdByNodeKey.get(optionId);
    if (explicitParentProjectId) {
      const parentNodeKey = nodeKeyByModelKey.get(explicitParentProjectId);
      const parentNode = parentNodeKey ? projectNodeByKey.get(parentNodeKey) : null;
      if (parentNode && parentNode.key !== childNode.key) {
        parentNode.children.push(childNode);
        parentKeyByNodeKey.set(childNode.key, parentNode.key);
      }
      return;
    }
    const rawParentLabel = parentLabelByNodeKey.get(optionId);
    if (!rawParentLabel) {
      return;
    }
    const normalizedParentLabel = normalizeProjectLabel(rawParentLabel);
    if (!normalizedParentLabel) {
      return;
    }

    const parentCandidates = (labelIndex.get(normalizedParentLabel) || [])
      .map((candidateKey) => projectNodeByKey.get(candidateKey))
      .filter((candidate): candidate is CascadedProjectNode => candidate != null && candidate.key !== childNode.key);
    const parentNode = parentCandidates[0] || resolveOrCreateVirtualNode(rawParentLabel, index - 0.1);
    parentNode.children.push(childNode);
    parentKeyByNodeKey.set(childNode.key, parentNode.key);
  });

  const roots: CascadedProjectNode[] = [
    ...Array.from(projectNodeByKey.values()).filter((node) => !parentKeyByNodeKey.has(node.key)),
    ...Array.from(virtualNodeByParentLabel.values()).filter((node) => !parentKeyByNodeKey.has(node.key))
  ];

  const ancestorKeysByOptionId: Record<string, string[]> = {};
  Array.from(projectNodeByKey.values()).forEach((node) => {
    if (!node.optionId) {
      return;
    }
    const ancestors: string[] = [];
    let cursor = node.key;
    while (parentKeyByNodeKey.has(cursor)) {
      const parentKey = parentKeyByNodeKey.get(cursor);
      if (!parentKey) {
        break;
      }
      ancestors.unshift(parentKey);
      cursor = parentKey;
    }
    ancestorKeysByOptionId[node.optionId] = ancestors;
  });

  return {
    roots: sortProjectTreeNodes(roots),
    ancestorKeysByOptionId
  };
}

function buildProjectDropdownEntries(
  roots: CascadedProjectNode[],
  switchableOptionIds: Set<string>,
  currentProjectOptionId: string
): {
  entries: ProjectDropdownEntry[];
  groupKeyByOptionId: Record<string, string>;
} {
  type SelectableDescendant = {
    key: string;
    label: string;
    optionId: string;
    depth: number;
    order: number;
    parentProjectLabel?: string;
    semanticKey: string;
  };

  const groupKeyByOptionId: Record<string, string> = {};

  function isHiddenIntermediateNode(node: CascadedProjectNode, depth: number): boolean {
    if (depth !== 1) {
      return false;
    }
    const candidates = [
      resolveAuthProjectDisplayName(node.project, node.label),
      node.label,
      node.project?.appExplain,
      node.project?.siteName,
      node.project?.siteCode
    ];
    const matchesDefault = candidates.some((candidate) => {
      const normalized = normalizeProjectLabel(candidate).toLowerCase();
      return DEFAULT_INTERMEDIATE_PROJECT_LABELS.has(normalized);
    });
    if (matchesDefault) {
      return true;
    }
    const displayLabel = normalizeProjectLabel(resolveAuthProjectDisplayName(node.project, node.label));
    const looksNumericPlaceholder = /^\d{1,3}$/.test(displayLabel);
    if (!looksNumericPlaceholder) {
      return false;
    }
    if (node.children.length > 0) {
      return true;
    }
    return !normalizeProjectLabel(node.project?.modelKey);
  }

  function dedupeSelectableBySemantic(items: SelectableDescendant[]): SelectableDescendant[] {
    return Array.from(
      items.reduce((map, item) => {
        const existing = map.get(item.semanticKey);
        if (!existing) {
          map.set(item.semanticKey, item);
          return map;
        }
        const existingScore = scoreDropdownLabel(existing.label);
        const currentScore = scoreDropdownLabel(item.label);
        if (item.optionId === currentProjectOptionId && existing.optionId !== currentProjectOptionId) {
          map.set(item.semanticKey, item);
          return map;
        }
        if (currentScore > existingScore) {
          map.set(item.semanticKey, item);
          return map;
        }
        if (currentScore === existingScore && item.depth < existing.depth) {
          map.set(item.semanticKey, item);
          return map;
        }
        if (currentScore === existingScore && item.depth === existing.depth && item.order < existing.order) {
          map.set(item.semanticKey, item);
        }
        return map;
      }, new Map<string, SelectableDescendant>()).values()
    ).sort((left, right) => left.order - right.order);
  }

  function buildProjectSemanticKey(project: AuthProject | undefined, optionId: string): string {
    if (!project) {
      return `option::${optionId}`;
    }
    return [
      normalizeProjectLabel(project.siteId),
      normalizeProjectLabel(project.modelKey),
      normalizeProjectLabel(project.template),
      normalizeProjectLabel(project.groupId)
    ].join("::");
  }

  function collectSelectableDescendants(node: CascadedProjectNode, depth: number): SelectableDescendant[] {
    const collected: SelectableDescendant[] = [];
    const hiddenIntermediateNode = isHiddenIntermediateNode(node, depth);
    if (node.optionId && switchableOptionIds.has(node.optionId) && !hiddenIntermediateNode) {
      const displayLabel = resolveAuthProjectDisplayName(node.project, node.label);
      collected.push({
        key: node.key,
        label: displayLabel,
        optionId: node.optionId,
        depth,
        order: node.order,
        parentProjectLabel: normalizeProjectLabel(node.project?.parentProjectLabel),
        semanticKey: buildProjectSemanticKey(node.project, node.optionId)
      });
    }
    node.children.forEach((child) => {
      collected.push(...collectSelectableDescendants(child, depth + 1));
    });
    return collected;
  }

  function collectDeepestSelectableChildren(
    node: CascadedProjectNode,
    depth: number,
    thresholdDepth: number
  ): SelectableDescendant[] {
    if (depth < thresholdDepth) {
      return node.children.flatMap((child) => collectDeepestSelectableChildren(child, depth + 1, thresholdDepth));
    }

    const deeper = node.children.flatMap((child) => collectDeepestSelectableChildren(child, depth + 1, thresholdDepth));
    if (deeper.length > 0) {
      return deeper;
    }

    const hiddenIntermediateNode = isHiddenIntermediateNode(node, depth);
    if (node.optionId && switchableOptionIds.has(node.optionId) && !hiddenIntermediateNode) {
      const displayLabel = resolveAuthProjectDisplayName(node.project, node.label);
      return [{
        key: node.key,
        label: displayLabel,
        optionId: node.optionId,
        depth,
        order: node.order,
        parentProjectLabel: normalizeProjectLabel(node.project?.parentProjectLabel),
        semanticKey: buildProjectSemanticKey(node.project, node.optionId)
      }];
    }
    return [];
  }

  const entries = roots
    .map((root): ProjectDropdownEntry | null => {
      const descendants = collectSelectableDescendants(root, 0)
        .sort((left, right) => left.order - right.order);

      const hasRealRootOption = Boolean(root.optionId && switchableOptionIds.has(root.optionId));
      const childDepthThreshold = hasRealRootOption ? 2 : 1;
      const thirdLevelDescendants = collectDeepestSelectableChildren(root, 0, childDepthThreshold)
        .sort((left, right) => left.order - right.order);
      const rootDisplayLabel = hasRealRootOption
        ? pickDropdownLabel(
            resolveAuthProjectDisplayName(root.project, root.label),
            root.label
          )
        : pickDropdownLabel(
            root.label,
            ...descendants.map((item) => item.parentProjectLabel)
          );

      if (thirdLevelDescendants.length > 0) {
        const uniqueChildren = dedupeSelectableBySemantic(thirdLevelDescendants);

        const highQualityChildren = uniqueChildren.filter((item) => scoreDropdownLabel(item.label) >= 3);
        const filteredChildren = highQualityChildren.length > 0 ? highQualityChildren : uniqueChildren;

        filteredChildren.forEach((item) => {
          groupKeyByOptionId[item.optionId] = root.key;
        });
        return {
          type: "group",
          key: root.key,
          label: rootDisplayLabel || root.label,
          order: root.order,
          children: filteredChildren.map((item) => ({
            key: item.key,
            label: item.label,
            optionId: item.optionId,
            order: item.order
          }))
        };
      }

      if (root.optionId) {
        return {
          type: "single",
          key: root.key,
          label: rootDisplayLabel || resolveAuthProjectDisplayName(root.project, root.label),
          optionId: root.optionId,
          order: root.order
        };
      }

      if (!descendants.length) {
        return null;
      }

      const dedupedDescendants = dedupeSelectableBySemantic(descendants);
      const singleCandidates = hasRealRootOption
        ? dedupedDescendants.filter((item) => item.depth <= 1)
        : dedupedDescendants;
      const nonRootCandidates = singleCandidates.filter((item) => item.depth > 0);
      const prioritizedSingleCandidates = nonRootCandidates.length > 0 ? nonRootCandidates : singleCandidates;
      const representative =
        prioritizedSingleCandidates.find((item) => item.optionId === currentProjectOptionId) ||
        prioritizedSingleCandidates
          .slice()
          .sort((left, right) => {
            const scoreDiff = scoreDropdownLabel(right.label) - scoreDropdownLabel(left.label);
            if (scoreDiff !== 0) {
              return scoreDiff;
            }
            if (left.depth !== right.depth) {
              return right.depth - left.depth;
            }
            return left.order - right.order;
          })[0];
      if (!representative) {
        return null;
      }
      return {
        type: "single",
        key: root.key,
        label: representative.label,
        optionId: representative.optionId,
        order: root.order
      };
    })
    .filter((item): item is ProjectDropdownEntry => Boolean(item))
    .sort((left, right) => left.order - right.order);

  return {
    entries,
    groupKeyByOptionId
  };
}

export default function AppShell() {
  const navigate = useNavigate();
  const location = useLocation();
  const locale = getCurrentLocale();
  const localeOptions = getLocaleOptions();
  const [nowLabel, setNowLabel] = useState(() => formatNowLabel(locale));
  const [switchingProjectId, setSwitchingProjectId] = useState<string | null>(null);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [isProjectDropdownOpen, setIsProjectDropdownOpen] = useState(false);
  const [isLocaleDropdownOpen, setIsLocaleDropdownOpen] = useState(false);
  const [expandedProjectNodeKeys, setExpandedProjectNodeKeys] = useState<string[]>([]);
  const projectDropdownRef = useRef<HTMLDivElement | null>(null);
  const localeDropdownRef = useRef<HTMLDivElement | null>(null);
  const session = getAuthSession();
  const sessionProjects = session?.projects || [];
  const currentProject = getCurrentProject(session);
  const availableProjects = getSwitchableProjects(sessionProjects);
  const fallbackCurrentProjectDisplayName = resolveAuthProjectDisplayName(currentProject, zhCN.appShell.projectPending);
  const projectTree = buildCascadedProjectTree(sessionProjects);
  const currentProjectOptionId = currentProject ? resolveAuthProjectId(currentProject) : "";
  const switchableOptionIds = new Set(availableProjects.map((project) => resolveAuthProjectId(project)));
  const projectByOptionId = new Map(
    sessionProjects.map((project) => [resolveAuthProjectId(project), project] as const)
  );
  const { entries: projectDropdownEntriesRaw, groupKeyByOptionId } = buildProjectDropdownEntries(
    projectTree.roots,
    switchableOptionIds,
    currentProjectOptionId
  );
  const currentProjectDisplayName = resolveCurrentProjectDisplayNameFromDropdown(
    currentProjectOptionId,
    fallbackCurrentProjectDisplayName,
    projectDropdownEntriesRaw,
    sessionProjects
  );
  const currentProjectCardDisplayName = resolveProjectCardDisplayNameFromDropdown(
    currentProjectOptionId,
    currentProjectDisplayName,
    projectDropdownEntriesRaw
  );
  const currentProjectGroupKey = groupKeyByOptionId[currentProjectOptionId] || "";
  const expandedProjectNodeSet = new Set(expandedProjectNodeKeys);
  const normalizedCurrentProjectSiteId = normalizeProjectLabel(currentProject?.siteId);
  const normalizedCurrentProjectDisplayName = normalizeProjectLabel(currentProjectDisplayName);
  const visibleOptionSiteCount = new Map<string, number>();
  projectDropdownEntriesRaw.forEach((entry) => {
    const optionIds = entry.type === "single"
      ? [entry.optionId]
      : entry.children.map((child) => child.optionId);
    optionIds.forEach((optionId) => {
      const project = projectByOptionId.get(optionId);
      const siteId = normalizeProjectLabel(project?.siteId);
      if (!siteId) {
        return;
      }
      visibleOptionSiteCount.set(siteId, (visibleOptionSiteCount.get(siteId) || 0) + 1);
    });
  });

  function isProjectOptionActive(optionId: string, optionLabel: string): boolean {
    if (optionId === currentProjectOptionId) {
      return true;
    }
    if (!normalizedCurrentProjectSiteId || !normalizedCurrentProjectDisplayName) {
      return false;
    }
    const candidateProject = projectByOptionId.get(optionId);
    if (!candidateProject) {
      return false;
    }
    const candidateSiteId = normalizeProjectLabel(candidateProject.siteId);
    if (candidateSiteId !== normalizedCurrentProjectSiteId) {
      return false;
    }
    if (normalizeProjectLabel(optionLabel) === normalizedCurrentProjectDisplayName) {
      return true;
    }
    const sameSiteVisibleOptionCount = visibleOptionSiteCount.get(candidateSiteId) || 0;
    return sameSiteVisibleOptionCount === 1;
  }
  const projectVisitStats = getProjectVisitStats();

  function resolveProjectVisitTimestamp(value: string | null | undefined): number {
    if (!value) {
      return 0;
    }
    const timestamp = new Date(value).getTime();
    return Number.isFinite(timestamp) ? timestamp : 0;
  }

  function compareProjectDropdownOptions(left: ProjectDropdownOption, right: ProjectDropdownOption): number {
    const leftIsActive = isProjectOptionActive(left.optionId, left.label);
    const rightIsActive = isProjectOptionActive(right.optionId, right.label);
    if (leftIsActive !== rightIsActive) {
      return leftIsActive ? -1 : 1;
    }

    const leftProject = projectByOptionId.get(left.optionId);
    const rightProject = projectByOptionId.get(right.optionId);
    const leftVisitStat = leftProject ? projectVisitStats[leftProject.siteId] : undefined;
    const rightVisitStat = rightProject ? projectVisitStats[rightProject.siteId] : undefined;
    const visitCountDiff = (rightVisitStat?.visitCount || 0) - (leftVisitStat?.visitCount || 0);
    if (visitCountDiff !== 0) {
      return visitCountDiff;
    }

    const lastVisitedDiff =
      resolveProjectVisitTimestamp(rightVisitStat?.lastVisitedAt) -
      resolveProjectVisitTimestamp(leftVisitStat?.lastVisitedAt);
    if (lastVisitedDiff !== 0) {
      return lastVisitedDiff;
    }

    const labelDiff = left.label.localeCompare(right.label, "zh-CN", {
      numeric: true,
      sensitivity: "base"
    });
    if (labelDiff !== 0) {
      return labelDiff;
    }
    return left.order - right.order;
  }

  function resolveProjectDropdownEntryScore(entry: ProjectDropdownEntry): {
    isActive: boolean;
    visitCount: number;
    lastVisitedAt: number;
    label: string;
    order: number;
  } {
    const options = entry.type === "single" ? [entry] : entry.children;
    return options.reduce((best, option) => {
      const project = projectByOptionId.get(option.optionId);
      const visitStat = project ? projectVisitStats[project.siteId] : undefined;
      const candidate = {
        isActive: isProjectOptionActive(option.optionId, option.label),
        visitCount: visitStat?.visitCount || 0,
        lastVisitedAt: resolveProjectVisitTimestamp(visitStat?.lastVisitedAt),
        label: entry.label,
        order: entry.order
      };
      if (!best) {
        return candidate;
      }
      if (candidate.isActive !== best.isActive) {
        return candidate.isActive ? candidate : best;
      }
      if (candidate.visitCount !== best.visitCount) {
        return candidate.visitCount > best.visitCount ? candidate : best;
      }
      if (candidate.lastVisitedAt !== best.lastVisitedAt) {
        return candidate.lastVisitedAt > best.lastVisitedAt ? candidate : best;
      }
      return best;
    }, null as null | {
      isActive: boolean;
      visitCount: number;
      lastVisitedAt: number;
      label: string;
      order: number;
    }) || {
      isActive: false,
      visitCount: 0,
      lastVisitedAt: 0,
      label: entry.label,
      order: entry.order
    };
  }

  function compareProjectDropdownEntries(left: ProjectDropdownEntry, right: ProjectDropdownEntry): number {
    const leftScore = resolveProjectDropdownEntryScore(left);
    const rightScore = resolveProjectDropdownEntryScore(right);
    if (leftScore.isActive !== rightScore.isActive) {
      return leftScore.isActive ? -1 : 1;
    }
    if (leftScore.visitCount !== rightScore.visitCount) {
      return rightScore.visitCount - leftScore.visitCount;
    }
    if (leftScore.lastVisitedAt !== rightScore.lastVisitedAt) {
      return rightScore.lastVisitedAt - leftScore.lastVisitedAt;
    }
    const labelDiff = leftScore.label.localeCompare(rightScore.label, "zh-CN", {
      numeric: true,
      sensitivity: "base"
    });
    if (labelDiff !== 0) {
      return labelDiff;
    }
    return leftScore.order - rightScore.order;
  }

  const projectDropdownEntries = projectDropdownEntriesRaw
    .map((entry): ProjectDropdownEntry => {
      if (entry.type === "single") {
        return entry;
      }
      return {
        ...entry,
        children: entry.children.slice().sort(compareProjectDropdownOptions)
      };
    })
    .sort(compareProjectDropdownEntries);
  const showRuntimeBadge = runtimeConfig.appMode !== "local";
  const isDashboardRoute = location.pathname === "/dashboard";
  const isSceneControlRoute = location.pathname === "/scene-control";
  const isProjectSelectionRoute = location.pathname === "/projects";
  const projectRouteShellSubtitle = runtimeConfig.readOnlyMode
    ? `${runtimeConfig.appModeLabel} · ${zhCN.runtimeMode.readOnlyBadge}`
    : runtimeConfig.appModeLabel;
  const projectSelectionTopHint =
    availableProjects.length > 0
      ? `共 ${availableProjects.length} 个项目，当前项目已就绪，可直接切换进入。`
      : zhCN.projectSwitcher.pendingHint;
  const shellSubtitleParts = isProjectSelectionRoute
    ? []
    : currentProject
      ? [currentProject.city, currentProject.siteId ? `项目编号 ${currentProject.siteId}` : ""].filter(Boolean)
      : [];
  const shellTitle = currentProjectCardDisplayName;
  const shellSubtitle = isProjectSelectionRoute
    ? projectRouteShellSubtitle
    : currentProject
      ? shellSubtitleParts.join(" · ")
      : zhCN.projectSwitcher.pendingHint;
  const navModules = [
    {
      key: "dashboard",
      label: zhCN.appShell.navDashboard,
      description: "运行 / 场景",
      icon: <Gauge size={14} />,
      defaultTo: "/dashboard",
      items: [
        { to: "/dashboard", icon: <Gauge size={14} />, label: "运行驾驶舱" },
        { to: "/scene-control", icon: <Box size={14} />, label: "冷站场景" }
      ]
    },
    {
      key: "duty",
      label: zhCN.appShell.navSectionDuty,
      description: "告警 / 日志 / 工单",
      icon: <BellRing size={14} />,
      defaultTo: "/alarms",
      items: [
        { to: "/alarms", icon: <BellRing size={14} />, label: zhCN.appShell.navAlarms },
        { to: "/cold-station-logs", icon: <FileText size={14} />, label: zhCN.appShell.navColdStationLog },
        { to: "/operation-records", icon: <ClipboardList size={14} />, label: zhCN.appShell.navOperationRecords },
        { to: "/work-orders", icon: <ClipboardList size={14} />, label: zhCN.appShell.navWorkOrders },
      ]
    },
    {
      key: "diagnostics",
      label: zhCN.appShell.navSectionDiagnostics,
      description: "总览 / 设备 / 工况",
      icon: <Cpu size={14} />,
      defaultTo: "/system-overview",
      items: [
        { to: "/system-overview", icon: <LayoutGrid size={14} />, label: zhCN.appShell.navSystemOverview },
        { to: "/devices", icon: <Cpu size={14} />, label: zhCN.appShell.navDevices },
        { to: "/power-monitoring", icon: <PlugZap size={14} />, label: "电力监控" },
        { to: "/compressed-air", icon: <Wind size={14} />, label: "空压站" },
        { to: "/hvac-terminal", icon: <Fan size={14} />, label: "空调末端" },
        { to: "/video-monitor", icon: <Video size={14} />, label: zhCN.appShell.navVideoMonitor },
        { to: "/environment-conditions", icon: <Wind size={14} />, label: zhCN.appShell.navEnvironment },
        { to: "/operational-diagnostics", icon: <Gauge size={14} />, label: zhCN.appShell.navOperationalDiagnostics }
      ]
    },
    {
      key: "analysis",
      label: zhCN.appShell.navSectionAnalysis,
      description: "趋势 / 能耗 / 报表",
      icon: <ChartColumnIncreasing size={14} />,
      defaultTo: "/trend-analysis",
      items: [
        { to: "/trend-analysis", icon: <ChartColumnIncreasing size={14} />, label: zhCN.appShell.navTrendAnalysis },
        { to: "/energy-analysis", icon: <LineChart size={14} />, label: zhCN.appShell.navEnergyAnalysis },
        { to: "/energy-efficiency", icon: <FileText size={14} />, label: zhCN.appShell.navEnergyEfficiency },
        { to: "/meter-readings", icon: <FileText size={14} />, label: zhCN.appShell.navMeterReadings },
        { to: "/performance-report", icon: <FileText size={14} />, label: zhCN.appShell.navPerformanceReport },
        { to: "/report-records", icon: <FileText size={14} />, label: zhCN.appShell.navReportRecords }
      ]
    },
    {
      key: "config",
      label: "配置",
      description: "参数 / 知识",
      icon: <BookOpen size={14} />,
      defaultTo: "/energy-parameters",
      items: [
        { to: "/energy-parameters", icon: <FileText size={14} />, label: zhCN.appShell.navEnergyParameters },
        { to: "/config-center", icon: <Settings2 size={14} />, label: "子系统配置" },
        { to: "/knowledge-base", icon: <BookOpen size={14} />, label: zhCN.appShell.navKnowledgeBase }
      ]
    },
    {
      key: "ai",
      label: "AI优化",
      description: "优化建议",
      icon: <Sparkles size={14} />,
      defaultTo: "/ai-overview",
      items: [
        { to: "/ai-overview", icon: <Sparkles size={14} />, label: zhCN.appShell.navAiOverview },
        { to: "/optimize-demo", icon: <Sparkles size={14} />, label: zhCN.appShell.navOptimizeDemo }
      ]
    }
  ];
  const navItems = navModules.flatMap((module) =>
    module.items.map((item) => ({
      ...item,
      moduleKey: module.key,
      moduleLabel: module.label
    }))
  );
  const currentNavItem = navItems.find((item) => item.to === location.pathname);
  const currentNavModule = navModules.find((module) =>
    module.items.some((item) => item.to === location.pathname)
  ) || navModules[0];
  const showSecondaryNav = !isProjectSelectionRoute && currentNavModule.items.length > 1;
  const topHeadingTitle = isProjectSelectionRoute
    ? zhCN.projectSwitcher.heading
    : currentNavModule?.label || currentNavItem?.label || currentProjectCardDisplayName;
  const topHeadingSubtitle = isProjectSelectionRoute
    ? projectSelectionTopHint
    : currentProject
      ? [
          currentNavModule.items.length > 1 && currentNavItem?.label ? `当前页面：${currentNavItem.label}` : "",
          currentProjectCardDisplayName,
          currentProject.city,
          currentProject.siteId ? `项目编号 ${currentProject.siteId}` : ""
        ]
          .filter(Boolean)
          .join(" · ")
      : zhCN.projectSwitcher.pendingHint;
  const currentSiteId = currentProject?.siteId || null;
  const currentLocaleOption = localeOptions.find((item) => item.value === locale) || null;

  function handleLocaleChange(value: string) {
    setIsLocaleDropdownOpen(false);
    setIsProjectDropdownOpen(false);
    if (value !== "zh-CN" && value !== "en-US" && value !== "vi-VN") {
      return;
    }
    if (value === locale) {
      return;
    }
    setCurrentLocale(value);
    window.location.reload();
  }

  useEffect(() => {
    setNowLabel(formatNowLabel(locale));
    const timer = window.setInterval(() => {
      setNowLabel(formatNowLabel(locale));
    }, 30 * 1000);
    return () => {
      window.clearInterval(timer);
    };
  }, [locale]);

  useEffect(() => {
    if (!isProjectDropdownOpen && !isLocaleDropdownOpen) {
      return;
    }

    function handleDocumentPointerDown(event: MouseEvent) {
      const targetNode = event.target as Node;
      const clickedProjectDropdown = projectDropdownRef.current?.contains(targetNode);
      const clickedLocaleDropdown = localeDropdownRef.current?.contains(targetNode);
      if (!clickedProjectDropdown && !clickedLocaleDropdown) {
        setIsProjectDropdownOpen(false);
        setIsLocaleDropdownOpen(false);
      }
    }

    function handleDocumentKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsProjectDropdownOpen(false);
        setIsLocaleDropdownOpen(false);
      }
    }

    document.addEventListener("mousedown", handleDocumentPointerDown);
    document.addEventListener("keydown", handleDocumentKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleDocumentPointerDown);
      document.removeEventListener("keydown", handleDocumentKeyDown);
    };
  }, [isProjectDropdownOpen, isLocaleDropdownOpen]);

  useEffect(() => {
    if (!isProjectDropdownOpen || !currentProjectGroupKey) {
      return;
    }
    setExpandedProjectNodeKeys((current) => (
      current.includes(currentProjectGroupKey)
        ? current
        : [...current, currentProjectGroupKey]
    ));
  }, [currentProjectGroupKey, isProjectDropdownOpen]);

  useEffect(() => {
    if (!currentProject?.siteId) {
      return;
    }
    preloadSceneFloorModels(currentProject.siteId).catch((error) => {
      console.warn("[sceneFloorModels] preload failed", error);
    });
  }, [currentProject?.siteId, currentProjectOptionId]);

  function handleSignOut() {
    clearAuthSession();
    navigate("/login", { replace: true });
  }

  function handleProjectChange(value: string) {
    setIsProjectDropdownOpen(false);
    setIsLocaleDropdownOpen(false);
    if (!value || value === currentProjectOptionId || switchingProjectId) {
      return;
    }
    const nextProject = sessionProjects.find((project) => resolveAuthProjectId(project) === value) || null;
    if (!nextProject) {
      return;
    }

    setSwitchingProjectId(value);
    const nextSession = selectAuthProject(value);
    if (!nextSession) {
      setSwitchingProjectId(null);
      return;
    }

    recordProjectVisit(
      nextProject.siteId,
      resolveAuthProjectDisplayName(
        nextSession.projects?.find((project) => resolveAuthProjectId(project) === value) || nextProject
      )
    );
    const nextPath =
      location.pathname === "/projects"
        ? appendSiteIdToPath("/scene-control", nextProject.siteId)
        : buildScopedLocationPath(location.pathname, location.search, location.hash, nextProject.siteId);
    window.location.assign(nextPath);
  }

  function toggleProjectNode(nodeKey: string) {
    setExpandedProjectNodeKeys((current) => (
      current.includes(nodeKey)
        ? current.filter((item) => item !== nodeKey)
        : [...current, nodeKey]
    ));
  }

  function handleOpenProjectSelection() {
    setIsProjectDropdownOpen(false);
    setIsLocaleDropdownOpen(false);
    const currentPath = buildScopedLocationPath(location.pathname, location.search, location.hash, currentSiteId);
    const nextPath =
      currentPath && currentPath !== "/projects"
        ? appendSiteIdToPath(`/projects?redirect=${encodeURIComponent(currentPath)}`, currentSiteId)
        : appendSiteIdToPath("/projects", currentSiteId);
    navigate(nextPath);
  }

  function closeMobileNav() {
    setIsMobileNavOpen(false);
  }

  function toggleMobileNav() {
    setIsMobileNavOpen((current) => !current);
  }

  function renderProjectDropdownEntry(entry: ProjectDropdownEntry) {
    if (entry.type === "single") {
      const isActive = isProjectOptionActive(entry.optionId, entry.label);
      return (
        <button
          key={entry.key}
          type="button"
          role="option"
          aria-selected={isActive}
          className={`project-switcher-option${isActive ? " is-active" : ""}`}
          onClick={() => handleProjectChange(entry.optionId)}
        >
          <span className="project-switcher-option-main">
            <span className="project-switcher-option-label">{entry.label}</span>
            {isActive ? <span className="project-switcher-option-state">{zhCN.projectSwitcher.currentTag}</span> : null}
          </span>
        </button>
      );
    }

    const isExpanded = expandedProjectNodeSet.has(entry.key);
    const isCurrentGroup = entry.children.some((child) => isProjectOptionActive(child.optionId, child.label));
    return (
      <div key={entry.key} className="project-switcher-group-wrap">
        <button
          type="button"
          className={`project-switcher-group${isExpanded ? " is-open" : ""}${isCurrentGroup ? " is-active" : ""}`}
          onClick={() => toggleProjectNode(entry.key)}
          aria-expanded={isExpanded}
        >
          <span className="project-switcher-group-main">
            <ChevronRight size={14} />
            <span className="project-switcher-group-label">{entry.label}</span>
          </span>
          <span className="project-switcher-group-count">{entry.children.length}</span>
        </button>
        {isExpanded ? (
          <div className="project-switcher-group-children">
            {entry.children.map((child) => {
              const isActive = isProjectOptionActive(child.optionId, child.label);
              return (
                <button
                  key={child.key}
                  type="button"
                  role="option"
                  aria-selected={isActive}
                  className={`project-switcher-option project-switcher-option-child${isActive ? " is-active" : ""}`}
                  onClick={() => handleProjectChange(child.optionId)}
                >
                  <span className="project-switcher-option-main">
                    <span className="project-switcher-option-label">{child.label}</span>
                    {isActive ? <span className="project-switcher-option-state">{zhCN.projectSwitcher.currentTag}</span> : null}
                  </span>
                </button>
              );
            })}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="app-shell" data-mobile-nav-open={isMobileNavOpen ? "true" : "false"}>
      <aside
        id="app-shell-primary-nav"
        className="left-nav"
        data-shell-nav="primary"
        data-mobile-nav-state={isMobileNavOpen ? "open" : "closed"}
      >
        <div className="nav-brand" data-shell-nav-brand>
          <p className="nav-eyebrow">{zhCN.appShell.title}</p>
          <h1>{shellTitle}</h1>
          <p className="nav-subtitle">{shellSubtitle}</p>
          {showRuntimeBadge || runtimeConfig.readOnlyMode ? (
            <div className="nav-status-row">
              {showRuntimeBadge ? (
                <span className="runtime-mode-chip">{runtimeConfig.appModeLabel}</span>
              ) : null}
              {runtimeConfig.readOnlyMode ? (
                <span className="runtime-mode-chip runtime-mode-chip-warn">{zhCN.runtimeMode.readOnlyBadge}</span>
              ) : null}
            </div>
          ) : null}
          <button
            className="nav-close-button"
            type="button"
            onClick={closeMobileNav}
            aria-label="关闭导航"
            data-mobile-nav-close
          >
            <X size={14} />
          </button>
        </div>
        <div className="nav-scroll" data-shell-nav-scroll>
          <nav className="nav-links nav-module-list" data-shell-nav-links>
            {navModules.map((module) => (
              <NavLink
                key={module.key}
                to={appendSiteIdToPath(module.defaultTo, currentSiteId)}
                className={() => `nav-module-link${currentNavModule.key === module.key ? " active" : ""}`}
                onClick={closeMobileNav}
                data-shell-nav-link
                data-shell-nav-module={module.key}
                data-shell-nav-target={module.defaultTo}
              >
                <span className="nav-module-icon">{module.icon}</span>
                <span className="nav-module-copy">
                  <strong>{module.label}</strong>
                  <small>{module.description}</small>
                </span>
                <span className="nav-module-count">{module.items.length}</span>
              </NavLink>
            ))}
          </nav>
        </div>
        <button className="exit-link" type="button" onClick={handleSignOut} data-shell-nav-exit>
          <LogOut size={14} /> {zhCN.appShell.signOut}
        </button>
      </aside>
      <button
        type="button"
        className="nav-overlay"
        onClick={closeMobileNav}
        aria-label="关闭导航"
        aria-hidden={isMobileNavOpen ? "false" : "true"}
        tabIndex={isMobileNavOpen ? 0 : -1}
        data-mobile-nav-overlay
      />
      <main data-shell-main>
        <header className="top-bar" data-shell-topbar>
          <div className="top-left">
            <button
              className="mobile-nav-toggle"
              type="button"
              onClick={toggleMobileNav}
              aria-label={isMobileNavOpen ? "关闭导航" : "打开导航"}
              aria-expanded={isMobileNavOpen}
              aria-controls="app-shell-primary-nav"
              data-mobile-nav-toggle
            >
              <span className="mobile-nav-toggle-line" />
              <span className="mobile-nav-toggle-line" />
              <span className="mobile-nav-toggle-line" />
            </button>
            <div className="top-heading">
              <strong>{topHeadingTitle}</strong>
              <span>{topHeadingSubtitle}</span>
            </div>
          </div>
          <div className="top-right">
            {availableProjects.length > 1 ? (
              <div className="top-project-controls">
                <button
                  className="top-action-button"
                  type="button"
                  onClick={handleOpenProjectSelection}
                  disabled={location.pathname === "/projects"}
                >
                  <ArrowLeftRight size={14} />
                  {zhCN.appShell.projectSelectionButton}
                </button>
            <label className="project-switcher">
              <span>{zhCN.appShell.projectLabel}</span>
                  <div className="project-switcher-dropdown" ref={projectDropdownRef}>
                    <button
                      type="button"
                      className={`project-switcher-trigger${isProjectDropdownOpen ? " is-open" : ""}`}
                      onClick={() => {
                        setIsProjectDropdownOpen((current) => !current);
                        setIsLocaleDropdownOpen(false);
                      }}
                      disabled={Boolean(switchingProjectId)}
                      aria-haspopup="listbox"
                      aria-expanded={isProjectDropdownOpen}
                      aria-controls="top-project-switcher-listbox"
                    >
                      <span className="project-switcher-trigger-text">
                        {currentProject ? currentProjectDisplayName : zhCN.appShell.projectSelectPlaceholder}
                      </span>
                      <ChevronDown size={14} />
                    </button>
                    {isProjectDropdownOpen ? (
                      <div
                        id="top-project-switcher-listbox"
                        className="project-switcher-menu"
                        role="listbox"
                        aria-label={zhCN.appShell.projectLabel}
                      >
                        {projectDropdownEntries.map((entry) => renderProjectDropdownEntry(entry))}
                      </div>
                    ) : null}
                  </div>
                </label>
              </div>
            ) : null}
            <div className="top-system-meta">
              <span className="top-user" title={`${zhCN.appShell.currentUserPrefix}${session?.username || zhCN.common.unknown}`}>
                {session?.username || zhCN.common.unknown}
              </span>
              <span className="top-time" title={nowLabel}>{nowLabel}</span>
              <label className="locale-switcher">
                <span>{zhCN.appShell.languageLabel}</span>
                <div className="locale-switcher-dropdown" ref={localeDropdownRef}>
                  <button
                    type="button"
                    className={`locale-switcher-trigger${isLocaleDropdownOpen ? " is-open" : ""}`}
                    onClick={() => {
                      setIsLocaleDropdownOpen((current) => !current);
                      setIsProjectDropdownOpen(false);
                    }}
                    aria-haspopup="listbox"
                    aria-expanded={isLocaleDropdownOpen}
                    aria-controls="top-locale-switcher-listbox"
                  >
                    <span className="locale-switcher-trigger-text">{currentLocaleOption?.label || locale}</span>
                    <ChevronDown size={14} />
                  </button>
                  {isLocaleDropdownOpen ? (
                    <div
                      id="top-locale-switcher-listbox"
                      className="locale-switcher-menu"
                      role="listbox"
                      aria-label={zhCN.appShell.languageLabel}
                    >
                      {localeOptions.map((item) => {
                        const isActive = item.value === locale;
                        return (
                          <button
                            key={item.value}
                            type="button"
                            role="option"
                            aria-selected={isActive}
                            className={`locale-switcher-option${isActive ? " is-active" : ""}`}
                            onClick={() => handleLocaleChange(item.value)}
                          >
                            <span className="locale-switcher-option-label">{item.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              </label>
            </div>
          </div>
        </header>
        {showSecondaryNav ? (
          <nav className="secondary-nav" data-shell-secondary-nav aria-label={`${currentNavModule.label}二级导航`}>
            <span className="secondary-nav-title">{currentNavModule.label}</span>
            <div className="secondary-nav-links">
              {currentNavModule.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={appendSiteIdToPath(item.to, currentSiteId)}
                  end
                  className={({ isActive }) => `secondary-nav-link${isActive ? " active is-current" : ""}`}
                  data-shell-secondary-nav-link
                  data-shell-nav-target={item.to}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </NavLink>
              ))}
            </div>
            <span className="secondary-nav-count">{currentNavModule.items.length} 项入口</span>
          </nav>
        ) : null}
        <div
          className={`content ${isDashboardRoute ? "is-dashboard-content" : "is-subpage-compact"}${isSceneControlRoute ? " is-scene-embed-content" : ""}${showSecondaryNav ? " has-secondary-nav" : ""}`}
          data-shell-content
        >
          <ShellProjectDisplayProvider value={currentProjectCardDisplayName}>
            <Outlet />
          </ShellProjectDisplayProvider>
        </div>
      </main>
    </div>
  );
}
