import { ArrowLeftRight, BellRing, BookOpen, Box, ChartColumnIncreasing, ChevronDown, ChevronRight, ClipboardList, Cpu, Fan, FileText, Flame, Gauge, LayoutGrid, LineChart, LogOut, Network, PlugZap, Settings2, Sparkles, Video, Wind, X } from "lucide-react";
import {
  type KeyboardEvent as ReactKeyboardEvent,
  useEffect,
  useLayoutEffect,
  useRef,
  useState
} from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { runtimeConfig } from "../config/runtimeConfig";
import "./AppShellMobile.css";
import "./AppShellRole.css";
import "./AppShellStation.css";
import { ShellProjectDisplayProvider } from "../context/ShellProjectDisplayContext";
import { StationRuntimeScopeProvider } from "../context/StationRuntimeScopeContext";
import { prioritizeNavigationModules, resolveNavigationPerspective } from "../config/navigationPolicy";
import {
  appendEnergyStationContextToPath,
  clearEnergyStationContextFromSearch,
  ENERGY_OBJECT_SEMANTIC_GROUPS,
  ENERGY_STATION_DEFINITIONS,
  isEnergyStationVisible,
  isPhysicalStationParentType,
  isStationWorkspaceRouteSupported,
  readEnergyStationIdFromSearch,
  readEnergyStationTypeFromSearch,
  resolveStationRuntimeBindingMode,
  resolveStationWorkspaceRoutePolicy,
  type EnergyStationIconKey,
  type EnergyStationType,
  type StationCapabilityLoadState,
  type StationFunctionIconKey
} from "../config/energyStationNavigation";
import { getCurrentLocale, getLocaleOptions, setCurrentLocale, zhCN } from "../i18n/zhCN";
import { getProjectVisitStats, recordProjectVisit } from "../services/projectSession";
import {
  type AuthProject,
  clearAuthSession,
  getAuthSession,
  getCurrentProject,
  resolveAuthProjectId,
  resolveEnergyConfigSiteId,
  getSwitchableProjects,
  resolveAuthProjectDisplayName,
  selectAuthProject
} from "../services/auth";
import {
  fetchSiteCapabilities,
  type RuntimeStationInstanceDto,
  type RuntimeSubsystemCapabilityDto,
  type RuntimeSubsystemCapabilityListDto
} from "../services/bffClient";
import {
  appendSiteIdToPath,
  buildScopedLocationPath,
  clearCrossProjectTransientContextFromSearch,
  siteIdsEquivalent
} from "../services/siteRouting";
import { preloadSceneFloorModels } from "../services/sceneFloorModelCache";
import { getSubsystemStatusPresentation } from "../utils/subsystemStatus";

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

const PROJECT_SWITCHER_TRIGGER_ID = "top-project-switcher-trigger";
const PROJECT_SWITCHER_LABEL_ID = "top-project-switcher-label";
const PROJECT_SWITCHER_TREE_ID = "top-project-switcher-tree";
const PROJECT_SWITCHER_VALUE_ID = "top-project-switcher-value";
const LOCALE_SWITCHER_TRIGGER_ID = "top-locale-switcher-trigger";
const LOCALE_SWITCHER_LABEL_ID = "top-locale-switcher-label";
const LOCALE_SWITCHER_LISTBOX_ID = "top-locale-switcher-listbox";
const LOCALE_SWITCHER_VALUE_ID = "top-locale-switcher-value";

function buildStableDomId(prefix: string, value: string): string {
  const suffix = value
    ? Array.from(value)
        .map((character) => character.codePointAt(0)?.toString(16) || "x")
        .join("-")
    : "empty";
  return `${prefix}-${suffix}`;
}

function resolveProjectOptionDomId(optionId: string): string {
  return buildStableDomId("top-project-switcher-option", optionId);
}

function resolveProjectGroupDomId(groupKey: string): string {
  return buildStableDomId("top-project-switcher-group", groupKey);
}

function resolveProjectChildrenGroupDomId(groupKey: string): string {
  return buildStableDomId("top-project-switcher-children", groupKey);
}

function resolveLocaleOptionDomId(localeCode: string): string {
  return buildStableDomId("top-locale-switcher-option", localeCode);
}

const DEFAULT_INTERMEDIATE_PROJECT_LABELS = new Set(["默认", "default"]);

function renderEnergyStationIcon(iconKey: EnergyStationIconKey) {
  switch (iconKey) {
    case "compressed-air":
      return <Wind size={14} />;
    case "boiler":
      return <Flame size={14} />;
    case "power":
      return <PlugZap size={14} />;
    case "terminal":
      return <Fan size={14} />;
    default:
      return <Box size={14} />;
  }
}

function renderStationFunctionIcon(iconKey: StationFunctionIconKey) {
  switch (iconKey) {
    case "twin":
      return <Network size={14} />;
    case "overview":
      return <LayoutGrid size={14} />;
    default:
      return <Box size={14} />;
  }
}

function resolvePublishedStationBindingVersion(
  instance: RuntimeStationInstanceDto | null | undefined
): number | null {
  if (!instance) {
    return null;
  }
  const publishedVersion = instance.publishedBindingVersion
    ?? (instance.bindingState === "published" ? instance.bindingVersion : null);
  return Number.isSafeInteger(publishedVersion) && Number(publishedVersion) > 0
    ? Number(publishedVersion)
    : null;
}

