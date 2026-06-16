import { CloudSun, Droplets, Maximize2, Minimize2, ThermometerSun } from "lucide-react";
import { Fragment, type CSSProperties, type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { runtimeConfig } from "../config/runtimeConfig";
import { useShellProjectDisplay } from "../context/ShellProjectDisplayContext";
import { getCurrentLocale, type LocaleCode, zhCN } from "../i18n/zhCN";
import {
  getAuthSession,
  getCurrentProject,
  resolveAuthProjectDisplayName
} from "../services/auth";
import {
  type DashboardOverviewDto,
  type SceneDeviceAlarmRecordDto,
  type SceneDeviceInfoItemDto,
  type SceneDeviceOperationRecordDto,
  type SceneDeviceParameterItemDto,
  type SceneDeviceParameterGroupDto,
  type SceneDeviceParametersDto,
  type SceneFloorModelItemDto,
  fetchDashboardOverviewForProject,
  fetchSceneDeviceParameters,
  submitSceneDeviceCommand
} from "../services/bffClient";
import {
  findSceneFloorModelForProject,
  getCachedSceneFloorModels,
  preloadSceneFloorModels,
  resolveSceneDropdownProjectKey
} from "../services/sceneFloorModelCache";

type SceneMode = "2d" | "3d";
type SceneFitMode = "fit" | "native" | "zoom";
type SceneDeviceDialogTab = "info" | "detail" | "control" | "alarm" | "operation";
type SceneNativeViewportPreset = {
  x: number;
  y: number;
  width: number;
  height: number;
  maxScale: number;
};
const SCENE_NATIVE_CANVAS_WIDTH = 2500;
const SCENE_NATIVE_CANVAS_HEIGHT = 920;
const SCENE_NATIVE_B25_VIEWPORT: SceneNativeViewportPreset = {
  x: 520,
  y: 100,
  width: 1500,
  height: 760,
  maxScale: 1.12
};
const SCENE_NATIVE_BUILD_2D_VIEWPORT: SceneNativeViewportPreset = {
  x: 670,
  y: 100,
  width: 1120,
  height: 650,
  maxScale: 1.08
};
const SCENE_NATIVE_FLOOR_OVERVIEW_VIEWPORT: SceneNativeViewportPreset = {
  x: 620,
  y: 140,
  width: 1250,
  height: 700,
  maxScale: 1
};
const SCENE_NATIVE_COMPACT_2D_VIEWPORT: SceneNativeViewportPreset = {
  x: 620,
  y: 150,
  width: 1350,
  height: 650,
  maxScale: 1.05
};
const SCENE_NATIVE_WIDE_BLUEPRINT_VIEWPORT: SceneNativeViewportPreset = {
  x: 0,
  y: 0,
  width: SCENE_NATIVE_CANVAS_WIDTH,
  height: SCENE_NATIVE_CANVAS_HEIGHT,
  maxScale: 1
};
const SCENE_NATIVE_SAFE_VIEWPORT: SceneNativeViewportPreset = {
  x: 0,
  y: 0,
  width: SCENE_NATIVE_CANVAS_WIDTH,
  height: SCENE_NATIVE_CANVAS_HEIGHT,
  maxScale: 1
};

function resolveSceneNativeViewport(sceneUrl: string): SceneNativeViewportPreset {
  if (/guanlanb25\/2d/i.test(sceneUrl)) {
    return SCENE_NATIVE_B25_VIEWPORT;
  }
  if (/\/build\/2d(?:[/?#]|$)/i.test(sceneUrl)) {
    return SCENE_NATIVE_BUILD_2D_VIEWPORT;
  }
  if (/vietnamgoer\/2d/i.test(sceneUrl)) {
    return SCENE_NATIVE_WIDE_BLUEPRINT_VIEWPORT;
  }
  if (/\/2d\/floor\//i.test(sceneUrl)) {
    return SCENE_NATIVE_FLOOR_OVERVIEW_VIEWPORT;
  }
  if (/\/2d(?:[/?#]|$)/i.test(sceneUrl) || /\/2d\//i.test(sceneUrl)) {
    return SCENE_NATIVE_COMPACT_2D_VIEWPORT;
  }
  return SCENE_NATIVE_SAFE_VIEWPORT;
}

const SCENE_EMBED_TEXT: Record<
  LocaleCode,
  {
    modeLabels: Record<SceneMode, string>;
    wetBulb: string;
    outdoorHumidity: string;
    outdoorTemperature: string;
    loading: string;
    noRemoteUrl: string;
    environmentAria: string;
    modeAria: string;
    missing2dUrl: string;
    missing3dUrl: string;
    fullscreen: string;
    restore: string;
  }
> = {
  "zh-CN": {
    modeLabels: {
      "2d": "2D\u573a\u666f",
      "3d": "3D\u573a\u666f"
    },
    wetBulb: "\u6e7f\u7403\u6e29\u5ea6",
    outdoorHumidity: "\u5ba4\u5916\u6e7f\u5ea6",
    outdoorTemperature: "\u5ba4\u5916\u6e29\u5ea6",
    loading: "\u52a0\u8f7d\u4e2d",
    noRemoteUrl: "\u672a\u5339\u914d\u5230\u8fdc\u7a0b\u573a\u666f URL",
    environmentAria: "\u5ba4\u5916\u73af\u5883\u53c2\u6570",
    modeAria: "\u573a\u666f\u6a21\u5f0f\u5207\u6362",
    missing2dUrl: "\u5f53\u524d\u9879\u76ee\u6ca1\u6709\u8fd4\u56de 2D \u573a\u666f URL",
    missing3dUrl: "\u5f53\u524d\u9879\u76ee\u6ca1\u6709\u8fd4\u56de 3D \u573a\u666f URL",
    fullscreen: "\u5168\u5c4f\u663e\u793a\u5d4c\u5165\u573a\u666f",
    restore: "\u6062\u590d\u6b63\u5e38\u663e\u793a"
  },
  "en-US": {
    modeLabels: {
      "2d": "2D Scene",
      "3d": "3D Scene"
    },
    wetBulb: "Wet-bulb Temp",
    outdoorHumidity: "Outdoor Humidity",
    outdoorTemperature: "Outdoor Temp",
    loading: "Loading",
    noRemoteUrl: "No remote scene URL matched",
    environmentAria: "Outdoor environment parameters",
    modeAria: "Scene mode switch",
    missing2dUrl: "The current project did not return a 2D scene URL",
    missing3dUrl: "The current project did not return a 3D scene URL",
    fullscreen: "Fullscreen embedded scene",
    restore: "Restore normal view"
  },
  "vi-VN": {
    modeLabels: {
      "2d": "Canh 2D",
      "3d": "Canh 3D"
    },
    wetBulb: "Nhiet do bau uot",
    outdoorHumidity: "Do am ngoai troi",
    outdoorTemperature: "Nhiet do ngoai troi",
    loading: "Dang tai",
    noRemoteUrl: "Chua khop URL canh tu xa",
    environmentAria: "Thong so moi truong ngoai troi",
    modeAria: "Chuyen che do canh",
    missing2dUrl: "Du an hien tai chua tra ve URL canh 2D",
    missing3dUrl: "Du an hien tai chua tra ve URL canh 3D",
    fullscreen: "Toan man hinh canh nhung",
    restore: "Khoi phuc hien thi binh thuong"
  }
};

function getSceneEmbedText(locale: LocaleCode): (typeof SCENE_EMBED_TEXT)[LocaleCode] {
  return SCENE_EMBED_TEXT[locale] || SCENE_EMBED_TEXT["zh-CN"];
}

const SCENE_DEVICE_DIALOG_TAB_ORDER: SceneDeviceDialogTab[] = [
  "info",
  "detail",
  "control",
  "alarm",
  "operation"
];

const SCENE_DEVICE_DIALOG_TAB_LABELS: Record<LocaleCode, Record<SceneDeviceDialogTab, string>> = {
  "zh-CN": {
    info: "\u8bbe\u5907\u4fe1\u606f",
    detail: "\u8fd0\u884c\u53c2\u6570",
    control: "\u63a7\u5236\u8bbe\u5b9a",
    alarm: "\u544a\u8b66\u8bb0\u5f55",
    operation: "\u64cd\u4f5c\u8bb0\u5f55"
  },
  "en-US": {
    info: "Device Info",
    detail: "Runtime Params",
    control: "Control Settings",
    alarm: "Alarms",
    operation: "Operations"
  },
  "vi-VN": {
    info: "Thong tin thiet bi",
    detail: "Thong so van hanh",
    control: "Cai dat dieu khien",
    alarm: "Canh bao",
    operation: "Thao tac"
  }
};

function getSceneDeviceDialogTabs(locale: LocaleCode): Array<{ key: SceneDeviceDialogTab; label: string }> {
  const labels = SCENE_DEVICE_DIALOG_TAB_LABELS[locale] || SCENE_DEVICE_DIALOG_TAB_LABELS["zh-CN"];
  return SCENE_DEVICE_DIALOG_TAB_ORDER.map((key) => ({ key, label: labels[key] }));
}

function getSceneDeviceDialogCloseText(locale: LocaleCode): { close: string; closeAria: string } {
  return SCENE_DEVICE_DIALOG_CLOSE_TEXT[locale] || SCENE_DEVICE_DIALOG_CLOSE_TEXT["zh-CN"];
}

const SCENE_DEVICE_DIALOG_TEXT = {
  title: "\u573a\u666f\u8bbe\u5907",
  closeAria: "\u5173\u95ed\u8bbe\u5907\u7a97\u53e3",
  tabsAria: "\u8bbe\u5907\u5f39\u7a97\u6807\u7b7e\u9875",
  loading: "\u6b63\u5728\u52a0\u8f7d\u8bbe\u5907\u6570\u636e...",
  detailEmpty: "\u5f53\u524d\u8bbe\u5907\u6682\u65e0\u8fd0\u884c\u53c2\u6570\u3002",
  controlEmpty: "\u5f53\u524d\u8bbe\u5907\u6682\u65e0\u53ef\u4e0b\u53d1\u63a7\u5236\u70b9\u3002",
  alarmEmpty: "\u5f53\u524d\u8bbe\u5907\u6682\u65e0\u544a\u8b66\u8bb0\u5f55\u3002",
  operationEmpty: "\u5f53\u524d\u8bbe\u5907\u6682\u65e0\u64cd\u4f5c\u8bb0\u5f55\u3002"
};

const SCENE_DEVICE_DIALOG_CLOSE_TEXT: Record<LocaleCode, { close: string; closeAria: string }> = {
  "zh-CN": {
    close: "\u5173\u95ed",
    closeAria: "\u5173\u95ed\u8bbe\u5907\u7a97\u53e3"
  },
  "en-US": {
    close: "Close",
    closeAria: "Close device dialog"
  },
  "vi-VN": {
    close: "Dong",
    closeAria: "Dong hop thoai thiet bi"
  }
};

const SCENE_DEVICE_RECORD_TEXT: Record<
  LocaleCode,
  {
    operationContent: string;
    operationResult: string;
    operationPerson: string;
    operationTime: string;
    alarmLevel: string;
    alarmState: string;
    alarmContent: string;
    alarmTime: string;
    recovered: string;
    alarming: string;
    unknown: string;
  }
> = {
  "zh-CN": {
    operationContent: "\u64cd\u4f5c\u5185\u5bb9",
    operationResult: "\u4e0b\u53d1/\u6267\u884c\u7ed3\u679c",
    operationPerson: "\u64cd\u4f5c\u4eba",
    operationTime: "\u64cd\u4f5c\u65f6\u95f4",
    alarmLevel: "\u544a\u8b66\u7ea7\u522b",
    alarmState: "\u72b6\u6001",
    alarmContent: "\u544a\u8b66\u5185\u5bb9",
    alarmTime: "\u53d1\u751f\u65f6\u95f4",
    recovered: "\u5df2\u6062\u590d",
    alarming: "\u544a\u8b66\u4e2d",
    unknown: "--"
  },
  "en-US": {
    operationContent: "Operation",
    operationResult: "Result",
    operationPerson: "Operator",
    operationTime: "Time",
    alarmLevel: "Level",
    alarmState: "State",
    alarmContent: "Alarm Content",
    alarmTime: "Alarm Time",
    recovered: "Recovered",
    alarming: "Alarming",
    unknown: "--"
  },
  "vi-VN": {
    operationContent: "Noi dung thao tac",
    operationResult: "Ket qua",
    operationPerson: "Nguoi thao tac",
    operationTime: "Thoi gian",
    alarmLevel: "Cap do",
    alarmState: "Trang thai",
    alarmContent: "Noi dung canh bao",
    alarmTime: "Thoi gian canh bao",
    recovered: "Da khoi phuc",
    alarming: "Dang canh bao",
    unknown: "--"
  }
};

const SCENE_CONTROL_SUBMIT_LABEL = "\u4e0b\u53d1";
const SCENE_CONTROL_PENDING_LABEL = "\u4e0b\u53d1\u4e2d";
const SCENE_NATIVE_FIT_MODE_OPTION = {
  value: "native" as const,
  label: "视图复位",
  title: "恢复初始视图位置和大小"
};
const SCENE_IDLE_3D_PREWARM_DELAY_MS = 1800;
const SCENE_COMFORT_LOADING_MAX_MS = 5200;

type SceneIdleWindow = Window & {
  requestIdleCallback?: (callback: () => void, options?: { timeout?: number }) => number;
  cancelIdleCallback?: (handle: number) => void;
};

type SceneControlSubmitHandler = (
  item: SceneDeviceParameterItemDto,
  value: string,
  actionKey: string,
  displayText?: string
) => void;

type SceneControlPendingCommand = {
  item: SceneDeviceParameterItemDto;
  value: string;
  actionKey: string;
  displayText: string;
  currentText: string;
  controlLabel: string;
  drTypeId: string;
  regName: string;
  tagName: string;
  intent: "normal" | "caution" | "danger";
};

type SceneControlCombinedRule = {
  label: string;
  members: string[];
};

type SceneControlCombinedMember = {
  item: SceneDeviceParameterItemDto;
  itemIndex: number;
  memberIndex: number;
  buttonLabel: string;
  value: string;
};

type SceneControlRenderRow =
  | {
      type: "item";
      item: SceneDeviceParameterItemDto;
      itemKey: string;
    }
  | {
      type: "combined";
      key: string;
      label: string;
      members: SceneControlCombinedMember[];
    };

type SceneParameterRow = {
  item: SceneDeviceParameterItemDto;
  key: string;
  groupName: string;
  label: string;
  valueText: string;
};

type SceneCompactValue = {
  key: string;
  label: string;
  valueText: string;
  matched?: boolean;
};

type SceneCompactSpec = {
  label: string;
  patterns: RegExp[];
};

type SceneMergedOperationRecord = {
  key: string;
  details: string;
  operationPerson: string;
  date: string;
  dispatchResult: string;
  executionResult: string;
  otherResults: string[];
};

type SceneDeviceKind = "chiller" | "tower" | "chilledPump" | "coolingPump" | "pump" | "other";

type SceneDeviceFilterContext = {
  kind: SceneDeviceKind;
  ordinal: string;
  tokens: string[];
};

const SCENE_DEVICE_RECORD_PREVIEW_LIMIT = 16;

const SCENE_CONTROL_COMBINED_RULES: SceneControlCombinedRule[] = [
  {
    label: "\u624b\u52a8\u542f\u505c",
    members: ["\u624b\u52a8\u542f\u52a8", "\u624b\u52a8\u505c\u6b62"]
  },
  {
    label: "\u677f\u6362\u5de5\u827a\u4e00\u952e\u542f\u505c",
    members: ["\u677f\u6362\u5de5\u827a\u4e00\u952e\u542f\u52a8", "\u677f\u6362\u5de5\u827a\u4e00\u952e\u505c\u6b62"]
  },
  {
    label: "\u677f\u6362\u4e00\u952e\u542f\u505c",
    members: ["\u677f\u6362\u4e00\u952e\u542f\u52a8", "\u677f\u6362\u4e00\u952e\u505c\u6b62"]
  },
  {
    label: "\u624b\u52a8\u9600\u95e8",
    members: ["\u624b\u52a8\u5f00\u9600", "\u624b\u52a8\u5173\u9600"]
  },
  {
    label: "\u4e00\u952e\u5f00\u5173",
    members: ["\u4e00\u952e\u5173\u673a", "\u4e00\u952e\u5f00\u673a"]
  },
  {
    label: "\u4e00\u952e\u542f\u505c",
    members: ["\u4e00\u952e\u542f\u52a8", "\u4e00\u952e\u505c\u6b62"]
  },
  {
    label: "\u5168\u81ea\u52a8\u542f\u505c",
    members: ["\u5168\u81ea\u52a8\u542f\u52a8", "\u5168\u81ea\u52a8\u505c\u6b62"]
  },
  {
    label: "\u4f4e\u901f\u542f\u505c",
    members: ["\u4f4e\u901f\u542f\u52a8", "\u4f4e\u901f\u505c\u6b62"]
  },
  {
    label: "\u9ad8\u901f\u542f\u505c",
    members: ["\u9ad8\u901f\u542f\u52a8", "\u9ad8\u901f\u505c\u6b62"]
  },
  {
    label: "\u7cfb\u7edf\u63a7\u5236\u6a21\u5f0f",
    members: ["\u624b\u52a8\u6a21\u5f0f", "\u673a\u7ec4\u6a21\u5f0f", "\u5168\u81ea\u52a8\u6a21\u5f0f"]
  }
];

const SCENE_FRAME_FIT_MESSAGES = [
  { type: "resize" },
  { type: "scene-resize" },
  { type: "scene-fit-view" },
  { type: "fitToWindow" },
  { type: "resetCamera" },
  { action: "resize" },
  { action: "fitToWindow" },
  { action: "resetCamera" }
];

const SCENE_FRAME_FIT_GLOBALS = [
  "viewer",
  "sceneViewer",
  "modelViewer",
  "threeViewer",
  "app",
  "map",
  "model",
  "scene"
];

const SCENE_FRAME_FIT_METHODS = [
  "resize",
  "fit",
  "fitView",
  "fitToView",
  "fitToWindow",
  "fitToScreen",
  "zoomToFit",
  "resetCamera",
  "resetView",
  "setFitView"
];

type SceneWeather = {
  outdoorWetBulbC: number | null;
  outdoorHumidityPct: number | null;
  outdoorTempC: number | null;
};

type SceneRuntimeMetricView = {
  key: string;
  label: string;
  value: string;
  unit?: string;
  hint: string;
  tone?: "good" | "info" | "warn" | "danger" | "neutral";
  primary?: boolean;
};

type SceneRuntimeContextItem = {
  label: string;
  value: string;
};

type SceneDeviceClick = {
  drId: string;
  deviceId: string;
  deviceName: string;
  deviceCode: string;
  modelName: string;
  deviceType: string;
  deviceTypeId: string;
  runningPoint: string;
  frequencyPoint: string;
};

function normalizeUrl(value: string | null | undefined): string {
  return typeof value === "string" ? value.trim() : "";
}

function readSceneAbsoluteUrl(value: string): URL | null {
  const normalized = normalizeUrl(value);
  if (!normalized) {
    return null;
  }
  try {
    return new URL(normalized, window.location.href);
  } catch {
    return null;
  }
}

function ensureSceneHeadLink(key: string, configure: (link: HTMLLinkElement) => void) {
  const existing = Array.from(document.head.querySelectorAll<HTMLLinkElement>("link[data-scene-model-hint]"))
    .some((link) => link.dataset.sceneModelHint === key);
  if (existing) {
    return;
  }
  const link = document.createElement("link");
  link.dataset.sceneModelHint = key;
  configure(link);
  document.head.appendChild(link);
}

function ensureSceneModelOriginHints(urls: string[]) {
  const origins = new Set<string>();
  urls.forEach((url) => {
    const parsed = readSceneAbsoluteUrl(url);
    if (parsed) {
      origins.add(parsed.origin);
    }
  });
  origins.forEach((origin) => {
    const parsed = readSceneAbsoluteUrl(origin);
    if (!parsed) {
      return;
    }
    ensureSceneHeadLink(`dns-prefetch:${parsed.host}`, (link) => {
      link.rel = "dns-prefetch";
      link.href = `//${parsed.host}`;
    });
    ensureSceneHeadLink(`preconnect:${parsed.origin}`, (link) => {
      link.rel = "preconnect";
      link.href = parsed.origin;
    });
  });
}

function ensureSceneModelDocumentPrefetch(url: string) {
  const parsed = readSceneAbsoluteUrl(url);
  if (!parsed) {
    return;
  }
  ensureSceneHeadLink(`prefetch:${parsed.href}`, (link) => {
    link.rel = "prefetch";
    link.as = "document";
    link.href = parsed.href;
  });
}

function callSceneFrameFitMethods(target: unknown) {
  if (!target || (typeof target !== "object" && typeof target !== "function")) {
    return;
  }
  const record = target as Record<string, unknown>;
  SCENE_FRAME_FIT_METHODS.forEach((method) => {
    const candidate = record[method];
    if (typeof candidate === "function") {
      try {
        candidate.call(target);
      } catch {
        // Remote scene pages differ by renderer; unsupported fit hooks are ignored.
      }
    }
  });
}

function requestSceneFrameAutoFit(iframe: HTMLIFrameElement | null) {
  const frameWindow = iframe?.contentWindow;
  if (!frameWindow) {
    return;
  }

  SCENE_FRAME_FIT_MESSAGES.forEach((message) => {
    try {
      frameWindow.postMessage(message, "*");
    } catch {
      // Cross-origin frames may ignore these hints; the iframe itself remains usable.
    }
  });

  try {
    frameWindow.dispatchEvent(new Event("resize"));
  } catch {
    // Cross-origin access can be restricted.
  }

  try {
    const frameDocument = iframe.contentDocument || frameWindow.document;
    frameDocument.documentElement.style.width = "100%";
    frameDocument.documentElement.style.height = "100%";
    frameDocument.documentElement.style.overflow = "hidden";
    if (frameDocument.body) {
      frameDocument.body.style.width = "100%";
      frameDocument.body.style.height = "100%";
      frameDocument.body.style.margin = "0";
      frameDocument.body.style.overflow = "hidden";
    }
    frameDocument.querySelectorAll("canvas").forEach((canvas) => {
      canvas.style.width = "100%";
      canvas.style.height = "100%";
    });
  } catch {
    // Same-origin styling is best-effort only.
  }

  try {
    callSceneFrameFitMethods(frameWindow);
    const frameRecord = frameWindow as Window & Record<string, unknown>;
    SCENE_FRAME_FIT_GLOBALS.forEach((key) => callSceneFrameFitMethods(frameRecord[key]));
  } catch {
    // Best-effort renderer integration.
  }
}

function normalizeLabel(value: string | null | undefined): string {
  return String(value || "").trim();
}

function readSceneWeather(overview: DashboardOverviewDto | null): SceneWeather {
  return {
    outdoorWetBulbC: overview?.energyCards?.outdoorWetBulbC ?? null,
    outdoorHumidityPct: overview?.energyCards?.outdoorHumidityPct ?? null,
    outdoorTempC: overview?.energyCards?.outdoorTempC ?? null
  };
}

function formatSceneMetric(value: number | null, unit: string, digits = 1): string {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "--";
  }
  return `${value.toFixed(digits)}${unit}`;
}

function isFiniteSceneNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function divideSceneOrNull(numerator: number | null | undefined, denominator: number | null | undefined): number | null {
  if (!isFiniteSceneNumber(numerator) || !isFiniteSceneNumber(denominator) || denominator === 0) {
    return null;
  }
  return numerator / denominator;
}

function formatSceneRuntimeNumber(value: number | null | undefined, digits = 1): string {
  if (!isFiniteSceneNumber(value)) {
    return "--";
  }
  return new Intl.NumberFormat("zh-CN", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  }).format(value);
}

function formatSceneRuntimeCount(value: number | null | undefined): string {
  if (!isFiniteSceneNumber(value)) {
    return "--";
  }
  return new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 0 }).format(value);
}

function formatSceneRuntimePercent(value: number | null | undefined): string {
  if (!isFiniteSceneNumber(value)) {
    return "--";
  }
  return formatSceneRuntimeNumber(value, value >= 10 ? 0 : 1);
}

function formatSceneRuntimeTime(value: string | null | undefined): string {
  if (!value) {
    return "";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function formatSceneRuntimeSourceState(overview: DashboardOverviewDto | null): { label: string; tone: "good" | "warn" | "neutral" } {
  const freshness = overview?.freshness;
  const timestamp = formatSceneRuntimeTime(freshness?.latestTimestamp || overview?.generatedAt);
  const suffix = timestamp ? ` · ${timestamp}` : "";
  if (!overview) {
    return { label: "数据待回传", tone: "neutral" };
  }
  if (freshness?.stale || freshness?.label === "stale") {
    return { label: `数据滞后${suffix}`, tone: "warn" };
  }
  if (freshness?.label === "fresh") {
    return { label: `数据新鲜${suffix}`, tone: "good" };
  }
  return { label: `数据已更新${suffix}`, tone: "good" };
}

function formatSceneTemperaturePair(first: number | null | undefined, second: number | null | undefined): string {
  const firstText = formatSceneRuntimeNumber(first, 1);
  const secondText = formatSceneRuntimeNumber(second, 1);
  if (firstText === "--" && secondText === "--") {
    return "--";
  }
  return `${firstText}/${secondText}`;
}

function formatSceneEquipmentCounts(overview: DashboardOverviewDto | null): string {
  const summary = overview?.deviceSummary;
  const values = [
    summary?.chillerCount,
    summary?.chilledPumpCount,
    summary?.coolingPumpCount,
    summary?.coolingTowerCount
  ];
  if (!values.some(isFiniteSceneNumber)) {
    return "--";
  }
  return values.map((value) => formatSceneRuntimeCount(value)).join("/");
}

function parseSceneLoadPercent(value: unknown): number | null {
  const normalized = readSceneText(value).replace(/,/g, "").replace(/%/g, "");
  if (!normalized) {
    return null;
  }
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) {
    return null;
  }
  return Math.max(0, Math.min(100, parsed));
}

function isSceneGifImage(value: string): boolean {
  return /\.gif(?:$|[?#])/i.test(value);
}

function getSceneDeviceInfoGroupByIndex(deviceInfo: SceneDeviceParametersDto["deviceInfo"], index: number) {
  return (deviceInfo?.layoutGroups || []).find((group) => Number(group.index) === index) || null;
}

function shouldHideSceneDeviceInfoItem(name: string, value: string): boolean {
  const normalizedName = normalizeSceneFilterText(name);
  const normalizedValue = readSceneSafeDisplayText(value);
  if (/^(drid|deviceid|设备id|设备类型id|drtypeid|drtype|typeid)$/.test(normalizedName)) {
    return true;
  }
  if (normalizedName === "设备类型" && /^\d+$/.test(normalizedValue)) {
    return true;
  }
  if (/^(运行点位|频率点位)$/.test(name) && /^\d+$/.test(normalizedValue)) {
    return true;
  }
  return false;
}

function formatSceneDeviceInfoLabel(name: string): string {
  return name
    .replace(/^正常\/报警$/, "告警状态")
    .replace(/^设备投用\/禁用$/, "投用状态")
    .replace(/^远程\/本地$/, "控制位置")
    .replace(/^频率手动给定$/, "手动频率给定")
    .replace(/^额定杨程$/, "额定扬程");
}

function formatSceneEngineeringText(value: string): string {
  return readSceneSafeDisplayText(value)
    .replace(/(\d)\s*(?:KW\/h|KWH)\b/gi, "$1 kWh")
    .replace(/\b(?:KW\/h|KWH)\b/gi, "kWh")
    .replace(/(\d)\s*KW\b/gi, "$1 kW")
    .replace(/\bKW\b/gi, "kW")
    .replace(/(\d)\s*KPA\b/gi, "$1 kPa")
    .replace(/\bKPA\b/gi, "kPa");
}

function formatSceneEngineeringUnit(unit: string): string {
  const normalized = readSceneSafeDisplayText(unit);
  if (/^(?:KW\/h|KWH)$/i.test(normalized)) {
    return "kWh";
  }
  if (/^KW$/i.test(normalized)) {
    return "kW";
  }
  if (/^KPA$/i.test(normalized)) {
    return "kPa";
  }
  return formatSceneEngineeringText(normalized);
}

function formatSceneEngineeringNumber(value: string, unit: string): string {
  const normalizedValue = formatSceneEngineeringText(value);
  const numericValue = Number(normalizedValue);
  if (!Number.isFinite(numericValue)) {
    return normalizedValue;
  }
  if (unit === "\u2103" || unit === "kPa" || unit === "kW") {
    return numericValue.toFixed(1);
  }
  return normalizedValue;
}

function formatSceneDeviceInfoValueParts(value: string, unit: string): {
  valueText: string;
  unitText: string;
  displayText: string;
} {
  const unitText = formatSceneEngineeringUnit(unit);
  const valueText = formatSceneEngineeringNumber(value || "--", unitText);
  const displayText = unitText && valueText !== "--"
    ? `${valueText} ${unitText}`
    : formatSceneEngineeringText(valueText);
  return {
    valueText: formatSceneEngineeringText(valueText),
    unitText,
    displayText
  };
}

function readSceneDeviceInfoNumericValue(value: string): number | null {
  const normalized = formatSceneEngineeringText(value).replace(/,/g, "");
  const match = normalized.match(/-?\d+(?:\.\d+)?/);
  if (!match) {
    return null;
  }
  const numericValue = Number(match[0]);
  return Number.isFinite(numericValue) ? numericValue : null;
}

function getSceneDeviceInfoTone(name: string, value: string, unit: string): "good" | "warn" | "danger" | "neutral" {
  const normalizedText = `${name} ${value} ${unit}`.trim();
  if (!normalizedText || value === "--") {
    return "neutral";
  }
  if (/报警|故障|异常|无水流|断流|离线|停机/.test(normalizedText)) {
    return "danger";
  }
  if (/本地|禁用|手动|关注|偏高|偏低/.test(normalizedText)) {
    return "warn";
  }
  if (/有水流|正常|投用|远程|在线|运行/.test(normalizedText)) {
    return "good";
  }

  const numericValue = readSceneDeviceInfoNumericValue(value);
  if (numericValue === null) {
    return "neutral";
  }
  if (/冷冻供水温度/.test(name)) {
    if (numericValue < 3 || numericValue > 15) {
      return "danger";
    }
    return numericValue < 4.5 || numericValue > 12 ? "warn" : "good";
  }
  if (/冷冻回水温度/.test(name)) {
    if (numericValue < 5 || numericValue > 24) {
      return "danger";
    }
    return numericValue < 7 || numericValue > 20 ? "warn" : "good";
  }
  if (/冷却.*水温度|冷凝温度/.test(name)) {
    if (numericValue > 45 || numericValue < 8) {
      return "danger";
    }
    return numericValue > 38 || numericValue < 12 ? "warn" : "good";
  }
  if (/蒸发温度/.test(name)) {
    if (numericValue < -2 || numericValue > 18) {
      return "danger";
    }
    return numericValue < 2 || numericValue > 15 ? "warn" : "good";
  }
  if (/压力/.test(name)) {
    if (numericValue <= 0) {
      return "danger";
    }
    return "good";
  }
  return "neutral";
}

function findSceneDeviceInfoItemValue(items: SceneDeviceInfoItemDto[], pattern: RegExp): string {
  const matched = items.find((item) => pattern.test(readSceneSafeDisplayText(item.name)));
  return readSceneSafeDisplayText(matched?.value);
}

function getSceneDeviceStatusTone(value: string): "good" | "warn" | "danger" | "neutral" {
  if (/异常|故障|报警|离线|无/.test(value)) {
    return "danger";
  }
  if (/本地|禁用|手动|未知|--/.test(value)) {
    return "warn";
  }
  if (/正常|在线|远程|投用|运行/.test(value)) {
    return "good";
  }
  return "neutral";
}

function resolveSceneCommunicationStatus(runStatus: string | undefined, hasStatusRows: boolean): string {
  const normalized = readSceneSafeDisplayText(runStatus);
  if (/^(?:1|true|online|normal|run|running|\u8fd0\u884c|\u6b63\u5e38|\u5728\u7ebf)$/i.test(normalized)) {
    return "\u901a\u8baf\u6b63\u5e38";
  }
  if (/^(?:0|false|offline|fault|error|stop|\u79bb\u7ebf|\u6545\u969c|\u5f02\u5e38)$/i.test(normalized)) {
    return "\u901a\u8baf\u5f02\u5e38";
  }
  return hasStatusRows ? "\u901a\u8baf\u6b63\u5e38" : "\u901a\u8baf\u672a\u77e5";
}

function renderSceneDeviceStatusPanel(
  items: SceneDeviceInfoItemDto[],
  runStatus: string | undefined,
  title = "\u8bbe\u5907\u72b6\u6001"
) {
  const enableValue = findSceneDeviceInfoItemValue(items, /设备投用|投用|禁用/) || "--";
  const remoteValue = findSceneDeviceInfoItemValue(items, /远程|本地|控制位置/) || "--";
  const communicationValue = resolveSceneCommunicationStatus(runStatus, items.length > 0);
  const badges = [
    { label: "\u6295\u7528\u72b6\u6001", value: enableValue },
    { label: "\u63a7\u5236\u4f4d\u7f6e", value: remoteValue },
    { label: "\u901a\u8baf\u72b6\u6001", value: communicationValue }
  ];

  return (
    <>
      <h4 className="scene-embed-device-info-title" title={title}>{title}</h4>
      <div className="scene-embed-device-status-badges">
        {badges.map((badge) => {
          const tone = getSceneDeviceStatusTone(badge.value);
          return (
            <article
              key={badge.label}
              className={`scene-embed-device-status-badge is-${tone}`}
              title={`${badge.label} ${badge.value}`}
            >
              <span>{badge.label}</span>
              <strong>{badge.value}</strong>
            </article>
          );
        })}
      </div>
    </>
  );
}

function resolveSceneLoadBand(loadPercent: number): {
  label: string;
  tone: "good" | "warn" | "danger";
} {
  if (loadPercent >= 95) {
    return { label: "\u9ad8\u8d1f\u8377", tone: "danger" };
  }
  if (loadPercent >= 85) {
    return { label: "\u504f\u9ad8", tone: "warn" };
  }
  if (loadPercent < 30) {
    return { label: "\u4f4e\u8f7d", tone: "warn" };
  }
  return { label: "\u7ecf\u6d4e\u533a", tone: "good" };
}

function renderSceneDeviceInfoList(
  items: SceneDeviceInfoItemDto[],
  _emptyText = "\u6682\u65e0\u6570\u636e",
  title = "",
  variant: "default" | "basic" = "default"
) {
  if (!items.length) {
    return title ? <h4 className="scene-embed-device-info-title" title={title}>{title}</h4> : null;
  }
  return (
    <>
      {title ? <h4 className="scene-embed-device-info-title" title={title}>{title}</h4> : null}
      <div className={`scene-embed-device-info-list is-${variant}`}>
        {items.map((item, index) => {
          const rawName = readSceneSafeDisplayText(item.name) || `\u9879\u76ee ${index + 1}`;
          const rawValue = readSceneSafeDisplayText(item.value) || "--";
          if (shouldHideSceneDeviceInfoItem(rawName, rawValue)) {
            return null;
          }
          const name = formatSceneDeviceInfoLabel(rawName);
          const { valueText, unitText, displayText } = formatSceneDeviceInfoValueParts(rawValue, readSceneSafeDisplayText(item.unit));
          const tone = variant === "basic" ? "neutral" : getSceneDeviceInfoTone(name, valueText, unitText);
          return (
            <article
              key={`${name}-${index}`}
              className={`scene-embed-device-info-row is-${tone}`}
              title={`${name} ${displayText}`}
            >
              <span title={name}>{name}</span>
              <strong title={displayText}>{valueText}</strong>
              {unitText && valueText !== "--" ? <em title={unitText}>{unitText}</em> : null}
            </article>
          );
        })}
      </div>
    </>
  );
}

function readSceneText(...values: unknown[]): string {
  for (const value of values) {
    if (value == null) {
      continue;
    }
    const normalized = String(value).trim();
    if (normalized) {
      return normalized;
    }
  }
  return "";
}

const SCENE_MOJIBAKE_MARKERS = [
  "\ufffd",
  "\u9422",
  "\u9359",
  "\u509b",
  "\u669f",
  "\u6fb6",
  "\u93c8",
  "\u558e",
  "\u9350",
  "\u8bf2",
  "\u95b2",
  "\u69db",
  "\u7490",
  "\u59dd",
  "\u749e"
];

function scoreSceneDisplayText(value: unknown): number {
  const text = readSceneText(value);
  if (!text) {
    return Number.POSITIVE_INFINITY;
  }
  const markerPenalty = SCENE_MOJIBAKE_MARKERS.reduce(
    (total, marker) => total + (text.includes(marker) ? 100 : 0),
    0
  );
  const replacementPenalty = (text.match(/\ufffd/g) || []).length * 120;
  const cjkReward = (text.match(/[\u4e00-\u9fff]/g) || []).length * 2;
  return markerPenalty + replacementPenalty - cjkReward;
}

function readSceneDisplayText(...values: unknown[]): string {
  const candidates = values
    .map((value, index) => ({
      text: readSceneText(value),
      score: scoreSceneDisplayText(value) + index * 0.01
    }))
    .filter((item) => item.text);
  if (candidates.length === 0) {
    return "";
  }
  candidates.sort((left, right) => left.score - right.score);
  return candidates[0].text;
}

function isSceneLikelyMojibake(value: unknown): boolean {
  const text = readSceneText(value);
  if (!text) {
    return false;
  }
  if (SCENE_MOJIBAKE_MARKERS.some((marker) => text.includes(marker))) {
    return true;
  }
  if (/閿焲鏂ゆ嫹|脙|脗|忙|氓|莽|冒|脨/.test(text)) {
    return /[\u4e00-\u9fff]/.test(text) || text.length > 3;
  }
  return scoreSceneDisplayText(text) >= 80;
}

function readSceneSafeDisplayText(...values: unknown[]): string {
  const text = readSceneDisplayText(...values);
  return isSceneLikelyMojibake(text) ? "" : text;
}

function extractSceneDeviceCode(value: unknown): string {
  const text = readSceneText(value);
  if (!text || text === "--" || /^\d+$/.test(text)) {
    return "";
  }
  const matched = text.match(/\b[A-Za-z]{1,10}[-_ ]?\d+[A-Za-z0-9_-]*\b/);
  if (matched?.[0]) {
    return matched[0].replace(/\s+/g, "");
  }
  if (!/[\u3400-\u9fff]/.test(text) && /[A-Za-z]/.test(text) && /\d/.test(text)) {
    return text;
  }
  return "";
}

function readSceneDeviceCode(...values: unknown[]): string {
  for (const value of values) {
    const code = extractSceneDeviceCode(value);
    if (code) {
      return code;
    }
  }
  return "";
}

function normalizeSceneFilterText(value: unknown): string {
  return readSceneSafeDisplayText(value)
    .replace(/\s+/g, "")
    .replace(/[＃]/g, "#")
    .toLowerCase();
}

function addSceneDeviceFilterToken(tokens: Set<string>, value: unknown) {
  const token = normalizeSceneFilterText(value);
  if (!token || token === "--" || /^\d+$/.test(token)) {
    return;
  }
  tokens.add(token);
}

function isSceneControlCabinetText(text: string): boolean {
  return /联动模式|控制柜|参数设置/.test(text);
}

function resolveSceneDeviceKind(...values: unknown[]): SceneDeviceKind {
  const text = normalizeSceneFilterText(values.join(" "));
  if (isSceneControlCabinetText(text)) {
    return "other";
  }
  if (/冷冻水泵|冷冻泵|chwp/.test(text)) {
    return "chilledPump";
  }
  if (/冷却水泵|冷却泵|cdwp|cwp/.test(text)) {
    return "coolingPump";
  }
  if (/水泵|泵/.test(text)) {
    return "pump";
  }
  if (/冷却塔|ct\d*/.test(text)) {
    return "tower";
  }
  if (/冷水机组|冷机|冰机|主机|(?:^|[^a-z])ch[-_#]?\d+/.test(text)) {
    return "chiller";
  }
  return "other";
}

function extractSceneDeviceOrdinal(...values: unknown[]): string {
  for (const value of values) {
    const text = normalizeSceneFilterText(value);
    if (!text) {
      continue;
    }
    const patterns = [
      /(\d+)[#号](?:冷水机组|冷机|冰机|主机|冷却塔|冷冻泵|冷却泵|水泵)?/,
      /(?:冷水机组|冷机|冰机|主机|冷却塔|冷冻泵|冷却泵|水泵)(\d+)[#号]?/,
      /(?:chwp|cdwp|cwp|ch|ct)[-_#]?(\d+)/
    ];
    for (const pattern of patterns) {
      const matched = text.match(pattern);
      if (matched?.[1]) {
        return matched[1];
      }
    }
  }
  return "";
}

function buildSceneDeviceFilterContext(
  clickedDevice: SceneDeviceClick | null,
  responseDeviceName?: string
): SceneDeviceFilterContext | null {
  if (!clickedDevice) {
    return null;
  }
  const tokens = new Set<string>();
  [
    responseDeviceName,
    clickedDevice.deviceName,
    clickedDevice.modelName,
    clickedDevice.deviceCode
  ].forEach((value) => addSceneDeviceFilterToken(tokens, value));

  const kind = resolveSceneDeviceKind(
    responseDeviceName,
    clickedDevice.deviceName,
    clickedDevice.modelName,
    clickedDevice.deviceCode,
    clickedDevice.deviceType
  );
  const ordinal = extractSceneDeviceOrdinal(
    responseDeviceName,
    clickedDevice.deviceName,
    clickedDevice.modelName,
    clickedDevice.deviceCode
  );

  if (ordinal) {
    tokens.add(`${ordinal}#`);
    tokens.add(`${ordinal}号`);
    if (kind === "chiller") {
      tokens.add(`${ordinal}#冷水机组`);
      tokens.add(`${ordinal}#冷机`);
      tokens.add(`${ordinal}#冰机`);
      tokens.add(`ch${ordinal}`);
    }
    if (kind === "tower") {
      tokens.add(`冷却塔${ordinal}`);
      tokens.add(`ct${ordinal}`);
    }
    if (kind === "chilledPump") {
      tokens.add(`冷冻泵${ordinal}`);
      tokens.add(`冷冻水泵${ordinal}`);
      tokens.add(`chwp${ordinal}`);
    }
    if (kind === "coolingPump") {
      tokens.add(`冷却泵${ordinal}`);
      tokens.add(`冷却水泵${ordinal}`);
      tokens.add(`cwp${ordinal}`);
      tokens.add(`cdwp${ordinal}`);
    }
  }

  return {
    kind,
    ordinal,
    tokens: Array.from(tokens).filter((token) => token.length > 1)
  };
}

function textMatchesSceneDevice(text: string, context: SceneDeviceFilterContext | null): boolean {
  if (!context?.tokens.length) {
    return false;
  }
  const normalized = normalizeSceneFilterText(text);
  return context.tokens.some((token) => normalized.includes(token));
}

function getSceneDifferentSameKindDevicePatterns(context: SceneDeviceFilterContext): RegExp[] {
  if (!context.ordinal) {
    return [];
  }
  if (context.kind === "chiller") {
    return [
      /(\d+)[#号](?:冷水机组|冷机|冰机|主机)/g,
      /(?:冷水机组|冷机|冰机|主机)(\d+)[#号]?/g,
      /ch[-_#]?(\d+)/g
    ];
  }
  if (context.kind === "tower") {
    return [/冷却塔(\d+)/g, /(\d+)[#号]冷却塔/g, /ct[-_#]?(\d+)/g];
  }
  if (context.kind === "chilledPump") {
    return [/冷冻水?泵(\d+)/g, /(\d+)[#号]冷冻水?泵/g, /chwp[-_#]?(\d+)/g];
  }
  if (context.kind === "coolingPump") {
    return [/冷却水?泵(\d+)/g, /(\d+)[#号]冷却水?泵/g, /(?:cwp|cdwp)[-_#]?(\d+)/g];
  }
  return [];
}

function textMentionsDifferentSameKindDevice(text: string, context: SceneDeviceFilterContext | null): boolean {
  if (!context?.ordinal) {
    return false;
  }
  const normalized = normalizeSceneFilterText(text);
  return getSceneDifferentSameKindDevicePatterns(context).some((pattern) => {
    pattern.lastIndex = 0;
    let matched = pattern.exec(normalized);
    while (matched) {
      if (matched[1] && matched[1] !== context.ordinal) {
        return true;
      }
      matched = pattern.exec(normalized);
    }
    return false;
  });
}

function textMentionsAnySceneDevice(text: string): boolean {
  return /(\d+)[#号](?:冷水机组|冷机|冰机|主机|冷却塔|冷冻水?泵|冷却水?泵|水泵)|(?:冷水机组|冷机|冰机|主机|冷却塔|冷冻水?泵|冷却水?泵|水泵)(\d+)[#号]?|(?:chwp|cdwp|cwp|ch|ct)[-_#]?\d+/i.test(
    normalizeSceneFilterText(text)
  );
}

function textIsSceneDeviceDomainUnrelated(text: string, context: SceneDeviceFilterContext | null): boolean {
  if (!context || context.kind === "other" || textMatchesSceneDevice(text, context)) {
    return false;
  }
  const normalized = normalizeSceneFilterText(text);
  const patternsByKind: Record<SceneDeviceKind, RegExp[]> = {
    chiller: [
      /冷却塔|ct\d/,
      /冷冻水?泵|冷却水?泵|水泵|泵参数/,
      /风机|逼近度|湿球|冷却回水目标|冷却温度下限|冷却负荷率/,
      /主机负荷阈值|目标台数|台减机|负荷模式|系统模式|加载负荷|减机负荷|负荷加载|负荷减载/
    ],
    tower: [
      /冷水机组|冷机|冰机/,
      /冷冻水?泵|冷却水?泵|水泵|泵参数/,
      /机组出水|蒸发温度|冷凝温度|主机电流|主机负荷阈值|台减机/
    ],
    chilledPump: [
      /冷水机组|冷机|冰机|冷却塔|ct\d/,
      /冷却水?泵/,
      /逼近度|湿球|风机|蒸发温度|冷凝温度/
    ],
    coolingPump: [
      /冷水机组|冷机|冰机|冷却塔|ct\d/,
      /冷冻水?泵/,
      /逼近度|湿球|风机|蒸发温度|冷凝温度/
    ],
    pump: [/冷水机组|冷机|冰机|冷却塔|ct\d/, /逼近度|湿球|风机|蒸发温度|冷凝温度/],
    other: []
  };
  return patternsByKind[context.kind].some((pattern) => pattern.test(normalized));
}

function normalizeSceneDialogTitleCandidate(value: unknown): string {
  const title = readSceneSafeDisplayText(value);
  if (!title || /^[-—]+$/.test(title)) {
    return "";
  }
  if (/冰机参数设置|冷机参数设置|冷站参数设置|系统参数设置/.test(title)) {
    return "联动模式控制柜";
  }
  return title;
}

function hasSceneControlCabinetParameterGroups(groups: SceneDeviceParameterGroupDto[]): boolean {
  const groupNames = groups
    .map((group) => readSceneSafeDisplayText(group.groupName))
    .filter(Boolean);
  const text = groups
    .flatMap((group) => [
      group.groupName,
      ...(group.items || []).flatMap((item) => [item.label, item.regName, item.tagName])
    ])
    .map((value) => readSceneSafeDisplayText(value))
    .filter(Boolean)
    .join(" ");
  return (
    groupNames.includes("控制参数") &&
    groupNames.includes("冷机参数") &&
    groupNames.includes("冷却塔参数") &&
    /冷却塔\d+手自动|负荷模式|故障复位|冷冻泵频率下限|冷却泵频率下限/.test(text)
  );
}

function resolveSceneDialogDeviceTitle(
  deviceName: string | undefined,
  clickedDevice: SceneDeviceClick | null,
  groups: SceneDeviceParameterGroupDto[] = []
): string {
  const chineseTitle =
    normalizeSceneDialogTitleCandidate(clickedDevice?.deviceName) ||
    normalizeSceneDialogTitleCandidate(clickedDevice?.modelName) ||
    normalizeSceneDialogTitleCandidate(deviceName) ||
    (hasSceneControlCabinetParameterGroups(groups) ? "联动模式控制柜" : "") ||
    "\u8bbe\u5907";
  if (getCurrentLocale() === "zh-CN") {
    return chineseTitle;
  }
  return (
    readSceneDeviceCode(clickedDevice?.deviceCode, clickedDevice?.modelName, clickedDevice?.deviceName, deviceName) ||
    chineseTitle
  );
}

function readSceneOrigin(value: string): string {
  try {
    return new URL(value).origin;
  } catch {
    return "";
  }
}

function normalizeSceneDeviceClick(payload: unknown): SceneDeviceClick | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }
  const row = payload as Record<string, unknown>;
  const drId = readSceneText(row.drid, row.drId, row.drID, row.id, row.deviceId);
  const deviceId = readSceneText(row.id, row.drid, row.drId, row.deviceId, row.code);
  const deviceName = readSceneDisplayText(row.nameCn, row.drname, row.deviceName, row.name, row.label);
  const deviceCode = readSceneDeviceCode(
    row.modelname,
    row.modelName,
    row.deviceCode,
    row.code,
    row.nameEn,
    row.nameEN,
    row.enName,
    row.name,
    row.label,
    row.drname,
    row.deviceName
  );
  const modelName = readSceneDisplayText(row.modelname, row.modelName, row.model, row.name);
  const deviceType = readSceneDisplayText(row.type, row.drtypeid, row.drTypeId, row.deviceType);
  const deviceTypeId = readSceneText(row.drtypeid, row.drTypeId, row.drtypeId, row.deviceTypeId, row.typeId);
  const runningPoint = readSceneText(row.runningid, row.runningId, row.runningRegId);
  const frequencyPoint = readSceneText(row.frequencyid, row.frequencyId, row.frequencyRegId);

  if (!deviceId && !deviceName && !modelName) {
    return null;
  }

  return {
    drId: drId || deviceId || "",
    deviceId: deviceId || "--",
    deviceName: deviceName || modelName || "--",
    deviceCode,
    modelName: modelName || "--",
    deviceType: deviceType || "--",
    deviceTypeId: deviceTypeId || deviceType || "--",
    runningPoint: runningPoint || "--",
    frequencyPoint: frequencyPoint || "--"
  };
}

function getSceneParameterGroupCount(groups: SceneDeviceParameterGroupDto[] | undefined): number {
  return Array.isArray(groups)
    ? groups.reduce((total, group) => total + (Array.isArray(group.items) ? group.items.length : 0), 0)
    : 0;
}

function formatSceneParameterValue(value: string | undefined, unit: string | undefined, displayValue: string | undefined): string {
  const normalizedDisplay = readSceneSafeDisplayText(displayValue);
  if (normalizedDisplay) {
    return normalizedDisplay;
  }
  const normalizedValue = readSceneSafeDisplayText(value) || "--";
  const normalizedUnit = readSceneSafeDisplayText(unit);
  return normalizedUnit && normalizedValue !== "--" ? `${normalizedValue} ${normalizedUnit}` : normalizedValue;
}

function formatSceneParameterDisplayLabel(label: string): string {
  return formatSceneControlCardLabel(label);
}

function formatSceneParameterDisplayValue(
  label: string,
  value: string | undefined,
  unit: string | undefined,
  displayValue: string | undefined
): string {
  const valueText = formatSceneParameterValue(value, unit, displayValue);
  if (/复位/.test(label)) {
    if (/^(无意义|0)$/.test(valueText)) {
      return "待复位";
    }
    if (/^(生效|1)$/.test(valueText)) {
      return "复位";
    }
  }
  return valueText;
}

function collectSceneParameterRows(groups: SceneDeviceParameterGroupDto[]): SceneParameterRow[] {
  return groups.flatMap((group, groupIndex) => {
    const groupName = readSceneSafeDisplayText(group.groupName) || "未分组";
    return (group.items || []).map((item, itemIndex) => {
      const label = readSceneSafeDisplayText(item.label) || "未命名参数";
      return {
        item,
        key: `${groupName}-${groupIndex}-${item.id || item.tagName || label}-${itemIndex}`,
        groupName,
        label,
        valueText: formatSceneParameterDisplayValue(label, item.value, item.unit, item.displayValue)
      };
    });
  });
}

function getSceneParameterFilterText(item: SceneDeviceParameterItemDto, groupName: string): string {
  return [
    groupName,
    item.groupName,
    item.label,
    item.regName,
    item.tagName,
    item.id
  ].map((value) => readSceneSafeDisplayText(value)).filter(Boolean).join(" ");
}

function isSceneParameterItemRelatedToDevice(
  item: SceneDeviceParameterItemDto,
  groupName: string,
  context: SceneDeviceFilterContext | null
): boolean {
  if (!context) {
    return true;
  }
  const groupMatchesDevice = textMatchesSceneDevice(groupName, context);
  const itemText = getSceneParameterFilterText(item, groupName);
  if (textMatchesSceneDevice(itemText, context)) {
    return true;
  }
  if (textMentionsDifferentSameKindDevice(itemText, context)) {
    return false;
  }
  if (!groupMatchesDevice && textIsSceneDeviceDomainUnrelated(groupName, context)) {
    return false;
  }
  return !textIsSceneDeviceDomainUnrelated(itemText, context);
}

function filterSceneDeviceParameterGroups(
  groups: SceneDeviceParameterGroupDto[],
  context: SceneDeviceFilterContext | null
): SceneDeviceParameterGroupDto[] {
  if (!context) {
    return groups;
  }
  return groups
    .map((group) => {
      const groupName = readSceneSafeDisplayText(group.groupName) || "未分组";
      const items = (group.items || []).filter((item) => isSceneParameterItemRelatedToDevice(item, groupName, context));
      return {
        ...group,
        items
      };
    })
    .filter((group) => (group.items || []).length > 0);
}

function shouldHideSceneRuntimeParameterItem(item: SceneDeviceParameterItemDto): boolean {
  const label = readSceneSafeDisplayText(item.label);
  return /故障复位|手动启动|手动停止|一键启动|一键停止/.test(label);
}

function shouldHideSceneCoolingTowerRemainingGroup(groupName: string): boolean {
  return /冷量参数|电表参数|能效参数/.test(groupName);
}

function formatSceneParameterGroupDisplayName(groupName: string): string {
  return groupName.replace(/报警/g, "告警");
}

function isSceneRecordTextRelatedToDevice(text: string, context: SceneDeviceFilterContext | null): boolean {
  if (!context) {
    return true;
  }
  if (textMatchesSceneDevice(text, context)) {
    return true;
  }
  if (textMentionsDifferentSameKindDevice(text, context)) {
    return false;
  }
  if (textIsSceneDeviceDomainUnrelated(text, context)) {
    return false;
  }
  return !textMentionsAnySceneDevice(text);
}

function filterSceneRecordsByDevice<T>(
  records: T[],
  context: SceneDeviceFilterContext | null,
  getRecordText: (record: T) => string
): T[] {
  if (!context || records.length === 0) {
    return records;
  }
  const directMatches = records.filter((record) => textMatchesSceneDevice(getRecordText(record), context));
  if (directMatches.length > 0) {
    return records.filter((record) => isSceneRecordTextRelatedToDevice(getRecordText(record), context));
  }
  const filteredRecords = records.filter((record) => isSceneRecordTextRelatedToDevice(getRecordText(record), context));
  return filteredRecords.length < records.length ? filteredRecords : records;
}

function matchSceneParameter(row: SceneParameterRow, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(row.label));
}

function findSceneParameterRow(rows: SceneParameterRow[], patterns: RegExp[]): SceneParameterRow | null {
  return rows.find((row) => matchSceneParameter(row, patterns)) || null;
}

function createSceneCompactValue(
  rows: SceneParameterRow[],
  usedItems: Set<SceneDeviceParameterItemDto>,
  label: string,
  patterns: RegExp[],
  fallbackValue = "--"
): SceneCompactValue {
  const row = findSceneParameterRow(rows, patterns);
  if (row) {
    usedItems.add(row.item);
  }
  return {
    key: row?.key || label,
    label,
    valueText: row?.valueText || fallbackValue,
    matched: Boolean(row)
  };
}

function createSceneCompactValueFromRow(row: SceneParameterRow, usedItems: Set<SceneDeviceParameterItemDto>): SceneCompactValue {
  usedItems.add(row.item);
  return {
    key: row.key,
    label: formatSceneParameterDisplayLabel(row.label),
    valueText: row.valueText,
    matched: true
  };
}

function buildSceneCompactSummaryValues(
  rows: SceneParameterRow[],
  usedItems: Set<SceneDeviceParameterItemDto>,
  specs: SceneCompactSpec[],
  limit: number
): SceneCompactValue[] {
  const matched = specs
    .map((spec) => createSceneCompactValue(rows, usedItems, spec.label, spec.patterns))
    .filter((item) => item.matched);
  if (matched.length >= limit) {
    return matched.slice(0, limit);
  }
  const fillers = rows
    .filter((row) => !usedItems.has(row.item))
    .slice(0, limit - matched.length)
    .map((row) => createSceneCompactValueFromRow(row, usedItems));
  return [...matched, ...fillers];
}

function renderSceneCompactStat(item: SceneCompactValue) {
  return (
    <article key={item.key} title={`${item.label} ${item.valueText}`}>
      <span>{item.label}</span>
      <strong>{item.valueText}</strong>
    </article>
  );
}

function renderSceneCompactCell(item: SceneCompactValue) {
  return (
    <div key={item.key} className="scene-embed-device-compact-cell" title={`${item.label} ${item.valueText}`}>
      <span>{item.label}</span>
      <strong>{item.valueText}</strong>
    </div>
  );
}

function getSceneModeTone(value: string): string {
  if (/手动|停止|关闭|故障|报警|告警/.test(value)) {
    return "is-caution";
  }
  if (/自动|运行|正常|生效/.test(value)) {
    return "is-good";
  }
  return "";
}

function hasSceneCoolingTowerDetail(rows: SceneParameterRow[]): boolean {
  return rows.some((row) =>
    /冷却塔|逼近度|冷却回水|冷却风机|风机加载|风机减载/.test(row.label)
  );
}

function renderSceneGenericCompactDetailGroups(
  groups: SceneDeviceParameterGroupDto[],
  rows: SceneParameterRow[],
  emptyText: string
) {
  if (!rows.length) {
    return <div className="scene-embed-device-state">{emptyText}</div>;
  }

  const usedItems = new Set<SceneDeviceParameterItemDto>();
  const summaryItems = buildSceneCompactSummaryValues(
    rows,
    usedItems,
    [
      { label: "运行状态", patterns: [/运行状态/, /机组状态/, /开关机状态/] },
      { label: "出水设定", patterns: [/出水温度设定/, /冷冻.*设定/] },
      { label: "冷冻出水", patterns: [/冷冻水出水温度/, /出水温度/] },
      { label: "冷冻回水", patterns: [/冷冻水进水温度/, /回水温度/] },
      { label: "主机负荷", patterns: [/主机负荷/, /机组负荷/, /^负荷$/] },
      { label: "电流", patterns: [/电流/] },
      { label: "冷凝温度", patterns: [/冷凝温度/] },
      { label: "蒸发温度", patterns: [/蒸发温度/] }
    ],
    5
  );
  const visibleGroups = groups
    .map((group, groupIndex) => {
      const groupName = readSceneSafeDisplayText(group.groupName) || "未分组";
      const items = (group.items || []).filter((item) => !usedItems.has(item) && !shouldHideSceneRuntimeParameterItem(item));
      return {
        key: `${groupName}-${groupIndex}`,
        groupName: formatSceneParameterGroupDisplayName(groupName),
        items
      };
    })
    .filter((group) => group.items.length > 0);

  return (
    <div className="scene-embed-device-detail-compact is-generic">
      <div className="scene-embed-device-compact-summary">
        {summaryItems.map(renderSceneCompactStat)}
      </div>
      <div className="scene-embed-device-compact-details is-primary">
        {visibleGroups.map((group) => (
          <details key={group.key}>
            <summary>
              <span>{group.groupName}</span>
              <strong>{group.items.length}项</strong>
            </summary>
            <div className="scene-embed-device-compact-grid is-remaining">
              {group.items.map((item, index) => {
                const rawLabel = readSceneSafeDisplayText(item.label) || "未命名参数";
                const label = formatSceneParameterDisplayLabel(rawLabel);
                const valueText = formatSceneParameterDisplayValue(rawLabel, item.value, item.unit, item.displayValue);
                return renderSceneCompactCell({
                  key: `${group.key}-${item.id || item.tagName || label}-${index}`,
                  label,
                  valueText
                });
              })}
            </div>
          </details>
        ))}
      </div>
    </div>
  );
}

function renderSceneCompactDetailGroups(groups: SceneDeviceParameterGroupDto[], emptyText: string) {
  const rows = collectSceneParameterRows(groups);
  if (!rows.length) {
    return <div className="scene-embed-device-state">{emptyText}</div>;
  }
  if (!hasSceneCoolingTowerDetail(rows)) {
    return renderSceneGenericCompactDetailGroups(groups, rows, emptyText);
  }

  const usedItems = new Set<SceneDeviceParameterItemDto>();
  const summaryItems = [
    createSceneCompactValue(rows, usedItems, "湿球", [/湿球/]),
    createSceneCompactValue(rows, usedItems, "当前逼近度", [/当前逼近度/]),
    createSceneCompactValue(rows, usedItems, "目标逼近度", [/目标逼近度/]),
    createSceneCompactValue(rows, usedItems, "冷却负荷率", [/冷却负荷率/]),
    createSceneCompactValue(rows, usedItems, "风机下限", [/冷却风机频率下限/])
  ];
  const towerRows = Array.from({ length: 6 }, (_, index) => {
    const towerNo = index + 1;
    const mode = createSceneCompactValue(rows, usedItems, `CT${towerNo}模式`, [
      new RegExp(`冷却塔${towerNo}手自动`)
    ]);
    const frequency = createSceneCompactValue(rows, usedItems, `CT${towerNo}频率`, [
      new RegExp(`冷却塔${towerNo}风机频率手动给定`)
    ]);
    return {
      key: `ct-${towerNo}`,
      name: `CT${towerNo}`,
      mode,
      frequency
    };
  });
  const keySettings = [
    createSceneCompactValue(rows, usedItems, "蒸发告警", [/蒸发报警设定/]),
    createSceneCompactValue(rows, usedItems, "冷凝告警", [/冷凝报警设定/]),
    createSceneCompactValue(rows, usedItems, "回水目标", [/冷却回水目标值/]),
    createSceneCompactValue(rows, usedItems, "手动设定", [/冷却塔回水温度手动设定值/, /冷却回水手动值/]),
    createSceneCompactValue(rows, usedItems, "温度下限", [/冷却温度下限/]),
    createSceneCompactValue(rows, usedItems, "风机上限", [/冷却风机频率上限/]),
    createSceneCompactValue(rows, usedItems, "最小逼近", [/最小逼近度/]),
    createSceneCompactValue(rows, usedItems, "最大逼近", [/最大逼近度/])
  ];
  const antiOscillation = [
    createSceneCompactValue(rows, usedItems, "风机加载计时", [/冷却塔风机加载计时/]),
    createSceneCompactValue(rows, usedItems, "风机减载计时", [/冷却塔风机减载计时/]),
    createSceneCompactValue(rows, usedItems, "风机加载延时", [/冷却塔风机加载时间设定/]),
    createSceneCompactValue(rows, usedItems, "风机减载延时", [/冷却塔风机减载时间设定/]),
    createSceneCompactValue(rows, usedItems, "负荷加载计时", [/负荷模式加载计时/]),
    createSceneCompactValue(rows, usedItems, "负荷减载计时", [/负荷模式减载计时/])
  ];
  const loadThresholds = [
    createSceneCompactValue(rows, usedItems, "系统模式", [/系统模式/]),
    createSceneCompactValue(rows, usedItems, "目标台数", [/负荷模式主机运行目标数量/]),
    createSceneCompactValue(rows, usedItems, "加载负荷", [/^加载负荷$/]),
    createSceneCompactValue(rows, usedItems, "2台减机", [/2台减机负荷/]),
    createSceneCompactValue(rows, usedItems, "3台减机", [/3台减机负荷/]),
    createSceneCompactValue(rows, usedItems, "4台减机", [/4台减机负荷/]),
    createSceneCompactValue(rows, usedItems, "5台减机", [/5台减机负荷/]),
    createSceneCompactValue(rows, usedItems, "6台减机", [/6台减机负荷/])
  ];
  const pumpSettings = [
    createSceneCompactValue(rows, usedItems, "冷冻泵下限", [/冷冻泵频率下限/]),
    createSceneCompactValue(rows, usedItems, "冷冻水ΔT当前", [/冷冻水温差当前值/]),
    createSceneCompactValue(rows, usedItems, "冷冻水ΔT设定", [/冷冻水温差设定值/]),
    createSceneCompactValue(rows, usedItems, "冷却泵下限", [/冷却泵频率下限/]),
    createSceneCompactValue(rows, usedItems, "冷却水ΔT当前", [/冷却水温差当前值/]),
    createSceneCompactValue(rows, usedItems, "冷却水ΔT设定", [/冷却水温差设定值/])
  ];
  const remainingGroups = groups
    .map((group, groupIndex) => {
      const groupName = readSceneSafeDisplayText(group.groupName) || "未分组";
      const items = shouldHideSceneCoolingTowerRemainingGroup(groupName)
        ? []
        : (group.items || []).filter((item) => !usedItems.has(item) && !shouldHideSceneRuntimeParameterItem(item));
      return {
        key: `${groupName}-${groupIndex}`,
        groupName: formatSceneParameterGroupDisplayName(groupName),
        items
      };
    })
    .filter((group) => group.items.length > 0);

  return (
    <div className="scene-embed-device-detail-compact">
      <div className="scene-embed-device-compact-summary">
        {summaryItems.map(renderSceneCompactStat)}
      </div>

      <div className="scene-embed-device-compact-main">
        <section className="scene-embed-device-compact-panel is-tower">
          <h4>冷却塔状态</h4>
          <div className="scene-embed-device-tower-table">
            <span>设备</span>
            <span>模式</span>
            <span>手动频率</span>
            {towerRows.map((tower) => (
              <Fragment key={tower.key}>
                <strong key={`${tower.key}-name`}>{tower.name}</strong>
                <em
                  key={`${tower.key}-mode`}
                  className={getSceneModeTone(tower.mode.valueText)}
                  title={tower.mode.valueText}
                >
                  {tower.mode.valueText}
                </em>
                <b key={`${tower.key}-freq`} title={tower.frequency.valueText}>
                  {tower.frequency.valueText}
                </b>
              </Fragment>
            ))}
          </div>
        </section>

        <section className="scene-embed-device-compact-panel">
          <h4>关键设定</h4>
          <div className="scene-embed-device-compact-grid is-key-settings">
            {keySettings.map(renderSceneCompactCell)}
          </div>
        </section>
      </div>

      <div className="scene-embed-device-compact-wide">
        <section className="scene-embed-device-compact-panel">
          <h4>防震荡与延时</h4>
          <div className="scene-embed-device-compact-grid is-dense">
            {antiOscillation.map(renderSceneCompactCell)}
          </div>
        </section>

        <section className="scene-embed-device-compact-panel">
          <h4>主机负荷阈值</h4>
          <div className="scene-embed-device-compact-grid is-load">
            {loadThresholds.map(renderSceneCompactCell)}
          </div>
        </section>

        <section className="scene-embed-device-compact-panel">
          <h4>泵参数</h4>
          <div className="scene-embed-device-compact-grid is-dense">
            {pumpSettings.map(renderSceneCompactCell)}
          </div>
        </section>
      </div>

      <div className="scene-embed-device-compact-details">
        {remainingGroups.map((group) => (
          <details key={group.key}>
            <summary>
              <span>{group.groupName}</span>
              <strong>{group.items.length}项</strong>
            </summary>
            <div className="scene-embed-device-compact-grid is-remaining">
              {group.items.map((item, index) => {
                const rawLabel = readSceneSafeDisplayText(item.label) || "未命名参数";
                const label = formatSceneParameterDisplayLabel(rawLabel);
                const valueText = formatSceneParameterDisplayValue(rawLabel, item.value, item.unit, item.displayValue);
                return renderSceneCompactCell({
                  key: `${group.key}-${item.id || item.tagName || label}-${index}`,
                  label,
                  valueText
                });
              })}
            </div>
          </details>
        ))}
      </div>
    </div>
  );
}

function hasSceneParameterTranslation(item: SceneDeviceParameterItemDto): boolean {
  return Boolean(readSceneText(item.regSub));
}

function getSceneControlActionKey(item: SceneDeviceParameterItemDto, value: string): string {
  return `${item.id || item.tagName || item.label || "control"}::${value}`;
}

function normalizeSceneControlValue(value: unknown): string {
  const text = readSceneText(value);
  if (!text) {
    return "";
  }
  const numeric = Number(text);
  return Number.isFinite(numeric) ? String(numeric) : text;
}

function getSceneControlOptions(item: SceneDeviceParameterItemDto): Array<{ value: string; text: string }> {
  return (Array.isArray(item.controlOptions) ? item.controlOptions : [])
    .map((option) => ({
      value: readSceneText(option.value),
      text: readSceneSafeDisplayText(option.text)
    }))
    .filter((option) => option.value && option.text);
}

function getSceneControlRegName(item: SceneDeviceParameterItemDto): string {
  return readSceneSafeDisplayText(item.regName) || readSceneSafeDisplayText(item.label);
}

function getSceneControlCurrentText(item: SceneDeviceParameterItemDto): string {
  const currentValue = normalizeSceneControlValue(item.value);
  const currentOption = getSceneControlOptions(item).find(
    (option) => normalizeSceneControlValue(option.value) === currentValue
  );
  return currentOption?.text || formatSceneParameterValue(item.value, item.unit, item.displayValue);
}

function formatSceneControlCardLabel(label: string): string {
  return label
    .replace(/冷却塔(\d+)风机频率手动给定/g, "CT$1频率给定")
    .replace(/冷却塔(\d+)手自动/g, "CT$1手自动")
    .replace(/冷却风机频率上限/g, "冷却风机上限")
    .replace(/冷却风机频率下限/g, "冷却风机下限")
    .replace(/冷却塔回水温度手动设定值/g, "回水手动设定")
    .replace(/冷却回水手动值/g, "回水手动值")
    .replace(/冷却温度下限/g, "温度下限")
    .replace(/冷却塔风机加载时间设定/g, "风机加载时间")
    .replace(/冷却塔风机减载时间设定/g, "风机减载时间")
    .replace(/负荷模式加载时间设置/g, "负荷加载时间")
    .replace(/负荷模式减载时间设置/g, "负荷减载时间")
    .replace(/冷冻水温差设定值/g, "冷冻水ΔT设定")
    .replace(/冷却水温差设定值/g, "冷却水ΔT设定")
    .replace(/冷冻泵频率下限/g, "冷冻泵下限")
    .replace(/冷却泵频率下限/g, "冷却泵下限")
    .replace(/蒸发报警设定/g, "蒸发告警")
    .replace(/冷凝报警设定/g, "冷凝告警")
    .replace(/蒸发报警/g, "蒸发告警")
    .replace(/冷凝报警/g, "冷凝告警")
    .replace(/冷却塔温度手自动/g, "塔温手自动")
    .replace(/故障复位/g, "故障复位")
    .replace(/(\d+)台减机负荷/g, "$1台减机");
}

function formatSceneControlOptionText(controlLabel: string, optionText: string): string {
  const normalizedControlLabel = readSceneSafeDisplayText(controlLabel);
  const normalizedOptionText = readSceneSafeDisplayText(optionText);
  if (/复位/.test(normalizedControlLabel)) {
    if (normalizedOptionText === "无意义") {
      return "待复位";
    }
    if (normalizedOptionText === "生效") {
      return "复位";
    }
  }
  return normalizedOptionText || optionText;
}

function getSceneControlIntentClass(label: string, valueText?: string): "normal" | "caution" | "danger" {
  const targetText = valueText || "";
  const actionText = targetText && /停止|停机|关机|禁用|关阀|关闭|启动|开机|开阀|投用|手动|联动|全自动|复位/.test(targetText)
    ? targetText
    : `${label} ${targetText}`;
  if (/停止|停机|关机|禁用|关阀|关闭/.test(actionText)) {
    return "danger";
  }
  if (/启动|开机|开阀|投用|手动|联动|全自动|设定|下发|复位|优先级|模式/.test(actionText)) {
    return "caution";
  }
  return "normal";
}

function getSceneControlIntentClassName(intent: "normal" | "caution" | "danger"): string {
  if (intent === "danger") {
    return "is-danger-action";
  }
  if (intent === "caution") {
    return "is-caution-action";
  }
  return "";
}

function findSceneControlCombinedRule(regName: string): SceneControlCombinedRule | null {
  return SCENE_CONTROL_COMBINED_RULES.find((rule) => rule.members.includes(regName)) || null;
}

function getSceneControlCombinedValue(item: SceneDeviceParameterItemDto): string {
  return getSceneControlOptions(item).find((option) => normalizeSceneControlValue(option.value) === "1")?.value || "";
}

function buildSceneControlRows(items: SceneDeviceParameterItemDto[], groupKey: string): SceneControlRenderRow[] {
  const combinedByLabel = new Map<
    string,
    {
      label: string;
      firstIndex: number;
      members: SceneControlCombinedMember[];
    }
  >();
  const consumedIndexes = new Set<number>();

  items.forEach((item, itemIndex) => {
    if (!hasSceneParameterTranslation(item)) {
      return;
    }
    const regName = getSceneControlRegName(item);
    const rule = findSceneControlCombinedRule(regName);
    const value = rule ? getSceneControlCombinedValue(item) : "";
    if (!rule || !value) {
      return;
    }
    const memberIndex = rule.members.indexOf(regName);
    const existing = combinedByLabel.get(rule.label) || {
      label: rule.label,
      firstIndex: itemIndex,
      members: []
    };
    existing.firstIndex = Math.min(existing.firstIndex, itemIndex);
    existing.members.push({
      item,
      itemIndex,
      memberIndex,
      buttonLabel: regName,
      value
    });
    combinedByLabel.set(rule.label, existing);
    consumedIndexes.add(itemIndex);
  });

  const combinedByFirstIndex = new Map<number, { label: string; members: SceneControlCombinedMember[] }>();
  Array.from(combinedByLabel.values()).forEach((combined) => {
    combinedByFirstIndex.set(combined.firstIndex, {
      label: combined.label,
      members: combined.members.sort((a, b) => a.memberIndex - b.memberIndex || a.itemIndex - b.itemIndex)
    });
  });

  const rows: SceneControlRenderRow[] = [];
  items.forEach((item, itemIndex) => {
    const combined = combinedByFirstIndex.get(itemIndex);
    if (combined) {
      rows.push({
        type: "combined",
        key: `${groupKey}-combined-${combined.label}-${itemIndex}`,
        label: combined.label,
        members: combined.members
      });
      return;
    }
    if (consumedIndexes.has(itemIndex)) {
      return;
    }
    rows.push({
      type: "item",
      item,
      itemKey: `${item.id || item.label || "item"}-${itemIndex}`
    });
  });
  return rows;
}

function renderSceneControlEditor(
  item: SceneDeviceParameterItemDto,
  itemKey: string,
  onSubmit: SceneControlSubmitHandler,
  submittingKey: string
) {
  const label = readSceneSafeDisplayText(item.label) || "\u672a\u547d\u540d\u53c2\u6570";
  const displayLabel = formatSceneControlCardLabel(label);
  const value = readSceneSafeDisplayText(item.value);
  const unit = readSceneSafeDisplayText(item.unit);
  const actionKey = getSceneControlActionKey(item, "input");
  const submitting = submittingKey === actionKey;
  return (
    <article key={itemKey} className="is-control-editable">
      <span title={label}>{displayLabel}</span>
      <div className="scene-embed-device-control-row">
        <input defaultValue={value} aria-label={label} />
        <em title={unit}>{unit}</em>
        <button
          type="button"
          className="is-caution-action"
          aria-label={SCENE_CONTROL_SUBMIT_LABEL}
          title={SCENE_CONTROL_SUBMIT_LABEL}
          disabled={submitting}
          onClick={(event) => {
            const input = event.currentTarget.parentElement?.querySelector("input");
            const nextValue = input?.value ?? "";
            onSubmit(item, nextValue, actionKey, formatSceneParameterValue(nextValue, unit, undefined));
          }}
        >
          {submitting ? SCENE_CONTROL_PENDING_LABEL : SCENE_CONTROL_SUBMIT_LABEL}
        </button>
      </div>
    </article>
  );
}

function renderSceneControlCombinedOptions(
  row: Extract<SceneControlRenderRow, { type: "combined" }>,
  onSubmit: SceneControlSubmitHandler,
  submittingKey: string
) {
  const displayLabel = formatSceneControlCardLabel(row.label);
  return (
    <article key={row.key} className="is-control-options is-control-combined">
      <span title={row.label}>{displayLabel}</span>
      <div className="scene-embed-device-control-options">
        {row.members.map((member) => {
          const actionKey = getSceneControlActionKey(member.item, member.value);
          const submitting = submittingKey === actionKey;
          const isCurrent = normalizeSceneControlValue(member.item.value) === normalizeSceneControlValue(member.value);
          const intentClassName = getSceneControlIntentClassName(
            getSceneControlIntentClass(member.buttonLabel, member.buttonLabel)
          );
          return (
            <button
              key={`${row.key}-${member.item.id || member.buttonLabel}-${member.value}`}
              type="button"
              className={[isCurrent ? "is-current" : "", intentClassName].filter(Boolean).join(" ")}
              disabled={Boolean(submittingKey) && !submitting}
              title={`${row.label}: ${member.buttonLabel}`}
              onClick={() => onSubmit(member.item, member.value, actionKey, member.buttonLabel)}
            >
              {submitting ? SCENE_CONTROL_PENDING_LABEL : member.buttonLabel}
            </button>
          );
        })}
      </div>
    </article>
  );
}

function renderSceneControlOptions(
  item: SceneDeviceParameterItemDto,
  itemKey: string,
  onSubmit: SceneControlSubmitHandler,
  submittingKey: string
) {
  const label = readSceneSafeDisplayText(item.label) || "\u672a\u547d\u540d\u53c2\u6570";
  const displayLabel = formatSceneControlCardLabel(label);
  const options = getSceneControlOptions(item);
  if (options.length === 0) {
    return (
      <article key={itemKey}>
        <span title={label}>{displayLabel}</span>
        <strong title={formatSceneParameterValue(item.value, item.unit, item.displayValue)}>
          {formatSceneParameterValue(item.value, item.unit, item.displayValue)}
        </strong>
      </article>
    );
  }
  return (
    <article key={itemKey} className="is-control-options">
      <span title={label}>{displayLabel}</span>
      <div className="scene-embed-device-control-options">
        {options.map((option) => {
          const displayOptionText = formatSceneControlOptionText(label, option.text);
          const actionKey = getSceneControlActionKey(item, option.value);
          const submitting = submittingKey === actionKey;
          const isCurrent = normalizeSceneControlValue(item.value) === normalizeSceneControlValue(option.value);
          const intentClassName = getSceneControlIntentClassName(getSceneControlIntentClass(label, displayOptionText));
          return (
            <button
              key={`${itemKey}-${option.value}`}
              type="button"
              className={[isCurrent ? "is-current" : "", intentClassName].filter(Boolean).join(" ")}
              disabled={Boolean(submittingKey) && !submitting}
              title={`${label}: ${displayOptionText}`}
              onClick={() => onSubmit(item, option.value, actionKey, displayOptionText)}
            >
              {submitting ? SCENE_CONTROL_PENDING_LABEL : displayOptionText}
            </button>
          );
        })}
      </div>
    </article>
  );
}

function getSceneControlGroupClassName(groupName: string, itemCount: number): string {
  const name = readSceneSafeDisplayText(groupName);
  if (/控制参数/.test(name)) {
    return "is-control-wide is-control-mode";
  }
  if (/冷却塔参数/.test(name)) {
    return "is-control-wide is-control-tower";
  }
  if (/系统参数/.test(name)) {
    return "is-control-wide is-control-system";
  }
  if (itemCount >= 6) {
    return "is-control-wide is-control-extra";
  }
  if (/冷机参数|冷冻泵参数|冷却泵参数|水泵参数/.test(name) || itemCount <= 3) {
    return "is-control-compact";
  }
  return "is-control-medium";
}

function renderSceneDeviceInfoTab(
  deviceInfo: SceneDeviceParametersDto["deviceInfo"],
  fallbackRows: Array<{ label: string; value: string }>,
  loading: boolean,
  errorText: string,
  controlContent?: ReactNode
) {
  if (loading) {
    return <div className="scene-embed-device-state">{"\u6b63\u5728\u52a0\u8f7d\u8bbe\u5907\u94ed\u724c\u4fe1\u606f..."}</div>;
  }
  if (errorText) {
    return <div className="scene-embed-device-state is-error">{errorText}</div>;
  }

  const imageUrl = readSceneText(deviceInfo?.imageUrl);
  const loadPercent = parseSceneLoadPercent(deviceInfo?.load);
  const loadText = readSceneSafeDisplayText(deviceInfo?.load);
  const loadDisplayText = loadText.includes("%") ? loadText : `${loadText}%`;
  const loadBand = loadPercent !== null ? resolveSceneLoadBand(loadPercent) : null;
  const leftTopGroup = getSceneDeviceInfoGroupByIndex(deviceInfo, 0);
  const centerTopGroup = getSceneDeviceInfoGroupByIndex(deviceInfo, 1);
  const rightTopGroup = getSceneDeviceInfoGroupByIndex(deviceInfo, 2);
  const leftBottomGroup = getSceneDeviceInfoGroupByIndex(deviceInfo, 3);
  const leftTopItems = leftTopGroup?.items || [];
  const centerTopItems = centerTopGroup?.items || [];
  const rightTopItems = rightTopGroup?.items || [];
  const leftBottomItems = leftBottomGroup?.items || [];
  const standingItems = deviceInfo?.standingItems || [];
  const fallbackItems = fallbackRows.map((item) => ({
    name: item.label,
    value: item.value
  }));

  return (
    <div className="scene-embed-device-info-board">
      <section className="scene-embed-device-info-panel is-left-top">
        {renderSceneDeviceInfoList(
          leftTopItems.length ? leftTopItems : fallbackItems,
          "\u6682\u65e0\u6570\u636e",
          readSceneSafeDisplayText(leftTopGroup?.title)
        )}
      </section>
      <section className="scene-embed-device-info-panel is-center-top">
        {renderSceneDeviceInfoList(
          centerTopItems,
          "\u6682\u65e0\u6570\u636e",
          readSceneSafeDisplayText(centerTopGroup?.title)
        )}
      </section>
      <section className="scene-embed-device-info-panel is-right-top">
        {renderSceneDeviceInfoList(
          rightTopItems,
          "\u6682\u65e0\u6570\u636e",
          readSceneSafeDisplayText(rightTopGroup?.title)
        )}
      </section>
      <section className="scene-embed-device-info-panel is-left-bottom">
        {renderSceneDeviceStatusPanel(
          leftBottomItems,
          deviceInfo?.runStatus,
          readSceneSafeDisplayText(leftBottomGroup?.title) || "\u8bbe\u5907\u72b6\u6001"
        )}
      </section>
      <section className="scene-embed-device-info-image">
        <div className="scene-embed-device-info-image-stage">
          {imageUrl ? (
            <img
              src={imageUrl}
              className={isSceneGifImage(imageUrl) ? "is-gif" : ""}
              alt={"\u8bbe\u5907\u56fe\u7247"}
            />
          ) : (
            <div className="scene-embed-device-info-image-empty">{"\u6682\u65e0\u8bbe\u5907\u56fe\u7247"}</div>
          )}
        </div>
        {loadPercent !== null ? (
          <div className={`scene-embed-device-info-load is-${loadBand?.tone || "good"}`}>
            <div>
              <span>{"\u673a\u7ec4\u7535\u6d41\u6bd4"}</span>
              <strong>{loadDisplayText}</strong>
              {loadBand ? <em>{loadBand.label}</em> : null}
            </div>
            <i>
              <b style={{ width: `${loadPercent}%` }} />
              <span className="scene-embed-device-info-load-marker is-low" />
              <span className="scene-embed-device-info-load-marker is-high" />
            </i>
            <div className="scene-embed-device-info-load-bands" aria-hidden="true">
              <span>{"\u4f4e\u8f7d <30%"}</span>
              <span>{"\u7ecf\u6d4e 30-85%"}</span>
              <span>{"\u9ad8\u8f7d >85%"}</span>
            </div>
          </div>
        ) : null}
        {controlContent ? (
          <section className="scene-embed-device-info-control-dock" aria-label="控制设定">
            <div className="scene-embed-device-info-control-head">
              <strong>控制设定</strong>
              <span>下发需确认</span>
            </div>
            {controlContent}
          </section>
        ) : null}
      </section>
      <section className="scene-embed-device-info-panel is-standing-book">
        {renderSceneDeviceInfoList(
          standingItems,
          "\u6682\u65e0\u94ed\u724c\u660e\u7ec6",
          standingItems.length ? "\u57fa\u672c\u4fe1\u606f" : "",
          "basic"
        )}
      </section>
    </div>
  );
}

function getSceneDeviceRecordText(): (typeof SCENE_DEVICE_RECORD_TEXT)[LocaleCode] {
  return SCENE_DEVICE_RECORD_TEXT[getCurrentLocale()] || SCENE_DEVICE_RECORD_TEXT["zh-CN"];
}

function formatSceneAlarmState(value: string | number | undefined, text = getSceneDeviceRecordText()): string {
  const normalized = value == null ? "" : String(value).trim();
  if (normalized === "0") {
    return text.recovered;
  }
  if (normalized === "1") {
    return text.alarming;
  }
  return normalized || text.unknown;
}

function normalizeSceneOperationResultKind(result: string): "dispatch" | "execution" | "other" {
  if (/下发/.test(result)) {
    return "dispatch";
  }
  if (/执行/.test(result)) {
    return "execution";
  }
  return "other";
}

function normalizeSceneOperationMergeKeyText(value: string): string {
  return readSceneSafeDisplayText(value)
    .replace(/\s+/g, "")
    .replace(/[：]/g, ":")
    .trim();
}

function mergeSceneDeviceOperationRecords(records: SceneDeviceOperationRecordDto[]): SceneMergedOperationRecord[] {
  const mergedRecords: SceneMergedOperationRecord[] = [];
  const recordIndex = new Map<string, SceneMergedOperationRecord>();

  records.forEach((record, index) => {
    const details = readSceneSafeDisplayText(record.details) || "--";
    const operationPerson = readSceneSafeDisplayText(record.operationPerson) || "--";
    const date = readSceneSafeDisplayText(record.date) || "--";
    const operationResult = readSceneSafeDisplayText(record.operationResult) || "--";
    const key = `${normalizeSceneOperationMergeKeyText(details)}::${operationPerson}::${date}`;
    const existing = recordIndex.get(key) || {
      key: `${record.id || "operation"}-${index}`,
      details,
      operationPerson,
      date,
      dispatchResult: "",
      executionResult: "",
      otherResults: []
    };
    const resultKind = normalizeSceneOperationResultKind(operationResult);
    if (resultKind === "dispatch") {
      existing.dispatchResult = existing.dispatchResult || operationResult;
    } else if (resultKind === "execution") {
      existing.executionResult = existing.executionResult || operationResult;
    } else if (!existing.otherResults.includes(operationResult)) {
      existing.otherResults.push(operationResult);
    }
    if (!recordIndex.has(key)) {
      recordIndex.set(key, existing);
      mergedRecords.push(existing);
    }
  });

  return mergedRecords;
}

function formatSceneMergedOperationResult(record: SceneMergedOperationRecord): string {
  return [
    record.dispatchResult ? `下发：${record.dispatchResult}` : "",
    record.executionResult ? `执行：${record.executionResult}` : "",
    ...record.otherResults
  ].filter(Boolean).join(" / ") || "--";
}

function renderSceneMergedOperationResult(record: SceneMergedOperationRecord) {
  const resultText = formatSceneMergedOperationResult(record);
  return (
    <div className="scene-embed-device-operation-result" title={resultText}>
      {record.dispatchResult ? <span>{record.dispatchResult}</span> : null}
      {record.executionResult ? <span>{record.executionResult}</span> : null}
      {record.otherResults.map((result) => (
        <span key={result}>{result}</span>
      ))}
      {!record.dispatchResult && !record.executionResult && record.otherResults.length === 0 ? <span>--</span> : null}
    </div>
  );
}

function renderSceneDeviceOperationRecords(
  records: SceneDeviceOperationRecordDto[],
  loading: boolean,
  errorText: string
) {
  const text = getSceneDeviceRecordText();
  if (loading) {
    return <div className="scene-embed-device-state">{SCENE_DEVICE_DIALOG_TEXT.loading}</div>;
  }
  if (errorText) {
    return <div className="scene-embed-device-state is-error">{errorText}</div>;
  }
  if (!records.length) {
    return <div className="scene-embed-device-state">{SCENE_DEVICE_DIALOG_TEXT.operationEmpty}</div>;
  }
  const mergedRecords = mergeSceneDeviceOperationRecords(records);
  const visibleRecords = mergedRecords.slice(0, SCENE_DEVICE_RECORD_PREVIEW_LIMIT);
  return (
    <div className="scene-embed-device-records">
      {mergedRecords.length > visibleRecords.length ? (
        <div className="scene-embed-device-record-note">
          仅展示最近 {visibleRecords.length} 条联动操作记录，已合并同一指令的下发与执行结果；更多历史请到操作记录页检索。
        </div>
      ) : null}
      <table className="scene-embed-device-record-table is-operation">
        <thead>
          <tr>
            <th>{text.operationContent}</th>
            <th>{text.operationResult}</th>
            <th>{text.operationPerson}</th>
            <th>{text.operationTime}</th>
          </tr>
        </thead>
        <tbody>
          {visibleRecords.map((record) => (
            <tr key={record.key}>
              <td title={record.details}>
                {record.details || text.unknown}
              </td>
              <td title={formatSceneMergedOperationResult(record)}>
                {renderSceneMergedOperationResult(record)}
              </td>
              <td title={record.operationPerson}>
                {record.operationPerson || text.unknown}
              </td>
              <td title={record.date}>
                {record.date || text.unknown}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function renderSceneDeviceAlarmRecords(records: SceneDeviceAlarmRecordDto[], loading: boolean, errorText: string) {
  const text = getSceneDeviceRecordText();
  if (loading) {
    return <div className="scene-embed-device-state">{SCENE_DEVICE_DIALOG_TEXT.loading}</div>;
  }
  if (errorText) {
    return <div className="scene-embed-device-state is-error">{errorText}</div>;
  }
  if (!records.length) {
    return <div className="scene-embed-device-state">{SCENE_DEVICE_DIALOG_TEXT.alarmEmpty}</div>;
  }
  const visibleRecords = records.slice(0, SCENE_DEVICE_RECORD_PREVIEW_LIMIT);
  return (
    <div className="scene-embed-device-records">
      {records.length > visibleRecords.length ? (
        <div className="scene-embed-device-record-note">
          仅展示最近 {visibleRecords.length} 条告警记录，共 {records.length} 条；更多历史请到告警中心检索。
        </div>
      ) : null}
      <table className="scene-embed-device-record-table is-alarm">
        <thead>
          <tr>
            <th>{text.alarmLevel}</th>
            <th>{text.alarmState}</th>
            <th>{text.alarmContent}</th>
            <th>{text.alarmTime}</th>
          </tr>
        </thead>
        <tbody>
          {visibleRecords.map((record, index) => {
            const stateText = formatSceneAlarmState(record.alarmState, text);
            return (
              <tr key={record.id || `alarm-${index}`}>
                <td title={readSceneSafeDisplayText(record.alarmTypeName)}>
                  {readSceneSafeDisplayText(record.alarmTypeName) || text.unknown}
                </td>
                <td
                  className={
                    String(record.alarmState).trim() === "0"
                      ? "is-recovered"
                      : String(record.alarmState).trim() === "1"
                        ? "is-alarming"
                        : ""
                  }
                  title={stateText}
                >
                  {stateText}
                </td>
                <td title={readSceneSafeDisplayText(record.alarmExplain)}>
                  {readSceneSafeDisplayText(record.alarmExplain) || text.unknown}
                </td>
                <td title={readSceneSafeDisplayText(record.time)}>
                  {readSceneSafeDisplayText(record.time) || text.unknown}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function SceneControlPage() {
  const session = getAuthSession();
  const currentProject = getCurrentProject(session);
  const shellProjectDisplayName = useShellProjectDisplay();
  const shellRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const sceneFrameNoticeTimerRef = useRef<number | null>(null);
  const [mode, setMode] = useState<SceneMode>("2d");
  const [fitMode, setFitMode] = useState<SceneFitMode>("native");
  const [sceneFrameResetKeys, setSceneFrameResetKeys] = useState<Record<SceneMode, number>>({ "2d": 0, "3d": 0 });
  const [loaded2dSceneUrl, setLoaded2dSceneUrl] = useState("");
  const [prewarm3dSceneUrl, setPrewarm3dSceneUrl] = useState("");
  const [prewarmed3dReadyUrl, setPrewarmed3dReadyUrl] = useState("");
  const [loadedActiveSceneFrameToken, setLoadedActiveSceneFrameToken] = useState("");
  const [expiredSceneComfortLoadingToken, setExpiredSceneComfortLoadingToken] = useState("");
  const [nativeFrameViewport, setNativeFrameViewport] = useState({ scale: 1, x: 0, y: 0 });
  const [items, setItems] = useState<SceneFloorModelItemDto[]>(() => getCachedSceneFloorModels());
  const [loading, setLoading] = useState(false);
  const [errorText, setErrorText] = useState("");
  const [clickedDevice, setClickedDevice] = useState<SceneDeviceClick | null>(null);
  const [deviceDialogTab, setDeviceDialogTab] = useState<SceneDeviceDialogTab>("info");
  const [deviceParameters, setDeviceParameters] = useState<SceneDeviceParametersDto | null>(null);
  const [deviceParametersLoading, setDeviceParametersLoading] = useState(false);
  const [deviceParametersError, setDeviceParametersError] = useState("");
  const [controlSubmittingKey, setControlSubmittingKey] = useState("");
  const [controlCommandStatus, setControlCommandStatus] = useState("");
  const [pendingControlCommand, setPendingControlCommand] = useState<SceneControlPendingCommand | null>(null);
  const [weather, setWeather] = useState<SceneWeather>({
    outdoorWetBulbC: null,
    outdoorHumidityPct: null,
    outdoorTempC: null
  });
  const [stationOverview, setStationOverview] = useState<DashboardOverviewDto | null>(null);
  const [runtimeHudExpanded, setRuntimeHudExpanded] = useState(true);
  const [isFrameFullscreen, setIsFrameFullscreen] = useState(false);
  const [sceneFrameNoticeVisible, setSceneFrameNoticeVisible] = useState(false);
  const fallbackProjectLabel = resolveAuthProjectDisplayName(currentProject, zhCN.appShell.projectPending);
  const projectLabel = normalizeLabel(shellProjectDisplayName) || fallbackProjectLabel;
  const dashboardProjectKey = useMemo(
    () => resolveSceneDropdownProjectKey(currentProject, session),
    [currentProject, session]
  );
  const dashboardProject = useMemo(() => {
    if (!currentProject) {
      return null;
    }
    return {
      ...currentProject,
      modelKey: dashboardProjectKey || currentProject.modelKey
    };
  }, [currentProject, dashboardProjectKey]);
  const activeModel = useMemo(() => findSceneFloorModelForProject(dashboardProject, items), [dashboardProject, items]);
  const model2dUrl = normalizeUrl(activeModel?.model2dUrl);
  const model3dUrl = normalizeUrl(activeModel?.model3dUrl);
  const activeUrl = mode === "2d" ? model2dUrl : model3dUrl;
  const activeSceneFrameResetKey = sceneFrameResetKeys[mode];
  const activeSceneFrameToken = activeUrl ? `${mode}:${activeUrl}:${activeSceneFrameResetKey}` : "";
  const inactiveSceneUrl = mode === "2d" ? model3dUrl : model2dUrl;
  const sceneModelUrls = useMemo(
    () => [model2dUrl, model3dUrl].filter((url): url is string => Boolean(url)),
    [model2dUrl, model3dUrl]
  );
  const shouldMount3dPrewarmFrame = Boolean(
    model3dUrl &&
    (mode === "3d" || (runtimeConfig.sceneIdle3dPrewarm && prewarm3dSceneUrl === model3dUrl))
  );
  const shouldMount2dFrame = Boolean(model2dUrl && mode === "2d");
  const is3dFrameActive = mode === "3d";
  const showSceneComfortLoading = Boolean(
    activeSceneFrameToken &&
      loadedActiveSceneFrameToken !== activeSceneFrameToken &&
      expiredSceneComfortLoadingToken !== activeSceneFrameToken
  );
  const sceneLocale = getCurrentLocale();
  const sceneText = getSceneEmbedText(sceneLocale);
  const activeLabel = sceneText.modeLabels[mode];
  const deviceFilterContext = buildSceneDeviceFilterContext(clickedDevice, deviceParameters?.deviceName);
  const detailGroups = filterSceneDeviceParameterGroups(deviceParameters?.groups || [], deviceFilterContext);
  const controlGroups = filterSceneDeviceParameterGroups(deviceParameters?.controlGroups || [], deviceFilterContext);
  const alarmRecords = filterSceneRecordsByDevice(
    deviceParameters?.alarmRecords || [],
    deviceFilterContext,
    (record) => [record.alarmTypeName, record.alarmExplain, record.id].map((value) => readSceneSafeDisplayText(value)).join(" ")
  );
  const operationRecords = filterSceneRecordsByDevice(
    deviceParameters?.operationRecords || [],
    deviceFilterContext,
    (record) => [record.details, record.id].map((value) => readSceneSafeDisplayText(value)).join(" ")
  );
  const showDeviceInfoTab = deviceParameters?.deviceInfo?.visible !== false;
  const embedControlInInfoTab = showDeviceInfoTab;
  const closeText = getSceneDeviceDialogCloseText(sceneLocale);
  const visibleDeviceDialogTabs = useMemo(
    () =>
      getSceneDeviceDialogTabs(sceneLocale).filter((tab) => {
        if (tab.key === "info") {
          return showDeviceInfoTab;
        }
        if (tab.key === "control") {
          return !embedControlInInfoTab;
        }
        return true;
      }),
    [embedControlInInfoTab, sceneLocale, showDeviceInfoTab]
  );
  const dialogDeviceTitle = resolveSceneDialogDeviceTitle(
    deviceParameters?.deviceName,
    clickedDevice,
    [...detailGroups, ...controlGroups]
  );
  const clickedDeviceRows = clickedDevice
    ? [
        { label: "\u8bbe\u5907\u540d\u79f0", value: clickedDevice.deviceName },
        { label: "\u6a21\u578b\u540d\u79f0", value: clickedDevice.modelName },
        { label: "\u8bbe\u5907\u7c7b\u578b", value: /^\d+$/.test(readSceneSafeDisplayText(clickedDevice.deviceType)) ? "" : clickedDevice.deviceType }
      ].filter((item) => readSceneSafeDisplayText(item.value))
    : [];
  const environmentItems = [
    {
      key: "wet-bulb",
      label: sceneText.wetBulb,
      value: formatSceneMetric(weather.outdoorWetBulbC, "\u00b0C"),
      icon: <CloudSun size={15} />
    },
    {
      key: "humidity",
      label: sceneText.outdoorHumidity,
      value: formatSceneMetric(weather.outdoorHumidityPct, "%", 0),
      icon: <Droplets size={15} />
    },
    {
      key: "temperature",
      label: sceneText.outdoorTemperature,
      value: formatSceneMetric(weather.outdoorTempC, "\u00b0C"),
      icon: <ThermometerSun size={15} />
    }
  ];
  const runtimeSourceState = formatSceneRuntimeSourceState(stationOverview);
  const energyCards = stationOverview?.energyCards;
  const totalPowerKw = energyCards?.totalPowerKw ?? null;
  const totalCoolingCapacity = energyCards?.totalCoolingCapacity ?? null;
  const stationEfficiency = energyCards?.currentCop ?? divideSceneOrNull(totalCoolingCapacity, totalPowerKw);
  const loadRate = energyCards?.currentLoadRate ?? null;
  const chillerPowerKw = energyCards?.chillerPowerKw ?? null;
  const chilledPumpPowerKw = energyCards?.chilledPumpPowerKw ?? null;
  const coolingPumpPowerKw = energyCards?.coolingPumpPowerKw ?? null;
  const coolingTowerPowerKw = energyCards?.coolingTowerPowerKw ?? null;
  const auxiliaryPowerKw =
    (isFiniteSceneNumber(chilledPumpPowerKw) ? chilledPumpPowerKw : 0) +
    (isFiniteSceneNumber(coolingPumpPowerKw) ? coolingPumpPowerKw : 0) +
    (isFiniteSceneNumber(coolingTowerPowerKw) ? coolingTowerPowerKw : 0);
  const hasAuxiliaryPower = [chilledPumpPowerKw, coolingPumpPowerKw, coolingTowerPowerKw].some(isFiniteSceneNumber);
  const chilledSupplyTemp = energyCards?.chilledSupplyTemp ?? null;
  const chilledDeltaT = energyCards?.chilledDeltaT ?? null;
  const chilledReturnTemp =
    isFiniteSceneNumber(chilledSupplyTemp) && isFiniteSceneNumber(chilledDeltaT)
      ? chilledSupplyTemp + chilledDeltaT
      : null;
  const coolingReturnTemp = energyCards?.coolingReturnTemp ?? null;
  const coolingDeltaT = energyCards?.coolingDeltaT ?? null;
  const activeAlarmCount = stationOverview?.alarmSummary?.total ?? energyCards?.activeAnomalyCount ?? null;
  const highAlarmCount = stationOverview?.alarmSummary?.high ?? null;
  const alarmRuntimeText =
    isFiniteSceneNumber(highAlarmCount) && highAlarmCount > 0
      ? `${formatSceneRuntimeCount(highAlarmCount)}高危`
      : isFiniteSceneNumber(activeAlarmCount)
        ? `${formatSceneRuntimeCount(activeAlarmCount)}项`
        : "--";
  const alarmRuntimeHint =
    isFiniteSceneNumber(activeAlarmCount) && isFiniteSceneNumber(highAlarmCount)
      ? `总告警 ${formatSceneRuntimeCount(activeAlarmCount)} · 高危 ${formatSceneRuntimeCount(highAlarmCount)}`
      : "等待告警摘要回传";
  const sceneRuntimeMetrics: SceneRuntimeMetricView[] = [
    {
      key: "efficiency",
      label: "冷站能效",
      value: formatSceneRuntimeNumber(stationEfficiency, 2),
      unit: "COP",
      hint: isFiniteSceneNumber(loadRate) ? `负荷率 ${formatSceneRuntimePercent(loadRate)}%` : "总冷量 / 总功率",
      tone: isFiniteSceneNumber(stationEfficiency) && stationEfficiency >= 4.15 ? "good" : "neutral",
      primary: true
    },
    {
      key: "power",
      label: "总功率",
      value: formatSceneRuntimeNumber(totalPowerKw, 1),
      unit: "kW",
      hint: `主机 ${formatSceneRuntimeNumber(chillerPowerKw, 1)} · 辅机 ${
        hasAuxiliaryPower ? formatSceneRuntimeNumber(auxiliaryPowerKw, 1) : "--"
      }`,
      tone: "info"
    },
    {
      key: "cooling-capacity",
      label: "总制冷量",
      value: formatSceneRuntimeNumber(totalCoolingCapacity, 0),
      unit: "kW",
      hint: isFiniteSceneNumber(loadRate) ? `当前负荷率 ${formatSceneRuntimePercent(loadRate)}%` : "等待负荷率回传"
    },
    {
      key: "chilled-water",
      label: "冷冻水",
      value: formatSceneTemperaturePair(chilledSupplyTemp, chilledReturnTemp),
      unit: "°C",
      hint: `供/回 · ΔT ${formatSceneRuntimeNumber(chilledDeltaT, 1)}°C`
    },
    {
      key: "cooling-water",
      label: "冷却水",
      value: formatSceneRuntimeNumber(coolingReturnTemp, 1),
      unit: "°C",
      hint: `回水 · ΔT ${formatSceneRuntimeNumber(coolingDeltaT, 1)}°C · 湿球 ${formatSceneMetric(weather.outdoorWetBulbC, "°C")}`,
      tone: "warn"
    },
    {
      key: "equipment-counts",
      label: "设备组合",
      value: formatSceneEquipmentCounts(stationOverview),
      hint: "冷机/泵/塔 · 设备数"
    }
  ];
  const sceneRuntimeCompactMetrics: SceneRuntimeMetricView[] = [
    sceneRuntimeMetrics[0],
    {
      key: "compact-load",
      label: "负荷率",
      value: formatSceneRuntimePercent(loadRate),
      unit: "%",
      hint: `P ${formatSceneRuntimeNumber(totalPowerKw, 1)}kW · C ${formatSceneRuntimeNumber(totalCoolingCapacity, 0)}kW`
    },
    {
      key: "compact-water",
      label: "关键水温",
      value: formatSceneTemperaturePair(chilledSupplyTemp, coolingReturnTemp),
      unit: "°C",
      hint: "冷冻供水 / 冷却回水"
    },
    {
      key: "compact-alarm",
      label: "活跃告警",
      value: alarmRuntimeText,
      hint: alarmRuntimeHint,
      tone: isFiniteSceneNumber(highAlarmCount) && highAlarmCount > 0 ? "danger" : "good"
    }
  ];
  const visibleRuntimeMetrics = runtimeHudExpanded ? sceneRuntimeMetrics : sceneRuntimeCompactMetrics;
  const sceneRuntimeContextItems: SceneRuntimeContextItem[] = [
    { label: "COP", value: formatSceneRuntimeNumber(stationEfficiency, 2) },
    { label: "负荷率", value: `${formatSceneRuntimePercent(loadRate)}%` },
    { label: "告警", value: alarmRuntimeText },
    { label: "状态", value: runtimeSourceState.label.replace(/^数据/, "") }
  ];

  useEffect(() => {
    setLoaded2dSceneUrl("");
    setPrewarm3dSceneUrl("");
    setPrewarmed3dReadyUrl("");
    setLoadedActiveSceneFrameToken("");
    setExpiredSceneComfortLoadingToken("");
  }, [model2dUrl, model3dUrl]);

  useEffect(() => {
    if (!activeSceneFrameToken) {
      setLoadedActiveSceneFrameToken("");
      return;
    }
    setLoadedActiveSceneFrameToken((currentToken) => {
      if (currentToken === activeSceneFrameToken) {
        return currentToken;
      }
      if (mode === "3d" && model3dUrl && prewarmed3dReadyUrl === model3dUrl) {
        return activeSceneFrameToken;
      }
      return "";
    });
  }, [activeSceneFrameToken, mode, model3dUrl, prewarmed3dReadyUrl]);

  useEffect(() => {
    if (!activeSceneFrameToken || loadedActiveSceneFrameToken === activeSceneFrameToken) {
      setExpiredSceneComfortLoadingToken("");
      return;
    }
    setExpiredSceneComfortLoadingToken((currentToken) => (currentToken === activeSceneFrameToken ? "" : currentToken));
    const loadingTimer = window.setTimeout(() => {
      setExpiredSceneComfortLoadingToken(activeSceneFrameToken);
    }, SCENE_COMFORT_LOADING_MAX_MS);
    return () => {
      window.clearTimeout(loadingTimer);
    };
  }, [activeSceneFrameToken, loadedActiveSceneFrameToken]);

  useEffect(() => {
    if (!sceneModelUrls.length) {
      return;
    }
    ensureSceneModelOriginHints(sceneModelUrls);
  }, [sceneModelUrls]);

  useEffect(() => {
    if (!activeUrl || !inactiveSceneUrl || inactiveSceneUrl === activeUrl) {
      return;
    }
    const prefetchTimer = window.setTimeout(() => {
      ensureSceneModelDocumentPrefetch(inactiveSceneUrl);
    }, 1600);
    return () => {
      window.clearTimeout(prefetchTimer);
    };
  }, [activeUrl, inactiveSceneUrl]);

  useEffect(() => {
    if (
      !runtimeConfig.sceneIdle3dPrewarm ||
      mode !== "2d" ||
      !model2dUrl ||
      !model3dUrl ||
      loaded2dSceneUrl !== model2dUrl ||
      prewarm3dSceneUrl === model3dUrl
    ) {
      return;
    }

    const idleWindow = window as SceneIdleWindow;
    let idleHandle: number | null = null;
    const settleTimer = window.setTimeout(() => {
      if (typeof idleWindow.requestIdleCallback === "function") {
        idleHandle = idleWindow.requestIdleCallback(() => {
          setPrewarm3dSceneUrl(model3dUrl);
        }, { timeout: 4500 });
        return;
      }
      setPrewarm3dSceneUrl(model3dUrl);
    }, SCENE_IDLE_3D_PREWARM_DELAY_MS);

    return () => {
      window.clearTimeout(settleTimer);
      if (idleHandle !== null && typeof idleWindow.cancelIdleCallback === "function") {
        idleWindow.cancelIdleCallback(idleHandle);
      }
    };
  }, [loaded2dSceneUrl, mode, model2dUrl, model3dUrl, prewarm3dSceneUrl]);

  useEffect(() => {
    if (!currentProject?.siteId) {
      return;
    }

    let active = true;
    setLoading(true);
    setErrorText("");
    preloadSceneFloorModels(currentProject.siteId)
      .then((nextItems) => {
        if (!active) {
          return;
        }
        setItems(nextItems);
      })
      .catch(() => {
        if (!active) {
          return;
        }
        setErrorText("场景地址加载失败，请检查当前项目的场景模型配置。");
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [currentProject?.siteId, currentProject?.modelKey, currentProject?.template]);

  useEffect(() => {
    if (!dashboardProject?.siteId) {
      setStationOverview(null);
      setWeather({
        outdoorWetBulbC: null,
        outdoorHumidityPct: null,
        outdoorTempC: null
      });
      return;
    }

    let active = true;
    fetchDashboardOverviewForProject(dashboardProject)
      .then((overview) => {
        if (!active) {
          return;
        }
        setStationOverview(overview);
        setWeather(readSceneWeather(overview));
      })
      .catch(() => {
        if (active) {
          setStationOverview(null);
          setWeather({
            outdoorWetBulbC: null,
            outdoorHumidityPct: null,
            outdoorTempC: null
          });
        }
      });

    return () => {
      active = false;
    };
  }, [
    dashboardProject?.siteId,
    dashboardProject?.modelKey,
    dashboardProject?.databaseKey,
    dashboardProject?.template
  ]);

  useEffect(() => {
    const allowedOrigin = readSceneOrigin(activeUrl);
    if (!allowedOrigin) {
      return;
    }

    function handleSceneMessage(event: MessageEvent) {
      if (event.origin !== allowedOrigin) {
        return;
      }
      if (event.source !== iframeRef.current?.contentWindow) {
        return;
      }
      const message = event.data;
      if (!message || typeof message !== "object" || Array.isArray(message)) {
        return;
      }
      const messageRecord = message as Record<string, unknown>;
      const messageId = readSceneText(messageRecord.id, messageRecord.type, messageRecord.action);
      if (messageId !== "onClickModelObservable") {
        return;
      }
      const device = normalizeSceneDeviceClick(messageRecord.data);
      if (device) {
        setDeviceDialogTab("info");
        setClickedDevice(device);
      }
    }

    window.addEventListener("message", handleSceneMessage);
    return () => {
      window.removeEventListener("message", handleSceneMessage);
    };
  }, [activeUrl]);

  useEffect(() => {
    if (!clickedDevice) {
      setDeviceParameters(null);
      setDeviceParametersError("");
      setDeviceParametersLoading(false);
      setControlSubmittingKey("");
      setControlCommandStatus("");
      setPendingControlCommand(null);
      return;
    }
    if (!dashboardProject?.siteId || !clickedDevice.drId) {
      setDeviceParameters(null);
      setDeviceParametersError("\u5f53\u524d\u8bbe\u5907\u7f3a\u5c11 drId\uff0c\u6682\u65f6\u65e0\u6cd5\u62c9\u53d6\u8be6\u7ec6\u53c2\u6570\u3002");
      setDeviceParametersLoading(false);
      return;
    }

    let active = true;
    setDeviceParametersLoading(true);
    setDeviceParametersError("");
    setControlCommandStatus("");
    setPendingControlCommand(null);
    setDeviceParameters(null);

    fetchSceneDeviceParameters(dashboardProject.siteId, clickedDevice.drId)
      .then((data) => {
        if (!active) {
          return;
        }
        setDeviceParameters(data);
      })
      .catch((error) => {
        if (!active) {
          return;
        }
        setDeviceParametersError(
          error instanceof Error
            ? error.message
            : "\u8bbe\u5907\u8be6\u7ec6\u53c2\u6570\u62c9\u53d6\u5931\u8d25"
        );
      })
      .finally(() => {
        if (active) {
          setDeviceParametersLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [clickedDevice, dashboardProject?.siteId]);

  useEffect(() => {
    if (clickedDevice && deviceParameters?.deviceInfo?.visible === false && deviceDialogTab === "info") {
      setDeviceDialogTab("detail");
    }
  }, [clickedDevice, deviceDialogTab, deviceParameters?.deviceInfo?.visible]);

  useEffect(() => {
    if (clickedDevice && embedControlInInfoTab && deviceDialogTab === "control") {
      setDeviceDialogTab("info");
    }
  }, [clickedDevice, deviceDialogTab, embedControlInInfoTab]);

  useEffect(() => {
    function handleFullscreenChange() {
      setIsFrameFullscreen(document.fullscreenElement === shellRef.current);
    }

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

  useEffect(() => {
    if (isFrameFullscreen) {
      setRuntimeHudExpanded(false);
    }
  }, [isFrameFullscreen]);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return;
    }
    const mediaQuery = window.matchMedia("(max-width: 760px)");
    function collapseForCompactViewport(event: MediaQueryList | MediaQueryListEvent) {
      if (event.matches) {
        setRuntimeHudExpanded(false);
      }
    }
    collapseForCompactViewport(mediaQuery);
    mediaQuery.addEventListener("change", collapseForCompactViewport);
    return () => {
      mediaQuery.removeEventListener("change", collapseForCompactViewport);
    };
  }, []);

  useEffect(() => {
    if (fitMode !== "native" || !activeUrl) {
      setNativeFrameViewport({ scale: 1, x: 0, y: 0 });
      return;
    }

    const stage = stageRef.current;
    if (!stage) {
      return;
    }
    const currentStage = stage;
    const nativeViewport = resolveSceneNativeViewport(activeUrl);

    function updateNativeFrameScale() {
      const widthScale = currentStage.clientWidth / nativeViewport.width;
      const heightScale = currentStage.clientHeight / nativeViewport.height;
      const scale = Math.max(0.1, Math.min(widthScale, heightScale, nativeViewport.maxScale));
      const roundedScale = Math.round(scale * 1000) / 1000;
      const offsetX =
        (currentStage.clientWidth - nativeViewport.width * roundedScale) / 2 -
        nativeViewport.x * roundedScale;
      const offsetY =
        (currentStage.clientHeight - nativeViewport.height * roundedScale) / 2 -
        nativeViewport.y * roundedScale;
      setNativeFrameViewport({
        scale: roundedScale,
        x: Math.round(offsetX),
        y: Math.round(offsetY)
      });
    }

    updateNativeFrameScale();

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", updateNativeFrameScale);
      return () => {
        window.removeEventListener("resize", updateNativeFrameScale);
      };
    }

    const observer = new ResizeObserver(updateNativeFrameScale);
    observer.observe(currentStage);
    return () => {
      observer.disconnect();
    };
  }, [activeUrl, fitMode, isFrameFullscreen, activeSceneFrameResetKey]);

  useEffect(() => {
    if (!activeUrl || fitMode === "native") {
      return;
    }
    const timers = [120, 420, 900, 1600].map((delay) =>
      window.setTimeout(() => requestSceneFrameAutoFit(iframeRef.current), delay)
    );
    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [activeUrl, fitMode]);

  useEffect(() => {
    setSceneFrameNoticeVisible(false);
    if (sceneFrameNoticeTimerRef.current !== null) {
      window.clearTimeout(sceneFrameNoticeTimerRef.current);
      sceneFrameNoticeTimerRef.current = null;
    }
    if (!activeUrl) {
      return;
    }
    sceneFrameNoticeTimerRef.current = window.setTimeout(() => {
      setSceneFrameNoticeVisible(true);
      sceneFrameNoticeTimerRef.current = null;
    }, 6000);
    return () => {
      if (sceneFrameNoticeTimerRef.current !== null) {
        window.clearTimeout(sceneFrameNoticeTimerRef.current);
        sceneFrameNoticeTimerRef.current = null;
      }
    };
  }, [activeUrl, fitMode]);

  useEffect(() => {
    if (!activeUrl || activeUrl !== prewarmed3dReadyUrl) {
      return;
    }
    if (sceneFrameNoticeTimerRef.current !== null) {
      window.clearTimeout(sceneFrameNoticeTimerRef.current);
      sceneFrameNoticeTimerRef.current = null;
    }
    setSceneFrameNoticeVisible(false);
  }, [activeUrl, prewarmed3dReadyUrl]);

  useEffect(() => {
    if (!activeUrl || fitMode === "native") {
      return;
    }
    let resizeTimer = 0;
    function handleSceneWindowResize() {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => requestSceneFrameAutoFit(iframeRef.current), 180);
    }
    window.addEventListener("resize", handleSceneWindowResize);
    return () => {
      window.clearTimeout(resizeTimer);
      window.removeEventListener("resize", handleSceneWindowResize);
    };
  }, [activeUrl, fitMode]);

  function handleToggleFullscreen() {
    const shell = shellRef.current;
    if (!shell) {
      return;
    }
    if (document.fullscreenElement === shell) {
      document.exitFullscreen?.();
      return;
    }
    shell.requestFullscreen?.();
  }

  function handleSceneFrameLoad(frameMode: SceneMode, frameUrl: string) {
    const frameToken = `${frameMode}:${frameUrl}:${sceneFrameResetKeys[frameMode]}`;
    if (frameMode === "2d") {
      setLoaded2dSceneUrl(frameUrl);
    }
    if (frameMode === "3d" && frameUrl === prewarm3dSceneUrl) {
      setPrewarmed3dReadyUrl(frameUrl);
    }
    if (frameMode !== mode || frameUrl !== activeUrl) {
      return;
    }
    setLoadedActiveSceneFrameToken(frameToken);
    if (sceneFrameNoticeTimerRef.current !== null) {
      window.clearTimeout(sceneFrameNoticeTimerRef.current);
      sceneFrameNoticeTimerRef.current = null;
    }
    setSceneFrameNoticeVisible(false);
    if (fitMode === "native") {
      return;
    }
    [80, 320, 760, 1400].forEach((delay) => {
      window.setTimeout(() => requestSceneFrameAutoFit(iframeRef.current), delay);
    });
  }

  function handleResetSceneNativeView() {
    if (sceneFrameNoticeTimerRef.current !== null) {
      window.clearTimeout(sceneFrameNoticeTimerRef.current);
      sceneFrameNoticeTimerRef.current = null;
    }
    setSceneFrameNoticeVisible(false);
    setFitMode(SCENE_NATIVE_FIT_MODE_OPTION.value);
    setNativeFrameViewport({ scale: 1, x: 0, y: 0 });
    setLoadedActiveSceneFrameToken("");
    if (mode === "3d") {
      setPrewarmed3dReadyUrl("");
    }
    setSceneFrameResetKeys((value) => ({
      ...value,
      [mode]: value[mode] + 1
    }));
  }

  function handleCloseDeviceDialog() {
    setClickedDevice(null);
    setDeviceDialogTab("info");
    setPendingControlCommand(null);
  }

  async function handleSubmitSceneControl(
    item: SceneDeviceParameterItemDto,
    value: string,
    actionKey: string,
    displayText?: string
  ) {
    if (!dashboardProject?.siteId || !clickedDevice) {
      return;
    }
    const normalizedValue = readSceneText(value);
    const drTypeId = readSceneText(item.drTypeId, clickedDevice.deviceTypeId, clickedDevice.deviceType);
    const regName = readSceneText(item.regName, item.label);
    const tagName = readSceneText(item.tagName);
    if (!normalizedValue || !drTypeId || !regName || !tagName) {
      setControlCommandStatus("\u63a7\u5236\u53c2\u6570\u4e0d\u5b8c\u6574\uff0c\u8bf7\u68c0\u67e5\u63a7\u5236\u70b9\u6620\u5c04\u4e0e\u5199\u5165\u70b9\u4f4d\u3002");
      return;
    }
    const displayValue = readSceneText(displayText, normalizedValue);
    const controlLabel = formatSceneControlCardLabel(getSceneControlRegName(item) || regName);
    const currentText = getSceneControlCurrentText(item);
    const intent = getSceneControlIntentClass(controlLabel || regName, displayValue);
    setPendingControlCommand({
      item,
      value: normalizedValue,
      actionKey,
      displayText: displayValue,
      currentText,
      controlLabel,
      drTypeId,
      regName,
      tagName,
      intent
    });
  }

  async function handleConfirmSceneControlCommand() {
    if (!dashboardProject?.siteId || !clickedDevice || !pendingControlCommand) {
      return;
    }
    const command = pendingControlCommand;
    setControlSubmittingKey(command.actionKey);
    setControlCommandStatus("");
    setPendingControlCommand(null);
    try {
      const result = await submitSceneDeviceCommand(dashboardProject.siteId, {
        drId: clickedDevice.drId,
        drTypeId: command.drTypeId,
        regName: command.regName,
        value: command.value,
        tagName: command.tagName
      });
      setControlCommandStatus(result.ok === false ? "\u63a7\u5236\u6307\u4ee4\u5df2\u4e0b\u53d1\uff0c\u4f46\u4e0a\u6e38\u672a\u786e\u8ba4\u6210\u529f\u3002" : "\u63a7\u5236\u6307\u4ee4\u5df2\u4e0b\u53d1\u3002");
    } catch (error) {
      setControlCommandStatus(error instanceof Error ? error.message : "\u63a7\u5236\u6307\u4ee4\u4e0b\u53d1\u5931\u8d25");
    } finally {
      setControlSubmittingKey("");
    }
  }

  function renderParameterGroups(groups: SceneDeviceParameterGroupDto[], emptyText: string, isControl = false) {
    if (deviceParametersLoading) {
      return <div className="scene-embed-device-state">{SCENE_DEVICE_DIALOG_TEXT.loading}</div>;
    }
    if (deviceParametersError) {
      return <div className="scene-embed-device-state is-error">{deviceParametersError}</div>;
    }
    if (!groups.length || getSceneParameterGroupCount(groups) === 0) {
      return <div className="scene-embed-device-state">{emptyText}</div>;
    }
    return (
      <div className={`scene-embed-device-parameter-groups${isControl ? " is-control" : ""}`}>
        {isControl && controlCommandStatus ? (
          <div className="scene-embed-device-command-state">{controlCommandStatus}</div>
        ) : null}
        {groups.map((group, groupIndex) => (
          <section
            key={`${group.groupName || "group"}-${groupIndex}`}
            className={[
              "scene-embed-device-parameter-group",
              isControl ? getSceneControlGroupClassName(group.groupName || "", (group.items || []).length) : ""
            ].filter(Boolean).join(" ")}
          >
            <h4>{readSceneSafeDisplayText(group.groupName) || "\u672a\u5206\u7ec4"}</h4>
            <div className="scene-embed-device-parameter-grid">
              {(isControl
                ? buildSceneControlRows(group.items || [], `${group.groupName || "group"}-${groupIndex}`)
                : (group.items || []).map((item, itemIndex) => ({
                    type: "item" as const,
                    item,
                    itemKey: `${item.id || item.label || "item"}-${itemIndex}`
                  }))
              ).map((row) => {
                if (row.type === "combined") {
                  return renderSceneControlCombinedOptions(row, handleSubmitSceneControl, controlSubmittingKey);
                }
                const { item, itemKey } = row;
                if (isControl && !hasSceneParameterTranslation(item)) {
                  return renderSceneControlEditor(item, itemKey, handleSubmitSceneControl, controlSubmittingKey);
                }
                if (isControl && hasSceneParameterTranslation(item)) {
                  return renderSceneControlOptions(item, itemKey, handleSubmitSceneControl, controlSubmittingKey);
                }
                return (
                  <article key={itemKey}>
                    <span title={readSceneSafeDisplayText(item.label) || "\u672a\u547d\u540d\u53c2\u6570"}>
                      {readSceneSafeDisplayText(item.label) || "\u672a\u547d\u540d\u53c2\u6570"}
                    </span>
                    <strong title={formatSceneParameterValue(item.value, item.unit, item.displayValue)}>
                      {formatSceneParameterValue(item.value, item.unit, item.displayValue)}
                    </strong>
                  </article>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    );
  }

  const nativeFrameStyle =
    fitMode === "native"
      ? ({
          "--scene-native-scale": nativeFrameViewport.scale,
          "--scene-native-x": `${nativeFrameViewport.x}px`,
          "--scene-native-y": `${nativeFrameViewport.y}px`,
          "--scene-native-width": `${SCENE_NATIVE_CANVAS_WIDTH}px`,
          "--scene-native-height": `${SCENE_NATIVE_CANVAS_HEIGHT}px`
        } as CSSProperties)
      : undefined;

  return (
    <div className="scene-embed-page page-enter">
      <div
        className={`scene-embed-shell${runtimeHudExpanded ? "" : " is-runtime-collapsed"}${
          isFrameFullscreen ? " is-frame-fullscreen" : ""
        }`}
        ref={shellRef}
      >
        <div className="scene-embed-runtimebar" aria-label="冷站运行态">
          <div className="scene-embed-runtime-grid">
            {visibleRuntimeMetrics.map((metric) => (
              <article
                key={metric.key}
                className={`scene-embed-runtime-card${metric.primary ? " is-primary" : ""}${
                  metric.tone ? ` is-${metric.tone}` : ""
                }`}
              >
                <div className="scene-embed-runtime-card-head">
                  <span>{metric.label}</span>
                  {metric.unit ? <em>{metric.unit}</em> : null}
                </div>
                <strong title={`${metric.value}${metric.unit ? ` ${metric.unit}` : ""}`}>
                  {metric.value}
                </strong>
                <p title={metric.hint}>{metric.hint}</p>
              </article>
            ))}
          </div>
          <div className="scene-embed-runtime-side">
            <span className={`scene-embed-runtime-source is-${runtimeSourceState.tone}`}>
              {runtimeSourceState.label}
            </span>
            <span
              className={`scene-embed-runtime-alarm${
                isFiniteSceneNumber(highAlarmCount) && highAlarmCount > 0 ? " is-danger" : ""
              }`}
              title={alarmRuntimeHint}
            >
              告警 {alarmRuntimeText}
            </span>
            <button
              type="button"
              className="scene-embed-runtime-toggle"
              onClick={() => setRuntimeHudExpanded((value) => !value)}
              aria-pressed={!runtimeHudExpanded}
            >
              {runtimeHudExpanded ? "收起" : "展开"}
            </button>
          </div>
        </div>

        <div className={`scene-embed-stage is-fit-${fitMode}`} ref={stageRef} style={nativeFrameStyle}>
          {activeUrl ? (
            <Fragment>
              {shouldMount2dFrame ? (
                <iframe
                  ref={iframeRef}
                  key={`${model2dUrl}-2d-${sceneFrameResetKeys["2d"]}`}
                  className={`scene-embed-frame is-2d is-fit-${fitMode}`}
                  data-scene-active="true"
                  data-scene-mode="2d"
                  data-scene-reset-key={sceneFrameResetKeys["2d"]}
                  title={`${projectLabel}-${sceneText.modeLabels["2d"]}`}
                  src={model2dUrl}
                  scrolling="no"
                  onLoad={() => handleSceneFrameLoad("2d", model2dUrl)}
                  allow="fullscreen; autoplay; clipboard-read; clipboard-write; camera; microphone; geolocation"
                  allowFullScreen
                />
              ) : null}
              {shouldMount3dPrewarmFrame ? (
                <iframe
                  ref={is3dFrameActive ? iframeRef : null}
                  key={`${model3dUrl}-3d-${sceneFrameResetKeys["3d"]}`}
                  className={`scene-embed-frame is-3d is-fit-${fitMode}${is3dFrameActive ? "" : " is-prewarm"}`}
                  data-scene-active={is3dFrameActive ? "true" : "false"}
                  data-scene-mode="3d"
                  data-scene-prewarm={is3dFrameActive ? undefined : "true"}
                  data-scene-prewarm-ready={prewarmed3dReadyUrl === model3dUrl ? "true" : undefined}
                  data-scene-reset-key={sceneFrameResetKeys["3d"]}
                  title={`${projectLabel}-${is3dFrameActive ? sceneText.modeLabels["3d"] : "3D场景预热"}`}
                  src={model3dUrl}
                  scrolling="no"
                  tabIndex={is3dFrameActive ? undefined : -1}
                  aria-hidden={is3dFrameActive ? undefined : true}
                  onLoad={() => handleSceneFrameLoad("3d", model3dUrl)}
                  allow="fullscreen; autoplay; clipboard-read; clipboard-write; camera; microphone; geolocation"
                  allowFullScreen
                />
              ) : null}
            </Fragment>
          ) : (
            <div className="scene-embed-empty">
              <strong>{loading ? "\u6b63\u5728\u52a0\u8f7d\u573a\u666f\u5730\u5740..." : "\u5f53\u524d\u9879\u76ee\u6682\u672a\u5339\u914d\u5230\u573a\u666f\u5730\u5740"}</strong>
              <p>
                {errorText ||
                  `已按当前项目匹配场景模型数据，当前项目：${projectLabel}。`}
              </p>
              <small>
                {dashboardProject?.modelKey
                  ? `当前项目模型：${dashboardProject.modelKey}`
                  : `\u5f53\u524d\u9ed8\u8ba4\u9879\u76ee\u7f16\u53f7\uff1a${runtimeConfig.siteId}`}
              </small>
            </div>
          )}
          {activeUrl && showSceneComfortLoading ? (
            <div className="scene-embed-loading-layer" role="status" aria-live="polite">
              <div className="scene-embed-loading-card">
                <span className="scene-embed-loading-mark" aria-hidden="true" />
                <strong>{activeLabel}加载中</strong>
                <span>正在准备场景模型与运行点位</span>
                <div className="scene-embed-loading-meter" aria-hidden="true">
                  <i />
                  <i />
                  <i />
                </div>
              </div>
            </div>
          ) : null}
          {activeUrl && sceneFrameNoticeVisible ? (
            <div className="scene-embed-frame-status" aria-live="polite">
              <strong>场景服务未确认</strong>
              <span>场景加载未完成，请核对 2D/3D 场景服务</span>
            </div>
          ) : null}
        </div>

        {clickedDevice ? (
          <div className="scene-embed-device-dialog-backdrop" role="presentation">
            <section className="scene-embed-device-dialog" role="dialog" aria-modal="true" aria-live="polite">
              <div className="scene-embed-device-dialog-head">
                <div className="scene-embed-device-dialog-title">
                  <strong>
                    {dialogDeviceTitle}
                  </strong>
                </div>
                <div className="scene-embed-device-tabs" role="tablist" aria-label={SCENE_DEVICE_DIALOG_TEXT.tabsAria}>
                  {visibleDeviceDialogTabs.map((tab) => {
                    const badgeCount =
                      tab.key === "alarm"
                        ? alarmRecords.length
                        : tab.key === "operation"
                          ? operationRecords.length
                          : null;
                    const badgeText = badgeCount !== null && badgeCount > 99 ? "99+" : String(badgeCount ?? "");
                    return (
                      <button
                        key={tab.key}
                        type="button"
                        role="tab"
                        aria-selected={deviceDialogTab === tab.key}
                        className={deviceDialogTab === tab.key ? "active" : ""}
                        onClick={() => setDeviceDialogTab(tab.key)}
                      >
                        <span>{tab.label}</span>
                        {badgeCount !== null ? <em>{badgeText}</em> : null}
                      </button>
                    );
                  })}
                </div>
                <button
                  type="button"
                  className="scene-embed-device-close"
                  onClick={handleCloseDeviceDialog}
                  aria-label={closeText.closeAria}
                >
                  {closeText.close}
                </button>
              </div>

              <div
                className={`scene-embed-device-dialog-body${
                  deviceDialogTab === "info" && showDeviceInfoTab ? " is-device-info" : ""
                }`}
              >
                {deviceDialogTab === "info" && showDeviceInfoTab ? (
                  renderSceneDeviceInfoTab(
                    deviceParameters?.deviceInfo,
                    clickedDeviceRows,
                    deviceParametersLoading,
                    deviceParametersError,
                    embedControlInInfoTab
                      ? renderParameterGroups(controlGroups, SCENE_DEVICE_DIALOG_TEXT.controlEmpty, true)
                      : null
                  )
                ) : null}

                {deviceDialogTab === "detail"
                  ? deviceParametersLoading
                    ? <div className="scene-embed-device-state">{SCENE_DEVICE_DIALOG_TEXT.loading}</div>
                    : deviceParametersError
                      ? <div className="scene-embed-device-state is-error">{deviceParametersError}</div>
                      : renderSceneCompactDetailGroups(detailGroups, SCENE_DEVICE_DIALOG_TEXT.detailEmpty)
                  : null}

                {deviceDialogTab === "control"
                  ? renderParameterGroups(controlGroups, SCENE_DEVICE_DIALOG_TEXT.controlEmpty, true)
                  : null}

                {deviceDialogTab === "alarm"
                  ? renderSceneDeviceAlarmRecords(alarmRecords, deviceParametersLoading, deviceParametersError)
                  : null}

                {deviceDialogTab === "operation"
                  ? renderSceneDeviceOperationRecords(operationRecords, deviceParametersLoading, deviceParametersError)
                  : null}
              </div>

              {pendingControlCommand ? (
                <div className="scene-embed-device-confirm-layer" role="presentation">
                  <section
                    className={`scene-embed-device-confirm is-${pendingControlCommand.intent}`}
                    role="alertdialog"
                    aria-modal="true"
                  >
                    <span>{"控制指令下发确认"}</span>
                    <strong title={dialogDeviceTitle}>{dialogDeviceTitle}</strong>
                    <div className="scene-embed-device-confirm-grid">
                      <p>
                        <em>{"控制点"}</em>
                        <b title={pendingControlCommand.controlLabel}>{pendingControlCommand.controlLabel}</b>
                      </p>
                      <p>
                        <em>{"当前值"}</em>
                        <b>{pendingControlCommand.currentText || "--"}</b>
                      </p>
                      <p>
                        <em>{"目标值"}</em>
                        <b>{pendingControlCommand.displayText}</b>
                      </p>
                      <p>
                        <em>{"设备编号"}</em>
                        <b>{clickedDevice?.drId || clickedDevice?.deviceId || "--"}</b>
                      </p>
                      <p>
                        <em>{"目标点位"}</em>
                        <b title={pendingControlCommand.tagName}>{pendingControlCommand.tagName}</b>
                      </p>
                      <p>
                        <em>{"操作人"}</em>
                        <b>{session?.username || "unknown"}</b>
                      </p>
                    </div>
                    <div className="scene-embed-device-confirm-runtime">
                      {sceneRuntimeContextItems.map((item) => (
                        <p key={item.label}>
                          <em>{item.label}</em>
                          <b>{item.value}</b>
                        </p>
                      ))}
                    </div>
                    <div className="scene-embed-device-confirm-route">
                      <em>{"执行链路"}</em>
                      <span>{"人工确认 / 权限校验 / 上位机下发 / PLC执行"}</span>
                    </div>
                    <div className="scene-embed-device-confirm-warning">
                      {"本操作将写入现场控制点。下发前请确认本地/远程状态、联动权限、检修挂牌和甲方授权。"}
                    </div>
                    <div className="scene-embed-device-confirm-actions">
                      <button type="button" onClick={() => setPendingControlCommand(null)}>
                        {"\u53d6\u6d88"}
                      </button>
                      <button type="button" className="is-primary" onClick={handleConfirmSceneControlCommand}>
                        {"确认下发"}
                      </button>
                    </div>
                  </section>
                </div>
              ) : null}

            </section>
          </div>
        ) : null}

        <div className="scene-embed-switchbar">
          <div className="scene-embed-current">
            <strong>{projectLabel}</strong>
            <span>{activeUrl || loading ? `${activeLabel}${loading ? ` \u00b7 ${sceneText.loading}` : ""}` : sceneText.noRemoteUrl}</span>
          </div>
          <div className="scene-embed-environment" aria-label={sceneText.environmentAria}>
            {environmentItems.map((item) => (
              <span key={item.key} className="scene-embed-environment-pill" title={`${item.label}\uff1a${item.value}`}>
                {item.icon}
                <em>{item.label}</em>
                <strong>{item.value}</strong>
              </span>
            ))}
          </div>
          <div className="scene-embed-toolbar">
            <div className="scene-embed-actions" role="tablist" aria-label={sceneText.modeAria}>
              <button
                type="button"
                role="tab"
                aria-selected={mode === "2d"}
                className={mode === "2d" ? "active" : ""}
                onClick={() => setMode("2d")}
                disabled={!model2dUrl}
                title={model2dUrl || sceneText.missing2dUrl}
              >
                {sceneText.modeLabels["2d"]}
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mode === "3d"}
                className={mode === "3d" ? "active" : ""}
                onClick={() => setMode("3d")}
                disabled={!model3dUrl}
                title={model3dUrl || sceneText.missing3dUrl}
              >
                {sceneText.modeLabels["3d"]}
              </button>
            </div>
            <div className="scene-embed-fit-actions" aria-label="场景视口适配">
              <button
                type="button"
                className={fitMode === SCENE_NATIVE_FIT_MODE_OPTION.value ? "active" : ""}
                onClick={handleResetSceneNativeView}
                title={SCENE_NATIVE_FIT_MODE_OPTION.title}
              >
                {SCENE_NATIVE_FIT_MODE_OPTION.label}
              </button>
            </div>
            <button
              type="button"
              className="scene-embed-fullscreen-button"
              onClick={handleToggleFullscreen}
              disabled={!activeUrl}
              aria-label={isFrameFullscreen ? sceneText.restore : sceneText.fullscreen}
              title={isFrameFullscreen ? sceneText.restore : sceneText.fullscreen}
            >
              {isFrameFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
