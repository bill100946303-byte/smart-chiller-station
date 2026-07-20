import type { SubsystemStatusPresentation, SubsystemStatusTone } from "./subsystemStatus";

export type StationMetricPresentation = {
  value: string;
  unit?: string;
  note: string;
  tone: SubsystemStatusTone;
};

export function formatControlBoundaryMode(value: string | null | undefined): string {
  switch (value) {
    case "shadow":
      return "影子建议";
    case "assisted":
      return "人工确认";
    case "enforced":
      return "闭环配置";
    default:
      return "只读";
  }
}

type ResolveStationMetricOptions = {
  status: SubsystemStatusPresentation;
  loading: boolean;
  errorText: string;
  demoValue: string;
  demoUnit: string;
  waitingNote: string;
  liveNote: string;
};

export function resolveStationMetric({
  status,
  loading,
  errorText,
  demoValue,
  demoUnit,
  waitingNote,
  liveNote
}: ResolveStationMetricOptions): StationMetricPresentation {
  if (loading) {
    return { value: "同步中", note: "正在读取能力状态", tone: "neutral" };
  }
  if (errorText) {
    return { value: "不可用", note: "能力链路异常", tone: "warn" };
  }

  switch (status.kind) {
    case "demo":
      return { value: demoValue, unit: demoUnit, note: "演示数据", tone: "neutral" };
    case "live":
      return { value: "待指标源", note: liveNote, tone: "warn" };
    case "waiting":
      return { value: "待接入", note: waitingNote, tone: "warn" };
    case "stale":
      return { value: "不可用", note: "数据陈旧，停止判读", tone: "warn" };
    case "error":
      return { value: "不可用", note: "实时链路异常", tone: "warn" };
    case "not_configured":
      return { value: "未配置", note: "不参与统计", tone: "neutral" };
    case "not_applicable":
      return { value: "不适用", note: "不参与统计", tone: "neutral" };
    default:
      return { value: "待核", note: "状态待核，停止判读", tone: "warn" };
  }
}

export function formatStationProcessState(status: SubsystemStatusPresentation): string {
  switch (status.kind) {
    case "demo":
      return "演示";
    case "live":
      return "已回传";
    case "waiting":
      return "待现场点";
    case "stale":
      return "数据陈旧";
    case "error":
      return "链路异常";
    case "not_configured":
    case "not_applicable":
      return "--";
    default:
      return "状态待核";
  }
}