function formatStationInstanceBindingLabel(instance: RuntimeStationInstanceDto): string {
  const publishedVersion = resolvePublishedStationBindingVersion(instance);
  if (Number.isSafeInteger(publishedVersion) && Number(publishedVersion) > 0) {
    return zhCN.appShell.navStationBindingPublished.replace("{version}", String(publishedVersion));
  }
  if (instance.bindingState === "validated" && Number.isSafeInteger(instance.draftBindingVersion)) {
    return zhCN.appShell.navStationBindingValidated.replace(
      "{version}",
      String(instance.draftBindingVersion)
    );
  }
  if (Number.isSafeInteger(instance.draftBindingVersion) && Number(instance.draftBindingVersion) > 0) {
    return zhCN.appShell.navStationBindingDraft.replace(
      "{version}",
      String(instance.draftBindingVersion)
    );
  }
  return zhCN.appShell.navStationBindingUnconfigured;
}

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
  const [isCompactViewport, setIsCompactViewport] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia("(max-width: 900px)").matches : false
  );
  const [isProjectDropdownOpen, setIsProjectDropdownOpen] = useState(false);
  const [isLocaleDropdownOpen, setIsLocaleDropdownOpen] = useState(false);
  const [activeProjectTreeItemId, setActiveProjectTreeItemId] = useState<string | null>(null);
  const [activeLocaleOptionId, setActiveLocaleOptionId] = useState<string | null>(null);
  const [openWorkspaceMenuKey, setOpenWorkspaceMenuKey] = useState<string | null>(null);
  const [expandedStationType, setExpandedStationType] = useState<EnergyStationType | null>(null);
  const [expandedProjectNodeKeys, setExpandedProjectNodeKeys] = useState<string[]>([]);
  const [siteCapabilities, setSiteCapabilities] = useState<RuntimeSubsystemCapabilityListDto | null>(null);
  const [stationCapabilityLoadState, setStationCapabilityLoadState] =
    useState<StationCapabilityLoadState>("loading");
  const projectDropdownRef = useRef<HTMLDivElement | null>(null);
  const localeDropdownRef = useRef<HTMLDivElement | null>(null);
  const projectDropdownTriggerRef = useRef<HTMLButtonElement | null>(null);
  const projectTreeRef = useRef<HTMLDivElement | null>(null);
  const pendingProjectTreeFocusIntentRef = useRef<"current" | "first" | "last">("current");
  const localeDropdownTriggerRef = useRef<HTMLButtonElement | null>(null);
  const localeListboxRef = useRef<HTMLDivElement | null>(null);
  const mobileNavToggleRef = useRef<HTMLButtonElement | null>(null);
  const primaryNavRef = useRef<HTMLElement | null>(null);
  const shellMainRef = useRef<HTMLElement | null>(null);
  const session = getAuthSession();
  const sessionProjects = session?.projects || [];
  const currentProject = getCurrentProject(session);
  const capabilitySiteId = resolveEnergyConfigSiteId(currentProject, runtimeConfig.siteId);

  useEffect(() => {
    document.documentElement.lang = locale;
    document.title = zhCN.appShell.title;
  }, [locale]);

  useLayoutEffect(() => {
    if (shellMainRef.current) {
      shellMainRef.current.scrollTop = 0;
      shellMainRef.current.scrollLeft = 0;
    }
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [location.pathname, location.search]);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 900px)");
    const handleViewportChange = (event: MediaQueryListEvent) => {
      setIsCompactViewport(event.matches);
      setOpenWorkspaceMenuKey(null);
      if (!event.matches) {
        setIsMobileNavOpen(false);
      }
    };
    setIsCompactViewport(mediaQuery.matches);
    mediaQuery.addEventListener("change", handleViewportChange);
    return () => mediaQuery.removeEventListener("change", handleViewportChange);
  }, []);

  useEffect(() => {
    let active = true;
    let refreshing = false;

    setSiteCapabilities(null);
    setStationCapabilityLoadState("loading");

    async function loadCapabilities() {
      if (refreshing) {
        return;
      }
      refreshing = true;
      try {
        const result = await fetchSiteCapabilities(capabilitySiteId);
        if (active) {
          setSiteCapabilities(result);
          setStationCapabilityLoadState("ready");
        }
      } catch {
        if (active) {
          setSiteCapabilities(null);
          setStationCapabilityLoadState("error");
        }
      } finally {
        refreshing = false;
      }
    }

    void loadCapabilities();
    const timer = window.setInterval(() => {
      void loadCapabilities();
    }, 30_000);

    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [capabilitySiteId]);

  useEffect(() => {
    if (!isCompactViewport || !isMobileNavOpen) {
      return;
    }
    const navigation = primaryNavRef.current;
    if (!navigation) {
      return;
    }
    const focusableSelector = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';
    const focusFrame = window.requestAnimationFrame(() => {
      const firstFocusable = navigation.querySelector<HTMLElement>(focusableSelector);
      (navigation.querySelector<HTMLElement>("[data-mobile-nav-close]") || firstFocusable)?.focus();
    });

    return () => window.cancelAnimationFrame(focusFrame);
  }, [isCompactViewport, isMobileNavOpen]);

  useEffect(() => {
    if (!isCompactViewport || !isMobileNavOpen) {
      return;
    }
    const navigation = primaryNavRef.current;
    if (!navigation) {
      return;
    }
    const focusableSelector = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

    const handleNavigationKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        if (openWorkspaceMenuKey) {
          setOpenWorkspaceMenuKey(null);
          window.requestAnimationFrame(() => focusVisibleWorkspaceMenuTrigger(openWorkspaceMenuKey));
          return;
        }
        setIsMobileNavOpen(false);
        window.requestAnimationFrame(() => mobileNavToggleRef.current?.focus());
        return;
      }
      if (event.key !== "Tab") {
        return;
      }
      const focusableElements = Array.from(navigation.querySelectorAll<HTMLElement>(focusableSelector))
        .filter((element) => element.getClientRects().length > 0);
      if (focusableElements.length === 0) {
        return;
      }
      const first = focusableElements[0];
      const last = focusableElements[focusableElements.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handleNavigationKeyDown);
    return () => document.removeEventListener("keydown", handleNavigationKeyDown);
  }, [isCompactViewport, isMobileNavOpen, openWorkspaceMenuKey]);
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
  const navigationPerspective = resolveNavigationPerspective(session?.role, runtimeConfig.readOnlyMode);
  const capabilityBySubsystemType = new Map(
    (siteCapabilities?.items || []).map((item) => [item.subsystemType, item] as const)
  );
  const registeredStationInstances = (siteCapabilities?.stationInstances || []).filter((instance) => (
    instance.published !== false &&
    siteIdsEquivalent(instance.siteId, capabilitySiteId) &&
    isPhysicalStationParentType(instance.parentSubsystemType)
  ));
  const stationInstancesBySubsystemType = new Map<EnergyStationType, RuntimeStationInstanceDto[]>();
  for (const instance of registeredStationInstances) {
    const parentSubsystemType = instance.parentSubsystemType as EnergyStationType;
    const current = stationInstancesBySubsystemType.get(parentSubsystemType) || [];
    current.push(instance);
    stationInstancesBySubsystemType.set(parentSubsystemType, current);
  }
  const energyStationItems = ENERGY_STATION_DEFINITIONS.map((definition) => {
    const capability = capabilityBySubsystemType.get(definition.subsystemType) || null;
    const label = zhCN.appShell[definition.labelKey];
    const summary = zhCN.appShell[definition.summaryKey];
    const statusSource: RuntimeSubsystemCapabilityDto | null = capability || (
      stationCapabilityLoadState === "ready"
        ? {
            subsystemType: definition.subsystemType,
            displayName: label,
            status: "not_configured"
          }
        : null
    );
    const status = getSubsystemStatusPresentation(statusSource);
    const functions = definition.functions.map((item) => ({
      to: item.to,
      label: zhCN.appShell[item.labelKey],
      icon: renderStationFunctionIcon(item.iconKey)
    }));
    const alarmCount = status.realDataReady && typeof capability?.alarmCount === "number" && Number.isFinite(capability.alarmCount)
      ? Math.max(0, capability.alarmCount)
      : null;
    const instances = (stationInstancesBySubsystemType.get(definition.subsystemType) || [])
      .slice()
      .sort((left, right) => (
        (left.sortOrder ?? 999) - (right.sortOrder ?? 999) ||
        left.stationName.localeCompare(right.stationName, "zh-CN", { numeric: true, sensitivity: "base" })
      ))
      .map((instance) => {
        const instanceStatus = getSubsystemStatusPresentation({
          siteId: instance.siteId,
          subsystemType: instance.parentSubsystemType,
          displayName: instance.stationName,
          status: instance.status,
          sourceStatus: instance.sourceStatus,
          freshnessStatus: instance.freshnessStatus
        });
        return {
          ...instance,
          statusPresentation: instanceStatus,
          alarmCount: instanceStatus.realDataReady && typeof instance.alarmCount === "number" && Number.isFinite(instance.alarmCount)
            ? Math.max(0, instance.alarmCount)
            : null
        };
      });

    return {
      ...definition,
      label,
      summary,
      icon: renderEnergyStationIcon(definition.iconKey),
      status,
      capability,
      alarmCount,
      instances,
      functions,
      visible: isEnergyStationVisible(status.kind, stationCapabilityLoadState, navigationPerspective)
    };
  });
  const visibleEnergyStationItems = energyStationItems.filter((item) => item.visible);
  const visibleEnergyStationGroups = ENERGY_OBJECT_SEMANTIC_GROUPS
    .map((group) => ({
      ...group,
      label: zhCN.appShell[group.labelKey],
      items: visibleEnergyStationItems.filter((item) => item.semanticGroup === group.key)
    }))
    .filter((group) => group.items.length > 0);
  const stationFunctionItems = energyStationItems.flatMap((station) => station.functions);
  const isDashboardRoute = location.pathname === "/dashboard";
  const isSceneControlRoute = location.pathname === "/scene-control";
  const isAutoTwinRoute = location.pathname === "/auto-twin";
  const isProjectSelectionRoute = location.pathname === "/projects";
  const projectRouteShellSubtitle = runtimeConfig.readOnlyMode
    ? `${runtimeConfig.appModeLabel} · ${zhCN.runtimeMode.readOnlyBadge}`
    : runtimeConfig.appModeLabel;
  const projectSelectionTopHint =
    availableProjects.length > 0
      ? zhCN.projectSwitcher.availableHint.replace("{count}", String(availableProjects.length))
      : zhCN.projectSwitcher.pendingHint;
  const shellSubtitleParts = isProjectSelectionRoute
    ? []
    : currentProject
      ? [currentProject.city, currentProject.siteId ? `${zhCN.projectSwitcher.siteIdLabel} ${currentProject.siteId}` : ""].filter(Boolean)
      : [];
  const shellTitle = currentProjectCardDisplayName;
  const shellSubtitle = isProjectSelectionRoute
    ? projectRouteShellSubtitle
    : currentProject
      ? shellSubtitleParts.join(" · ")
      : zhCN.projectSwitcher.pendingHint;
  const navModules = prioritizeNavigationModules([
    {
      key: "dashboard",
      label: zhCN.appShell.navSectionDashboard,
      description: zhCN.appShell.navDescriptionDashboard,
      icon: <Gauge size={14} />,
      defaultTo: "/dashboard",
      items: [
        { to: "/dashboard", icon: <Gauge size={14} />, label: zhCN.appShell.navOperationDashboard }
      ]
    },
    {
      key: "operations",
      label: zhCN.appShell.navSectionOperations,
      description: zhCN.appShell.navDescriptionOperations,
      icon: <Box size={14} />,
      defaultTo: visibleEnergyStationItems[0]?.defaultTo || "/scene-control",
      items: stationFunctionItems
    },
    {
      key: "duty",
      label: zhCN.appShell.navSectionDuty,
      description: zhCN.appShell.navDescriptionDuty,
      icon: <BellRing size={14} />,
      defaultTo: "/alarms",
      items: [
        { to: "/alarms", icon: <BellRing size={14} />, label: zhCN.appShell.navAlarms },
        { to: "/operation-records", icon: <ClipboardList size={14} />, label: zhCN.appShell.navOperationRecords },
        { to: "/work-orders", icon: <ClipboardList size={14} />, label: zhCN.appShell.navWorkOrders },
      ]
    },
    {
      key: "diagnostics",
      label: zhCN.appShell.navSectionDiagnostics,
      description: zhCN.appShell.navDescriptionDiagnostics,
      icon: <Cpu size={14} />,
      defaultTo: "/devices",
      items: [
        { to: "/devices", icon: <Cpu size={14} />, label: zhCN.appShell.navDevices },
        { to: "/video-monitor", icon: <Video size={14} />, label: zhCN.appShell.navVideoMonitor },
        { to: "/environment-conditions", icon: <Wind size={14} />, label: zhCN.appShell.navEnvironment },
        { to: "/operational-diagnostics", icon: <Gauge size={14} />, label: zhCN.appShell.navOperationalDiagnostics }
      ]
    },
    {
      key: "analysis",
      label: zhCN.appShell.navSectionAnalysis,
      description: zhCN.appShell.navDescriptionAnalysis,
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
      label: zhCN.appShell.navSectionConfig,
      description: zhCN.appShell.navDescriptionConfig,
      icon: <BookOpen size={14} />,
      defaultTo: "/config-center",
      items: [
        { to: "/config-center", icon: <Settings2 size={14} />, label: zhCN.appShell.navConfigCenter },
        { to: "/energy-parameters", icon: <FileText size={14} />, label: zhCN.appShell.navEnergyParameters },
        { to: "/knowledge-base", icon: <BookOpen size={14} />, label: zhCN.appShell.navKnowledgeBase }
      ]
    },
    {
      key: "ai",
      label: zhCN.appShell.navSectionAi,
      description: zhCN.appShell.navDescriptionAi,
      icon: <Sparkles size={14} />,
      defaultTo: "/ai-overview",
      items: [
        { to: "/ai-overview", icon: <Sparkles size={14} />, label: zhCN.appShell.navAiOverview },
        { to: "/optimize-demo", icon: <Sparkles size={14} />, label: zhCN.appShell.navOptimizeDemo }
      ]
    }
  ], navigationPerspective);
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
  const routeEnergyStation = energyStationItems.find((station) =>
    station.functions.some((item) => item.to === location.pathname)
  ) || null;
  const queryEnergyStationType = readEnergyStationTypeFromSearch(location.search);
  const queryStationInstanceId = readEnergyStationIdFromSearch(location.search);
  const acceptsQueryStationContext = ["duty", "analysis", "ai", "diagnostics"].includes(currentNavModule.key);
  const requestedQueryEnergyStation = acceptsQueryStationContext
    ? energyStationItems.find((station) => station.subsystemType === queryEnergyStationType) || null
    : null;
  const queryEnergyStationIsVisible = !requestedQueryEnergyStation || requestedQueryEnergyStation.visible;
  const queryEnergyStationIsSupported = !requestedQueryEnergyStation || isStationWorkspaceRouteSupported(
    location.pathname,
    requestedQueryEnergyStation.subsystemType
  );
  const queryEnergyStation = queryEnergyStationIsVisible && queryEnergyStationIsSupported
    ? requestedQueryEnergyStation
    : null;
  const rejectedQueryEnergyStation = requestedQueryEnergyStation && (
    !queryEnergyStationIsVisible || !queryEnergyStationIsSupported
  )
    ? requestedQueryEnergyStation
    : null;
  const currentWorkspaceRoutePolicy = resolveStationWorkspaceRoutePolicy(location.pathname);
  const policyBoundEnergyStation = !requestedQueryEnergyStation
    && currentWorkspaceRoutePolicy?.supportedStationTypes?.length === 1
    ? energyStationItems.find((station) => (
        station.visible
        && station.subsystemType === currentWorkspaceRoutePolicy.supportedStationTypes?.[0]
      )) || null
    : null;
  const currentEnergyStation = routeEnergyStation || queryEnergyStation || policyBoundEnergyStation;
  const associatedWorkspaceStation = currentEnergyStation || rejectedQueryEnergyStation;
  const registeredStationInstance = queryStationInstanceId
    ? registeredStationInstances.find((instance) => instance.stationId === queryStationInstanceId) || null
    : null;
  const currentStationInstance = registeredStationInstance && currentEnergyStation &&
    registeredStationInstance.parentSubsystemType === currentEnergyStation.subsystemType
    ? currentEnergyStation.instances.find((instance) => instance.stationId === registeredStationInstance.stationId) || null
    : null;
  const stationInstanceContextBlocked = Boolean(queryStationInstanceId) && (
    stationCapabilityLoadState !== "ready" ||
    !registeredStationInstance ||
    !currentEnergyStation ||
    registeredStationInstance.parentSubsystemType !== currentEnergyStation.subsystemType
  );
  const currentStationDisplayLabel = currentStationInstance && currentEnergyStation
    ? `${currentEnergyStation.label} · ${currentStationInstance.stationName}`
    : currentEnergyStation?.label || null;
  const currentStationInstanceCount = currentEnergyStation?.instances.length || 0;
  useEffect(() => {
    const currentType = currentEnergyStation?.subsystemType || null;
    setExpandedStationType((expandedType) => {
      if (currentType && currentStationInstanceCount > 0) {
        return currentType;
      }
      return expandedType === currentType ? null : expandedType;
    });
  }, [capabilitySiteId, currentEnergyStation?.subsystemType, currentStationInstanceCount]);
  const unfilteredSecondaryNavItems = routeEnergyStation?.functions || (currentNavItem ? [currentNavItem] : currentNavModule.items);
  const secondaryNavItems = currentStationInstance
    ? unfilteredSecondaryNavItems.filter((item) => resolveStationRuntimeBindingMode(item.to) !== "unsupported")
    : unfilteredSecondaryNavItems;
  const secondaryNavTitle = routeEnergyStation
    ? currentStationDisplayLabel || routeEnergyStation.label
    : currentEnergyStation
      ? `${currentStationDisplayLabel || currentEnergyStation.label} · ${currentNavModule.label}`
      : currentNavModule.label;
  const showSecondaryNav = !isProjectSelectionRoute;
  const scopedHeadingTitle = routeEnergyStation
    ? currentStationDisplayLabel || routeEnergyStation.label
    : currentEnergyStation
      ? `${currentStationDisplayLabel || currentEnergyStation.label} · ${currentNavModule.label}`
      : currentNavModule?.label || currentNavItem?.label || currentProjectCardDisplayName;
  const topHeadingTitle = isProjectSelectionRoute
    ? zhCN.projectSwitcher.heading
    : scopedHeadingTitle;
  const topHeadingSubtitle = isProjectSelectionRoute
    ? projectSelectionTopHint
    : currentProject
      ? [
          currentNavItem?.label ? `${zhCN.appShell.currentPagePrefix}${currentNavItem.label}` : "",
          currentProjectCardDisplayName,
          currentProject.city,
          currentProject.siteId ? `${zhCN.projectSwitcher.siteIdLabel} ${currentProject.siteId}` : ""
        ]
          .filter(Boolean)
          .join(" · ")
      : zhCN.projectSwitcher.pendingHint;
  const currentSiteId = currentProject?.siteId || null;
  const currentLocaleOption = localeOptions.find((item) => item.value === locale) || null;
  const currentProjectTreeItemId = currentProjectOptionId
    ? resolveProjectOptionDomId(currentProjectOptionId)
    : null;
  const firstProjectDropdownEntry = projectDropdownEntries[0] || null;
  const firstProjectTreeItemId = firstProjectDropdownEntry
    ? firstProjectDropdownEntry.type === "single"
      ? resolveProjectOptionDomId(firstProjectDropdownEntry.optionId)
      : resolveProjectGroupDomId(firstProjectDropdownEntry.key)
    : null;
  const lastProjectDropdownEntry = projectDropdownEntries[projectDropdownEntries.length - 1] || null;
  const lastProjectTreeItemId = lastProjectDropdownEntry
    ? lastProjectDropdownEntry.type === "group" &&
      expandedProjectNodeSet.has(lastProjectDropdownEntry.key) &&
      lastProjectDropdownEntry.children.length > 0
      ? resolveProjectOptionDomId(lastProjectDropdownEntry.children[lastProjectDropdownEntry.children.length - 1].optionId)
      : lastProjectDropdownEntry.type === "single"
        ? resolveProjectOptionDomId(lastProjectDropdownEntry.optionId)
        : resolveProjectGroupDomId(lastProjectDropdownEntry.key)
    : null;
  const currentLocaleOptionId = resolveLocaleOptionDomId(locale);
  const firstLocaleOptionId = localeOptions[0] ? resolveLocaleOptionDomId(localeOptions[0].value) : null;
  const lastLocaleOptionId = localeOptions.length > 0
    ? resolveLocaleOptionDomId(localeOptions[localeOptions.length - 1].value)
    : null;
  const currentProjectDataScopeLabel = zhCN.appShell.navWorkspaceCurrentProject;
  const projectUnfilteredDataScopeLabel = zhCN.appShell.navWorkspaceProjectUnfiltered;
  const selectedDeviceDataScopeLabel = zhCN.appShell.navWorkspaceSelectedDevices;
  function resolveEnergyObjectDataScopeLabel(station: typeof currentEnergyStation): string | null {
    if (!station) {
      return null;
    }
    if (station.subsystemType === "power_monitoring") {
      return zhCN.appShell.navWorkspacePowerProjectAggregate;
    }
    if (station.subsystemType === "hvac_terminal") {
      return zhCN.appShell.navWorkspaceHvacFixedFloor;
    }
    return station.label;
  }
  const defaultStationDataScopeLabel = energyStationItems.find((station) => (
    currentWorkspaceRoutePolicy?.supportedStationTypes?.includes(station.subsystemType)
  ))?.label || zhCN.appShell.navWorkspaceAllStations;
  const baseCurrentPageDataScopeLabel = resolveEnergyObjectDataScopeLabel(routeEnergyStation) || (
    currentWorkspaceRoutePolicy?.dataScope === "station"
      ? queryEnergyStation?.label || defaultStationDataScopeLabel
      : currentWorkspaceRoutePolicy?.dataScope === "device"
        ? selectedDeviceDataScopeLabel
      : currentWorkspaceRoutePolicy?.dataScope === "site"
        ? projectUnfilteredDataScopeLabel
        : currentProjectDataScopeLabel
  );
  const currentPageStationScopeApplied = Boolean(
    currentStationInstance
    && resolveStationRuntimeBindingMode(location.pathname) === "required"
    && resolvePublishedStationBindingVersion(currentStationInstance) != null
  );
  const currentPageDataScopeLabel = currentPageStationScopeApplied && currentStationInstance
    ? currentStationInstance.stationName
    : currentStationInstance && (
    Boolean(routeEnergyStation) || currentWorkspaceRoutePolicy?.dataScope === "station"
  )
    ? zhCN.appShell.navStationInstanceDataUnfiltered
        .replace("{scope}", baseCurrentPageDataScopeLabel)
        .replace("{station}", currentStationInstance.stationName)
    : baseCurrentPageDataScopeLabel;

  function resolveWorkspaceItemScopeLabel(path: string, station: typeof currentEnergyStation): string {
    const runtimeBindingMode = resolveStationRuntimeBindingMode(path);
    if (currentStationInstance && runtimeBindingMode === "unsupported") {
      return zhCN.appShell.navWorkspaceStationInstanceUnsupported.replace(
        "{scope}",
        station?.label || baseCurrentPageDataScopeLabel
      );
    }
    if (currentStationInstance && runtimeBindingMode === "required") {
      const publishedVersion = currentStationInstance.publishedBindingVersion
        ?? (currentStationInstance.bindingState === "published"
          ? currentStationInstance.bindingVersion
          : null);
      if (Number.isSafeInteger(publishedVersion) && Number(publishedVersion) > 0) {
        return currentStationInstance.stationName;
      }
      return `${currentStationInstance.stationName}（${formatStationInstanceBindingLabel(currentStationInstance)}）`;
    }
    const policy = resolveStationWorkspaceRoutePolicy(path);
    if (!policy) {
      return currentProjectDataScopeLabel;
    }
    if (policy.dataScope === "site") {
      return projectUnfilteredDataScopeLabel;
    }
    if (policy.dataScope === "device") {
      return selectedDeviceDataScopeLabel;
    }
    if (station && isStationWorkspaceRouteSupported(path, station.subsystemType)) {
      return station.label;
    }
    const supportedLabels = energyStationItems
      .filter((item) => policy.supportedStationTypes?.includes(item.subsystemType))
      .map((item) => item.label);
    return supportedLabels.join(" / ") || zhCN.appShell.navWorkspaceAllStations;
  }

  function resolveWorkspaceNavigationStationType(path: string): EnergyStationType | null {
    if (associatedWorkspaceStation) {
      return associatedWorkspaceStation.subsystemType;
    }
    const policy = resolveStationWorkspaceRoutePolicy(path);
    return policy?.supportedStationTypes?.length === 1
      ? policy.supportedStationTypes[0]
      : null;
  }

  const stationWorkspaceModuleKeys = ["operations", "duty", "analysis", "ai", "diagnostics"] as const;
  const workspaceLevel = associatedWorkspaceStation ? "energy-object" : "project";
  const workspaceTitle = associatedWorkspaceStation
    ? zhCN.appShell.navWorkspaceObjectTitle
    : zhCN.appShell.navWorkspaceProjectTitle;
  const stationWorkspaceActions = stationWorkspaceModuleKeys
    .map((moduleKey) => {
      const module = navModules.find((item) => item.key === moduleKey);
      if (!module) {
        return null;
      }
      const isRunAction = moduleKey === "operations";
      const unfilteredSourceItems = isRunAction
        ? associatedWorkspaceStation?.functions || navModules.find((item) => item.key === "dashboard")?.items || []
        : module.items;
      const sourceItems = unfilteredSourceItems.filter((item) => {
        const stationTypeSupported = isRunAction || !associatedWorkspaceStation || isStationWorkspaceRouteSupported(
          item.to,
          associatedWorkspaceStation.subsystemType
        );
        const stationInstanceSupported = !currentStationInstance || resolveStationRuntimeBindingMode(item.to) !== "unsupported";
        return stationTypeSupported && stationInstanceSupported;
      });
      const isActive = !isProjectSelectionRoute && (isRunAction
        ? currentNavModule.key === "operations" || currentNavModule.key === "dashboard"
        : currentNavModule.key === moduleKey);
      return {
        key: moduleKey,
        label: isRunAction
          ? associatedWorkspaceStation
            ? zhCN.appShell.navWorkspaceRun
            : zhCN.appShell.navWorkspaceOverview
          : module.label,
        icon: module.icon,
        description: isRunAction
          ? associatedWorkspaceStation
            ? sourceItems.map((item) => item.label).join(" / ")
            : navModules.find((item) => item.key === "dashboard")?.description || sourceItems.map((item) => item.label).join(" / ")
          : module.description,
        items: sourceItems.map((item) => {
          const navigationStationType = resolveWorkspaceNavigationStationType(item.to);
          const navigationStationInstanceId = navigationStationType === associatedWorkspaceStation?.subsystemType
            ? currentStationInstance?.stationId || null
            : null;
          return {
            ...item,
            scopeLabel: isRunAction
              ? currentStationInstance
                ? resolveWorkspaceItemScopeLabel(item.to, associatedWorkspaceStation)
                : resolveEnergyObjectDataScopeLabel(associatedWorkspaceStation) || currentProjectDataScopeLabel
              : resolveWorkspaceItemScopeLabel(item.to, associatedWorkspaceStation),
            to: appendSiteIdToPath(
              appendEnergyStationContextToPath(item.to, navigationStationType, navigationStationInstanceId),
              currentSiteId
            )
          };
        }),
        isActive,
        isUnavailable: Boolean(associatedWorkspaceStation) && sourceItems.length === 0
      };
    })
    .filter((item): item is NonNullable<typeof item> => item != null);
  const configNavigationModule = navModules.find((module) => module.key === "config") || null;
  const configWorkspaceAction = configNavigationModule
    ? {
        key: "config",
        label: zhCN.appShell.navWorkspaceGlobalConfig,
        compactLabel: zhCN.appShell.navSectionConfig,
        description: configNavigationModule.description,
        icon: <Settings2 size={14} />,
        isActive: !isProjectSelectionRoute && currentNavModule.key === "config",
        items: configNavigationModule.items.map((item) => ({
          ...item,
          scopeLabel: currentProjectDataScopeLabel,
          to: appendSiteIdToPath(
            appendEnergyStationContextToPath(item.to, null),
            currentSiteId
          )
        }))
      }
    : null;
  const stationWorkspaceScopeLabel = currentStationInstance?.stationName || associatedWorkspaceStation?.label || zhCN.appShell.navWorkspaceAllStations;
  const stationWorkspaceScopeKey = currentStationInstance?.stationId || associatedWorkspaceStation?.subsystemType || "project";
  const stationBindingState = currentStationInstance?.bindingState || "unconfigured";
  const stationBindingVersion = resolvePublishedStationBindingVersion(currentStationInstance);
  const stationRuntimeBindingPublished = Boolean(
    currentStationInstance
    && stationBindingVersion != null
  );
  const stationRuntimeBindingMode = resolveStationRuntimeBindingMode(location.pathname);
  const currentRouteRequiresStationRuntime = Boolean(
    currentStationInstance && stationRuntimeBindingMode === "required"
  );
  const stationRuntimeEndpointUnsupported = Boolean(
    currentStationInstance && stationRuntimeBindingMode === "unsupported"
  );
  const stationRuntimeBindingBlocked = currentRouteRequiresStationRuntime && !stationRuntimeBindingPublished;
  const stationRuntimeScope = {
    projectSiteId: currentSiteId,
    runtimeBindingSiteId: currentStationInstance?.siteId || capabilitySiteId || currentSiteId,
    selectedStationId: currentStationInstance?.stationId || null,
    runtimeStationId: stationRuntimeBindingPublished ? currentStationInstance?.stationId || null : null,
    stationType: currentEnergyStation?.subsystemType || null,
    stationName: currentStationInstance?.stationName || null,
    bindingState: stationRuntimeBindingPublished ? "published" : stationBindingState,
    bindingVersion: stationBindingVersion,
    bindingPublished: stationRuntimeBindingPublished,
    scopeKey: [
      `site:${currentSiteId || "none"}`,
      `binding-site:${currentStationInstance?.siteId || capabilitySiteId || currentSiteId || "none"}`,
      `station:${currentStationInstance?.stationId || "none"}`,
      `binding:${stationBindingVersion ?? "none"}`
    ].join("|")
  };
  const stationScopeGuardActive = Boolean(rejectedQueryEnergyStation)
    || stationInstanceContextBlocked
    || stationRuntimeBindingBlocked
    || stationRuntimeEndpointUnsupported;
  const scopeGuardBackStation = rejectedQueryEnergyStation || currentEnergyStation || (
    registeredStationInstance
      ? energyStationItems.find((station) => station.subsystemType === registeredStationInstance.parentSubsystemType) || null
      : null
  );
  const unsupportedWorkspaceTitle = rejectedQueryEnergyStation
    ? zhCN.appShell.navWorkspaceUnsupportedTitle
        .replace("{station}", rejectedQueryEnergyStation.label)
        .replace("{workspace}", currentNavModule.label)
    : stationInstanceContextBlocked
      ? zhCN.appShell.navStationInstanceInvalidTitle
      : stationRuntimeBindingBlocked
        ? zhCN.appShell.navStationRuntimeBindingRequiredTitle
        : stationRuntimeEndpointUnsupported
          ? zhCN.appShell.navStationRuntimeEndpointUnsupportedTitle
          : "";
  const unsupportedWorkspaceHint = rejectedQueryEnergyStation
    ? zhCN.appShell.navWorkspaceUnsupportedHint
        .replace("{station}", rejectedQueryEnergyStation.label)
        .replace("{scope}", currentPageDataScopeLabel)
    : stationInstanceContextBlocked
      ? stationCapabilityLoadState === "ready"
        ? zhCN.appShell.navStationInstanceInvalidHint
        : zhCN.appShell.navStationInstanceVerifyingHint
      : stationRuntimeBindingBlocked
        ? zhCN.appShell.navStationRuntimeBindingRequiredHint
            .replace("{station}", currentStationInstance?.stationName || queryStationInstanceId || "-")
            .replace(
              "{state}",
              currentStationInstance
                ? formatStationInstanceBindingLabel(currentStationInstance)
                : stationBindingState
            )
        : stationRuntimeEndpointUnsupported
          ? zhCN.appShell.navStationRuntimeEndpointUnsupportedHint
              .replace("{station}", currentStationInstance?.stationName || queryStationInstanceId || "-")
          : "";
  const unsupportedWorkspaceBackLabel = scopeGuardBackStation
    ? zhCN.appShell.navWorkspaceBackToStation.replace("{station}", scopeGuardBackStation.label)
    : zhCN.appShell.navOperationDashboard;
  const scopeGuardContextLabel = rejectedQueryEnergyStation?.label
    || currentStationInstance?.stationName
    || queryStationInstanceId
    || zhCN.appShell.navWorkspaceAllStations;
  const scopeGuardBackTarget = appendSiteIdToPath(scopeGuardBackStation?.defaultTo || "/dashboard", currentSiteId);

  function resolveWorkspaceActionScopeLabel(items: readonly { scopeLabel: string }[]): string {
    const scopes = Array.from(new Set(items.map((item) => item.scopeLabel)));
    return scopes.length === 1 ? scopes[0] : zhCN.appShell.navWorkspaceMixedScope;
  }

  function formatWorkspaceActionAriaLabel(
    label: string,
    count: number,
    scopeLabel: string,
    unavailable = false
  ): string {
    const template = unavailable
      ? zhCN.appShell.navWorkspaceActionUnavailable
      : zhCN.appShell.navWorkspaceActionCount;
    return template
      .replace("{label}", label)
      .replace("{count}", String(count))
      .replace("{scope}", scopeLabel);
  }

  function buildContextualNavigationTarget(path: string): string {
    const stationType = currentEnergyStation?.subsystemType || null;
    return appendSiteIdToPath(
      appendEnergyStationContextToPath(path, stationType, currentStationInstance?.stationId || null),
      currentSiteId
    );
  }

  function focusVisibleWorkspaceMenuTrigger(menuKey: string): void {
    const triggers = Array.from(
      document.querySelectorAll<HTMLElement>(`[data-workspace-menu-trigger="${menuKey}"]`)
    );
    triggers.find((trigger) => trigger.getClientRects().length > 0)?.focus();
  }

  function toggleWorkspaceMenu(menuKey: string): void {
    setOpenWorkspaceMenuKey((current) => current === menuKey ? null : menuKey);
  }

  useEffect(() => {
    setOpenWorkspaceMenuKey(null);
  }, [location.pathname, location.search]);

  useEffect(() => {
    if (!openWorkspaceMenuKey) {
      return;
    }

    function handleWorkspacePointerDown(event: PointerEvent) {
      const target = event.target;
      if (target instanceof Element && target.closest("[data-workspace-menu-root]")) {
        return;
      }
      setOpenWorkspaceMenuKey(null);
    }

    function handleWorkspaceFocusIn(event: FocusEvent) {
      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }
      const visibleOpenRoots = Array.from(
        document.querySelectorAll<HTMLElement>("[data-workspace-menu-root].is-open")
      ).filter((root) => root.getClientRects().length > 0);
      if (visibleOpenRoots.some((root) => root.contains(target))) {
        return;
      }
      setOpenWorkspaceMenuKey(null);
    }

    function handleWorkspaceKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape" || (isCompactViewport && isMobileNavOpen)) {
        return;
      }
      event.preventDefault();
      const menuKey = openWorkspaceMenuKey;
      if (!menuKey) {
        return;
      }
      setOpenWorkspaceMenuKey(null);
      window.requestAnimationFrame(() => focusVisibleWorkspaceMenuTrigger(menuKey));
    }

    document.addEventListener("pointerdown", handleWorkspacePointerDown);
    document.addEventListener("focusin", handleWorkspaceFocusIn);
    document.addEventListener("keydown", handleWorkspaceKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handleWorkspacePointerDown);
      document.removeEventListener("focusin", handleWorkspaceFocusIn);
      document.removeEventListener("keydown", handleWorkspaceKeyDown);
    };
  }, [isCompactViewport, isMobileNavOpen, openWorkspaceMenuKey]);

  function getVisibleProjectTreeItems(): HTMLButtonElement[] {
    if (!projectTreeRef.current) {
      return [];
    }
    return Array.from(
      projectTreeRef.current.querySelectorAll<HTMLButtonElement>("[data-project-tree-item]")
    ).filter((item) => !item.disabled && item.getClientRects().length > 0);
  }

  function getVisibleLocaleOptions(): HTMLButtonElement[] {
    if (!localeListboxRef.current) {
      return [];
    }
    return Array.from(
      localeListboxRef.current.querySelectorAll<HTMLButtonElement>("[data-locale-option]")
    ).filter((item) => !item.disabled && item.getClientRects().length > 0);
  }

  function focusProjectTreeItemById(targetId: string | null): boolean {
    const items = getVisibleProjectTreeItems();
    const target = items.find((item) => item.id === targetId) || null;
    if (!target) {
      return false;
    }
    setActiveProjectTreeItemId(target.id);
    target.focus();
    return true;
  }

  function focusLocaleOptionById(targetId: string | null): boolean {
    const items = getVisibleLocaleOptions();
    const target = items.find((item) => item.id === targetId) || null;
    if (!target) {
      return false;
    }
    setActiveLocaleOptionId(target.id);
    target.focus();
    return true;
  }

  function closeProjectDropdown(restoreFocus: boolean): void {
    setIsProjectDropdownOpen(false);
    if (restoreFocus) {
      window.requestAnimationFrame(() => projectDropdownTriggerRef.current?.focus());
    }
  }

  function closeLocaleDropdown(restoreFocus: boolean): void {
    setIsLocaleDropdownOpen(false);
    if (restoreFocus) {
      window.requestAnimationFrame(() => localeDropdownTriggerRef.current?.focus());
    }
  }

  function openProjectDropdown(focusIntent: "current" | "first" | "last" = "current"): void {
    pendingProjectTreeFocusIntentRef.current = focusIntent;
    if (currentProjectGroupKey) {
      setExpandedProjectNodeKeys((current) => (
        current.includes(currentProjectGroupKey)
          ? current
          : [...current, currentProjectGroupKey]
      ));
    }
    const targetId = focusIntent === "first"
      ? firstProjectTreeItemId
      : focusIntent === "last"
        ? lastProjectTreeItemId
        : currentProjectTreeItemId || firstProjectTreeItemId;
    setActiveProjectTreeItemId(targetId);
    setIsLocaleDropdownOpen(false);
    setIsProjectDropdownOpen(true);
  }

  function openLocaleDropdown(focusIntent: "current" | "first" | "last" = "current"): void {
    const targetId = focusIntent === "first"
      ? firstLocaleOptionId
      : focusIntent === "last"
        ? lastLocaleOptionId
        : currentLocaleOptionId || firstLocaleOptionId;
    setActiveLocaleOptionId(targetId);
    setIsProjectDropdownOpen(false);
    setIsLocaleDropdownOpen(true);
  }

  function handleProjectDropdownTriggerKeyDown(event: ReactKeyboardEvent<HTMLButtonElement>): void {
    if (event.key === "ArrowDown" || event.key === "Home") {
      event.preventDefault();
      openProjectDropdown("first");
      return;
    }
    if (event.key === "ArrowUp" || event.key === "End") {
      event.preventDefault();
      openProjectDropdown("last");
      return;
    }
    if (event.key === "Escape" && isProjectDropdownOpen) {
      event.preventDefault();
      closeProjectDropdown(true);
    }
  }

  function handleLocaleDropdownTriggerKeyDown(event: ReactKeyboardEvent<HTMLButtonElement>): void {
    if (event.key === "ArrowDown" || event.key === "Home") {
      event.preventDefault();
      openLocaleDropdown("first");
      return;
    }
    if (event.key === "ArrowUp" || event.key === "End") {
      event.preventDefault();
      openLocaleDropdown("last");
      return;
    }
    if (event.key === "Escape" && isLocaleDropdownOpen) {
      event.preventDefault();
      closeLocaleDropdown(true);
    }
  }

  function handleProjectTreeItemKeyDown(
    event: ReactKeyboardEvent<HTMLButtonElement>,
    context: {
      groupKey?: string;
      isExpandedGroup?: boolean;
      firstChildId?: string;
      parentGroupId?: string;
    } = {}
  ): void {
    const items = getVisibleProjectTreeItems();
    const currentIndex = items.indexOf(event.currentTarget);
    let nextItem: HTMLButtonElement | null = null;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      nextItem = items[Math.min(currentIndex + 1, items.length - 1)] || null;
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      nextItem = items[Math.max(currentIndex - 1, 0)] || null;
    } else if (event.key === "Home") {
      event.preventDefault();
      nextItem = items[0] || null;
    } else if (event.key === "End") {
      event.preventDefault();
      nextItem = items[items.length - 1] || null;
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      event.currentTarget.click();
      return;
    } else if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      closeProjectDropdown(true);
      return;
    } else if (event.key === "ArrowRight" && context.groupKey) {
      event.preventDefault();
      if (!context.isExpandedGroup) {
        setExpandedProjectNodeKeys((current) => (
          current.includes(context.groupKey as string)
            ? current
            : [...current, context.groupKey as string]
        ));
      } else if (context.firstChildId) {
        window.requestAnimationFrame(() => focusProjectTreeItemById(context.firstChildId || null));
      }
      return;
    } else if (event.key === "ArrowLeft") {
      if (context.groupKey && context.isExpandedGroup) {
        event.preventDefault();
        setExpandedProjectNodeKeys((current) => current.filter((item) => item !== context.groupKey));
      } else if (context.parentGroupId) {
        event.preventDefault();
        focusProjectTreeItemById(context.parentGroupId);
      }
      return;
    }

    if (nextItem) {
      setActiveProjectTreeItemId(nextItem.id);
      nextItem.focus();
    }
  }

  function handleLocaleOptionKeyDown(event: ReactKeyboardEvent<HTMLButtonElement>): void {
    const items = getVisibleLocaleOptions();
    const currentIndex = items.indexOf(event.currentTarget);
    let nextItem: HTMLButtonElement | null = null;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      nextItem = items[Math.min(currentIndex + 1, items.length - 1)] || null;
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      nextItem = items[Math.max(currentIndex - 1, 0)] || null;
    } else if (event.key === "Home") {
      event.preventDefault();
      nextItem = items[0] || null;
    } else if (event.key === "End") {
      event.preventDefault();
      nextItem = items[items.length - 1] || null;
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      event.currentTarget.click();
      return;
    } else if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      closeLocaleDropdown(true);
      return;
    }

    if (nextItem) {
      setActiveLocaleOptionId(nextItem.id);
      nextItem.focus();
    }
  }

  function handleLocaleChange(value: string) {
    closeLocaleDropdown(true);
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

    function handleDocumentPointerDown(event: PointerEvent) {
      const targetNode = event.target as Node;
      const clickedProjectDropdown = projectDropdownRef.current?.contains(targetNode);
      const clickedLocaleDropdown = localeDropdownRef.current?.contains(targetNode);
      if (!clickedProjectDropdown && !clickedLocaleDropdown) {
        closeProjectDropdown(false);
        closeLocaleDropdown(false);
      }
    }

    function handleDocumentKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        if (isProjectDropdownOpen) {
          event.preventDefault();
          closeProjectDropdown(true);
        } else if (isLocaleDropdownOpen) {
          event.preventDefault();
          closeLocaleDropdown(true);
        }
      }
    }

    document.addEventListener("pointerdown", handleDocumentPointerDown);
    document.addEventListener("keydown", handleDocumentKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handleDocumentPointerDown);
      document.removeEventListener("keydown", handleDocumentKeyDown);
    };
  }, [isProjectDropdownOpen, isLocaleDropdownOpen]);

  useLayoutEffect(() => {
    if (!isProjectDropdownOpen) {
      return;
    }
    const focusIntent = pendingProjectTreeFocusIntentRef.current;
    pendingProjectTreeFocusIntentRef.current = "current";
    const visibleItems = getVisibleProjectTreeItems();
    const intentTarget = focusIntent === "first"
      ? visibleItems[0] || null
      : focusIntent === "last"
        ? visibleItems[visibleItems.length - 1] || null
        : null;
    if (intentTarget) {
      setActiveProjectTreeItemId(intentTarget.id);
      intentTarget.focus();
      return;
    }
    const fallbackId = currentProjectTreeItemId || firstProjectTreeItemId;
    if (!focusProjectTreeItemById(activeProjectTreeItemId || fallbackId)) {
      const firstVisibleItem = getVisibleProjectTreeItems()[0] || null;
      if (firstVisibleItem) {
        setActiveProjectTreeItemId(firstVisibleItem.id);
        firstVisibleItem.focus();
      }
    }
  }, [isProjectDropdownOpen]);

  useLayoutEffect(() => {
    if (!isLocaleDropdownOpen) {
      return;
    }
    const fallbackId = currentLocaleOptionId || firstLocaleOptionId;
    if (!focusLocaleOptionById(activeLocaleOptionId || fallbackId)) {
      const firstVisibleOption = getVisibleLocaleOptions()[0] || null;
      if (firstVisibleOption) {
        setActiveLocaleOptionId(firstVisibleOption.id);
        firstVisibleOption.focus();
      }
    }
  }, [isLocaleDropdownOpen]);

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
    const sceneRouteActive = location.pathname === "/scene-control" || location.pathname === "/auto-twin";
    if (!sceneRouteActive || !currentProject?.siteId) {
      return;
    }
    preloadSceneFloorModels(currentProject.siteId).catch((error) => {
      console.warn("[sceneFloorModels] preload failed", error);
    });
  }, [currentProject?.siteId, currentProjectOptionId, location.pathname]);

  function handleSignOut() {
    clearAuthSession();
    navigate("/login", { replace: true });
  }

  function handleProjectChange(value: string) {
    closeProjectDropdown(true);
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
        ? appendSiteIdToPath("/dashboard", nextProject.siteId)
        : buildScopedLocationPath(
            location.pathname,
            clearCrossProjectTransientContextFromSearch(
              clearEnergyStationContextFromSearch(location.search)
            ),
            location.hash,
            nextProject.siteId
          );
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
    closeProjectDropdown(false);
    closeLocaleDropdown(false);
    const currentPath = buildScopedLocationPath(location.pathname, location.search, location.hash, currentSiteId);
    const nextPath =
      currentPath && currentPath !== "/projects"
        ? appendSiteIdToPath(`/projects?redirect=${encodeURIComponent(currentPath)}`, currentSiteId)
        : appendSiteIdToPath("/projects", currentSiteId);
    navigate(nextPath);
  }

  function closeMobileNav() {
    setIsMobileNavOpen(false);
    if (isCompactViewport) {
      window.requestAnimationFrame(() => mobileNavToggleRef.current?.focus());
    }
  }

  function toggleMobileNav() {
    setIsMobileNavOpen((current) => !current);
  }

  function renderProjectDropdownEntry(entry: ProjectDropdownEntry) {
    if (entry.type === "single") {
      const isActive = isProjectOptionActive(entry.optionId, entry.label);
      const itemId = resolveProjectOptionDomId(entry.optionId);
      return (
        <button
          key={entry.key}
          id={itemId}
          type="button"
          role="treeitem"
          aria-selected={isActive}
          aria-level={1}
          tabIndex={activeProjectTreeItemId === itemId ? 0 : -1}
          data-project-tree-item
          className={`project-switcher-option${isActive ? " is-active" : ""}`}
          onFocus={() => setActiveProjectTreeItemId(itemId)}
          onKeyDown={(event) => handleProjectTreeItemKeyDown(event)}
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
    const groupItemId = resolveProjectGroupDomId(entry.key);
    const childrenGroupId = resolveProjectChildrenGroupDomId(entry.key);
    const firstChildId = entry.children[0]
      ? resolveProjectOptionDomId(entry.children[0].optionId)
      : undefined;
    return (
      <div key={entry.key} className="project-switcher-group-wrap" role="none">
        <button
          id={groupItemId}
          type="button"
          role="treeitem"
          className={`project-switcher-group${isExpanded ? " is-open" : ""}${isCurrentGroup ? " is-active" : ""}`}
          onClick={() => toggleProjectNode(entry.key)}
          onFocus={() => setActiveProjectTreeItemId(groupItemId)}
          onKeyDown={(event) => handleProjectTreeItemKeyDown(event, {
            groupKey: entry.key,
            isExpandedGroup: isExpanded,
            firstChildId
          })}
          aria-expanded={isExpanded}
          aria-controls={childrenGroupId}
          aria-owns={isExpanded ? childrenGroupId : undefined}
          aria-level={1}
          tabIndex={activeProjectTreeItemId === groupItemId ? 0 : -1}
          data-project-tree-item
        >
          <span className="project-switcher-group-main">
            <ChevronRight size={14} aria-hidden="true" />
            <span className="project-switcher-group-label">{entry.label}</span>
          </span>
          <span className="project-switcher-group-count">{entry.children.length}</span>
        </button>
        <div
          id={childrenGroupId}
          className="project-switcher-group-children"
          role="group"
          hidden={!isExpanded}
        >
          {entry.children.map((child) => {
            const isActive = isProjectOptionActive(child.optionId, child.label);
            const childItemId = resolveProjectOptionDomId(child.optionId);
            return (
              <button
                key={child.key}
                id={childItemId}
                type="button"
                role="treeitem"
                aria-selected={isActive}
                aria-level={2}
                tabIndex={activeProjectTreeItemId === childItemId ? 0 : -1}
                data-project-tree-item
                className={`project-switcher-option project-switcher-option-child${isActive ? " is-active" : ""}`}
                onFocus={() => setActiveProjectTreeItemId(childItemId)}
                onKeyDown={(event) => handleProjectTreeItemKeyDown(event, {
                  parentGroupId: groupItemId
                })}
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
      </div>
    );
  }

  const globalNavigationModules = navModules.filter((module) => module.key === "dashboard");

  function renderModuleNavigationLink(module: (typeof navModules)[number]) {
    return (
      <NavLink
        key={module.key}
        to={appendSiteIdToPath(module.defaultTo, currentSiteId)}
        className={() => `nav-module-link${!isProjectSelectionRoute && currentNavModule.key === module.key ? " active" : ""}`}
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
    );
  }

  return (
    <div className="app-shell" data-mobile-nav-open={isMobileNavOpen ? "true" : "false"}>
      <a
        className="shell-skip-link"
        href="#app-shell-main-content"
        tabIndex={isCompactViewport && isMobileNavOpen ? -1 : undefined}
        aria-hidden={isCompactViewport && isMobileNavOpen ? "true" : undefined}
      >
        跳到主要内容
      </a>
      <aside
        ref={primaryNavRef}
        id="app-shell-primary-nav"
        className="left-nav"
        role={isCompactViewport ? "dialog" : undefined}
        aria-modal={isCompactViewport && isMobileNavOpen ? "true" : undefined}
        aria-label={isCompactViewport ? zhCN.appShell.navigationDialog : undefined}
        data-shell-nav="primary"
        data-mobile-nav-state={isMobileNavOpen ? "open" : "closed"}
        aria-hidden={isCompactViewport && !isMobileNavOpen ? "true" : undefined}
        inert={isCompactViewport && !isMobileNavOpen ? true : undefined}
      >
        <div className="nav-brand" data-shell-nav-brand>
          <p className="nav-eyebrow">{zhCN.appShell.title}</p>
          <div className="nav-project-title">{shellTitle}</div>
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
          <div
            className="nav-perspective"
            data-navigation-perspective={navigationPerspective.id}
            title={navigationPerspective.description}
          >
            <span>工作视角</span>
            <strong>{navigationPerspective.label}</strong>
            <small>{navigationPerspective.description}</small>
          </div>
          <button
            className="nav-close-button"
            type="button"
            onClick={closeMobileNav}
            aria-label={zhCN.appShell.closeNavigation}
            data-mobile-nav-close
          >
            <X size={14} />
          </button>
        </div>
        <div className="nav-scroll" data-shell-nav-scroll>
          <nav className="nav-links nav-module-list" data-shell-nav-links>
            <section className="nav-menu-section" data-nav-section="global">
              <p className="nav-menu-section-label">{zhCN.appShell.navGroupGlobal}</p>
              {globalNavigationModules.map((module) => renderModuleNavigationLink(module))}
            </section>

            <section
              className="nav-menu-section nav-station-group"
              data-nav-section="stations"
              data-shell-station-group
            >
              <p className="nav-menu-section-label">{zhCN.appShell.navGroupStations}</p>
              <div className={`nav-station-group-heading${currentEnergyStation ? " is-active" : ""}`}>
                <span className="nav-module-icon"><Box size={14} /></span>
                <span className="nav-module-copy">
                  <strong>{zhCN.appShell.navObjectDirectoryTitle}</strong>
                  <small>{zhCN.appShell.navObjectDirectoryDescription}</small>
                </span>
                <span
                  className="nav-module-count nav-station-registry-count"
                  title={zhCN.appShell.navStationRegistryCount
                    .replace("{types}", String(visibleEnergyStationItems.length))
                    .replace("{stations}", String(registeredStationInstances.length))}
                >
                  <span>{visibleEnergyStationItems.length}类</span>
                  <span>{registeredStationInstances.length}站</span>
                </span>
              </div>
              <div className="nav-station-list">
                {visibleEnergyStationItems.length ? visibleEnergyStationGroups.map((semanticGroup) => (
                  <section
                    key={semanticGroup.key}
                    className="nav-energy-object-group"
                    aria-labelledby={`nav-energy-object-group-${semanticGroup.key}`}
                    data-energy-object-semantic-group={semanticGroup.key}
                  >
                    <h3
                      id={`nav-energy-object-group-${semanticGroup.key}`}
                      className="nav-energy-object-group-label"
                    >
                      {semanticGroup.label}
                    </h3>
                    <div className="nav-energy-object-group-items">
                      {semanticGroup.items.map((station) => {
                  const isCurrentStation = currentEnergyStation?.subsystemType === station.subsystemType;
                  const isExpanded = expandedStationType === station.subsystemType;
                  const stationPanelId = `nav-station-instances-${station.subsystemType}`;
                  const stationToggleId = `nav-station-toggle-${station.subsystemType}`;
                  return (
                    <div
                      key={station.subsystemType}
                      className={`nav-station-type${isCurrentStation ? " is-current" : ""}`}
                      data-station-type-group={station.subsystemType}
                      data-station-instance-count={station.instances.length}
                    >
                      <div className="nav-station-type-row">
                        <NavLink
                          to={appendSiteIdToPath(station.defaultTo, currentSiteId)}
                          className={() => `nav-station-link${isCurrentStation ? " active" : ""}`}
                          onClick={closeMobileNav}
                          aria-current={isCurrentStation && !currentStationInstance ? "location" : undefined}
                          title={`${station.label} · ${station.status.detailLabel}`}
                          data-shell-station-link
                          data-shell-nav-target={station.defaultTo}
                          data-station-type={station.subsystemType}
                        >
                          <span className="nav-station-icon">{station.icon}</span>
                          <span className="nav-station-copy">
                            <strong>{station.label}</strong>
                            <small title={station.summary}>
                              {station.instances.length > 0
                                ? zhCN.appShell.navStationInstanceCount.replace("{count}", String(station.instances.length))
                                : station.summary}
                            </small>
                          </span>
                          <span className="nav-station-meta">
                            {station.alarmCount != null && station.alarmCount > 0 ? (
                              <span className="nav-station-alarm" title={`${station.alarmCount} 条活动告警`}>
                                {station.alarmCount > 99 ? "99+" : station.alarmCount}
                              </span>
                            ) : null}
                            <span
                              className="nav-station-status"
                              data-shell-station-status
                              data-status-kind={station.status.kind}
                            >
                              {station.status.compactLabel}
                            </span>
                          </span>
                        </NavLink>
                        {station.instances.length > 0 ? (
                          <button
                            id={stationToggleId}
                            type="button"
                            className="nav-station-instance-toggle"
                            onClick={() => setExpandedStationType((current) => (
                              current === station.subsystemType ? null : station.subsystemType
                            ))}
                            aria-expanded={isExpanded}
                            aria-controls={stationPanelId}
                            aria-label={zhCN.appShell.navStationInstanceToggle
                              .replace("{station}", station.label)
                              .replace("{count}", String(station.instances.length))}
                            data-station-instance-toggle={station.subsystemType}
                          >
                            <ChevronDown size={13} aria-hidden="true" />
                          </button>
                        ) : null}
                      </div>
                      {station.instances.length > 0 ? (
                        <div
                          id={stationPanelId}
                          className="nav-station-instance-list"
                          role="group"
                          aria-labelledby={stationToggleId}
                          hidden={!isExpanded}
                          data-station-instance-panel={station.subsystemType}
                        >
                          {station.instances.map((instance) => {
                            const isCurrentInstance = currentStationInstance?.stationId === instance.stationId;
                            return (
                              <NavLink
                                key={instance.stationId}
                                to={appendSiteIdToPath(
                                  appendEnergyStationContextToPath(
                                    station.defaultTo,
                                    station.subsystemType,
                                    instance.stationId
                                  ),
                                  currentSiteId
                                )}
                                className={() => `nav-station-instance-link${isCurrentInstance ? " active" : ""}`}
                                onClick={closeMobileNav}
                                aria-current={isCurrentInstance ? "page" : undefined}
                                title={`${instance.stationName} · ${formatStationInstanceBindingLabel(instance)} · ${instance.statusPresentation.detailLabel}`}
                                data-shell-station-instance-link
                                data-station-id={instance.stationId}
                                data-parent-subsystem-type={station.subsystemType}
                              >
                                <span className="nav-station-instance-marker" aria-hidden="true" />
                                <span className="nav-station-instance-copy">
                                  <strong>{instance.stationName}</strong>
                                  <small>{formatStationInstanceBindingLabel(instance)}</small>
                                </span>
                                {instance.alarmCount != null && instance.alarmCount > 0 ? (
                                  <span className="nav-station-alarm" title={`${instance.alarmCount} 条活动告警`}>
                                    {instance.alarmCount > 99 ? "99+" : instance.alarmCount}
                                  </span>
                                ) : (
                                  <span
                                    className="nav-station-status nav-station-instance-status"
                                    data-status-kind={instance.statusPresentation.kind}
                                  >
                                    {instance.statusPresentation.compactLabel}
                                  </span>
                                )}
                              </NavLink>
                            );
                          })}
                        </div>
                      ) : null}
                    </div>
                  );
                      })}
                    </div>
                  </section>
                )) : (
                  <p className="nav-station-empty">当前角色没有可用站房，请联系工程管理员核对接入配置。</p>
                )}
              </div>
              {stationCapabilityLoadState === "ready" && registeredStationInstances.length === 0 ? (
                <div className="nav-station-registry-note" data-station-registry-empty>
                  <span>{zhCN.appShell.navStationRegistryEmpty}</span>
                  <NavLink
                    to={appendSiteIdToPath("/config-center", currentSiteId)}
                    className="nav-station-registry-action"
                    data-station-registry-action
                    onClick={closeMobileNav}
                  >
                    {zhCN.appShell.navStationRegistryAction}
                    <ChevronRight size={13} aria-hidden="true" />
                  </NavLink>
                </div>
              ) : null}
            </section>

            <section
              className="nav-menu-section nav-mobile-workspace"
              data-nav-section="mobile-workspace"
              data-shell-mobile-station-workspace
              data-workspace-level={workspaceLevel}
              data-station-context={stationWorkspaceScopeKey}
            >
              <p className="nav-menu-section-label">{workspaceTitle}</p>
              <div className="nav-mobile-workspace-scope">
                <span>{zhCN.appShell.navWorkspaceContext}</span>
                <strong>{stationWorkspaceScopeLabel}</strong>
                <small data-workspace-current-data-scope>
                  {zhCN.appShell.navWorkspaceDataScope}：{currentPageDataScopeLabel}
                </small>
              </div>
              <div className="nav-mobile-workspace-list">
                {stationWorkspaceActions.map((action) => {
                  const isOpen = openWorkspaceMenuKey === action.key;
                  const panelId = `mobile-workspace-panel-${action.key}`;
                  return (
                    <div
                      key={action.key}
                      className={`nav-mobile-workspace-menu-root${isOpen ? " is-open" : ""}${action.isUnavailable ? " is-unavailable" : ""}`}
                      data-workspace-menu-root
                      data-workspace-availability={action.isUnavailable ? "unavailable" : "available"}
                    >
                      <button
                        type="button"
                        className={`nav-mobile-workspace-link${action.isActive ? " active is-current" : ""}`}
                        onClick={() => toggleWorkspaceMenu(action.key)}
                        disabled={action.isUnavailable}
                        onKeyDown={(event) => {
                          if (event.key !== "ArrowDown") {
                            return;
                          }
                          event.preventDefault();
                          setOpenWorkspaceMenuKey(action.key);
                          window.requestAnimationFrame(() => {
                            document.querySelector<HTMLElement>(`#${panelId} a[href]`)?.focus();
                          });
                        }}
                        aria-expanded={isOpen}
                        aria-controls={panelId}
                        aria-label={formatWorkspaceActionAriaLabel(
                          action.label,
                          action.items.length,
                          resolveWorkspaceActionScopeLabel(action.items),
                          action.isUnavailable
                        )}
                        data-workspace-menu-trigger={action.key}
                        data-shell-workspace-action
                        data-workspace-module={action.key}
                        data-workspace-scope={stationWorkspaceScopeKey}
                      >
                        {action.icon}
                        <span className="nav-mobile-workspace-copy">
                          <strong>{action.label}</strong>
                          <small>{action.isUnavailable ? zhCN.appShell.navWorkspaceUnavailable : action.description}</small>
                        </span>
                        <span className="nav-mobile-workspace-count" aria-hidden="true">
                          {action.isUnavailable ? zhCN.appShell.navWorkspaceUnavailable : action.items.length}
                        </span>
                        <ChevronDown className="nav-mobile-workspace-chevron" size={14} aria-hidden="true" />
                      </button>
                      {isOpen && !action.isUnavailable ? (
                        <nav
                          id={panelId}
                          className="nav-mobile-workspace-panel"
                          aria-label={`${stationWorkspaceScopeLabel} · ${action.label}`}
                          data-workspace-panel={action.key}
                        >
                          {action.items.map((item) => (
                            <NavLink
                              key={item.to}
                              to={item.to}
                              end
                              className={({ isActive }) => `nav-mobile-workspace-child${isActive ? " active is-current" : ""}`}
                              onClick={() => {
                                setOpenWorkspaceMenuKey(null);
                                closeMobileNav();
                              }}
                              data-workspace-child-link
                              data-workspace-module={action.key}
                              data-workspace-data-scope={item.scopeLabel}
                            >
                              {item.icon}
                              <span className="nav-mobile-workspace-child-copy">
                                <strong>{item.label}</strong>
                                <small>{zhCN.appShell.navWorkspaceDataScope}：{item.scopeLabel}</small>
                              </span>
                              <ChevronRight size={13} aria-hidden="true" />
                            </NavLink>
                          ))}
                        </nav>
                      ) : null}
                    </div>
                  );
                })}
                {configWorkspaceAction ? (() => {
                  const isOpen = openWorkspaceMenuKey === configWorkspaceAction.key;
                  const panelId = "mobile-workspace-panel-config";
                  return (
                    <div
                      className={`nav-mobile-workspace-menu-root nav-mobile-workspace-config-root${isOpen ? " is-open" : ""}`}
                      data-workspace-menu-root
                    >
                      <button
                        type="button"
                        className={`nav-mobile-workspace-link nav-mobile-workspace-config${configWorkspaceAction.isActive ? " active is-current" : ""}`}
                        onClick={() => toggleWorkspaceMenu(configWorkspaceAction.key)}
                        onKeyDown={(event) => {
                          if (event.key !== "ArrowDown") {
                            return;
                          }
                          event.preventDefault();
                          setOpenWorkspaceMenuKey(configWorkspaceAction.key);
                          window.requestAnimationFrame(() => {
                            document.querySelector<HTMLElement>(`#${panelId} a[href]`)?.focus();
                          });
                        }}
                        aria-expanded={isOpen}
                        aria-controls={panelId}
                        aria-label={formatWorkspaceActionAriaLabel(
                          configWorkspaceAction.label,
                          configWorkspaceAction.items.length,
                          currentProjectDataScopeLabel
                        )}
                        data-workspace-menu-trigger="config"
                        data-shell-global-config
                        data-workspace-module="config"
                        data-workspace-scope="global"
                      >
                        {configWorkspaceAction.icon}
                        <span className="nav-mobile-workspace-copy">
                          <strong>{configWorkspaceAction.label}</strong>
                          <small>{configWorkspaceAction.description}</small>
                        </span>
                        <span className="nav-mobile-workspace-count" aria-hidden="true">{configWorkspaceAction.items.length}</span>
                        <ChevronDown className="nav-mobile-workspace-chevron" size={14} aria-hidden="true" />
                      </button>
                      {isOpen ? (
                        <nav
                          id={panelId}
                          className="nav-mobile-workspace-panel"
                          aria-label={configWorkspaceAction.label}
                          data-workspace-panel="config"
                        >
                          {configWorkspaceAction.items.map((item) => (
                            <NavLink
                              key={item.to}
                              to={item.to}
                              end
                              className={({ isActive }) => `nav-mobile-workspace-child${isActive ? " active is-current" : ""}`}
                              onClick={() => {
                                setOpenWorkspaceMenuKey(null);
                                closeMobileNav();
                              }}
                              data-workspace-child-link
                              data-workspace-module="config"
                              data-workspace-data-scope={item.scopeLabel}
                            >
                              {item.icon}
                              <span className="nav-mobile-workspace-child-copy">
                                <strong>{item.label}</strong>
                                <small>{zhCN.appShell.navWorkspaceDataScope}：{item.scopeLabel}</small>
                              </span>
                              <ChevronRight size={13} aria-hidden="true" />
                            </NavLink>
                          ))}
                        </nav>
                      ) : null}
                    </div>
                  );
                })() : null}
              </div>
            </section>
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
        aria-label={zhCN.appShell.closeNavigation}
        aria-hidden="true"
        tabIndex={-1}
        data-mobile-nav-overlay
      />
      <main
        ref={shellMainRef}
        data-shell-main
        inert={isCompactViewport && isMobileNavOpen ? true : undefined}
      >
        <header className="top-bar" data-shell-topbar>
          <div className="top-left">
            <button
              ref={mobileNavToggleRef}
              className="mobile-nav-toggle"
              type="button"
              onClick={toggleMobileNav}
              aria-label={isMobileNavOpen ? zhCN.appShell.closeNavigation : zhCN.appShell.openNavigation}
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
                <div className="project-switcher">
                  <span id={PROJECT_SWITCHER_LABEL_ID}>{zhCN.appShell.projectLabel}</span>
                  <div
                    className="project-switcher-dropdown"
                    ref={projectDropdownRef}
                    onBlur={(event) => {
                      const nextFocus = event.relatedTarget;
                      if (!(nextFocus instanceof Node) || !event.currentTarget.contains(nextFocus)) {
                        closeProjectDropdown(false);
                      }
                    }}
                  >
                    <button
                      id={PROJECT_SWITCHER_TRIGGER_ID}
                      ref={projectDropdownTriggerRef}
                      type="button"
                      className={`project-switcher-trigger${isProjectDropdownOpen ? " is-open" : ""}`}
                      onClick={() => {
                        if (isProjectDropdownOpen) {
                          closeProjectDropdown(false);
                        } else {
                          openProjectDropdown("current");
                        }
                      }}
                      onKeyDown={handleProjectDropdownTriggerKeyDown}
                      disabled={Boolean(switchingProjectId)}
                      aria-haspopup="tree"
                      aria-expanded={isProjectDropdownOpen}
                      aria-controls={PROJECT_SWITCHER_TREE_ID}
                      aria-labelledby={`${PROJECT_SWITCHER_LABEL_ID} ${PROJECT_SWITCHER_VALUE_ID}`}
                    >
                      <span id={PROJECT_SWITCHER_VALUE_ID} className="project-switcher-trigger-text">
                        {currentProject ? currentProjectDisplayName : zhCN.appShell.projectSelectPlaceholder}
                      </span>
                      <ChevronDown size={14} aria-hidden="true" />
                    </button>
                    <div
                      id={PROJECT_SWITCHER_TREE_ID}
                      ref={projectTreeRef}
                      className="project-switcher-menu"
                      role="tree"
                      aria-labelledby={PROJECT_SWITCHER_LABEL_ID}
                      aria-orientation="vertical"
                      hidden={!isProjectDropdownOpen}
                    >
                      {projectDropdownEntries.map((entry) => renderProjectDropdownEntry(entry))}
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
            <div className="top-system-meta">
              <span className="top-user-perspective" title={navigationPerspective.description}>
                {navigationPerspective.label}
              </span>
              <span className="top-user" title={`${zhCN.appShell.currentUserPrefix}${session?.username || zhCN.common.unknown}`}>
                {session?.username || zhCN.common.unknown}
              </span>
              <span className="top-time" title={nowLabel}>{nowLabel}</span>
              <div className="locale-switcher">
                <span id={LOCALE_SWITCHER_LABEL_ID}>{zhCN.appShell.languageLabel}</span>
                <div
                  className="locale-switcher-dropdown"
                  ref={localeDropdownRef}
                  onBlur={(event) => {
                    const nextFocus = event.relatedTarget;
                    if (!(nextFocus instanceof Node) || !event.currentTarget.contains(nextFocus)) {
                      closeLocaleDropdown(false);
                    }
                  }}
                >
                  <button
                    id={LOCALE_SWITCHER_TRIGGER_ID}
                    ref={localeDropdownTriggerRef}
                    type="button"
                    className={`locale-switcher-trigger${isLocaleDropdownOpen ? " is-open" : ""}`}
                    onClick={() => {
                      if (isLocaleDropdownOpen) {
                        closeLocaleDropdown(false);
                      } else {
                        openLocaleDropdown("current");
                      }
                    }}
                    onKeyDown={handleLocaleDropdownTriggerKeyDown}
                    aria-haspopup="listbox"
                    aria-expanded={isLocaleDropdownOpen}
                    aria-controls={LOCALE_SWITCHER_LISTBOX_ID}
                    aria-labelledby={`${LOCALE_SWITCHER_LABEL_ID} ${LOCALE_SWITCHER_VALUE_ID}`}
                  >
                    <span id={LOCALE_SWITCHER_VALUE_ID} className="locale-switcher-trigger-text">
                      {currentLocaleOption?.label || locale}
                    </span>
                    <ChevronDown size={14} aria-hidden="true" />
                  </button>
                  <div
                    id={LOCALE_SWITCHER_LISTBOX_ID}
                    ref={localeListboxRef}
                    className="locale-switcher-menu"
                    role="listbox"
                    aria-labelledby={LOCALE_SWITCHER_LABEL_ID}
                    aria-orientation="vertical"
                    hidden={!isLocaleDropdownOpen}
                  >
                    {localeOptions.map((item) => {
                      const isActive = item.value === locale;
                      const optionId = resolveLocaleOptionDomId(item.value);
                      return (
                        <button
                          key={item.value}
                          id={optionId}
                          type="button"
                          role="option"
                          aria-selected={isActive}
                          tabIndex={activeLocaleOptionId === optionId ? 0 : -1}
                          data-locale-option
                          className={`locale-switcher-option${isActive ? " is-active" : ""}`}
                          onFocus={() => setActiveLocaleOptionId(optionId)}
                          onKeyDown={handleLocaleOptionKeyDown}
                          onClick={() => handleLocaleChange(item.value)}
                        >
                          <span className="locale-switcher-option-label">{item.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </header>
        {showSecondaryNav ? (
          <nav
            className="secondary-nav"
            data-shell-secondary-nav
            data-shell-internal-nav={routeEnergyStation ? "station" : undefined}
            data-secondary-nav-scope={
              routeEnergyStation
                ? "station"
                : currentEnergyStation
                  ? "station-workspace"
                  : "project"
            }
            aria-label={
              locale === "en-US"
                ? `${secondaryNavTitle} secondary navigation`
                : locale === "vi-VN"
                  ? `${secondaryNavTitle} điều hướng phụ`
                  : `${secondaryNavTitle}二级导航`
            }
          >
            <span className="secondary-nav-title">{secondaryNavTitle}</span>
            <div className="secondary-nav-links">
              {secondaryNavItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={buildContextualNavigationTarget(item.to)}
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
            {currentEnergyStation ? (
              <span
                className="station-context-status"
                data-status-kind={currentStationInstance?.statusPresentation.kind || currentEnergyStation.status.kind}
                title={currentStationInstance?.statusPresentation.detailLabel || currentEnergyStation.status.detailLabel}
              >
                {currentStationInstance?.statusPresentation.detailLabel || currentEnergyStation.status.detailLabel}
              </span>
            ) : null}
            <div
              className="station-workspace-toolbar"
              role="group"
              data-shell-station-workspace
              data-workspace-level={workspaceLevel}
              data-station-context={stationWorkspaceScopeKey}
              aria-label={`${workspaceTitle} · ${zhCN.appShell.navWorkspaceContext}: ${stationWorkspaceScopeLabel} · ${zhCN.appShell.navWorkspaceDataScope}: ${currentPageDataScopeLabel}`}
            >
              <span className="station-workspace-level" data-workspace-level-label>{workspaceTitle}</span>
              <span className="station-workspace-context" title={`${zhCN.appShell.navWorkspaceContext}：${stationWorkspaceScopeLabel}`}>
                <small>{zhCN.appShell.navWorkspaceContext}</small>
                <strong>{stationWorkspaceScopeLabel}</strong>
              </span>
              <span
                className="station-workspace-data-scope"
                title={`${zhCN.appShell.navWorkspaceDataScope}：${currentPageDataScopeLabel}`}
                data-workspace-current-data-scope
              >
                <small>{zhCN.appShell.navWorkspaceDataScope}</small>
                <strong>{currentPageDataScopeLabel}</strong>
              </span>
              <div className="station-workspace-actions">
                {stationWorkspaceActions.map((action) => {
                  const isOpen = openWorkspaceMenuKey === action.key;
                  const panelId = `desktop-workspace-panel-${action.key}`;
                  return (
                    <div
                      key={action.key}
                      className={`station-workspace-menu-root${isOpen ? " is-open" : ""}${action.isUnavailable ? " is-unavailable" : ""}`}
                      data-workspace-menu-root
                      data-workspace-availability={action.isUnavailable ? "unavailable" : "available"}
                    >
                      <button
                        type="button"
                        className={`station-workspace-link${action.isActive ? " active is-current" : ""}`}
                        onClick={() => toggleWorkspaceMenu(action.key)}
                        disabled={action.isUnavailable}
                        onKeyDown={(event) => {
                          if (event.key !== "ArrowDown") {
                            return;
                          }
                          event.preventDefault();
                          setOpenWorkspaceMenuKey(action.key);
                          window.requestAnimationFrame(() => {
                            document.querySelector<HTMLElement>(`#${panelId} a[href]`)?.focus();
                          });
                        }}
                        aria-expanded={isOpen}
                        aria-controls={panelId}
                        aria-label={formatWorkspaceActionAriaLabel(
                          action.label,
                          action.items.length,
                          resolveWorkspaceActionScopeLabel(action.items),
                          action.isUnavailable
                        )}
                        title={`${action.label} · ${action.description}`}
                        data-workspace-menu-trigger={action.key}
                        data-shell-workspace-action
                        data-workspace-module={action.key}
                        data-workspace-scope={stationWorkspaceScopeKey}
                      >
                        {action.icon}
                        <span>{action.label}</span>
                        <span className="station-workspace-count" aria-hidden="true">
                          {action.isUnavailable ? zhCN.appShell.navWorkspaceUnavailable : action.items.length}
                        </span>
                        <ChevronDown className="station-workspace-chevron" size={12} aria-hidden="true" />
                      </button>
                      {isOpen && !action.isUnavailable ? (
                        <nav
                          id={panelId}
                          className="station-workspace-popover"
                          aria-label={`${stationWorkspaceScopeLabel} · ${action.label}`}
                          data-workspace-panel={action.key}
                        >
                          <div className="station-workspace-popover-header">
                            <span>{zhCN.appShell.navWorkspaceContext} · {stationWorkspaceScopeLabel}</span>
                            <strong>{action.label}</strong>
                            <small>{action.description}</small>
                          </div>
                          <div className="station-workspace-popover-list">
                            {action.items.map((item) => (
                              <NavLink
                                key={item.to}
                                to={item.to}
                                end
                                className={({ isActive }) => `station-workspace-popover-link${isActive ? " active is-current" : ""}`}
                                onClick={() => setOpenWorkspaceMenuKey(null)}
                                data-workspace-child-link
                                data-workspace-module={action.key}
                                data-workspace-data-scope={item.scopeLabel}
                              >
                                {item.icon}
                                <span className="station-workspace-popover-copy">
                                  <strong>{item.label}</strong>
                                  <small>{zhCN.appShell.navWorkspaceDataScope}：{item.scopeLabel}</small>
                                </span>
                                <ChevronRight size={12} aria-hidden="true" />
                              </NavLink>
                            ))}
                          </div>
                        </nav>
                      ) : null}
                    </div>
                  );
                })}
                {configWorkspaceAction ? (() => {
                  const isOpen = openWorkspaceMenuKey === configWorkspaceAction.key;
                  const panelId = "desktop-workspace-panel-config";
                  return (
                    <div
                      className={`station-workspace-menu-root station-workspace-config-root${isOpen ? " is-open" : ""}`}
                      data-workspace-menu-root
                    >
                      <button
                        type="button"
                        className={`station-workspace-link station-workspace-config${configWorkspaceAction.isActive ? " active is-current" : ""}`}
                        onClick={() => toggleWorkspaceMenu(configWorkspaceAction.key)}
                        onKeyDown={(event) => {
                          if (event.key !== "ArrowDown") {
                            return;
                          }
                          event.preventDefault();
                          setOpenWorkspaceMenuKey(configWorkspaceAction.key);
                          window.requestAnimationFrame(() => {
                            document.querySelector<HTMLElement>(`#${panelId} a[href]`)?.focus();
                          });
                        }}
                        aria-expanded={isOpen}
                        aria-controls={panelId}
                        aria-label={formatWorkspaceActionAriaLabel(
                          configWorkspaceAction.label,
                          configWorkspaceAction.items.length,
                          currentProjectDataScopeLabel
                        )}
                        title={`${configWorkspaceAction.label} · ${configWorkspaceAction.description}`}
                        data-workspace-menu-trigger="config"
                        data-shell-global-config
                        data-workspace-module="config"
                        data-workspace-scope="global"
                      >
                        {configWorkspaceAction.icon}
                        <span>{configWorkspaceAction.compactLabel}</span>
                        <span className="station-workspace-count" aria-hidden="true">{configWorkspaceAction.items.length}</span>
                        <ChevronDown className="station-workspace-chevron" size={12} aria-hidden="true" />
                      </button>
                      {isOpen ? (
                        <nav
                          id={panelId}
                          className="station-workspace-popover station-workspace-popover-global"
                          aria-label={configWorkspaceAction.label}
                          data-workspace-panel="config"
                        >
                          <div className="station-workspace-popover-header">
                            <span>{zhCN.appShell.navWorkspaceGlobalConfig}</span>
                            <strong>{configWorkspaceAction.compactLabel}</strong>
                            <small>{configWorkspaceAction.description}</small>
                          </div>
                          <div className="station-workspace-popover-list">
                            {configWorkspaceAction.items.map((item) => (
                              <NavLink
                                key={item.to}
                                to={item.to}
                                end
                                className={({ isActive }) => `station-workspace-popover-link${isActive ? " active is-current" : ""}`}
                                onClick={() => setOpenWorkspaceMenuKey(null)}
                                data-workspace-child-link
                                data-workspace-module="config"
                                data-workspace-data-scope={item.scopeLabel}
                              >
                                {item.icon}
                                <span className="station-workspace-popover-copy">
                                  <strong>{item.label}</strong>
                                  <small>{zhCN.appShell.navWorkspaceDataScope}：{item.scopeLabel}</small>
                                </span>
                                <ChevronRight size={12} aria-hidden="true" />
                              </NavLink>
                            ))}
                          </div>
                        </nav>
                      ) : null}
                    </div>
                  );
                })() : null}
              </div>
            </div>
          </nav>
        ) : null}
        <div
          id="app-shell-main-content"
          tabIndex={-1}
          className={`content ${isDashboardRoute ? "is-dashboard-content" : "is-subpage-compact"}${isSceneControlRoute ? " is-scene-embed-content" : ""}${isAutoTwinRoute ? " is-auto-twin-content" : ""}${showSecondaryNav ? " has-secondary-nav" : ""}`}
          data-shell-content
        >
          {stationScopeGuardActive ? (
            <section
              className="station-scope-guard"
              role="status"
              data-station-scope-guard
              data-rejected-station-type={rejectedQueryEnergyStation?.subsystemType}
              data-rejected-station-id={stationInstanceContextBlocked ? queryStationInstanceId || undefined : undefined}
              data-station-binding-state={stationRuntimeBindingBlocked ? stationBindingState : undefined}
              data-station-runtime-mode={stationRuntimeBindingMode}
            >
              <span className="station-scope-guard-eyebrow">{zhCN.appShell.navWorkspaceDataScope}</span>
              <h1>{unsupportedWorkspaceTitle}</h1>
              <p>{unsupportedWorkspaceHint}</p>
              <dl>
                <div>
                  <dt>{zhCN.appShell.navWorkspaceContext}</dt>
                  <dd>{scopeGuardContextLabel}</dd>
                </div>
                <div>
                  <dt>{zhCN.appShell.navWorkspaceDataScope}</dt>
                  <dd>{currentPageDataScopeLabel}</dd>
                </div>
              </dl>
              <NavLink
                className="station-scope-guard-action"
                to={scopeGuardBackTarget}
              >
                {unsupportedWorkspaceBackLabel}
                <ChevronRight size={14} aria-hidden="true" />
              </NavLink>
            </section>
          ) : (
            <ShellProjectDisplayProvider value={currentProjectCardDisplayName}>
              <StationRuntimeScopeProvider value={stationRuntimeScope}>
                <Outlet />
              </StationRuntimeScopeProvider>
            </ShellProjectDisplayProvider>
          )}
        </div>
      </main>
    </div>
  );
}
