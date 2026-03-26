export type Kpi = {
  title: string;
  value: string;
  unit: string;
  delta: string;
  tone: "neutral" | "good" | "warn";
};

export const dashboardKpis: Kpi[] = [
  { title: "当前 COP", value: "3.78", unit: "", delta: "+0.12", tone: "good" },
  { title: "总站功率", value: "892", unit: "kW", delta: "-3.1%", tone: "good" },
  { title: "当前负荷率", value: "72.4", unit: "%", delta: "+1.8%", tone: "neutral" },
  { title: "今日累计电量", value: "8,251", unit: "kWh", delta: "-4.6%", tone: "good" },
  { title: "节能潜力", value: "6.9", unit: "%", delta: "+0.7%", tone: "warn" },
  { title: "当前异常数", value: "3", unit: "项", delta: "+1", tone: "warn" }
];

export const recommendations = [
  {
    id: "rec-001",
    title: "提高冷冻水供水温度设定",
    description: "低负荷时段将设定值从 7.0℃ 调整到 7.6℃",
    impact: "预计节能 4.8%",
    risk: "低"
  },
  {
    id: "rec-002",
    title: "下调冷却泵目标频率",
    description: "在当前工况下将目标频率由 46Hz 调整到 42Hz",
    impact: "预计节能 2.1%",
    risk: "中"
  },
  {
    id: "rec-003",
    title: "切换冷机主备顺序",
    description: "当前效率更高，优先 CH-02 作为主机",
    impact: "预计节能 1.4%",
    risk: "低"
  }
];

export const anomalies = [
  { title: "冷冻水温差偏低", loss: "210 kWh/天", severity: "高" },
  { title: "冷却侧散热能力下降", loss: "120 kWh/天", severity: "中" },
  { title: "水泵短周期启停趋势", loss: "65 kWh/天", severity: "中" },
  { title: "疑似传感器漂移：TT-104", loss: "未知", severity: "低" }
];

export const topologyNodes = [
  { id: "ch", label: "冷机群组", running: "2/3 台", status: "running" },
  { id: "chp", label: "冷冻泵组", running: "2/3 台", status: "running" },
  { id: "load", label: "建筑负荷", running: "72.4%", status: "stable" },
  { id: "cwp", label: "冷却泵组", running: "2/3 台", status: "running" },
  { id: "ct", label: "冷却塔组", running: "1/2 台", status: "alert" }
];
