export const controlPolicyPresentation = {
  sourceLabel: "站点批准参数",
  statusLabel: "站点参数待确认",
  chilledSupplyBoundary: "目标与上限以站点批准参数为准",
  chilledSupplyRollback: "冷冻出水越过站点批准上限",
  frequencyBoundary: "按变频器、最小流量与厂家限制",
  stepRateBoundary: "按设备调试批准速率",
  missingReason: "当前页面未取得已审批的站点控制参数，不展示通用数值代替现场边界。"
} as const;
