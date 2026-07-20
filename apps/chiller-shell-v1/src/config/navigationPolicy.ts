export type NavigationPerspectiveId = "observer" | "operator" | "engineer";

export type NavigationPerspective = {
  id: NavigationPerspectiveId;
  label: string;
  description: string;
  modulePriority: string[];
  canViewUnconfiguredStations: boolean;
};

const PERSPECTIVES: Record<NavigationPerspectiveId, NavigationPerspective> = {
  observer: {
    id: "observer",
    label: "运行观察",
    description: "优先查看总览、告警与能效证据；所有控制保持只读。",
    modulePriority: ["dashboard", "operations", "duty", "analysis", "ai", "diagnostics", "config"],
    canViewUnconfiguredStations: false
  },
  operator: {
    id: "operator",
    label: "运行值守",
    description: "优先处理告警、运行记录与设备诊断。",
    modulePriority: ["duty", "operations", "dashboard", "diagnostics", "analysis", "ai", "config"],
    canViewUnconfiguredStations: false
  },
  engineer: {
    id: "engineer",
    label: "工程运维",
    description: "优先处理诊断、告警、配置与现场交接。",
    modulePriority: ["operations", "diagnostics", "duty", "dashboard", "config", "analysis", "ai"],
    canViewUnconfiguredStations: true
  }
};

export function resolveNavigationPerspective(
  role: string | null | undefined,
  readOnlyMode: boolean
): NavigationPerspective {
  if (readOnlyMode) {
    return PERSPECTIVES.observer;
  }
  if (role === "edit") {
    return PERSPECTIVES.engineer;
  }
  return PERSPECTIVES.operator;
}

export function prioritizeNavigationModules<T extends { key: string }>(
  modules: T[],
  perspective: NavigationPerspective
): T[] {
  const rankByKey = new Map(perspective.modulePriority.map((key, index) => [key, index]));
  return modules
    .map((module, index) => ({ module, index }))
    .sort((left, right) => {
      const leftRank = rankByKey.get(left.module.key) ?? Number.MAX_SAFE_INTEGER;
      const rightRank = rankByKey.get(right.module.key) ?? Number.MAX_SAFE_INTEGER;
      return leftRank === rightRank ? left.index - right.index : leftRank - rightRank;
    })
    .map(({ module }) => module);
}
