import {
  type AuthProject,
  resolveAuthProjectDisplayName,
  resolveAuthProjectId
} from "./auth";

type CascadedProjectNode = {
  key: string;
  label: string;
  optionId?: string;
  project?: AuthProject;
  order: number;
  children: CascadedProjectNode[];
};

export type ProjectDropdownEntry =
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
      children: Array<{
        key: string;
        label: string;
        optionId: string;
        order: number;
      }>;
    };

type SelectableDescendant = {
  key: string;
  label: string;
  optionId: string;
  depth: number;
  order: number;
  parentProjectLabel?: string;
  semanticKey: string;
};

const PROJECT_CASCADE_SPLITTER = /^(.+?)\s*[-\uFF0D\u2014\u2013]\s*(.+)$/;
const DEFAULT_INTERMEDIATE_PROJECT_LABELS = new Set(["默认", "default"]);

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

function composeParentChildLabel(parentLabel: string, childLabel: string): string {
  const parent = normalizeProjectLabel(parentLabel);
  const child = normalizeProjectLabel(childLabel);
  if (!parent) {
    return child;
  }
  if (!child) {
    return parent;
  }
  if (child === parent || child.startsWith(`${parent}-`)) {
    return child;
  }
  return `${parent}-${child}`;
}

function resolveProjectNodeMeta(project: AuthProject): {
  optionId: string;
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

function buildCascadedProjectTree(projects: AuthProject[]): CascadedProjectNode[] {
  if (!projects.length) {
    return [];
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
  return sortProjectTreeNodes(roots);
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

function collectSelectableDescendants(
  node: CascadedProjectNode,
  depth: number,
  switchableOptionIds: Set<string>
): SelectableDescendant[] {
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
    collected.push(...collectSelectableDescendants(child, depth + 1, switchableOptionIds));
  });
  return collected;
}

function collectDeepestSelectableChildren(
  node: CascadedProjectNode,
  depth: number,
  thresholdDepth: number,
  switchableOptionIds: Set<string>
): SelectableDescendant[] {
  if (depth < thresholdDepth) {
    return node.children.flatMap((child) =>
      collectDeepestSelectableChildren(child, depth + 1, thresholdDepth, switchableOptionIds)
    );
  }

  const deeper = node.children.flatMap((child) =>
    collectDeepestSelectableChildren(child, depth + 1, thresholdDepth, switchableOptionIds)
  );
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

function dedupeSelectableBySemantic(
  items: SelectableDescendant[],
  currentProjectOptionId: string
): SelectableDescendant[] {
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

export function buildProjectDropdownEntries(
  sessionProjects: AuthProject[],
  switchableProjects: AuthProject[],
  currentProjectOptionId: string
): ProjectDropdownEntry[] {
  const roots = buildCascadedProjectTree(sessionProjects);
  const switchableOptionIds = new Set(switchableProjects.map((project) => resolveAuthProjectId(project)));

  return roots
    .map((root): ProjectDropdownEntry | null => {
      const descendants = collectSelectableDescendants(root, 0, switchableOptionIds)
        .sort((left, right) => left.order - right.order);

      const hasRealRootOption = Boolean(root.optionId && switchableOptionIds.has(root.optionId));
      const childDepthThreshold = hasRealRootOption ? 2 : 1;
      const thirdLevelDescendants = collectDeepestSelectableChildren(
        root,
        0,
        childDepthThreshold,
        switchableOptionIds
      ).sort((left, right) => left.order - right.order);
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
        const uniqueChildren = dedupeSelectableBySemantic(thirdLevelDescendants, currentProjectOptionId);
        const highQualityChildren = uniqueChildren.filter((item) => scoreDropdownLabel(item.label) >= 3);
        const filteredChildren = highQualityChildren.length > 0 ? highQualityChildren : uniqueChildren;
        return {
          type: "group",
          key: root.key,
          label: rootDisplayLabel || root.label,
          order: root.order,
          children: filteredChildren.map((item) => ({
            key: item.key,
            label: composeParentChildLabel(rootDisplayLabel || root.label, item.label),
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

      const dedupedDescendants = dedupeSelectableBySemantic(descendants, currentProjectOptionId);
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
        label:
          representative.depth > 0
            ? composeParentChildLabel(rootDisplayLabel || root.label, representative.label)
            : representative.label,
        optionId: representative.optionId,
        order: root.order
      };
    })
    .filter((item): item is ProjectDropdownEntry => Boolean(item))
    .sort((left, right) => left.order - right.order);
}

export function flattenProjectDropdownTargets(
  entries: ProjectDropdownEntry[]
): Array<{ optionId: string; label: string; order: number }> {
  const flattened = entries.flatMap((entry) => {
    if (entry.type === "single") {
      return [{
        optionId: entry.optionId,
        label: entry.label,
        order: entry.order
      }];
    }
    return entry.children.map((child) => ({
      optionId: child.optionId,
      label: child.label,
      order: child.order
    }));
  });
  const uniqueByOptionId = Array.from(
    flattened.reduce((map, item) => {
      if (!map.has(item.optionId) || item.order < (map.get(item.optionId)?.order || Number.MAX_SAFE_INTEGER)) {
        map.set(item.optionId, item);
      }
      return map;
    }, new Map<string, { optionId: string; label: string; order: number }>()).values()
  );
  return uniqueByOptionId.sort((left, right) => left.order - right.order);
}
