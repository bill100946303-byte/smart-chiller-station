import { Activity, Box, MousePointer2, Rotate3D } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ACESFilmicToneMapping,
  AmbientLight,
  AnimationMixer,
  Box3,
  BoxGeometry,
  CanvasTexture,
  Clock,
  Color,
  DirectionalLight,
  FogExp2,
  GridHelper,
  Group,
  HemisphereLight,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  Raycaster,
  Scene,
  Sprite,
  SpriteMaterial,
  SRGBColorSpace,
  Vector2,
  Vector3,
  WebGLRenderer,
  type AnimationAction,
  type Material,
  type Object3D,
  type Texture
} from "three";
import { GLTFLoader, type GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { PlantOverviewSiteProfile } from "../../config/plantOverviewRegistry";
import type {
  RuntimePointEvidenceItemDto,
  RuntimePointSummaryDto
} from "../../services/bffClient";
import SystemDiagramInspector from "./SystemDiagramInspector";
import { buildSystemDiagramLayout } from "./systemDiagramLayout";
import type {
  SystemDiagramResolvedNode,
  SystemDiagramTopology
} from "./systemDiagramTypes";
import "./PlantOverview3D.css";

type PlantOverview3DProps = {
  profile: PlantOverviewSiteProfile;
  topology?: SystemDiagramTopology;
  selectedNodeId?: string | null;
  onNodeSelect?: (node: SystemDiagramResolvedNode) => void;
  devicePageHref?: string | null;
  operationalEvidence?: boolean;
  runtimeSummary?: RuntimePointSummaryDto | null;
  runtimeScopeKey?: string;
  embedded?: boolean;
  resetViewSignal?: number;
  viewportFitSignal?: string;
  inspectedEquipmentId?: string | null;
  onEquipmentSelectionChange?: (selection: PlantOverviewEquipmentSelection | null) => void;
};

type LodLevel = "LOD0" | "LOD1" | "LOD2";
type ModelLoadState = "loading" | "ready" | "degraded" | "error";
type RuntimeEvidenceState = "LIVE" | "STALE" | "UNBOUND";
type AnimationMode = "live-read-only" | "shadow-read-only" | "paused-stale" | "paused-unbound" | "schematic-demo";
type RuntimeDriveMode = "live" | "shadow" | "paused";
export type EquipmentOperationalState = "running" | "fault" | "stopped" | "standby" | "unknown";
export type EquipmentStateEvidenceMode = "live" | "shadow" | "stale" | "unbound";
type EquipmentStatusFilter = EquipmentOperationalState | null;

export type PlantOverviewMetricEvidenceMode = "live" | "shadow" | "stale" | "unbound";

export type PlantOverviewEquipmentMetric = {
  key: "loadPercent" | "frequencyHz" | "powerKw" | "flowM3h";
  label: string;
  value: number | null;
  unit: "%" | "Hz" | "kW" | "m³/h";
  evidenceMode: PlantOverviewMetricEvidenceMode;
  pointKey: string | null;
  observedAt: string | null;
};

export type PlantOverviewEquipmentSelection = {
  equipmentId: string;
  runtimeId: string;
  deviceId: string;
  runtimeGroup: NonNullable<BindingEntry["runtimeGroup"]>;
  groupLabel: string;
  state: EquipmentOperationalState;
  stateLabel: string;
  evidenceMode: EquipmentStateEvidenceMode;
  authority: RuntimeEquipmentStateDecision["authority"];
  reason: string;
  frequencyTagName: string | null;
  loadPercentTagName: string | null;
};

export type PlantOverviewRuntimeEquipmentView = {
  selection: PlantOverviewEquipmentSelection;
  metrics: PlantOverviewEquipmentMetric[];
  motionEnabled: boolean;
  playbackRate: number;
};

export type PlantOverviewRuntimeSnapshot = {
  identityVerified: boolean;
  evidenceState: "LIVE" | "STALE" | "UNBOUND";
  equipmentById: Map<string, PlantOverviewRuntimeEquipmentView>;
  stateCounts: Record<EquipmentOperationalState, number>;
  readableEquipmentStateCount: number;
  liveEquipmentStateCount: number;
  shadowEquipmentStateCount: number;
  expectedEquipmentCount: number;
};

type PlantProcessMetric = {
  key: string;
  label: string;
  valueText: string;
  evidenceMode: "stale" | "unbound";
  anchor: [number, number, number];
  tone: "chilled" | "cooling" | "weather";
};

type ManifestItem = {
  id: string;
  category?: string;
  targetPath?: string;
  displayName?: string;
  lodPaths?: Partial<Record<LodLevel, string>>;
  lodDistanceMeters?: {
    LOD0Max?: number;
    LOD1Max?: number;
    LOD2Min?: number;
  };
};

type ModelManifest = {
  items?: ManifestItem[];
};

type BindingEntry = {
  equipmentId?: string;
  deviceId?: string;
  deviceIdRef?: string | number;
  runtimeGroup?: "chillers" | "chilledPumps" | "coolingPumps" | "coolingTowers";
  runtimeId?: string;
};

type BindingContract = {
  status?: string;
  authoritative?: boolean;
  authority?: {
    identity?: boolean;
    telemetry?: boolean;
    geometryTopology?: boolean;
  };
  bindings?: BindingEntry[];
  runtimeSignalBindings?: {
    status?: string;
    authoritative?: boolean;
    source?: string;
    selectorConfidence?: string;
    runtimeTagAliasRule?: {
      status?: string;
      pointTablePrefix?: string;
      runtimePrefixSource?: string;
      rule?: string;
      verifiedExamples?: Array<{
        pointTableCode?: string;
        runtimeId?: string;
        runtimeTagName?: string;
      }>;
    };
    runtimeValueRule?: string;
    semanticBoundary?: string;
    signals?: Record<string, {
      runningTagName?: string;
      faultTagName?: string;
      remoteEnabledTagName?: string;
      frequencyTagName?: string;
      loadPercentTagName?: string;
    }>;
  };
};

type ResolvedBinding = {
  equipmentId: string;
  runtimeGroup: BindingEntry["runtimeGroup"];
  runtimeId: string;
  deviceId: string;
  runtimeSignals: {
    runningTagName: string;
    faultTagName: string;
    remoteEnabledTagName: string;
    frequencyTagName: string | null;
    loadPercentTagName: string | null;
    selectorStatus: string;
    selectorReadOnly: boolean;
    selectorConfidence: string;
    transportAliasStatus: string;
  } | null;
};

type RuntimeClipDecision = {
  evidenceLive: boolean;
  shadowReadable: boolean;
  driveMode: RuntimeDriveMode;
  motionEnabled: boolean;
  playbackRate: number;
};

type RuntimeEquipmentStateDecision = {
  equipmentId: string;
  runtimeId: string;
  state: EquipmentOperationalState;
  evidenceMode: EquipmentStateEvidenceMode;
  authority: "authoritative-live" | "unverified-shadow" | "none";
  reason: string;
  running: boolean | null;
  faultActive: boolean | null;
  remoteEnabled: boolean | null;
};

type EquipmentStateCounts = Record<EquipmentOperationalState, number>;

type RuntimeAnimationPlan = {
  decisionsByClipName: Map<string, RuntimeClipDecision>;
  equipmentStatesByEquipmentId: Map<string, RuntimeEquipmentStateDecision>;
  equipmentStateCounts: EquipmentStateCounts;
  liveEquipmentStateCount: number;
  shadowEquipmentStateCount: number;
  readableEquipmentStateCount: number;
  signature: string;
  evidenceState: RuntimeEvidenceState;
  liveEquipmentCount: number;
  shadowReadableEquipmentCount: number;
  expectedEquipmentCount: number;
  playingEquipmentCount: number;
  playingLiveEquipmentCount: number;
  playingShadowEquipmentCount: number;
};

type RuntimeStatusMarker = {
  root: Group;
  baseLightband: Group;
  cornerFrame: Group;
  badge: Sprite;
  baseLightbandMaterial: MeshBasicMaterial;
  cornerFrameMaterial: MeshBasicMaterial;
  badgeMaterial: SpriteMaterial;
  baseBadgeScale: number;
  renderedBadgeScale: number;
  state: EquipmentOperationalState;
  evidenceMode: EquipmentStateEvidenceMode;
  renderedBaseLightbandOpacity: number;
  renderedCornerFrameOpacity: number;
};

type RuntimeBodyTintMaterialTarget = {
  material: MeshStandardMaterial;
  baseColor: Color;
  baseEmissive: Color;
  baseEmissiveIntensity: number;
  renderedEmissiveIntensity: number;
};

type RuntimeEquipmentBodyTint = {
  equipmentId: string;
  assetKey: "chiller" | "pump" | "tower";
  materials: RuntimeBodyTintMaterialTarget[];
  state: EquipmentOperationalState;
  evidenceMode: EquipmentStateEvidenceMode;
};

type EquipmentStatusVisualContext = {
  activeLod: LodLevel;
  selectedEquipmentId: string | null;
  statusFilter: EquipmentStatusFilter;
};

export type RuntimeReplayHistoryEntry = {
  sourceSequence: number;
  scanCycleId: string;
  bootId: string;
  seenBootIds: string[];
  observedAt: string;
  observedAtMs: number;
  valueFingerprint: string;
};

const BINDING_GROUPS = new Set<BindingEntry["runtimeGroup"]>([
  "chillers",
  "chilledPumps",
  "coolingPumps",
  "coolingTowers"
]);

type LoadedLod = {
  level: LodLevel;
  root: Group;
  mixerRoot: Object3D;
  mixer: AnimationMixer;
  actionsByClipName: Map<string, AnimationAction>;
  statusMarkersByEquipmentId: Map<string, RuntimeStatusMarker>;
  bodyTintsByEquipmentId: Map<string, RuntimeEquipmentBodyTint>;
  animationCount: number;
  runtimeTargetCount: number;
};

const MANIFEST_PATH = "/models/model-manifest-v1.json";
const INITIAL_LOD: LodLevel = "LOD1";
const FALLBACK_LODS: LodLevel[] = ["LOD1", "LOD2", "LOD0"];
const DEFAULT_CAMERA_VIEW_DIRECTION = new Vector3(18, 25, 34).normalize();
const DEFAULT_CAMERA_VIEW_DIRECTION_CONTRACT = "18,25,34";
const CHILLER_TOP_TO_BOTTOM_ORDER = Array.from({ length: 7 }, (_, index) => `CH${index + 1}`);
const RUNTIME_SOURCE_KEY = "chillerStagingRuntime";
const RUNTIME_REPLAY_STORAGE_KEY = "b25-runtime-point-replay-history-v1";
const CODE_OWNED_EVIDENCE_PROFILE_IDS = new Set(["opcua-datavalue-v1"]);
const HARD_LIVE_MAX_AGE_MS = 20_000;
const HARD_MAX_FUTURE_SKEW_MS = 2_000;
const HARD_SHADOW_TRANSPORT_MAX_AGE_MS = 30_000;
const AUTHORITATIVE_TIMESTAMP_BASES = new Set([
  "opcua_server_timestamp",
  "edge_poll_complete",
  "historian_event_time",
  "source_observed_at"
]);
const EQUIPMENT_MOTION_GROUPS = new Set<ResolvedBinding["runtimeGroup"]>([
  "chilledPumps",
  "coolingPumps",
  "coolingTowers"
]);
const EXPECTED_CORE_EQUIPMENT_IDS = [
  ...Array.from({ length: 7 }, (_, index) => `CH${index + 1}`),
  ...Array.from({ length: 7 }, (_, index) => `CHWP${index + 1}`),
  ...Array.from({ length: 7 }, (_, index) => `CWP${index + 1}`),
  ...Array.from({ length: 33 }, (_, index) => `CT${String(index + 1).padStart(2, "0")}`)
] as const;
const EXPECTED_CORE_EQUIPMENT_ID_SET = new Set<string>(EXPECTED_CORE_EQUIPMENT_IDS);
const EXPECTED_CORE_BINDING_SPECS: Array<{
  equipmentId: string;
  runtimeId: string;
  runtimeGroup: BindingEntry["runtimeGroup"];
}> = [
  ...Array.from({ length: 7 }, (_, index) => ({
    equipmentId: `CH${index + 1}`,
    runtimeId: `CH${index + 1}`,
    runtimeGroup: "chillers" as const
  })),
  ...Array.from({ length: 7 }, (_, index) => ({
    equipmentId: `CHWP${index + 1}`,
    runtimeId: `CHP${index + 1}`,
    runtimeGroup: "chilledPumps" as const
  })),
  ...Array.from({ length: 7 }, (_, index) => ({
    equipmentId: `CWP${index + 1}`,
    runtimeId: `CWP${index + 1}`,
    runtimeGroup: "coolingPumps" as const
  })),
  ...Array.from({ length: 33 }, (_, index) => ({
    equipmentId: `CT${String(index + 1).padStart(2, "0")}`,
    runtimeId: `CTF${Math.floor(index / 6) + 1}${(index % 6) + 1}`,
    runtimeGroup: "coolingTowers" as const
  }))
];
const EXPECTED_CORE_BINDING_SPEC_BY_EQUIPMENT_ID = new Map(
  EXPECTED_CORE_BINDING_SPECS.map((spec) => [spec.equipmentId, spec] as const)
);
const EXPECTED_CORE_RUNTIME_ID_SET = new Set(
  EXPECTED_CORE_BINDING_SPECS.map((spec) => spec.runtimeId)
);
const EQUIPMENT_STATE_COLORS: Record<EquipmentOperationalState, number> = {
  running: 0x36e08b,
  fault: 0xff4d5a,
  stopped: 0x718096,
  standby: 0xf5b942,
  unknown: 0x7d9aaa
};
const EQUIPMENT_BODY_TINT_STRENGTHS: Record<EquipmentOperationalState, number> = {
  running: 0.1,
  fault: 0.22,
  stopped: 0.16,
  standby: 0.1,
  unknown: 0.07
};
const EQUIPMENT_BODY_TINT_MATERIALS: Record<RuntimeEquipmentBodyTint["assetKey"], ReadonlySet<string>> = {
  chiller: new Set([
    "MAT_PAINTED_TEAL_DARK",
    "MAT_PAINTED_TEAL",
    "MAT_PAINTED_TEAL_LIGHT"
  ]),
  pump: new Set([
    "MAT_PUMP_BLUE_SHADOW",
    "MAT_PUMP_INDUSTRIAL_BLUE",
    "MAT_PUMP_BLUE_HIGHLIGHT"
  ]),
  tower: new Set([
    "MAT_FRP_PANEL_COOLGRAY",
    "MAT_FRP_PANEL_LIGHT"
  ])
};
const EQUIPMENT_STATE_LABELS: Record<EquipmentOperationalState, string> = {
  running: "运行",
  fault: "故障",
  stopped: "停机",
  standby: "待机",
  unknown: "状态未确认"
};
const EQUIPMENT_STATE_SHAPES: Record<EquipmentOperationalState, {
  glyph: string;
  contract: "running-play" | "fault-alert" | "standby-pause" | "stopped-square" | "unknown-question";
}> = {
  running: { glyph: "▶", contract: "running-play" },
  fault: { glyph: "▲!", contract: "fault-alert" },
  standby: { glyph: "Ⅱ", contract: "standby-pause" },
  stopped: { glyph: "■", contract: "stopped-square" },
  unknown: { glyph: "?", contract: "unknown-question" }
};
const EQUIPMENT_GROUP_LABELS: Record<NonNullable<BindingEntry["runtimeGroup"]>, string> = {
  chillers: "主机",
  chilledPumps: "冷冻泵",
  coolingPumps: "冷却泵",
  coolingTowers: "冷却塔风机"
};
const EQUIPMENT_STATE_EVIDENCE_LABELS: Record<EquipmentStateEvidenceMode, string> = {
  live: "实时（LIVE）",
  shadow: "影子（SHADOW）· 时效不可证",
  stale: "陈旧（STALE）",
  unbound: "未绑定（UNBOUND）"
};
const EQUIPMENT_STATE_EVIDENCE_SUMMARY_LABELS: Record<"LIVE" | "SHADOW" | "STALE" | "UNBOUND" | "DEMO", string> = {
  LIVE: "实时（LIVE）",
  SHADOW: "影子（SHADOW）",
  STALE: "陈旧（STALE）",
  UNBOUND: "未绑定（UNBOUND）",
  DEMO: "演示（DEMO）"
};
const EMPTY_TOPOLOGY: SystemDiagramTopology = {
  id: "plant-overview-read-only",
  title: "B25 全站三维展示",
  description: "只读身份展示，不声明现场水力拓扑权威性。",
  nodes: [],
  edges: []
};

function resolveRuntimeReplayStorageKey(runtimeScopeKey: string): string {
  const normalizedScopeKey = runtimeScopeKey.trim() || "site-default";
  return `${RUNTIME_REPLAY_STORAGE_KEY}:${normalizedScopeKey}`;
}

export function loadRuntimeReplayHistory(runtimeScopeKey: string): Map<string, RuntimeReplayHistoryEntry> {
  if (typeof window === "undefined") {
    return new Map();
  }
  try {
    const parsed = JSON.parse(window.sessionStorage.getItem(resolveRuntimeReplayStorageKey(runtimeScopeKey)) || "[]");
    if (!Array.isArray(parsed)) {
      return new Map();
    }
    const entries = parsed.filter((entry): entry is [string, RuntimeReplayHistoryEntry] => {
      const [key, value] = Array.isArray(entry) ? entry : [];
      return typeof key === "string"
        && Boolean(key)
        && value !== null
        && typeof value === "object"
        && Number.isSafeInteger(value.sourceSequence)
        && typeof value.scanCycleId === "string"
        && typeof value.bootId === "string"
        && Array.isArray(value.seenBootIds)
        && value.seenBootIds.every((bootId: unknown) => typeof bootId === "string" && Boolean(bootId))
        && typeof value.observedAt === "string"
        && typeof value.observedAtMs === "number"
        && Number.isFinite(value.observedAtMs)
        && typeof value.valueFingerprint === "string";
    });
    return new Map(entries);
  } catch {
    return new Map();
  }
}

export function persistRuntimeReplayHistory(
  runtimeScopeKey: string,
  history: Map<string, RuntimeReplayHistoryEntry>
): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.sessionStorage.setItem(
      resolveRuntimeReplayStorageKey(runtimeScopeKey),
      JSON.stringify([...history.entries()])
    );
  } catch {
    // Storage denial or quota exhaustion must never relax the in-memory gate.
  }
}

function normalizeId(value: string | null | undefined): string {
  return String(value || "").trim().toUpperCase();
}

function readProcessMetricNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function formatProcessMetric(value: number | null, unit: string, digits = 1): string {
  return value === null ? "--" : `${value.toFixed(digits)}${unit}`;
}

function buildPlantProcessMetrics(summary: RuntimePointSummaryDto | null): PlantProcessMetric[] {
  const chilled = summary?.keySignals?.chilledWater;
  const cooling = summary?.keySignals?.coolingWater;
  const weather = summary?.keySignals?.weather;
  const chilledSupply = readProcessMetricNumber(chilled?.supplyTempC);
  const chilledReturn = readProcessMetricNumber(chilled?.returnTempC);
  const chilledDifferentialPressure = readProcessMetricNumber(chilled?.differentialPressureKpa);
  const coolingSupply = readProcessMetricNumber(cooling?.supplyTempC);
  const coolingReturn = readProcessMetricNumber(cooling?.returnTempC);
  const wetBulb = readProcessMetricNumber(weather?.wetBulbC);
  const approach = coolingSupply !== null && wetBulb !== null ? coolingSupply - wetBulb : null;
  const metric = (
    key: string,
    label: string,
    value: number | null,
    unit: string,
    anchor: [number, number, number],
    tone: PlantProcessMetric["tone"],
    digits = 1
  ): PlantProcessMetric => ({
    key,
    label,
    valueText: formatProcessMetric(value, unit, digits),
    evidenceMode: value === null ? "unbound" : "stale",
    anchor,
    tone
  });
  return [
    metric("chw-supply", "冷冻供水", chilledSupply, "°C", [6.6, -4.5, 0.82], "chilled"),
    metric("chw-return", "冷冻回水", chilledReturn, "°C", [7.4, 4.5, 1.33], "chilled"),
    metric("chw-dp", "冷冻干管压差", chilledDifferentialPressure, "kPa", [8.45, 0, 1.45], "chilled"),
    metric("cw-supply", "冷却供水", coolingSupply, "°C", [-9.45, -3.2, 0.82], "cooling"),
    metric("cw-return", "冷却回水", coolingReturn, "°C", [-10.35, 3.2, 1.3], "cooling"),
    metric("wet-bulb", "室外湿球", wetBulb, "°C", [-8.8, 10.6, 2.2], "weather"),
    metric("tower-approach", "冷却塔逼近度", approach, "°C", [-8.8, 8.7, 2.1], "weather")
  ];
}

function resolveReviewedRuntimeTagAlias(
  pointTableTagName: string | null | undefined,
  runtimeId: string,
  aliasRule: NonNullable<NonNullable<BindingContract["runtimeSignalBindings"]>["runtimeTagAliasRule"]> | undefined
): string {
  const pointTablePrefix = readExactNonEmptyString(aliasRule?.pointTablePrefix);
  const selector = readExactNonEmptyString(pointTableTagName);
  if (
    aliasRule?.status !== "REVIEWED_EXACT_TRANSPORT_ALIAS"
    || aliasRule.runtimePrefixSource !== "runtimeId"
    || pointTablePrefix !== "SY-"
    || !selector.startsWith(pointTablePrefix)
    || !runtimeId
  ) {
    return "";
  }
  return `${runtimeId}-${selector.slice(pointTablePrefix.length)}`;
}

function resolveVerifiedIdentityBindings(
  contract: BindingContract | null,
  expectedCount: number
): ResolvedBinding[] | null {
  if (
    !contract
    || contract.status !== "FORMAL_READ_ONLY_IDENTITY"
    || contract.authoritative !== false
    || contract.authority?.identity !== true
    || contract.authority?.telemetry !== false
    || contract.authority?.geometryTopology !== false
    || contract.bindings?.length !== expectedCount
  ) {
    return null;
  }

  const runtimeSignalSelectorStatus = readExactNonEmptyString(contract.runtimeSignalBindings?.status);
  const runtimeSignalSelectorReadOnly = contract.runtimeSignalBindings?.authoritative === false;
  const runtimeSignalSelectorConfidence = readExactNonEmptyString(contract.runtimeSignalBindings?.selectorConfidence);
  const runtimeTagAliasRule = contract.runtimeSignalBindings?.runtimeTagAliasRule;
  const transportAliasStatus = readExactNonEmptyString(runtimeTagAliasRule?.status);
  const runtimeSignalEntries = Object.entries(contract.runtimeSignalBindings?.signals || {});
  const runtimeSignalBindings = new Map(runtimeSignalEntries.map(([runtimeId, signalBinding]) => (
    [readExactNonEmptyString(runtimeId), signalBinding] as const
  )));
  const resolved = contract.bindings.map((binding) => {
    const equipmentId = readExactNonEmptyString(binding.equipmentId);
    const runtimeId = readExactNonEmptyString(binding.runtimeId || binding.deviceId);
    const signalBinding = runtimeSignalBindings.get(runtimeId);
    const runningTagName = resolveReviewedRuntimeTagAlias(signalBinding?.runningTagName, runtimeId, runtimeTagAliasRule);
    const faultTagName = resolveReviewedRuntimeTagAlias(signalBinding?.faultTagName, runtimeId, runtimeTagAliasRule);
    const remoteEnabledTagName = resolveReviewedRuntimeTagAlias(
      signalBinding?.remoteEnabledTagName,
      runtimeId,
      runtimeTagAliasRule
    );
    const frequencyTagName = signalBinding?.frequencyTagName
      ? resolveReviewedRuntimeTagAlias(signalBinding.frequencyTagName, runtimeId, runtimeTagAliasRule) || null
      : null;
    const loadPercentTagName = signalBinding?.loadPercentTagName
      ? resolveReviewedRuntimeTagAlias(signalBinding.loadPercentTagName, runtimeId, runtimeTagAliasRule) || null
      : null;
    return {
      equipmentId,
      runtimeGroup: binding.runtimeGroup,
      runtimeId,
      deviceId: readExactNonEmptyString(binding.deviceIdRef ?? binding.deviceId),
      runtimeSignals: runningTagName && faultTagName && remoteEnabledTagName
        ? {
            runningTagName,
            faultTagName,
            remoteEnabledTagName,
            frequencyTagName,
            loadPercentTagName,
            selectorStatus: runtimeSignalSelectorStatus,
            selectorReadOnly: runtimeSignalSelectorReadOnly,
            selectorConfidence: runtimeSignalSelectorConfidence,
            transportAliasStatus
          }
        : null
    };
  });
  const complete = resolved.every((binding) => (
    Boolean(binding.equipmentId)
    && Boolean(binding.runtimeId)
    && Boolean(binding.deviceId)
    && BINDING_GROUPS.has(binding.runtimeGroup)
  ));
  const unique = [
    resolved.map((binding) => binding.equipmentId),
    resolved.map((binding) => binding.runtimeId),
    resolved.map((binding) => binding.deviceId)
  ].every((values) => new Set(values).size === expectedCount);
  const exactBindingSet = resolved.every((binding) => {
    const expected = EXPECTED_CORE_BINDING_SPEC_BY_EQUIPMENT_ID.get(binding.equipmentId);
    return expected?.runtimeId === binding.runtimeId
      && expected.runtimeGroup === binding.runtimeGroup;
  });
  const exactRuntimeSignalSet = runtimeSignalEntries.length === expectedCount
    && runtimeSignalBindings.size === expectedCount
    && [...runtimeSignalBindings.keys()].every((runtimeId) => EXPECTED_CORE_RUNTIME_ID_SET.has(runtimeId));
  return complete
    && unique
    && exactBindingSet
    && exactRuntimeSignalSet
    && EXPECTED_CORE_BINDING_SPEC_BY_EQUIPMENT_ID.size === expectedCount
    ? resolved
    : null;
}

function isValidFreshnessPolicy(summary: RuntimePointSummaryDto | null): boolean {
  const liveMaxAgeMs = summary?.freshnessPolicy?.liveMaxAgeMs;
  const maxFutureSkewMs = summary?.freshnessPolicy?.maxFutureSkewMs;
  return typeof liveMaxAgeMs === "number"
    && Number.isFinite(liveMaxAgeMs)
    && liveMaxAgeMs > 0
    && liveMaxAgeMs <= HARD_LIVE_MAX_AGE_MS
    && typeof maxFutureSkewMs === "number"
    && Number.isFinite(maxFutureSkewMs)
    && maxFutureSkewMs >= 0
    && maxFutureSkewMs <= HARD_MAX_FUTURE_SKEW_MS;
}

function isRuntimeSourceReadOnlyHealthy(summary: RuntimePointSummaryDto | null): boolean {
  if (
    summary?.pointEvidence?.contractVersion !== "runtime-point-evidence-v1"
    || summary.pointEvidence.sourceKey !== RUNTIME_SOURCE_KEY
  ) {
    return false;
  }
  const matchingSources = summary.sourceStatus?.sources?.filter((source) => source.key === RUNTIME_SOURCE_KEY) || [];
  return matchingSources.length === 1
    && matchingSources[0].ok === true
    && matchingSources[0].fallback === false;
}

function readExactNonEmptyString(value: unknown): string {
  return typeof value === "string" && value.length > 0 && value === value.trim()
    ? value
    : "";
}

function isRuntimeSourceHealthy(summary: RuntimePointSummaryDto | null): boolean {
  return isRuntimeSourceReadOnlyHealthy(summary)
    && CODE_OWNED_EVIDENCE_PROFILE_IDS.has(readExactNonEmptyString(summary?.pointEvidence?.evidenceProfileId));
}

function isShadowTransportFresh(summary: RuntimePointSummaryDto | null, nowMs: number): boolean {
  const receivedAtMs = Date.parse(String(summary?.pointEvidence?.receivedAt || ""));
  if (!Number.isFinite(receivedAtMs)) {
    return false;
  }
  const ageMs = nowMs - receivedAtMs;
  return ageMs >= -HARD_MAX_FUTURE_SKEW_MS && ageMs <= HARD_SHADOW_TRANSPORT_MAX_AGE_MS;
}

function buildGloballyUniquePointKeys(points: RuntimePointEvidenceItemDto[]): Set<string> {
  const counts = new Map<string, number>();
  points.forEach((point) => {
    const sourceKey = typeof point.sourceKey === "string" ? point.sourceKey : "";
    const pointKey = typeof point.pointKey === "string" ? point.pointKey : "";
    if (sourceKey && pointKey) {
      const key = `${sourceKey}:${pointKey}`;
      counts.set(key, (counts.get(key) || 0) + 1);
    }
  });
  return new Set([...counts.entries()].filter(([, count]) => count === 1).map(([key]) => key));
}

function isShadowReadablePoint(
  point: RuntimePointEvidenceItemDto | null,
  globallyUniquePointKeys: Set<string>
): point is RuntimePointEvidenceItemDto {
  if (!point) {
    return false;
  }
  const sourceKey = typeof point.sourceKey === "string" ? point.sourceKey : "";
  const pointKey = typeof point.pointKey === "string" ? point.pointKey : "";
  const tagName = typeof point.tagName === "string" ? point.tagName : "";
  const qualityCode = readExactNonEmptyString(point.qualityCode).toUpperCase();
  return sourceKey === RUNTIME_SOURCE_KEY
    && Boolean(pointKey)
    && pointKey === pointKey.trim()
    && pointKey === tagName
    && globallyUniquePointKeys.has(`${sourceKey}:${pointKey}`)
    && !qualityCode.startsWith("BAD");
}

function buildReplayIdentityKey(point: RuntimePointEvidenceItemDto): string {
  const sourceKey = readExactNonEmptyString(point.sourceKey);
  const deviceId = readExactNonEmptyString(point.deviceId);
  const tagName = readExactNonEmptyString(point.tagName);
  return sourceKey && deviceId && tagName ? `${sourceKey}:${deviceId}:${tagName}` : "";
}

export function buildReplaySafePointKeys(
  summary: RuntimePointSummaryDto | null,
  history: Map<string, RuntimeReplayHistoryEntry>
): Set<string> {
  const points = Array.isArray(summary?.pointEvidence?.points) ? summary.pointEvidence.points : [];
  const identityKeyCounts = new Map<string, number>();
  const pointKeyCounts = new Map<string, number>();
  points.forEach((point) => {
    const identityKey = buildReplayIdentityKey(point);
    const sourceKey = readExactNonEmptyString(point.sourceKey);
    const pointKey = readExactNonEmptyString(point.pointKey);
    if (identityKey) {
      identityKeyCounts.set(identityKey, (identityKeyCounts.get(identityKey) || 0) + 1);
    }
    if (sourceKey && pointKey) {
      const globalPointKey = `${sourceKey}:${pointKey}`;
      pointKeyCounts.set(globalPointKey, (pointKeyCounts.get(globalPointKey) || 0) + 1);
    }
  });
  const safeKeys = new Set<string>();
  points.forEach((point) => {
    const key = buildReplayIdentityKey(point);
    const sourceKey = readExactNonEmptyString(point.sourceKey);
    const pointKey = readExactNonEmptyString(point.pointKey);
    const tagName = readExactNonEmptyString(point.tagName);
    const globalPointKey = `${sourceKey}:${pointKey}`;
    const sourceSequence = point.sourceSequence;
    const scanCycleId = readExactNonEmptyString(point.scanCycleId);
    const bootId = readExactNonEmptyString(point.bootId);
    const observedAt = readExactNonEmptyString(point.observedAt);
    const observedAtMs = Date.parse(observedAt);
    if (
      !key
      || pointKey !== tagName
      || identityKeyCounts.get(key) !== 1
      || pointKeyCounts.get(globalPointKey) !== 1
      || typeof sourceSequence !== "number"
      || !Number.isSafeInteger(sourceSequence)
      || sourceSequence < 0
      || !scanCycleId
      || !bootId
      || !Number.isFinite(observedAtMs)
    ) {
      return;
    }
    const valueFingerprint = JSON.stringify({
      value: point.value ?? null,
      qualityCode: point.qualityCode ?? null,
      timestampBasis: point.timestampBasis ?? null,
      authoritativeTimestamp: point.authoritativeTimestamp ?? null,
      deviceId: point.deviceId ?? null,
      tagName: point.tagName ?? null
    });
    const current: RuntimeReplayHistoryEntry = {
      sourceSequence,
      scanCycleId,
      bootId,
      seenBootIds: [bootId],
      observedAt,
      observedAtMs,
      valueFingerprint
    };
    const previous = history.get(key);
    const sameSample = previous !== undefined
      && previous.bootId === bootId
      && previous.sourceSequence === sourceSequence
      && previous.scanCycleId === scanCycleId
      && previous.observedAt === observedAt
      && previous.valueFingerprint === valueFingerprint;
    const newerSameBoot = previous !== undefined
      && previous.bootId === bootId
      && sourceSequence > previous.sourceSequence
      && scanCycleId !== previous.scanCycleId
      && observedAtMs >= previous.observedAtMs;
    const newerBoot = previous !== undefined
      && previous.bootId !== bootId
      && !previous.seenBootIds.includes(bootId)
      && observedAtMs > previous.observedAtMs;
    if (!previous || sameSample || newerSameBoot || newerBoot) {
      safeKeys.add(key);
      if (!previous || newerSameBoot || newerBoot) {
        history.set(key, {
          ...current,
          seenBootIds: previous
            ? [...new Set([...previous.seenBootIds, bootId])]
            : [bootId]
        });
      }
    }
  });
  return safeKeys;
}

function findUniqueExactTagPoint(
  points: RuntimePointEvidenceItemDto[],
  deviceId: string,
  tagName: string | null | undefined
): RuntimePointEvidenceItemDto | null {
  const exactTagName = readExactNonEmptyString(tagName);
  const exactDeviceId = readExactNonEmptyString(deviceId);
  if (!exactTagName || !exactDeviceId) {
    return null;
  }
  const matches = points.filter((point) => (
    readExactNonEmptyString(point.deviceId) === exactDeviceId
    && readExactNonEmptyString(point.tagName) === exactTagName
  ));
  return matches.length === 1 ? matches[0] : null;
}

function isAuthoritativeFreshPoint(
  point: RuntimePointEvidenceItemDto | null,
  nowMs: number,
  liveMaxAgeMs: number,
  maxFutureSkewMs: number,
  replaySafePointKeys: Set<string>
): point is RuntimePointEvidenceItemDto {
  const exactObservedAt = readExactNonEmptyString(point?.observedAt);
  if (
    !point
    || !readExactNonEmptyString(point.pointKey)
    || readExactNonEmptyString(point.pointKey) !== readExactNonEmptyString(point.tagName)
    || point.sourceKey !== RUNTIME_SOURCE_KEY
    || (!readExactNonEmptyString(point.tagName) && !readExactNonEmptyString(point.regId))
    || point.qualityCode !== "GOOD"
    || point.authoritativeTimestamp !== true
    || !replaySafePointKeys.has(buildReplayIdentityKey(point))
    || !AUTHORITATIVE_TIMESTAMP_BASES.has(readExactNonEmptyString(point.timestampBasis))
    || !exactObservedAt
  ) {
    return false;
  }
  const observedAtMs = Date.parse(exactObservedAt);
  if (!Number.isFinite(observedAtMs)) {
    return false;
  }
  const ageMs = nowMs - observedAtMs;
  return ageMs >= -maxFutureSkewMs && ageMs <= liveMaxAgeMs;
}

function readStrictBinaryValue(value: RuntimePointEvidenceItemDto["value"]): boolean | null {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "number") {
    return value === 1 ? true : value === 0 ? false : null;
  }
  if (typeof value !== "string") {
    return null;
  }
  return value === "1" ? true : value === "0" ? false : null;
}

function readFinitePointNumber(value: RuntimePointEvidenceItemDto["value"]): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function readFrequencyHz(value: RuntimePointEvidenceItemDto["value"]): number | null {
  const frequencyHz = readFinitePointNumber(value);
  return frequencyHz !== null && frequencyHz >= 0 && frequencyHz <= 60 ? frequencyHz : null;
}

function findUniqueExactSemanticPoint(
  points: RuntimePointEvidenceItemDto[],
  deviceId: string,
  semanticKeys: readonly string[]
): RuntimePointEvidenceItemDto | null {
  const exactDeviceId = readExactNonEmptyString(deviceId);
  if (!exactDeviceId) {
    return null;
  }
  const acceptedSemanticKeys = new Set(semanticKeys);
  const matches = points.filter((point) => {
    const tagName = readExactNonEmptyString(point.tagName);
    return readExactNonEmptyString(point.deviceId) === exactDeviceId
      && acceptedSemanticKeys.has(readExactNonEmptyString(point.semanticKey))
      && Boolean(tagName)
      && readExactNonEmptyString(point.pointKey) === tagName;
  });
  return matches.length === 1 ? matches[0] : null;
}

export function resolvePlantOverviewEquipmentMetrics(
  summary: RuntimePointSummaryDto | null,
  selection: PlantOverviewEquipmentSelection | null
): PlantOverviewEquipmentMetric[] {
  if (!selection) {
    return [];
  }
  const points = Array.isArray(summary?.pointEvidence?.points) ? summary.pointEvidence.points : [];
  const globallyUniquePointKeys = buildGloballyUniquePointKeys(points);
  const shadowSourceReadable = isRuntimeSourceReadOnlyHealthy(summary)
    && isShadowTransportFresh(summary, Date.now());
  const resolveMetric = (
    key: PlantOverviewEquipmentMetric["key"],
    label: string,
    unit: PlantOverviewEquipmentMetric["unit"],
    semanticKeys: readonly string[],
    exactTagName: string | null = null
  ): PlantOverviewEquipmentMetric => {
    const point = exactTagName
      ? findUniqueExactTagPoint(points, selection.deviceId, exactTagName)
      : findUniqueExactSemanticPoint(points, selection.deviceId, semanticKeys);
    const pointIdentityUnique = Boolean(point)
      && globallyUniquePointKeys.has(`${readExactNonEmptyString(point?.sourceKey)}:${readExactNonEmptyString(point?.pointKey)}`);
    const rawValue = pointIdentityUnique
      ? key === "frequencyHz" ? readFrequencyHz(point?.value) : readFinitePointNumber(point?.value)
      : null;
    const value = key === "loadPercent" && rawValue !== null
      ? rawValue >= 0 && rawValue <= 100 ? rawValue : null
      : rawValue;
    const evidenceMode: PlantOverviewMetricEvidenceMode = !point || value === null
      ? "unbound"
      : shadowSourceReadable && isShadowReadablePoint(point, globallyUniquePointKeys)
        ? "shadow"
        : "stale";
    return {
      key,
      label,
      value,
      unit,
      evidenceMode,
      pointKey: point ? readExactNonEmptyString(point.pointKey) || null : null,
      observedAt: point ? readExactNonEmptyString(point.observedAt) || null : null
    };
  };

  if (selection.runtimeGroup === "chillers") {
    return [
      resolveMetric(
        "loadPercent",
        "负荷率",
        "%",
        ["loadPercent", "loadPct", "currentPercent"],
        selection.loadPercentTagName
      ),
      resolveMetric("powerKw", "功率", "kW", ["powerKw"])
    ];
  }
  return [
    resolveMetric("frequencyHz", "运行频率", "Hz", ["frequencyHz"], selection.frequencyTagName),
    resolveMetric("powerKw", "功率", "kW", ["powerKw"]),
    resolveMetric("flowM3h", "流量", "m³/h", ["flowM3h"])
  ];
}

function buildPlantOverviewEquipmentSelection(
  equipmentId: string,
  binding: ResolvedBinding | null,
  decision: RuntimeEquipmentStateDecision | null
): PlantOverviewEquipmentSelection | null {
  if (!binding || !binding.runtimeGroup) {
    return null;
  }
  const fallbackDecision: RuntimeEquipmentStateDecision = {
    equipmentId,
    runtimeId: binding.runtimeId,
    state: "unknown",
    evidenceMode: "unbound",
    authority: "none",
    reason: "exact_state_binding_or_point_evidence_unavailable",
    running: null,
    faultActive: null,
    remoteEnabled: null
  };
  const resolvedDecision = decision || fallbackDecision;
  return {
    equipmentId,
    runtimeId: binding.runtimeId,
    deviceId: binding.deviceId,
    runtimeGroup: binding.runtimeGroup,
    groupLabel: EQUIPMENT_GROUP_LABELS[binding.runtimeGroup],
    state: resolvedDecision.state,
    stateLabel: EQUIPMENT_STATE_LABELS[resolvedDecision.state],
    evidenceMode: resolvedDecision.evidenceMode,
    authority: resolvedDecision.authority,
    reason: resolvedDecision.reason,
    frequencyTagName: binding.runtimeSignals?.frequencyTagName || null,
    loadPercentTagName: binding.runtimeSignals?.loadPercentTagName || null
  };
}

function resolveEquipmentMotionClipName(binding: ResolvedBinding): string | null {
  if (binding.runtimeGroup === "coolingTowers") {
    return `ACT_ANIM_FAN_${binding.equipmentId}`;
  }
  if (binding.runtimeGroup === "chilledPumps" || binding.runtimeGroup === "coolingPumps") {
    return `ACT_ANIM_SHAFT_${binding.equipmentId}`;
  }
  return null;
}

type OperationalStateResolution = {
  state: EquipmentOperationalState;
  reason: string;
  requiredSignals: Array<"running" | "faultActive" | "remoteEnabled">;
};

function resolveEquipmentOperationalState(
  running: boolean | null,
  faultActive: boolean | null,
  remoteEnabled: boolean | null,
  readable: { running: boolean; faultActive: boolean; remoteEnabled: boolean }
): OperationalStateResolution {
  if (!readable.faultActive || faultActive === null) {
    return { state: "unknown", reason: "explicit_fault_signal_unavailable", requiredSignals: [] };
  }
  if (faultActive === true) {
    return { state: "fault", reason: "explicit_fault_signal_active", requiredSignals: ["faultActive"] };
  }
  if (!readable.running || running === null) {
    return { state: "unknown", reason: "explicit_running_signal_unavailable", requiredSignals: [] };
  }
  if (running === true) {
    return {
      state: "running",
      reason: "explicit_running_signal_active_and_fault_clear",
      requiredSignals: ["faultActive", "running"]
    };
  }
  if (!readable.remoteEnabled || remoteEnabled === null) {
    return { state: "unknown", reason: "explicit_remote_signal_unavailable", requiredSignals: [] };
  }
  if (remoteEnabled === true) {
    return {
      state: "standby",
      reason: "stopped_fault_clear_and_remote_enabled",
      requiredSignals: ["faultActive", "running", "remoteEnabled"]
    };
  }
  return {
    state: "stopped",
    reason: "stopped_fault_clear_and_remote_disabled",
    requiredSignals: ["faultActive", "running", "remoteEnabled"]
  };
}

function requiredStatePointsShareSnapshot(
  resolution: OperationalStateResolution,
  points: Record<"running" | "faultActive" | "remoteEnabled", RuntimePointEvidenceItemDto | null>
): boolean {
  if (resolution.state === "unknown" || resolution.requiredSignals.length === 0) {
    return false;
  }
  const requiredPoints = resolution.requiredSignals.map((signal) => points[signal]);
  const bootIds = requiredPoints.map((point) => String(point?.bootId || "").trim());
  const scanCycleIds = requiredPoints.map((point) => String(point?.scanCycleId || "").trim());
  return bootIds.every(Boolean)
    && scanCycleIds.every(Boolean)
    && new Set(bootIds).size === 1
    && new Set(scanCycleIds).size === 1;
}

function buildRuntimeAnimationPlan(
  summary: RuntimePointSummaryDto | null,
  identityBindings: ResolvedBinding[],
  nowMs: number,
  replaySafePointKeys: Set<string>
): RuntimeAnimationPlan {
  const decisionsByClipName = new Map<string, RuntimeClipDecision>();
  const equipmentStatesByEquipmentId = new Map<string, RuntimeEquipmentStateDecision>();
  const points = Array.isArray(summary?.pointEvidence?.points) ? summary.pointEvidence.points : [];
  const globallyUniquePointKeys = buildGloballyUniquePointKeys(points);
  const freshnessPolicyValid = isValidFreshnessPolicy(summary);
  const liveMaxAgeMs = freshnessPolicyValid
    ? Number(summary?.freshnessPolicy?.liveMaxAgeMs)
    : 0;
  const maxFutureSkewMs = freshnessPolicyValid
    ? Number(summary?.freshnessPolicy?.maxFutureSkewMs)
    : 0;
  const sourceReadOnlyHealthy = isRuntimeSourceReadOnlyHealthy(summary)
    && isShadowTransportFresh(summary, nowMs);
  const sourceAuthoritativeHealthy = isRuntimeSourceHealthy(summary) && freshnessPolicyValid;
  let liveEquipmentCount = 0;
  let shadowReadableEquipmentCount = 0;
  let playingEquipmentCount = 0;
  let playingLiveEquipmentCount = 0;
  let playingShadowEquipmentCount = 0;
  let liveEquipmentStateCount = 0;
  let shadowEquipmentStateCount = 0;

  EXPECTED_CORE_EQUIPMENT_IDS.forEach((equipmentId) => {
    equipmentStatesByEquipmentId.set(equipmentId, {
      equipmentId,
      runtimeId: equipmentId,
      state: "unknown",
      evidenceMode: summary ? "stale" : "unbound",
      authority: "none",
      reason: summary ? "exact_state_binding_or_point_evidence_unavailable" : "runtime_summary_unbound",
      running: null,
      faultActive: null,
      remoteEnabled: null
    });
  });

  identityBindings.forEach((binding) => {
    const clipName = resolveEquipmentMotionClipName(binding);
    const requiresFrequency = EQUIPMENT_MOTION_GROUPS.has(binding.runtimeGroup);
    const runtimeSignals = binding.runtimeSignals;
    const signalIdentityExact = runtimeSignals?.selectorStatus === "POINT_TABLE_DERIVED_READ_ONLY"
      && runtimeSignals.selectorReadOnly === true
      && runtimeSignals.selectorConfidence === "point_table_exact_read_only"
      && runtimeSignals.transportAliasStatus === "REVIEWED_EXACT_TRANSPORT_ALIAS";
    const runningPoint = findUniqueExactTagPoint(points, binding.deviceId, runtimeSignals?.runningTagName);
    const faultPoint = findUniqueExactTagPoint(points, binding.deviceId, runtimeSignals?.faultTagName);
    const remoteEnabledPoint = findUniqueExactTagPoint(
      points,
      binding.deviceId,
      runtimeSignals?.remoteEnabledTagName
    );
    const frequencyPoint = requiresFrequency
      ? findUniqueExactTagPoint(points, binding.deviceId, runtimeSignals?.frequencyTagName)
      : null;
    const running = readStrictBinaryValue(runningPoint?.value);
    const faultActive = readStrictBinaryValue(faultPoint?.value);
    const remoteEnabled = readStrictBinaryValue(remoteEnabledPoint?.value);
    const rawFrequency = readFrequencyHz(frequencyPoint?.value);
    const frequencyHz = rawFrequency;
    const frequencyUnitExact = !requiresFrequency || frequencyPoint?.unit === "Hz";
    const pairedSnapshotExact = !requiresFrequency
      || (
        Boolean(runningPoint?.bootId)
        && runningPoint?.bootId === frequencyPoint?.bootId
        && Boolean(runningPoint?.scanCycleId)
        && runningPoint?.scanCycleId === frequencyPoint?.scanCycleId
      );
    const shadowEnvelopeReceivedAt = readExactNonEmptyString(summary?.pointEvidence?.receivedAt);
    const runningReceivedAt = readExactNonEmptyString(runningPoint?.receivedAt);
    const frequencyReceivedAt = readExactNonEmptyString(frequencyPoint?.receivedAt);
    const replayPairFields = [
      readExactNonEmptyString(runningPoint?.bootId),
      readExactNonEmptyString(runningPoint?.scanCycleId),
      readExactNonEmptyString(frequencyPoint?.bootId),
      readExactNonEmptyString(frequencyPoint?.scanCycleId)
    ];
    const replayPairIdentityPresent = replayPairFields.some(Boolean);
    const replayPairIdentityComplete = replayPairFields.every(Boolean);
    const pairedShadowSnapshotExact = !requiresFrequency
      || (
        Boolean(shadowEnvelopeReceivedAt)
        && runningReceivedAt === shadowEnvelopeReceivedAt
        && frequencyReceivedAt === shadowEnvelopeReceivedAt
        && (
          !replayPairIdentityPresent
          || (replayPairIdentityComplete && pairedSnapshotExact)
        )
      );
    const shadowReadable = sourceReadOnlyHealthy
      && signalIdentityExact
      && isShadowReadablePoint(runningPoint, globallyUniquePointKeys)
      && running !== null
      && (
        !requiresFrequency
        || (
          isShadowReadablePoint(frequencyPoint, globallyUniquePointKeys)
          && frequencyHz !== null
          && frequencyUnitExact
          && pairedShadowSnapshotExact
        )
      );
    const evidenceLive = sourceAuthoritativeHealthy
      && signalIdentityExact
      && isAuthoritativeFreshPoint(runningPoint, nowMs, liveMaxAgeMs, maxFutureSkewMs, replaySafePointKeys)
      && running !== null
      && (
        !requiresFrequency
        || (
          isAuthoritativeFreshPoint(frequencyPoint, nowMs, liveMaxAgeMs, maxFutureSkewMs, replaySafePointKeys)
          && frequencyHz !== null
          && frequencyUnitExact
          && pairedSnapshotExact
        )
      );

    const statePoints = { running: runningPoint, faultActive: faultPoint, remoteEnabled: remoteEnabledPoint };
    const shadowStateReadable = {
      running: sourceReadOnlyHealthy
        && signalIdentityExact
        && isShadowReadablePoint(runningPoint, globallyUniquePointKeys)
        && running !== null,
      faultActive: sourceReadOnlyHealthy
        && signalIdentityExact
        && isShadowReadablePoint(faultPoint, globallyUniquePointKeys)
        && faultActive !== null,
      remoteEnabled: sourceReadOnlyHealthy
        && signalIdentityExact
        && isShadowReadablePoint(remoteEnabledPoint, globallyUniquePointKeys)
        && remoteEnabled !== null
    };
    const liveStateReadable = {
      running: sourceAuthoritativeHealthy
        && signalIdentityExact
        && isAuthoritativeFreshPoint(runningPoint, nowMs, liveMaxAgeMs, maxFutureSkewMs, replaySafePointKeys)
        && running !== null,
      faultActive: sourceAuthoritativeHealthy
        && signalIdentityExact
        && isAuthoritativeFreshPoint(faultPoint, nowMs, liveMaxAgeMs, maxFutureSkewMs, replaySafePointKeys)
        && faultActive !== null,
      remoteEnabled: sourceAuthoritativeHealthy
        && signalIdentityExact
        && isAuthoritativeFreshPoint(remoteEnabledPoint, nowMs, liveMaxAgeMs, maxFutureSkewMs, replaySafePointKeys)
        && remoteEnabled !== null
    };
    let stateResolution = resolveEquipmentOperationalState(
      running,
      faultActive,
      remoteEnabled,
      liveStateReadable
    );
    let stateEvidenceMode: EquipmentStateEvidenceMode = "live";
    if (
      stateResolution.state === "unknown"
      || !requiredStatePointsShareSnapshot(stateResolution, statePoints)
    ) {
      stateResolution = resolveEquipmentOperationalState(
        running,
        faultActive,
        remoteEnabled,
        shadowStateReadable
      );
      stateEvidenceMode = stateResolution.state === "unknown"
        ? summary ? "stale" : "unbound"
        : "shadow";
    }
    const stateAuthority = stateEvidenceMode === "live"
      ? "authoritative-live"
      : stateEvidenceMode === "shadow"
        ? "unverified-shadow"
        : "none";
    equipmentStatesByEquipmentId.set(binding.equipmentId, {
      equipmentId: binding.equipmentId,
      runtimeId: binding.runtimeId,
      state: stateResolution.state,
      evidenceMode: stateEvidenceMode,
      authority: stateAuthority,
      reason: stateResolution.reason,
      running,
      faultActive,
      remoteEnabled
    });
    if (stateEvidenceMode === "live" && stateResolution.state !== "unknown") {
      liveEquipmentStateCount += 1;
    } else if (stateEvidenceMode === "shadow" && stateResolution.state !== "unknown") {
      shadowEquipmentStateCount += 1;
    }
    const driveMode: RuntimeDriveMode = evidenceLive
      ? "live"
      : shadowReadable
        ? "shadow"
        : "paused";
    const motionEnabled = Boolean(clipName)
      && driveMode !== "paused"
      && stateResolution.state === "running"
      && running === true
      && frequencyHz !== null
      && frequencyHz > 0;
    const playbackRate = frequencyHz === null
      ? 0
      : Math.max(0.1, Math.min(1.2, frequencyHz / 50));
    if (clipName) {
      decisionsByClipName.set(clipName, {
        evidenceLive,
        shadowReadable,
        driveMode,
        motionEnabled,
        playbackRate
      });
    }
    if (evidenceLive) {
      liveEquipmentCount += 1;
    }
    if (shadowReadable) {
      shadowReadableEquipmentCount += 1;
    }
    if (motionEnabled) {
      playingEquipmentCount += 1;
      if (driveMode === "live") {
        playingLiveEquipmentCount += 1;
      } else if (driveMode === "shadow") {
        playingShadowEquipmentCount += 1;
      }
    }
  });

  const expectedEquipmentCount = EXPECTED_CORE_EQUIPMENT_IDS.length;
  const evidenceState: RuntimeEvidenceState = !summary
    ? "UNBOUND"
    : expectedEquipmentCount > 0 && liveEquipmentCount === expectedEquipmentCount
      ? "LIVE"
      : "STALE";
  const signature = [...decisionsByClipName.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([clipName, decision]) => (
      `${clipName}:${decision.driveMode}:${decision.motionEnabled ? 1 : 0}:${decision.playbackRate.toFixed(3)}`
    ))
    .join("|");
  const stateSignature = [...equipmentStatesByEquipmentId.values()]
    .sort((left, right) => left.equipmentId.localeCompare(right.equipmentId))
    .map((decision) => `${decision.equipmentId}:${decision.state}:${decision.evidenceMode}`)
    .join("|");
  const equipmentStateCounts: EquipmentStateCounts = {
    running: 0,
    fault: 0,
    stopped: 0,
    standby: 0,
    unknown: 0
  };
  equipmentStatesByEquipmentId.forEach((decision) => {
    equipmentStateCounts[decision.state] += 1;
  });

  return {
    decisionsByClipName,
    equipmentStatesByEquipmentId,
    equipmentStateCounts,
    liveEquipmentStateCount,
    shadowEquipmentStateCount,
    readableEquipmentStateCount: liveEquipmentStateCount + shadowEquipmentStateCount,
    signature: `${evidenceState}|motion:${signature}|state:${stateSignature}`,
    evidenceState,
    liveEquipmentCount,
    shadowReadableEquipmentCount,
    expectedEquipmentCount,
    playingEquipmentCount,
    playingLiveEquipmentCount,
    playingShadowEquipmentCount
  };
}

export function resolvePlantOverviewRuntimeSnapshot(
  summary: RuntimePointSummaryDto | null,
  bindingContract: unknown,
  expectedBindingCount: number,
  nowMs: number,
  replayHistory: Map<string, RuntimeReplayHistoryEntry>
): PlantOverviewRuntimeSnapshot {
  const identityBindings = resolveVerifiedIdentityBindings(
    bindingContract as BindingContract | null,
    expectedBindingCount
  );
  const replaySafePointKeys = buildReplaySafePointKeys(summary, replayHistory);
  const runtimePlan = buildRuntimeAnimationPlan(
    summary,
    identityBindings || [],
    nowMs,
    replaySafePointKeys
  );
  const equipmentById = new Map<string, PlantOverviewRuntimeEquipmentView>();

  (identityBindings || []).forEach((binding) => {
    const decision = runtimePlan.equipmentStatesByEquipmentId.get(binding.equipmentId) || null;
    const selection = buildPlantOverviewEquipmentSelection(binding.equipmentId, binding, decision);
    if (!selection) {
      return;
    }
    const clipName = resolveEquipmentMotionClipName(binding);
    const clipDecision = clipName ? runtimePlan.decisionsByClipName.get(clipName) : null;
    equipmentById.set(binding.equipmentId, {
      selection,
      metrics: resolvePlantOverviewEquipmentMetrics(summary, selection),
      motionEnabled: clipDecision?.motionEnabled === true,
      playbackRate: clipDecision?.playbackRate || 0
    });
  });

  return {
    identityVerified: identityBindings !== null,
    evidenceState: runtimePlan.evidenceState,
    equipmentById,
    stateCounts: runtimePlan.equipmentStateCounts,
    readableEquipmentStateCount: runtimePlan.readableEquipmentStateCount,
    liveEquipmentStateCount: runtimePlan.liveEquipmentStateCount,
    shadowEquipmentStateCount: runtimePlan.shadowEquipmentStateCount,
    expectedEquipmentCount: runtimePlan.expectedEquipmentCount
  };
}

function resolveLodPath(item: ManifestItem, level: LodLevel): string | null {
  if (level === "LOD0") {
    return item.lodPaths?.LOD0 || item.targetPath || null;
  }
  return item.lodPaths?.[level] || null;
}

function resolveDesiredLod(item: ManifestItem, distance: number): LodLevel {
  const lod0Max = item.lodDistanceMeters?.LOD0Max ?? 25;
  const lod1Max = item.lodDistanceMeters?.LOD1Max ?? 60;
  if (distance <= lod0Max) {
    return "LOD0";
  }
  if (distance <= lod1Max) {
    return "LOD1";
  }
  return "LOD2";
}

function findEquipmentId(object: Object3D | null): string | null {
  let current = object;
  while (current) {
    const equipmentId = current.userData?.equipment_id;
    if (typeof equipmentId === "string" && equipmentId.trim()) {
      return equipmentId.trim();
    }
    current = current.parent;
  }
  return null;
}

function countRuntimeTargets(root: Object3D): number {
  let count = 0;
  root.traverse((object) => {
    if (object.userData?.runtime_animation_target === true) {
      count += 1;
    }
  });
  return count;
}

function setActionRuntime(
  action: AnimationAction | undefined,
  motionEnabled: boolean,
  playbackRate: number
) {
  if (!action) {
    return;
  }
  action.enabled = true;
  if (!motionEnabled) {
    action.paused = true;
    action.timeScale = 0;
    return;
  }
  action.paused = false;
  action.timeScale = playbackRate;
}

function createStatusGlyphTexture(
  state: EquipmentOperationalState,
  evidenceMode: EquipmentStateEvidenceMode
): CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const context = canvas.getContext("2d");
  if (!context) {
    return new CanvasTexture(canvas);
  }
  const color = `#${EQUIPMENT_STATE_COLORS[state].toString(16).padStart(6, "0")}`;
  const isShadow = evidenceMode === "shadow";
  context.clearRect(0, 0, 128, 128);
  context.strokeStyle = color;
  context.fillStyle = color;
  context.lineWidth = isShadow ? 8 : 6;
  context.lineCap = "round";
  context.lineJoin = "round";
  context.shadowColor = color;
  context.shadowBlur = isShadow ? 0 : 14;
  context.setLineDash(isShadow ? [10, 8] : []);

  if (state === "running") {
    context.beginPath();
    context.moveTo(39, 27);
    context.lineTo(98, 64);
    context.lineTo(39, 101);
    context.closePath();
    if (!isShadow) context.fill();
    context.stroke();
  } else if (state === "fault") {
    context.beginPath();
    context.moveTo(64, 18);
    context.lineTo(108, 103);
    context.lineTo(20, 103);
    context.closePath();
    if (!isShadow) {
      context.globalAlpha = 0.28;
      context.fill();
      context.globalAlpha = 1;
    }
    context.stroke();
    context.setLineDash([]);
    context.font = "900 62px system-ui, sans-serif";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText("!", 64, 74);
  } else if (state === "standby") {
    if (isShadow) {
      context.strokeRect(35, 27, 18, 74);
      context.strokeRect(75, 27, 18, 74);
    } else {
      context.fillRect(35, 27, 18, 74);
      context.fillRect(75, 27, 18, 74);
    }
  } else if (state === "stopped") {
    if (isShadow) context.strokeRect(31, 31, 66, 66);
    else context.fillRect(31, 31, 66, 66);
  } else {
    context.setLineDash([]);
    context.font = `900 ${isShadow ? 76 : 82}px system-ui, sans-serif`;
    context.textAlign = "center";
    context.textBaseline = "middle";
    if (isShadow) context.strokeText("?", 64, 66);
    else context.fillText("?", 64, 66);
  }

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function addStatusBand(
  group: Group,
  material: MeshBasicMaterial,
  width: number,
  depth: number,
  x: number,
  z: number
): void {
  const band = new Mesh(new BoxGeometry(width, 0.035, depth), material);
  band.position.set(x, 0, z);
  band.renderOrder = 14;
  group.add(band);
}

function normalizeRuntimeTintMaterialName(name: string): string {
  return name
    .replace(/__RUNTIME_TINT_.+$/i, "")
    .replace(/\.\d{3}$/i, "")
    .trim()
    .toUpperCase();
}

function createRuntimeEquipmentBodyTints(model: Object3D): Map<string, RuntimeEquipmentBodyTint> {
  const bodyTints = new Map<string, RuntimeEquipmentBodyTint>();
  model.traverse((object) => {
    const isReviewedLatestModel = object.userData?.shared_latest_model === true
      || object.name.toUpperCase().endsWith("__LATEST_MODEL");
    if (!isReviewedLatestModel) {
      return;
    }
    const equipmentId = normalizeId(
      typeof object.userData?.equipment_id === "string" ? object.userData.equipment_id : ""
    );
    const assetKey = String(object.userData?.asset_key || "").trim().toLowerCase();
    if (
      !EXPECTED_CORE_EQUIPMENT_ID_SET.has(equipmentId)
      || (assetKey !== "chiller" && assetKey !== "pump" && assetKey !== "tower")
    ) {
      return;
    }

    const eligibleMaterialNames = EQUIPMENT_BODY_TINT_MATERIALS[assetKey];
    const materialTargets: RuntimeBodyTintMaterialTarget[] = [];
    // Blender/glTF can expand one reviewed multi-material equipment node into a
    // metadata-bearing parent plus material-bearing child meshes. Inherit the
    // reviewed equipment identity from that parent and tint only allowlisted
    // painted materials below it.
    object.traverse((candidate) => {
      const meshObject = candidate as Mesh & {
        geometry?: unknown;
        material?: Mesh["material"];
      };
      // Structural mesh detection remains stable across bundled Three.js module
      // instances while the material-name allowlist constrains mutation scope.
      if (!meshObject.geometry || !meshObject.material) {
        return;
      }
      const sourceMaterials = Array.isArray(meshObject.material) ? meshObject.material : [meshObject.material];
      const runtimeMaterials = sourceMaterials.map((sourceMaterial) => {
        const sourcePbrMaterial = sourceMaterial as MeshStandardMaterial & {
          isMeshStandardMaterial?: boolean;
          isMeshPhysicalMaterial?: boolean;
        };
        const isPbrMaterial = sourcePbrMaterial.isMeshStandardMaterial === true
          || sourcePbrMaterial.isMeshPhysicalMaterial === true
          || (
            sourcePbrMaterial.color?.isColor === true
            && sourcePbrMaterial.emissive?.isColor === true
            && typeof sourcePbrMaterial.clone === "function"
          );
        if (
          !isPbrMaterial
          || !eligibleMaterialNames.has(normalizeRuntimeTintMaterialName(sourceMaterial.name))
        ) {
          return sourceMaterial;
        }
        const runtimeMaterial = sourcePbrMaterial.clone();
        runtimeMaterial.name = `${sourceMaterial.name}__RUNTIME_TINT_${equipmentId}`;
        runtimeMaterial.userData = {
          ...sourceMaterial.userData,
          runtime_body_tint: true,
          runtime_body_tint_equipment_id: equipmentId,
          runtime_body_tint_source_material: sourceMaterial.name,
          runtime_body_tint_scope: "painted-shell-only"
        };
        materialTargets.push({
          material: runtimeMaterial,
          baseColor: sourcePbrMaterial.color.clone(),
          baseEmissive: sourcePbrMaterial.emissive.clone(),
          baseEmissiveIntensity: sourcePbrMaterial.emissiveIntensity,
          renderedEmissiveIntensity: sourcePbrMaterial.emissiveIntensity
        });
        return runtimeMaterial;
      });
      meshObject.material = Array.isArray(meshObject.material) ? runtimeMaterials : runtimeMaterials[0];
    });
    if (materialTargets.length === 0) {
      return;
    }
    const existing = bodyTints.get(equipmentId);
    if (existing) {
      existing.materials.push(...materialTargets);
      return;
    }
    bodyTints.set(equipmentId, {
      equipmentId,
      assetKey,
      materials: materialTargets,
      state: "unknown",
      evidenceMode: "unbound"
    });
  });
  return bodyTints;
}

function createRuntimeStatusMarkers(root: Group, model: Object3D): Map<string, RuntimeStatusMarker> {
  root.updateMatrixWorld(true);
  const equipmentBounds = new Map<string, Box3>();
  model.traverse((object) => {
    const equipmentId = normalizeId(
      typeof object.userData?.equipment_id === "string" ? object.userData.equipment_id : ""
    );
    if (!EXPECTED_CORE_EQUIPMENT_ID_SET.has(equipmentId)) {
      return;
    }
    const objectBounds = new Box3().setFromObject(object);
    if (objectBounds.isEmpty()) {
      return;
    }
    const existing = equipmentBounds.get(equipmentId);
    if (existing) {
      existing.union(objectBounds);
    } else {
      equipmentBounds.set(equipmentId, objectBounds.clone());
    }
  });

  const markers = new Map<string, RuntimeStatusMarker>();
  EXPECTED_CORE_EQUIPMENT_IDS.forEach((equipmentId) => {
    const bounds = equipmentBounds.get(equipmentId);
    if (!bounds || bounds.isEmpty()) {
      return;
    }
    const size = bounds.getSize(new Vector3());
    const center = bounds.getCenter(new Vector3());
    const frameWidth = Math.max(0.5, size.x + 0.18);
    const frameDepth = Math.max(0.5, size.z + 0.18);
    const bandThickness = Math.max(0.035, Math.min(0.075, Math.min(frameWidth, frameDepth) * 0.035));
    const baseLightbandMaterial = new MeshBasicMaterial({
      color: EQUIPMENT_STATE_COLORS.unknown,
      transparent: true,
      opacity: 0.52,
      depthTest: true,
      depthWrite: false,
      toneMapped: false
    });
    const cornerFrameMaterial = new MeshBasicMaterial({
      color: EQUIPMENT_STATE_COLORS.unknown,
      transparent: true,
      opacity: 0.66,
      depthTest: true,
      depthWrite: false,
      toneMapped: false
    });

    const baseLightband = new Group();
    baseLightband.name = `BASE_LIGHTBAND_${equipmentId}`;
    addStatusBand(baseLightband, baseLightbandMaterial, frameWidth, bandThickness, 0, frameDepth / 2);
    addStatusBand(baseLightband, baseLightbandMaterial, frameWidth, bandThickness, 0, -frameDepth / 2);
    addStatusBand(baseLightband, baseLightbandMaterial, bandThickness, frameDepth, frameWidth / 2, 0);
    addStatusBand(baseLightband, baseLightbandMaterial, bandThickness, frameDepth, -frameWidth / 2, 0);

    const cornerFrame = new Group();
    cornerFrame.name = `SHADOW_CORNER_FRAME_${equipmentId}`;
    const cornerLengthX = Math.max(0.14, Math.min(frameWidth * 0.24, 0.52));
    const cornerLengthZ = Math.max(0.14, Math.min(frameDepth * 0.24, 0.52));
    for (const xSign of [-1, 1]) {
      for (const zSign of [-1, 1]) {
        addStatusBand(
          cornerFrame,
          cornerFrameMaterial,
          cornerLengthX,
          bandThickness,
          xSign * (frameWidth / 2 - cornerLengthX / 2),
          zSign * frameDepth / 2
        );
        addStatusBand(
          cornerFrame,
          cornerFrameMaterial,
          bandThickness,
          cornerLengthZ,
          xSign * frameWidth / 2,
          zSign * (frameDepth / 2 - cornerLengthZ / 2)
        );
      }
    }

    const badgeMaterial = new SpriteMaterial({
      map: createStatusGlyphTexture("unknown", "unbound"),
      transparent: true,
      opacity: 0.72,
      depthTest: false,
      depthWrite: false,
      toneMapped: false
    });
    const badge = new Sprite(badgeMaterial);
    const badgeScale = Math.max(0.42, Math.min(0.8, Math.max(frameWidth, frameDepth) * 0.18));
    badge.position.set(frameWidth / 2 + badgeScale * 0.3, Math.max(0.62, size.y + 0.28), frameDepth / 2);
    badge.scale.set(badgeScale, badgeScale, 1);
    badge.renderOrder = 21;
    badge.userData.equipment_id = equipmentId;
    badge.userData.runtime_status_shape = EQUIPMENT_STATE_SHAPES.unknown.contract;

    const markerRoot = new Group();
    markerRoot.name = `RUNTIME_STATUS_${equipmentId}`;
    markerRoot.position.set(center.x, bounds.min.y + 0.045, center.z);
    markerRoot.userData.equipment_id = equipmentId;
    markerRoot.userData.runtime_status_marker = true;
    markerRoot.userData.status_visual = "base-lightband-corner-frame-v1";
    markerRoot.userData.exclude_from_camera_fit = true;
    markerRoot.add(baseLightband, cornerFrame, badge);
    markerRoot.visible = false;
    root.add(markerRoot);
    markers.set(equipmentId, {
      root: markerRoot,
      baseLightband,
      cornerFrame,
      badge,
      baseLightbandMaterial,
      cornerFrameMaterial,
      badgeMaterial,
      baseBadgeScale: badgeScale,
      renderedBadgeScale: badgeScale,
      state: "unknown",
      evidenceMode: "unbound",
      renderedBaseLightbandOpacity: 0,
      renderedCornerFrameOpacity: 0
    });
  });
  return markers;
}

function applyEquipmentStatusFilter(
  loaded: LoadedLod,
  runtimePlan: RuntimeAnimationPlan,
  visualContext: EquipmentStatusVisualContext
): void {
  loaded.statusMarkersByEquipmentId.forEach((marker, equipmentId) => {
    const decision = runtimePlan.equipmentStatesByEquipmentId.get(equipmentId);
    const state = decision?.state || "unknown";
    const evidenceMode = decision?.evidenceMode || "unbound";
    const color = EQUIPMENT_STATE_COLORS[state];
    const isSelected = normalizeId(visualContext.selectedEquipmentId) === equipmentId;
    const matchesFilter = visualContext.statusFilter === null || state === visualContext.statusFilter;
    const filterOpacity = matchesFilter ? 1 : 0.16;
    const evidenceOpacity = evidenceMode === "live"
      ? 1
      : evidenceMode === "shadow"
        ? 0.76
        : 0.48;
    marker.baseLightbandMaterial.color.setHex(color);
    marker.cornerFrameMaterial.color.setHex(color);
    marker.baseLightbandMaterial.opacity = evidenceOpacity * filterOpacity * (isSelected ? 1 : 0.78);
    marker.cornerFrameMaterial.opacity = evidenceOpacity * filterOpacity * (isSelected ? 1 : 0.9);
    marker.renderedBaseLightbandOpacity = marker.baseLightbandMaterial.opacity;
    marker.renderedCornerFrameOpacity = marker.cornerFrameMaterial.opacity;
    marker.baseLightband.visible = evidenceMode === "live";
    marker.cornerFrame.visible = evidenceMode !== "live";

    if (marker.state !== state || marker.evidenceMode !== evidenceMode) {
      marker.badgeMaterial.map?.dispose();
      marker.badgeMaterial.map = createStatusGlyphTexture(state, evidenceMode);
      marker.badgeMaterial.needsUpdate = true;
    }
    const lodScale = visualContext.activeLod === "LOD0" ? 1 : visualContext.activeLod === "LOD1" ? 0.84 : 0.7;
    marker.renderedBadgeScale = Math.max(0.36, marker.baseBadgeScale) * lodScale * (isSelected ? 1.18 : 1);
    marker.badge.scale.set(marker.renderedBadgeScale, marker.renderedBadgeScale, 1);
    marker.badge.visible = true;
    marker.badgeMaterial.opacity = evidenceOpacity * filterOpacity * (isSelected ? 1 : 0.9);
    marker.badge.userData.runtime_status_shape = EQUIPMENT_STATE_SHAPES[state].contract;
    marker.root.visible = true;
    marker.root.userData.operational_state = state;
    marker.root.userData.state_evidence = evidenceMode;
    marker.root.userData.state_authority = decision?.authority || "none";
    marker.root.userData.status_shape = EQUIPMENT_STATE_SHAPES[state].contract;
    marker.root.userData.filter_match = matchesFilter;
    marker.root.userData.status_filter = visualContext.statusFilter || "all";
    marker.root.userData.lod_semantic = visualContext.activeLod;
    marker.state = state;
    marker.evidenceMode = evidenceMode;
  });

  loaded.bodyTintsByEquipmentId.forEach((bodyTint, equipmentId) => {
    const decision = runtimePlan.equipmentStatesByEquipmentId.get(equipmentId);
    const state = decision?.state || "unknown";
    const evidenceMode = decision?.evidenceMode || "unbound";
    const statusColor = new Color(EQUIPMENT_STATE_COLORS[state]);
    const isSelected = normalizeId(visualContext.selectedEquipmentId) === equipmentId;
    const matchesFilter = visualContext.statusFilter === null || state === visualContext.statusFilter;
    const evidenceMultiplier = evidenceMode === "live"
      ? 1
      : evidenceMode === "shadow"
        ? 0.78
        : evidenceMode === "stale"
          ? 0.48
          : 0.28;
    const lodMultiplier = visualContext.activeLod === "LOD0"
      ? 1
      : visualContext.activeLod === "LOD1"
        ? 1.04
        : 1.18;
    const filterMultiplier = matchesFilter ? 1 : 0.18;
    const selectionMultiplier = isSelected ? 1.2 : 1;
    const tintStrength = Math.min(
      0.28,
      EQUIPMENT_BODY_TINT_STRENGTHS[state]
        * evidenceMultiplier
        * lodMultiplier
        * filterMultiplier
        * selectionMultiplier
    );
    const staticEmissiveBoost = state === "fault"
      ? 0.13
      : state === "running"
        ? 0.025
        : state === "standby"
          ? 0.01
          : 0;

    bodyTint.materials.forEach((target) => {
      const physicalBase = target.baseColor.clone();
      if (state === "stopped") {
        const hsl = { h: 0, s: 0, l: 0 };
        physicalBase.getHSL(hsl);
        physicalBase.setHSL(hsl.h, hsl.s * 0.6, hsl.l * 0.88);
      }
      target.material.color.copy(physicalBase).lerp(statusColor, tintStrength);
      if (!matchesFilter) {
        target.material.color.multiplyScalar(0.58);
      }
      const emissiveBlend = Math.min(0.18, tintStrength * 0.46);
      target.material.emissive.copy(target.baseEmissive).lerp(statusColor, emissiveBlend);
      target.renderedEmissiveIntensity = target.baseEmissiveIntensity
        + staticEmissiveBoost * evidenceMultiplier * filterMultiplier * (isSelected ? 1.15 : 1);
      target.material.emissiveIntensity = target.renderedEmissiveIntensity;
      target.material.userData.runtime_operational_state = state;
      target.material.userData.runtime_state_evidence = evidenceMode;
      target.material.userData.runtime_filter_match = matchesFilter;
      target.material.needsUpdate = true;
    });
    bodyTint.state = state;
    bodyTint.evidenceMode = evidenceMode;
  });
}

function animateRuntimeStatusMarkers(loaded: LoadedLod, elapsedSeconds: number): void {
  loaded.statusMarkersByEquipmentId.forEach((marker) => {
    const pulse = marker.state === "fault"
      ? 0.86 + (Math.sin(elapsedSeconds * 2.4) + 1) * 0.07
      : 1;
    marker.root.scale.setScalar(1);
    marker.baseLightbandMaterial.opacity = marker.renderedBaseLightbandOpacity * pulse;
    marker.cornerFrameMaterial.opacity = marker.renderedCornerFrameOpacity * pulse;
    marker.badge.scale.setScalar(marker.renderedBadgeScale);
  });
  loaded.bodyTintsByEquipmentId.forEach((bodyTint) => {
    const pulse = bodyTint.state === "fault"
      ? 0.82 + (Math.sin(elapsedSeconds * 2.4) + 1) * 0.09
      : 1;
    bodyTint.materials.forEach((target) => {
      target.material.emissiveIntensity = target.renderedEmissiveIntensity * pulse;
    });
  });
}

function applyReadOnlyRuntimeAnimations(
  loaded: LoadedLod,
  demoAnimationEnabled: boolean,
  runtimePlan: RuntimeAnimationPlan
) {
  loaded.actionsByClipName.forEach((action, clipName) => {
    const isEquipmentMotion = clipName.startsWith("ACT_ANIM_FAN_")
      || clipName.startsWith("ACT_ANIM_SHAFT_");
    const isFlowMotion = clipName.startsWith("ACT_ANIM_FLOW_")
      || clipName.startsWith("ACT_ANIM_HEADER_");
    const runtimeDecision = runtimePlan.decisionsByClipName.get(clipName);
    const runtimeMotionEnabled = isEquipmentMotion && runtimeDecision?.motionEnabled === true;
    const motionEnabled = demoAnimationEnabled
      ? isEquipmentMotion || isFlowMotion
      : runtimeMotionEnabled;
    const playbackRate = demoAnimationEnabled
      ? isEquipmentMotion ? 0.55 : 0.42
      : runtimeDecision?.playbackRate || 0;
    setActionRuntime(
      action,
      motionEnabled,
      playbackRate
    );
  });
}

function resolveCameraFitPadding(viewportWidth: number, viewportHeight: number): number {
  const aspect = viewportWidth / Math.max(1, viewportHeight);
  if (aspect < 0.85) {
    return 1.07;
  }
  if (aspect < 1.4) {
    return 1.04;
  }
  return 1.015;
}

function resolveCameraInitialComposition(
  viewportWidth: number,
  viewportHeight: number
): { distanceScale: number; verticalOffsetPx: number } {
  const aspect = viewportWidth / Math.max(1, viewportHeight);
  if (aspect < 0.85) {
    return { distanceScale: 1.02, verticalOffsetPx: 0 };
  }
  if (aspect < 1.4) {
    return { distanceScale: 0.985, verticalOffsetPx: -12 };
  }
  const wideVerticalOffsetPx = -Math.min(
    96,
    Math.max(60, Math.round(viewportHeight * 0.087))
  );
  return { distanceScale: 0.89, verticalOffsetPx: wideVerticalOffsetPx };
}

function collectVisibleMeshFitPoints(root: Object3D): { bounds: Box3; points: Vector3[] } {
  root.updateMatrixWorld(true);
  const bounds = new Box3();
  const points: Vector3[] = [];
  root.traverse((object) => {
    if (!(object instanceof Mesh) || object.userData?.exclude_from_camera_fit === true) {
      return;
    }
    if (!object.geometry.boundingBox) {
      object.geometry.computeBoundingBox();
    }
    const localBounds = object.geometry.boundingBox;
    if (!localBounds || localBounds.isEmpty()) {
      return;
    }
    for (const x of [localBounds.min.x, localBounds.max.x]) {
      for (const y of [localBounds.min.y, localBounds.max.y]) {
        for (const z of [localBounds.min.z, localBounds.max.z]) {
          const point = new Vector3(x, y, z).applyMatrix4(object.matrixWorld);
          points.push(point);
          bounds.expandByPoint(point);
        }
      }
    }
  });
  return { bounds, points };
}

function findNodeByDeviceId(
  nodes: SystemDiagramResolvedNode[],
  deviceId: string | null | undefined
): SystemDiagramResolvedNode | null {
  const normalizedDeviceId = normalizeId(deviceId);
  if (!normalizedDeviceId) {
    return null;
  }
  return nodes.find((node) => {
    if (normalizeId(node.primaryDeviceId) === normalizedDeviceId) {
      return true;
    }
    return (node.deviceIds || []).some((candidate) => normalizeId(candidate) === normalizedDeviceId);
  }) || null;
}

function disposeMaterial(material: Material) {
  Object.values(material as unknown as Record<string, unknown>).forEach((value) => {
    const texture = value as Texture | null;
    if (texture?.isTexture) {
      texture.dispose();
    }
  });
  material.dispose();
}

function disposeObject(root: Object3D) {
  const disposedMaterials = new Set<Material>();
  const disposedGeometries = new Set<object>();
  root.traverse((object) => {
    if (object instanceof Mesh && !disposedGeometries.has(object.geometry)) {
      disposedGeometries.add(object.geometry);
      object.geometry.dispose();
    }
    if (object instanceof Sprite) {
      object.material.map?.dispose();
      object.material.map = null;
      object.material.needsUpdate = true;
    }
    if (!(object instanceof Mesh) && !(object instanceof Sprite)) {
      return;
    }
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    materials.forEach((material) => {
      if (disposedMaterials.has(material)) {
        return;
      }
      disposedMaterials.add(material);
      disposeMaterial(material);
    });
  });
}

function prepareModel(gltf: GLTF, level: LodLevel): LoadedLod {
  const root = new Group();
  root.name = `B25_PLANT_OVERVIEW_${level}`;
  const model = gltf.scene;
  const bounds = new Box3().setFromObject(model);
  const center = bounds.getCenter(new Vector3());
  model.position.set(-center.x, -bounds.min.y, -center.z);
  model.traverse((object) => {
    if (object instanceof Mesh) {
      object.castShadow = false;
      object.receiveShadow = false;
    }
  });
  root.add(model);
  root.visible = false;
  const bodyTintsByEquipmentId = createRuntimeEquipmentBodyTints(model);
  const statusMarkersByEquipmentId = createRuntimeStatusMarkers(root, model);

  const mixer = new AnimationMixer(model);
  const actionsByClipName = new Map<string, AnimationAction>();
  gltf.animations.forEach((clip) => {
    const action = mixer.clipAction(clip);
    action.play();
    action.paused = true;
    action.timeScale = 0;
    actionsByClipName.set(normalizeId(clip.name), action);
  });

  return {
    level,
    root,
    mixerRoot: model,
    mixer,
    actionsByClipName,
    statusMarkersByEquipmentId,
    bodyTintsByEquipmentId,
    animationCount: gltf.animations.length,
    runtimeTargetCount: countRuntimeTargets(model)
  };
}

export default function PlantOverview3D({
  profile,
  topology = EMPTY_TOPOLOGY,
  selectedNodeId = null,
  onNodeSelect,
  devicePageHref = null,
  operationalEvidence = true,
  runtimeSummary = null,
  runtimeScopeKey = "site-default",
  embedded = false,
  resetViewSignal = 0,
  viewportFitSignal = "default",
  inspectedEquipmentId,
  onEquipmentSelectionChange
}: PlantOverview3DProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const processMetricOverlayRef = useRef<HTMLDivElement | null>(null);
  const cameraFitRef = useRef<{ reset: () => void; refit: () => void } | null>(null);
  const resolved = useMemo(() => buildSystemDiagramLayout(topology), [topology]);
  const resolvedNodesRef = useRef(resolved.nodes);
  const onNodeSelectRef = useRef(onNodeSelect);
  const onEquipmentSelectionChangeRef = useRef(onEquipmentSelectionChange);
  const publishEquipmentSelectionRef = useRef<(equipmentId: string, binding: ResolvedBinding | null) => void>(() => undefined);
  const demoAnimationEnabledRef = useRef(false);
  const selectedEquipmentIdRef = useRef<string | null>(null);
  const statusFilterRef = useRef<EquipmentStatusFilter>(null);
  const runtimeAnimationPlanRef = useRef<RuntimeAnimationPlan | null>(null);
  const runtimeReplayHistoryRef = useRef<Map<string, RuntimeReplayHistoryEntry>>(
    loadRuntimeReplayHistory(runtimeScopeKey)
  );
  const [loadState, setLoadState] = useState<ModelLoadState>("loading");
  const [activeLod, setActiveLod] = useState<LodLevel | null>(null);
  const [animationCount, setAnimationCount] = useState(0);
  const [runtimeTargetCount, setRuntimeTargetCount] = useState(0);
  const [statusMarkerCount, setStatusMarkerCount] = useState(0);
  const [bodyTintCount, setBodyTintCount] = useState(0);
  const [bodyTintMaterialCount, setBodyTintMaterialCount] = useState(0);
  const [selectedEquipmentId, setSelectedEquipmentId] = useState<string | null>(null);
  const [hoveredEquipment, setHoveredEquipment] = useState<{ equipmentId: string; x: number; y: number } | null>(null);
  const [statusFilter, setStatusFilter] = useState<EquipmentStatusFilter>(null);
  const [candidateDeviceId, setCandidateDeviceId] = useState<string | null>(null);
  const [boundDeviceId, setBoundDeviceId] = useState<string | null>(null);
  const [bindingAuthoritative, setBindingAuthoritative] = useState(false);
  const [bindingIdentityVerified, setBindingIdentityVerified] = useState(false);
  const [bindingResolved, setBindingResolved] = useState(false);
  const [identityBindings, setIdentityBindings] = useState<ResolvedBinding[]>([]);
  const [demoAnimationEnabled, setDemoAnimationEnabled] = useState(false);
  const [runtimeEvidenceClockMs, setRuntimeEvidenceClockMs] = useState(() => Date.now());
  const [loadMessage, setLoadMessage] = useState("正在读取模型清单与 B25 绑定合同");
  const selectedNode = bindingAuthoritative
    ? resolved.nodes.find((node) => node.id === selectedNodeId) || resolved.nodes[0] || null
    : null;

  resolvedNodesRef.current = resolved.nodes;
  onNodeSelectRef.current = onNodeSelect;
  onEquipmentSelectionChangeRef.current = onEquipmentSelectionChange;
  demoAnimationEnabledRef.current = demoAnimationEnabled;
  selectedEquipmentIdRef.current = selectedEquipmentId;
  statusFilterRef.current = statusFilter;

  const replaySafePointKeys = useMemo(
    () => buildReplaySafePointKeys(runtimeSummary, runtimeReplayHistoryRef.current),
    [runtimeSummary]
  );
  useEffect(() => {
    persistRuntimeReplayHistory(runtimeScopeKey, runtimeReplayHistoryRef.current);
  }, [replaySafePointKeys, runtimeScopeKey]);
  const runtimeAnimationPlan = useMemo(
    () => buildRuntimeAnimationPlan(
      runtimeSummary,
      identityBindings,
      runtimeEvidenceClockMs,
      replaySafePointKeys
    ),
    [identityBindings, replaySafePointKeys, runtimeEvidenceClockMs, runtimeSummary]
  );
  runtimeAnimationPlanRef.current = runtimeAnimationPlan;
  const processMetrics = useMemo(() => buildPlantProcessMetrics(runtimeSummary), [runtimeSummary]);
  const equipmentStateRows = [...runtimeAnimationPlan.equipmentStatesByEquipmentId.values()]
    .sort((left, right) => left.equipmentId.localeCompare(right.equipmentId));
  const chillerStateRows = CHILLER_TOP_TO_BOTTOM_ORDER
    .map((equipmentId) => runtimeAnimationPlan.equipmentStatesByEquipmentId.get(equipmentId))
    .filter((decision): decision is RuntimeEquipmentStateDecision => Boolean(decision));
  const selectedEquipmentState = selectedEquipmentId
    ? runtimeAnimationPlan.equipmentStatesByEquipmentId.get(normalizeId(selectedEquipmentId)) || null
    : null;
  const hoveredEquipmentState = hoveredEquipment
    ? runtimeAnimationPlan.equipmentStatesByEquipmentId.get(normalizeId(hoveredEquipment.equipmentId)) || null
    : null;
  const hoveredEquipmentBinding = hoveredEquipment
    ? identityBindings.find((binding) => binding.equipmentId === normalizeId(hoveredEquipment.equipmentId)) || null
    : null;
  const hoveredEquipmentSelection = hoveredEquipmentState
    ? buildPlantOverviewEquipmentSelection(
        hoveredEquipmentState.equipmentId,
        hoveredEquipmentBinding,
        hoveredEquipmentState
      )
    : null;
  const hoveredEquipmentMetrics = resolvePlantOverviewEquipmentMetrics(runtimeSummary, hoveredEquipmentSelection);
  const hoveredPrimaryMetric = hoveredEquipmentMetrics.find((metric) => metric.value !== null)
    || hoveredEquipmentMetrics[0]
    || null;
  const equipmentStateCountTotal = Object.values(runtimeAnimationPlan.equipmentStateCounts)
    .reduce((sum, count) => sum + count, 0);
  const equipmentCountsInvariant = equipmentStateCountTotal === EXPECTED_CORE_EQUIPMENT_IDS.length;
  const equipmentFilterMatchCount = statusFilter
    ? runtimeAnimationPlan.equipmentStateCounts[statusFilter]
    : equipmentStateCountTotal;
  const equipmentAnomalies = equipmentStateRows.filter((decision) => (
    decision.state === "fault" || decision.state === "unknown"
  ));
  const equipmentGroupStateCounts = Object.entries(EQUIPMENT_GROUP_LABELS).map(([runtimeGroup, label]) => {
    const counts: EquipmentStateCounts = { running: 0, fault: 0, standby: 0, stopped: 0, unknown: 0 };
    equipmentStateRows.forEach((decision) => {
      const spec = EXPECTED_CORE_BINDING_SPEC_BY_EQUIPMENT_ID.get(decision.equipmentId);
      if (spec?.runtimeGroup === runtimeGroup) {
        counts[decision.state] += 1;
      }
    });
    return { runtimeGroup, label, counts };
  });
  const publishEquipmentSelection = (equipmentId: string, binding: ResolvedBinding | null) => {
    const normalizedEquipmentId = normalizeId(equipmentId);
    const decision = runtimeAnimationPlanRef.current?.equipmentStatesByEquipmentId.get(normalizedEquipmentId) || null;
    onEquipmentSelectionChangeRef.current?.(
      buildPlantOverviewEquipmentSelection(normalizedEquipmentId, binding, decision)
    );
  };
  publishEquipmentSelectionRef.current = publishEquipmentSelection;
  const selectEquipmentForInspection = (equipmentId: string) => {
    const normalizedEquipmentId = normalizeId(equipmentId);
    setSelectedEquipmentId(normalizedEquipmentId);
    const binding = identityBindings.find((candidate) => candidate.equipmentId === normalizedEquipmentId) || null;
    publishEquipmentSelection(normalizedEquipmentId, binding);
    setCandidateDeviceId(binding ? `${binding.runtimeId} / #${binding.deviceId}` : null);
    if (!bindingAuthoritative || !binding) {
      setBoundDeviceId(null);
      setBindingResolved(false);
      return;
    }
    setBoundDeviceId(binding.deviceId);
    const node = findNodeByDeviceId(resolved.nodes, binding.deviceId);
    setBindingResolved(Boolean(node));
    if (node) {
      onNodeSelect?.(node);
    }
  };
  const navigateEquipmentAnomaly = (direction: -1 | 1) => {
    if (equipmentAnomalies.length === 0) {
      return;
    }
    const currentIndex = equipmentAnomalies.findIndex((decision) => (
      decision.equipmentId === normalizeId(selectedEquipmentId)
    ));
    const nextIndex = currentIndex < 0
      ? direction > 0 ? 0 : equipmentAnomalies.length - 1
      : (currentIndex + direction + equipmentAnomalies.length) % equipmentAnomalies.length;
    selectEquipmentForInspection(equipmentAnomalies[nextIndex].equipmentId);
  };
  const clearCanvasSelectionBeforeThreePick = (event: { target: EventTarget | null }) => {
    if (!(event.target instanceof HTMLCanvasElement)) {
      return;
    }
    setSelectedEquipmentId(null);
    setCandidateDeviceId(null);
    setBoundDeviceId(null);
    setBindingResolved(false);
    onEquipmentSelectionChangeRef.current?.(null);
  };
  const equipmentStateEvidence = runtimeAnimationPlan.liveEquipmentStateCount === runtimeAnimationPlan.expectedEquipmentCount
    ? "LIVE"
    : runtimeAnimationPlan.readableEquipmentStateCount > 0
      ? "SHADOW"
      : runtimeSummary
        ? "STALE"
        : "UNBOUND";
  const runtimeEvidenceState = runtimeAnimationPlan.evidenceState;
  const shadowAnimationAvailable = runtimeEvidenceState !== "LIVE"
    && runtimeAnimationPlan.shadowReadableEquipmentCount > 0;
  const animationMode: AnimationMode = demoAnimationEnabled
    ? "schematic-demo"
    : runtimeEvidenceState === "LIVE"
      ? "live-read-only"
    : shadowAnimationAvailable
      ? "shadow-read-only"
    : runtimeEvidenceState === "STALE"
      ? "paused-stale"
      : "paused-unbound";
  const runtimeDisplayState = demoAnimationEnabled
    ? "DEMO"
    : runtimeEvidenceState === "LIVE"
      ? "LIVE"
      : shadowAnimationAvailable
        ? "SHADOW"
        : runtimeEvidenceState;
  const animationModeLabel = demoAnimationEnabled
    ? "DEMO 示意动画"
    : runtimeEvidenceState === "LIVE"
      ? runtimeAnimationPlan.playingEquipmentCount > 0
        ? `只读 LIVE ${runtimeAnimationPlan.playingEquipmentCount}/${runtimeAnimationPlan.expectedEquipmentCount} 动画`
        : "LIVE 设备当前停机"
      : shadowAnimationAvailable
        ? runtimeAnimationPlan.playingEquipmentCount > 0
          ? `SHADOW ${runtimeAnimationPlan.playingEquipmentCount} 台设备运动 · 时效不可证`
          : "SHADOW 设备当前停机 · 时效不可证"
        : runtimeEvidenceState === "STALE"
          ? "STALE 动画已暂停"
          : "UNBOUND 动画已暂停";
  const activeQualityLabel = activeLod === "LOD0"
    ? "精细"
    : activeLod === "LOD1"
      ? "标准"
      : activeLod === "LOD2"
        ? "流畅"
        : "加载中";
  const bindingState = bindingAuthoritative && bindingResolved
    ? "site-overview-authoritative-resolved"
    : bindingIdentityVerified && candidateDeviceId
      ? "site-overview-read-only-identity-selected"
      : bindingIdentityVerified
        ? "site-overview-read-only-identity"
        : "site-overview-unbound";
  const bindingLabel = bindingAuthoritative && bindingResolved
    ? `权威映射已解析 · ${boundDeviceId}`
    : bindingIdentityVerified && candidateDeviceId
      ? `身份已核实 ${candidateDeviceId} · LIVE ${runtimeAnimationPlan.liveEquipmentCount}/${runtimeAnimationPlan.expectedEquipmentCount} · SHADOW可读 ${runtimeAnimationPlan.shadowReadableEquipmentCount}/${runtimeAnimationPlan.expectedEquipmentCount}`
      : bindingIdentityVerified
        ? `54 个核心身份已核实 · LIVE ${runtimeAnimationPlan.liveEquipmentCount}/${runtimeAnimationPlan.expectedEquipmentCount} · SHADOW可读 ${runtimeAnimationPlan.shadowReadableEquipmentCount}/${runtimeAnimationPlan.expectedEquipmentCount}`
        : "B25 身份合同未通过完整性校验 · UNBOUND 动画已暂停";
  const runtimeEvidenceNote = demoAnimationEnabled
    ? "DEMO只改变示意动画，不改变运行/故障/待机/停机业务状态，也不产生 BA/PLC 写入。"
    : runtimeEvidenceState === "LIVE"
      ? "设备状态由精确运行、故障、远程点解析；设备动画只由逐点 observedAt、GOOD 质量和健康来源驱动，水流仍等待逐点流量证据。"
      : shadowAnimationAvailable
        ? "SHADOW仅按精确唯一运行/故障/远程点显示业务状态，并按运行/频率值只读驱动设备；缺少权威 observedAt、质量或防重放证明，证据仍为 STALE，水流保持暂停。"
        : "缺少可安全读取的精确运行点或来源不健康；动画已暂停，演示动画不代表设备正在运行，也不产生 BA/PLC 写入。";

  useEffect(() => {
    const timer = window.setInterval(() => setRuntimeEvidenceClockMs(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (inspectedEquipmentId === undefined) {
      return;
    }
    const normalizedEquipmentId = normalizeId(inspectedEquipmentId);
    if (!normalizedEquipmentId) {
      setSelectedEquipmentId(null);
      setCandidateDeviceId(null);
      setBoundDeviceId(null);
      setBindingResolved(false);
      return;
    }
    if (normalizedEquipmentId !== selectedEquipmentIdRef.current) {
      setSelectedEquipmentId(normalizedEquipmentId);
    }
  }, [inspectedEquipmentId]);

  useEffect(() => {
    const mountNode = mountRef.current;
    if (!mountNode) {
      return;
    }

    let disposed = false;
    let animationFrame = 0;
    let resizeFrame = 0;
    let hoverRaycastFrame = 0;
    let hoverPointerClientX = 0;
    let hoverPointerClientY = 0;
    let manifestItem: ManifestItem | null = null;
    let activeLevel: LodLevel | null = null;
    let authoritativeBinding = false;
    let cameraHasUserInteracted = false;
    let lastAppliedDemoState: boolean | null = null;
    let lastAppliedRuntimeSignature: string | null = null;
    let lastAppliedStatusVisualSignature: string | null = null;
    const loaded = new Map<LodLevel, LoadedLod>();
    const pending = new Map<LodLevel, Promise<LoadedLod>>();
    const failedLods = new Set<LodLevel>();
    const candidateBindingByEquipmentId = new Map<string, ResolvedBinding>();
    const processMetricNodes = Array.from(
      processMetricOverlayRef.current?.querySelectorAll<HTMLElement>("[data-process-metric-anchor]") || []
    ).map((node) => ({
      node,
      anchor: new Vector3(
        Number(node.dataset.anchorX || 0),
        Number(node.dataset.anchorY || 0),
        Number(node.dataset.anchorZ || 0)
      )
    }));

    setCandidateDeviceId(null);
    setBoundDeviceId(null);
    setBindingAuthoritative(false);
    setBindingIdentityVerified(false);
    setBindingResolved(false);
    setIdentityBindings([]);
    setStatusMarkerCount(0);
    setBodyTintCount(0);
    setBodyTintMaterialCount(0);

    mountNode.innerHTML = "";
    const width = mountNode.clientWidth || 320;
    const height = mountNode.clientHeight || 260;
    const renderer = new WebGLRenderer({ alpha: true, antialias: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    renderer.outputColorSpace = SRGBColorSpace;
    renderer.toneMapping = ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    mountNode.appendChild(renderer.domElement);

    const scene = new Scene();
    scene.background = new Color(0x06111a);
    scene.fog = new FogExp2(0x06111a, 0.012);

    const camera = new PerspectiveCamera(38, width / height, 0.1, 320);
    camera.position.copy(DEFAULT_CAMERA_VIEW_DIRECTION).multiplyScalar(48);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 1.2, 0);
    controls.enableDamping = true;
    controls.dampingFactor = 0.07;
    controls.minDistance = 11;
    controls.maxDistance = 180;
    controls.maxPolarAngle = Math.PI * 0.49;
    controls.update();
    const handleControlsStart = () => {
      cameraHasUserInteracted = true;
    };
    controls.addEventListener("start", handleControlsStart);

    const ambientLight = new AmbientLight(0xffffff, 1.45);
    const hemisphereLight = new HemisphereLight(0xccefff, 0x071015, 1.65);
    const keyLight = new DirectionalLight(0xd8f2ff, 3.2);
    keyLight.position.set(18, 28, 15);
    const fillLight = new DirectionalLight(0x74c7ff, 1.6);
    fillLight.position.set(-18, 12, -10);
    const rimLight = new DirectionalLight(0x77ffd9, 1.25);
    rimLight.position.set(6, 10, -24);
    scene.add(ambientLight, hemisphereLight, keyLight, fillLight, rimLight);

    const ground = new Mesh(
      new PlaneGeometry(72, 72),
      new MeshStandardMaterial({ color: 0x091923, metalness: 0.08, roughness: 0.88 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.025;
    scene.add(ground);
    const grid = new GridHelper(72, 36, 0x24536a, 0x122d3b);
    grid.position.y = 0;
    scene.add(grid);

    const modelStage = new Group();
    scene.add(modelStage);
    const raycaster = new Raycaster();
    const pointer = new Vector2();
    const clock = new Clock();
    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);

    const fitCameraToModel = (
      root: Object3D,
      viewportWidth: number,
      viewportHeight: number,
      preserveViewDirection = false
    ) => {
      const fitGeometry = collectVisibleMeshFitPoints(root);
      const { bounds, points } = fitGeometry;
      if (bounds.isEmpty() || points.length === 0) {
        return;
      }
      const center = bounds.getCenter(new Vector3());
      const aspect = viewportWidth / Math.max(1, viewportHeight);
      const currentDirection = camera.position.clone().sub(controls.target);
      const viewDirection = preserveViewDirection && currentDirection.lengthSq() > 0.001
        ? currentDirection.normalize()
        : aspect < 0.85
          ? new Vector3(18, 52, 34).normalize()
          : DEFAULT_CAMERA_VIEW_DIRECTION.clone();
      if (scene.fog instanceof FogExp2) {
        scene.fog.density = aspect < 0.85 ? 0.0065 : 0.01;
      }
      camera.aspect = Math.max(0.1, viewportWidth / Math.max(1, viewportHeight));
      camera.position.copy(center).addScaledVector(viewDirection, 40);
      camera.lookAt(center);
      camera.updateProjectionMatrix();
      camera.updateMatrixWorld(true);

      const right = new Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
      const up = new Vector3(0, 1, 0).applyQuaternion(camera.quaternion);
      const tanHalfVertical = Math.tan((camera.fov * Math.PI) / 360);
      const tanHalfHorizontal = tanHalfVertical * camera.aspect;
      let requiredDistance = 12;
      for (const point of points) {
        const relative = point.clone().sub(center);
        const nearOffset = relative.dot(viewDirection);
        requiredDistance = Math.max(
          requiredDistance,
          nearOffset + Math.abs(relative.dot(right)) / Math.max(0.01, tanHalfHorizontal),
          nearOffset + Math.abs(relative.dot(up)) / Math.max(0.01, tanHalfVertical)
        );
      }
      const initialComposition = preserveViewDirection
        ? { distanceScale: 1, verticalOffsetPx: 0 }
        : resolveCameraInitialComposition(viewportWidth, viewportHeight);
      requiredDistance *= resolveCameraFitPadding(viewportWidth, viewportHeight)
        * initialComposition.distanceScale;
      const worldUnitsPerVerticalPixel = (
        2 * requiredDistance * tanHalfVertical / Math.max(1, viewportHeight)
      );
      const compositionTarget = center.clone().addScaledVector(
        up,
        initialComposition.verticalOffsetPx * worldUnitsPerVerticalPixel
      );
      controls.target.copy(compositionTarget);
      camera.position.copy(compositionTarget).addScaledVector(viewDirection, requiredDistance);
      camera.far = Math.max(320, requiredDistance * 4);
      controls.maxDistance = Math.max(180, requiredDistance * 2.2);
      camera.updateProjectionMatrix();
      controls.update();
    };

    const fitActiveModelToViewport = (resetOrientation: boolean) => {
      const activeModel = activeLevel ? loaded.get(activeLevel) : null;
      if (!activeModel) {
        return;
      }
      if (resetOrientation) {
        cameraHasUserInteracted = false;
      }
      fitCameraToModel(
        activeModel.mixerRoot,
        mountNode.clientWidth || width,
        mountNode.clientHeight || height,
        !resetOrientation && cameraHasUserInteracted
      );
    };
    const cameraFitController = {
      reset: () => fitActiveModelToViewport(true),
      refit: () => fitActiveModelToViewport(false)
    };
    cameraFitRef.current = cameraFitController;

    const releaseLevel = (level: LodLevel) => {
      const entry = loaded.get(level);
      if (!entry) {
        return;
      }
      entry.mixer.stopAllAction();
      entry.mixer.uncacheRoot(entry.mixerRoot);
      modelStage.remove(entry.root);
      disposeObject(entry.root);
      loaded.delete(level);
    };

    const activateLevel = (level: LodLevel) => {
      const next = loaded.get(level);
      if (!next || disposed) {
        return;
      }
      next.root.visible = true;
      next.mixer.timeScale = 1;
      if (activeLevel === null) {
        fitCameraToModel(next.mixerRoot, mountNode.clientWidth || width, mountNode.clientHeight || height, false);
      }
      const runtimePlan = runtimeAnimationPlanRef.current;
      if (runtimePlan) {
        applyReadOnlyRuntimeAnimations(next, demoAnimationEnabledRef.current, runtimePlan);
        applyEquipmentStatusFilter(next, runtimePlan, {
          activeLod: level,
          selectedEquipmentId: selectedEquipmentIdRef.current,
          statusFilter: statusFilterRef.current
        });
        lastAppliedRuntimeSignature = runtimePlan.signature;
        lastAppliedStatusVisualSignature = [
          runtimePlan.signature,
          level,
          normalizeId(selectedEquipmentIdRef.current),
          statusFilterRef.current || "all"
        ].join("|");
      }
      lastAppliedDemoState = demoAnimationEnabledRef.current;
      [...loaded.keys()].filter((candidate) => candidate !== level).forEach(releaseLevel);
      activeLevel = level;
      setActiveLod(level);
      setAnimationCount(next.animationCount);
      setRuntimeTargetCount(next.runtimeTargetCount);
      setStatusMarkerCount(next.statusMarkersByEquipmentId.size);
      setBodyTintCount(next.bodyTintsByEquipmentId.size);
      setBodyTintMaterialCount(
        [...next.bodyTintsByEquipmentId.values()]
          .reduce((count, bodyTint) => count + bodyTint.materials.length, 0)
      );
      const countMatches = next.animationCount === profile.expectedAnimationCount
        && next.runtimeTargetCount === profile.expectedRuntimeTargetCount
        && next.statusMarkersByEquipmentId.size === EXPECTED_CORE_EQUIPMENT_IDS.length
        && next.bodyTintsByEquipmentId.size === EXPECTED_CORE_EQUIPMENT_IDS.length;
      setLoadState(countMatches ? "ready" : "degraded");
      setLoadMessage(countMatches
        ? "模型、LOD、设备本体状态色与内置动画已加载"
        : `模型已加载，但本体着色、状态标记、运行目标或动画数量与合同不一致（本体 ${next.bodyTintsByEquipmentId.size}/54 · 状态 ${next.statusMarkersByEquipmentId.size}/54 · 目标 ${next.runtimeTargetCount} · 动画 ${next.animationCount}）`);
    };

    const loadLevel = (level: LodLevel): Promise<LoadedLod> => {
      const existing = loaded.get(level);
      if (existing) {
        return Promise.resolve(existing);
      }
      const inFlight = pending.get(level);
      if (inFlight) {
        return inFlight;
      }
      if (failedLods.has(level)) {
        return Promise.reject(new Error(`plant_overview_${level}_previously_failed`));
      }
      const path = manifestItem ? resolveLodPath(manifestItem, level) : null;
      if (!path) {
        return Promise.reject(new Error(`plant_overview_${level}_path_missing`));
      }

      const request = loader.loadAsync(path).then((gltf) => {
        if (disposed) {
          disposeObject(gltf.scene);
          throw new Error("plant_overview_disposed");
        }
        const prepared = prepareModel(gltf, level);
        loaded.set(level, prepared);
        modelStage.add(prepared.root);
        pending.delete(level);
        return prepared;
      }).catch((error: unknown) => {
        pending.delete(level);
        throw error;
      });
      pending.set(level, request);
      return request;
    };

    const requestLevel = (level: LodLevel) => {
      if (disposed || failedLods.has(level)) {
        return;
      }
      void loadLevel(level)
        .then(() => {
          if (!manifestItem || disposed) {
            return;
          }
          const desired = resolveDesiredLod(
            manifestItem,
            camera.position.distanceTo(controls.target)
          );
          if (desired === level || activeLevel === null) {
            activateLevel(level);
          } else {
            releaseLevel(level);
          }
        })
        .catch(() => {
          if (disposed) {
            return;
          }
          failedLods.add(level);
          if (loaded.size > 0) {
            setLoadState("degraded");
            setLoadMessage(`${level} 加载失败，已停止重试并保留当前可用层级`);
            return;
          }
          const fallback = FALLBACK_LODS.find((candidate) => (
            candidate !== level
            && !failedLods.has(candidate)
            && !pending.has(candidate)
          ));
          if (fallback) {
            requestLevel(fallback);
          } else {
            setLoadState("error");
            setLoadMessage("全站三维模型加载失败；二维水力图与拓扑三维仍可使用");
          }
        });
    };

    const loadContracts = async () => {
      setLoadState("loading");
      setLoadMessage("正在读取模型清单与 B25 绑定合同");
      try {
        const bindingPromise = fetch(profile.bindingContractPath, { cache: "no-cache" })
          .then(async (response) => response.ok ? await response.json() as BindingContract : null)
          .catch(() => null);
        const [manifestResponse, bindingContract] = await Promise.all([
          fetch(MANIFEST_PATH, { cache: "no-cache" }),
          bindingPromise
        ]);
        if (!manifestResponse.ok) {
          throw new Error(`model_manifest_http_${manifestResponse.status}`);
        }
        const manifest = await manifestResponse.json() as ModelManifest;
        if (disposed) {
          return;
        }
        manifestItem = manifest.items?.find((item) => item.id === profile.assetId) || null;
        if (!manifestItem || !resolveLodPath(manifestItem, "LOD0")) {
          throw new Error("plant_overview_manifest_entry_missing");
        }
        authoritativeBinding = false;
        setBindingAuthoritative(authoritativeBinding);
        const verifiedBindings = resolveVerifiedIdentityBindings(
          bindingContract,
          profile.expectedExplicitBindingCount
        );
        const identityVerified = verifiedBindings !== null;
        setBindingIdentityVerified(identityVerified);
        setIdentityBindings(verifiedBindings || []);
        (verifiedBindings || []).forEach((binding) => {
          candidateBindingByEquipmentId.set(binding.equipmentId, binding);
        });
        if (authoritativeBinding) {
          setLoadMessage("正在加载已确认绑定的 B25 全站模型");
        } else if (identityVerified) {
          setLoadMessage("正在加载 B25 全核心设备模型；身份已核实，遥测时效不可证");
        } else if (bindingContract) {
          setLoadMessage("正在加载 B25 展示模型；映射不作为运行真值");
        } else {
          setLoadMessage("绑定合同不可用；模型按 UNBOUND 只读模式加载");
        }
        requestLevel(INITIAL_LOD);
      } catch (error) {
        if (!disposed) {
          setLoadState("error");
          setLoadMessage(error instanceof Error ? error.message : "全站模型合同读取失败");
        }
      }
    };

    const handlePointerDown = (event: PointerEvent) => {
      if (!activeLevel) {
        return;
      }
      const activeModel = loaded.get(activeLevel);
      if (!activeModel) {
        return;
      }
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObject(activeModel.root, true)[0]?.object || null;
      const equipmentId = findEquipmentId(hit);
      if (!equipmentId) {
        setSelectedEquipmentId(null);
        setCandidateDeviceId(null);
        setBoundDeviceId(null);
        setBindingResolved(false);
        onEquipmentSelectionChangeRef.current?.(null);
        return;
      }
      setSelectedEquipmentId(equipmentId);
      const binding = candidateBindingByEquipmentId.get(normalizeId(equipmentId));
      publishEquipmentSelectionRef.current(equipmentId, binding || null);
      const deviceId = binding?.deviceId || null;
      setCandidateDeviceId(binding ? `${binding.runtimeId} / #${binding.deviceId}` : null);
      if (!authoritativeBinding) {
        setBoundDeviceId(null);
        setBindingResolved(false);
        return;
      }
      setBoundDeviceId(deviceId);
      const node = findNodeByDeviceId(resolvedNodesRef.current, deviceId);
      setBindingResolved(Boolean(node));
      if (node) {
        onNodeSelectRef.current?.(node);
      }
    };

    const updateHoverCursor = () => {
      hoverRaycastFrame = 0;
      if (!activeLevel) {
        renderer.domElement.style.cursor = "grab";
        setHoveredEquipment(null);
        return;
      }
      const activeModel = loaded.get(activeLevel);
      if (!activeModel) {
        renderer.domElement.style.cursor = "grab";
        setHoveredEquipment(null);
        return;
      }
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((hoverPointerClientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((hoverPointerClientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const statusMarkerRoots = [...activeModel.statusMarkersByEquipmentId.values()]
        .map((marker) => marker.root);
      const hit = raycaster.intersectObjects(statusMarkerRoots, true)[0]?.object || null;
      const equipmentId = findEquipmentId(hit);
      renderer.domElement.style.cursor = equipmentId ? "pointer" : "grab";
      setHoveredEquipment(equipmentId ? {
        equipmentId,
        x: Math.max(136, Math.min(rect.width - 136, hoverPointerClientX - rect.left)),
        y: Math.max(74, Math.min(rect.height - 74, hoverPointerClientY - rect.top))
      } : null);
    };

    const handlePointerMove = (event: PointerEvent) => {
      hoverPointerClientX = event.clientX;
      hoverPointerClientY = event.clientY;
      if (hoverRaycastFrame === 0) {
        hoverRaycastFrame = window.requestAnimationFrame(updateHoverCursor);
      }
    };
    const handlePointerLeave = () => {
      setHoveredEquipment(null);
      renderer.domElement.style.cursor = "grab";
    };

    renderer.domElement.addEventListener("pointerdown", handlePointerDown);
    renderer.domElement.addEventListener("click", handlePointerDown);
    renderer.domElement.addEventListener("pointermove", handlePointerMove);
    renderer.domElement.addEventListener("pointerleave", handlePointerLeave);

    const renderLoop = () => {
      animationFrame = window.requestAnimationFrame(renderLoop);
      const delta = Math.min(clock.getDelta(), 0.05);
      controls.update();
      const activeModel = activeLevel ? loaded.get(activeLevel) : null;
      activeModel?.mixer.update(delta);
      const runtimePlan = runtimeAnimationPlanRef.current;
      if (
        activeModel
        && runtimePlan
        && (
          lastAppliedDemoState !== demoAnimationEnabledRef.current
          || lastAppliedRuntimeSignature !== runtimePlan.signature
        )
      ) {
        applyReadOnlyRuntimeAnimations(activeModel, demoAnimationEnabledRef.current, runtimePlan);
        lastAppliedDemoState = demoAnimationEnabledRef.current;
        lastAppliedRuntimeSignature = runtimePlan.signature;
      }
      if (activeModel && activeLevel && runtimePlan) {
        const statusVisualSignature = [
          runtimePlan.signature,
          activeLevel,
          normalizeId(selectedEquipmentIdRef.current),
          statusFilterRef.current || "all"
        ].join("|");
        if (statusVisualSignature !== lastAppliedStatusVisualSignature) {
          applyEquipmentStatusFilter(activeModel, runtimePlan, {
            activeLod: activeLevel,
            selectedEquipmentId: selectedEquipmentIdRef.current,
            statusFilter: statusFilterRef.current
          });
          lastAppliedStatusVisualSignature = statusVisualSignature;
        }
        animateRuntimeStatusMarkers(activeModel, clock.elapsedTime);
      }
      if (activeModel && processMetricNodes.length > 0) {
        activeModel.mixerRoot.updateMatrixWorld(true);
        const metricRect = renderer.domElement.getBoundingClientRect();
        processMetricNodes.forEach(({ node, anchor }) => {
          const projected = activeModel.mixerRoot.localToWorld(anchor.clone()).project(camera);
          const visible = projected.z > -1 && projected.z < 1
            && projected.x > -1.08 && projected.x < 1.08
            && projected.y > -1.08 && projected.y < 1.08;
          node.style.display = visible ? "grid" : "none";
          if (visible) {
            node.style.left = `${(projected.x * 0.5 + 0.5) * metricRect.width}px`;
            node.style.top = `${(-projected.y * 0.5 + 0.5) * metricRect.height}px`;
          }
        });
      }
      if (manifestItem) {
        const desired = resolveDesiredLod(manifestItem, camera.position.distanceTo(controls.target));
        if (desired !== activeLevel) {
          const desiredModel = loaded.get(desired);
          if (desiredModel) {
            activateLevel(desired);
          } else if (!pending.has(desired) && !failedLods.has(desired)) {
            requestLevel(desired);
          }
        }
      }
      renderer.render(scene, camera);
    };
    renderLoop();
    void loadContracts();

    const resizeObserver = new ResizeObserver((entries) => {
      const nextWidth = entries[0]?.contentRect.width || width;
      const nextHeight = entries[0]?.contentRect.height || height;
      window.cancelAnimationFrame(resizeFrame);
      resizeFrame = window.requestAnimationFrame(() => {
        if (disposed || nextWidth <= 0 || nextHeight <= 0) {
          return;
        }
        renderer.setSize(nextWidth, nextHeight);
        camera.aspect = nextWidth / nextHeight;
        camera.updateProjectionMatrix();
        const activeModel = activeLevel ? loaded.get(activeLevel) : null;
        if (activeModel && !cameraHasUserInteracted) {
          fitCameraToModel(activeModel.mixerRoot, nextWidth, nextHeight, false);
        }
      });
    });
    resizeObserver.observe(mountNode);

    return () => {
      disposed = true;
      window.cancelAnimationFrame(animationFrame);
      window.cancelAnimationFrame(resizeFrame);
      window.cancelAnimationFrame(hoverRaycastFrame);
      resizeObserver.disconnect();
      renderer.domElement.removeEventListener("pointerdown", handlePointerDown);
      renderer.domElement.removeEventListener("click", handlePointerDown);
      renderer.domElement.removeEventListener("pointermove", handlePointerMove);
      renderer.domElement.removeEventListener("pointerleave", handlePointerLeave);
      controls.removeEventListener("start", handleControlsStart);
      controls.dispose();
      [...loaded.keys()].forEach(releaseLevel);
      disposeObject(ground);
      renderer.dispose();
      scene.clear();
      mountNode.innerHTML = "";
      if (cameraFitRef.current === cameraFitController) {
        cameraFitRef.current = null;
      }
    };
  }, [profile.assetId, profile.bindingContractPath, profile.expectedAnimationCount, profile.expectedRuntimeTargetCount]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => cameraFitRef.current?.reset());
    return () => window.cancelAnimationFrame(frame);
  }, [resetViewSignal]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => cameraFitRef.current?.refit());
    return () => window.cancelAnimationFrame(frame);
  }, [viewportFitSignal]);

  return (
    <section
      className={`scene-system-diagram-card plant-overview-card${embedded ? " is-scene-control-embed" : ""}`}
      onPointerDownCapture={clearCanvasSelectionBeforeThreePick}
      onClickCapture={clearCanvasSelectionBeforeThreePick}
      data-model-asset={profile.assetId}
      data-model-load-state={loadState}
      data-model-lod={activeLod || "pending"}
      data-model-animation-count={animationCount}
      data-model-runtime-target-count={runtimeTargetCount}
      data-model-binding={bindingState}
      data-runtime-evidence={runtimeEvidenceState}
      data-equipment-status-contract="operational-state-v1"
      data-equipment-status-visual="base-lightband-corner-frame-v1"
      data-equipment-status-marker-count={statusMarkerCount}
      data-equipment-status-expected-marker-count={EXPECTED_CORE_EQUIPMENT_IDS.length}
      data-equipment-status-marker-parity={statusMarkerCount === EXPECTED_CORE_EQUIPMENT_IDS.length ? "PASS" : "FAIL"}
      data-equipment-body-status-visual="pbr-preserving-selective-light-tint-v1"
      data-equipment-body-tint-count={bodyTintCount}
      data-equipment-body-tint-expected-count={EXPECTED_CORE_EQUIPMENT_IDS.length}
      data-equipment-body-tint-parity={bodyTintCount === EXPECTED_CORE_EQUIPMENT_IDS.length ? "PASS" : "FAIL"}
      data-equipment-body-tint-material-count={bodyTintMaterialCount}
      data-equipment-body-tint-scope="painted-shell-only-excludes-pipes-flanges-instruments-shafts-and-guards"
      data-equipment-body-tint-runtime-only="true"
      data-equipment-body-tint-fault-pulse-only="true"
      data-equipment-state-evidence={equipmentStateEvidence}
      data-equipment-state-readable={`${runtimeAnimationPlan.readableEquipmentStateCount}/${runtimeAnimationPlan.expectedEquipmentCount}`}
      data-equipment-state-count-total={equipmentStateCountTotal}
      data-equipment-status-filter={statusFilter || "all"}
      data-equipment-filter-match-count={equipmentFilterMatchCount}
      data-equipment-counts-invariant={equipmentCountsInvariant ? "PASS" : "FAIL"}
      data-equipment-anomaly-navigation="fault-and-unknown-read-only"
      data-equipment-status-lod-semantic-scaling="lightband-always-badge-progressive-v1"
      data-chiller-status-display="compact-strip-and-docked-inspector-v3"
      data-chiller-persistent-model-placard-count="0"
      data-selected-equipment-detail-max-count="0"
      data-selected-equipment-detail-visible="0"
      data-device-hover-metric-mode="exact-device-primary-read-only-v1"
      data-device-hover-raycast="54-status-marker-proxies-raf-throttled"
      data-process-metric-anchor-count={processMetrics.length}
      data-process-metric-evidence="per-metric-stale-or-unbound"
      data-blank-canvas-clears-selection="true"
      data-canvas-selection-event-order="pointer-and-click-capture-clear-before-three-pick-v2"
      data-chiller-status-strip-mode="glyph-id-tooltip-v2"
      data-chiller-status-count={chillerStateRows.length}
      data-chiller-row-order={CHILLER_TOP_TO_BOTTOM_ORDER.join("-")}
      data-chiller-row-order-contract="CH1-top-CH7-bottom"
      data-equipment-running-count={runtimeAnimationPlan.equipmentStateCounts.running}
      data-equipment-fault-count={runtimeAnimationPlan.equipmentStateCounts.fault}
      data-equipment-stopped-count={runtimeAnimationPlan.equipmentStateCounts.stopped}
      data-equipment-standby-count={runtimeAnimationPlan.equipmentStateCounts.standby}
      data-equipment-unknown-count={runtimeAnimationPlan.equipmentStateCounts.unknown}
      data-selected-equipment-status={selectedEquipmentState?.state || "unknown"}
      data-selected-equipment-status-evidence={selectedEquipmentState?.evidenceMode || "unbound"}
      data-selected-equipment-status-authority={selectedEquipmentState?.authority || "none"}
      data-selected-equipment-status-duration="unavailable"
      data-selected-equipment-status-duration-basis="missing-authoritative-changed-at"
      data-animation-mode={animationMode}
      data-animation-display-state={runtimeDisplayState}
      data-animation-authority={demoAnimationEnabled
        ? "schematic-demo"
        : runtimeEvidenceState === "LIVE"
          ? "authoritative-live"
          : shadowAnimationAvailable
            ? "unverified-shadow"
            : "none"}
      data-animation-playing-count={demoAnimationEnabled ? animationCount : runtimeAnimationPlan.playingEquipmentCount}
      data-live-equipment-evidence={`${runtimeAnimationPlan.liveEquipmentCount}/${runtimeAnimationPlan.expectedEquipmentCount}`}
      data-shadow-equipment-readable={`${runtimeAnimationPlan.shadowReadableEquipmentCount}/${runtimeAnimationPlan.expectedEquipmentCount}`}
      data-live-animation-playing-count={runtimeAnimationPlan.playingLiveEquipmentCount}
      data-shadow-animation-playing-count={runtimeAnimationPlan.playingShadowEquipmentCount}
      data-flow-animation-evidence={demoAnimationEnabled ? "schematic-demo" : "unbound-paused"}
      data-runtime-source-key={runtimeSummary?.pointEvidence?.sourceKey || "unbound"}
      data-camera-fit="reference-angle-bottom-safe-obb-fit-v6"
      data-camera-fit-geometry="visible-mesh-obb-corners"
      data-camera-default-view="tower-left-chiller-center-manifold-right-v5"
      data-camera-default-direction={DEFAULT_CAMERA_VIEW_DIRECTION_CONTRACT}
      data-camera-overlay-layout="compact-two-row-v1"
      data-camera-initial-composition="wide-scale-0.89-y-responsive-minus60to96px-more-topdown-bottom-safe-mobile-conservative"
      data-camera-interaction="preserve-on-resize"
      data-control-boundary="visualization-only-no-ba-plc-write"
    >
      {!embedded ? <div className="scene-system-diagram-topbar">
        <div className="scene-system-diagram-copy">
          <span>B25 · 全站展示模型</span>
          <strong>{profile.displayName}</strong>
          <p>54 个 B25 核心设备显示运行、故障、待机、停机四态；缺少精确证据时降级为未确认，SHADOW标注时效不可证，水流默认暂停。</p>
        </div>
      </div> : null}

      {!embedded ? <div className="scene-system-diagram-meta">
        <div className="scene-system-diagram-stat"><label>LOD</label><strong>{activeLod || "--"}</strong></div>
        <div className="scene-system-diagram-stat"><label>动画</label><strong>{animationCount}</strong></div>
        <div className="scene-system-diagram-stat"><label>运行目标</label><strong>{runtimeTargetCount}</strong></div>
        <div className="scene-system-diagram-stat"><label>状态可读</label><strong>{runtimeAnimationPlan.readableEquipmentStateCount}/54</strong></div>
      </div> : null}

      <div className="scene-system-diagram-shell plant-overview-shell">
        <div className="scene-system-diagram-shell-hud">
          <div className={`plant-overview-overlay-stack${selectedEquipmentId ? " is-inspection-expanded" : " is-default-compact"}`}>
            <div className={`scene-system-diagram-shell-copy${selectedEquipmentId ? " is-inspection-expanded" : " is-default-compact"}`}>
              <span>观澜 B25 · 只读三维展示</span>
              <strong>{selectedEquipmentId || profile.displayName}</strong>
              <small>{selectedEquipmentId ? `模型设备 ${selectedEquipmentId}` : "7 台主机 · 7+7 台水泵 · 6 塔组 / 33 台风机"}</small>
              {selectedEquipmentState ? <small
                className={`plant-overview-selected-state is-${selectedEquipmentState.state} is-${selectedEquipmentState.evidenceMode}`}
              >
                {EQUIPMENT_STATE_LABELS[selectedEquipmentState.state]} · {EQUIPMENT_STATE_EVIDENCE_LABELS[selectedEquipmentState.evidenceMode]}
              </small> : null}
            </div>
            <details
              className="plant-overview-coverage"
              data-binding-coverage={bindingIdentityVerified ? "full-core-read-only" : "unbound-incomplete"}
            >
              <summary>
                <span className={`plant-overview-evidence is-${runtimeDisplayState.toLowerCase()}`}>
                  {EQUIPMENT_STATE_EVIDENCE_SUMMARY_LABELS[runtimeDisplayState]}
                </span>
                <strong>只读设备与数据状态</strong>
              </summary>
              <div className="plant-overview-coverage-body">
                <span>
                  {bindingIdentityVerified
                    ? "主机 7/7 · 冷冻泵 7/7 · 冷却泵 7/7 · 塔组 6/6 · 风机 33/33"
                    : "设备身份覆盖未完成验真"}
                </span>
                <small>{bindingLabel}</small>
                <small>设备状态：运行 {runtimeAnimationPlan.equipmentStateCounts.running} · 故障 {runtimeAnimationPlan.equipmentStateCounts.fault} · 待机 {runtimeAnimationPlan.equipmentStateCounts.standby} · 停机 {runtimeAnimationPlan.equipmentStateCounts.stopped} · 未确认 {runtimeAnimationPlan.equipmentStateCounts.unknown}</small>
                <div className="plant-overview-equipment-group-counts" aria-label="设备分类状态汇总">
                  {equipmentGroupStateCounts.map(({ runtimeGroup, label, counts }) => <small
                    key={runtimeGroup}
                    data-equipment-runtime-group={runtimeGroup}
                  >
                    {label}：运行 {counts.running} · 故障 {counts.fault} · 待机 {counts.standby} · 停机 {counts.stopped} · 未确认 {counts.unknown}
                  </small>)}
                </div>
                <small>动画资产 {animationCount}/{profile.expectedAnimationCount} · 运行目标 {runtimeTargetCount}/{profile.expectedRuntimeTargetCount}</small>
                <small>本体状态色：54台设备运行时轻着色 · 仅涂装外壳 · 原始PBR及管路材质保持不变</small>
                <small>设备运动：LIVE {runtimeAnimationPlan.playingLiveEquipmentCount} · SHADOW {runtimeAnimationPlan.playingShadowEquipmentCount} · 水流 {demoAnimationEnabled ? "DEMO" : "已暂停"}</small>
                <button
                  type="button"
                  className="plant-overview-demo-toggle"
                  onClick={() => setDemoAnimationEnabled((value) => !value)}
                  aria-pressed={demoAnimationEnabled}
                  data-animation-mode={animationMode}
                >
                  {demoAnimationEnabled ? "暂停演示动画" : "播放演示动画"}
                </button>
                <small className="plant-overview-demo-note">{runtimeEvidenceNote}</small>
              </div>
            </details>
          </div>
          <div className="plant-overview-status-cluster">
            <div className="scene-system-diagram-shell-chip-group">
              <span className="scene-system-diagram-shell-chip">画质 {activeQualityLabel}</span>
              <span className={`plant-overview-evidence is-${equipmentStateEvidence.toLowerCase()}`}>
                {EQUIPMENT_STATE_EVIDENCE_SUMMARY_LABELS[equipmentStateEvidence]}
              </span>
            </div>
            <div
              className="plant-overview-state-legend plant-overview-status-filter"
              aria-label="设备运行状态筛选"
              style={{ pointerEvents: "auto" }}
            >
              {(["running", "fault", "standby", "stopped", "unknown"] as EquipmentOperationalState[]).map((state) => (
                <button
                  type="button"
                  key={state}
                  className={`plant-overview-equipment-state is-${state} is-${equipmentStateEvidence.toLowerCase()}${statusFilter === state ? " is-filter-active" : statusFilter !== null ? " is-filter-dimmed" : ""}`}
                  onClick={() => setStatusFilter((current) => current === state ? null : state)}
                  aria-pressed={statusFilter === state}
                  data-equipment-status-filter={state}
                >
                  <b aria-hidden="true">{EQUIPMENT_STATE_SHAPES[state].glyph}</b>
                  {EQUIPMENT_STATE_LABELS[state]} {runtimeAnimationPlan.equipmentStateCounts[state]}
                </button>
              ))}
              {statusFilter ? <button
                type="button"
                className="plant-overview-equipment-state plant-overview-status-filter-clear"
                onClick={() => setStatusFilter(null)}
              >
                清除筛选 · 显示54台
              </button> : null}
            </div>
            <div
              className="plant-overview-anomaly-navigation plant-overview-exception-nav"
              aria-label="设备异常导航"
              style={{ pointerEvents: "auto" }}
            >
              <button
                type="button"
                onClick={() => navigateEquipmentAnomaly(-1)}
                disabled={equipmentAnomalies.length === 0}
              >上一异常</button>
              <span>故障/未确认 {equipmentAnomalies.length}</span>
              <button
                type="button"
                onClick={() => navigateEquipmentAnomaly(1)}
                disabled={equipmentAnomalies.length === 0}
              >下一异常</button>
            </div>
            <div
              className="plant-overview-chiller-status-strip"
              aria-label="主机逐台运行状态，CH1至CH7"
              data-chiller-status-count={chillerStateRows.length}
              data-chiller-status-strip-mode="glyph-id-tooltip-v2"
            >
              <span className="plant-overview-chiller-status-title">主机</span>
              {chillerStateRows.map((decision) => <button
                type="button"
                key={decision.equipmentId}
                className={`plant-overview-chiller-status is-${decision.state} is-${decision.evidenceMode}${selectedEquipmentId === decision.equipmentId ? " is-selected" : ""}`}
                onClick={() => selectEquipmentForInspection(decision.equipmentId)}
                data-equipment-id={decision.equipmentId}
                data-equipment-operational-state={decision.state}
                data-equipment-state-evidence={decision.evidenceMode}
                data-equipment-status-shape={EQUIPMENT_STATE_SHAPES[decision.state].contract}
                aria-label={`${decision.equipmentId} ${EQUIPMENT_STATE_LABELS[decision.state]} · ${EQUIPMENT_STATE_EVIDENCE_LABELS[decision.evidenceMode]}`}
                title={`${decision.equipmentId} ${EQUIPMENT_STATE_LABELS[decision.state]} · ${EQUIPMENT_STATE_EVIDENCE_LABELS[decision.evidenceMode]}`}
              >
                <b aria-hidden="true">{EQUIPMENT_STATE_SHAPES[decision.state].glyph}</b>
                <span>{decision.equipmentId}</span>
              </button>)}
            </div>
          </div>
        </div>

        <div className="scene-system-diagram-shell-zones plant-overview-zones">
          <span className="scene-system-diagram-shell-zone">冷冻水系统</span>
          <span className="scene-system-diagram-shell-zone">主机与水泵</span>
          <span className="scene-system-diagram-shell-zone">冷却水及塔组</span>
        </div>
        <ul className="plant-overview-equipment-state-contract" aria-label="54台核心设备只读运行状态">
          {equipmentStateRows.map((decision) => <li
            key={decision.equipmentId}
            data-equipment-id={decision.equipmentId}
            data-equipment-operational-state={decision.state}
            data-equipment-state-evidence={decision.evidenceMode}
            data-equipment-state-authority={decision.authority}
            data-equipment-state-reason={decision.reason}
            data-equipment-status-shape={EQUIPMENT_STATE_SHAPES[decision.state].contract}
            data-equipment-filter-match={statusFilter === null || decision.state === statusFilter ? "true" : "false"}
            data-equipment-body-tint="painted-shell-runtime-only"
            data-equipment-alarm-state="unbound"
            data-equipment-diagnostic-state="unbound"
          >
            {decision.equipmentId} · {EQUIPMENT_STATE_SHAPES[decision.state].glyph} · {EQUIPMENT_STATE_LABELS[decision.state]} · {EQUIPMENT_STATE_EVIDENCE_LABELS[decision.evidenceMode]}
          </li>)}
        </ul>
        <div ref={mountRef} className="scene-system-diagram-canvas plant-overview-canvas" />

        <div
          ref={processMetricOverlayRef}
          className="plant-overview-process-metrics"
          aria-label="全站关键工艺测点"
          data-process-metric-layout="world-projected-header-anchors-v1"
        >
          {processMetrics.map((metric) => <div
            key={metric.key}
            className={`plant-overview-process-metric is-${metric.tone} is-${metric.evidenceMode}`}
            data-process-metric-anchor={metric.key}
            data-anchor-x={metric.anchor[0]}
            data-anchor-y={metric.anchor[1]}
            data-anchor-z={metric.anchor[2]}
            data-metric-evidence={metric.evidenceMode}
            style={{ display: "none" }}
          >
            <span>{metric.label}</span>
            <strong>{metric.valueText}</strong>
            <small>{metric.evidenceMode === "unbound" ? "未绑定（UNBOUND）" : "影子（SHADOW）· 时效不可证"}</small>
          </div>)}
        </div>

        {hoveredEquipment && hoveredEquipmentState ? <div
          className={`plant-overview-hover-metric is-${hoveredEquipmentState.state} is-${hoveredEquipmentState.evidenceMode}`}
          style={{ left: hoveredEquipment.x, top: hoveredEquipment.y }}
          role="tooltip"
          data-hover-equipment-id={hoveredEquipmentState.equipmentId}
          data-hover-metric-key={hoveredPrimaryMetric?.key || "unbound"}
          data-hover-metric-evidence={hoveredPrimaryMetric?.evidenceMode || "unbound"}
        >
          <div>
            <strong>{hoveredEquipmentState.equipmentId}</strong>
            <span>{EQUIPMENT_STATE_SHAPES[hoveredEquipmentState.state].glyph} {EQUIPMENT_STATE_LABELS[hoveredEquipmentState.state]}</span>
          </div>
          <p>
            <span>{hoveredPrimaryMetric?.label || "关键参数"}</span>
            <b>{hoveredPrimaryMetric?.value === null || hoveredPrimaryMetric === null
              ? "--"
              : `${hoveredPrimaryMetric.value.toFixed(1)} ${hoveredPrimaryMetric.unit}`}</b>
          </p>
          <small>{hoveredPrimaryMetric
            ? EQUIPMENT_STATE_EVIDENCE_LABELS[hoveredPrimaryMetric.evidenceMode]
            : "未绑定（UNBOUND）"}</small>
        </div> : null}

        {loadState !== "ready" ? <div className={`plant-overview-load-status is-${loadState}`} role="status" aria-live="polite">
          {loadState === "loading" ? <Activity size={14} className="is-spinning" /> : <Box size={14} />}
          <span>{loadMessage}</span>
        </div> : null}

        <div className="plant-overview-controls-hint" aria-hidden="true">
          <span><Rotate3D size={13} /> 拖动旋转</span>
          <span><MousePointer2 size={13} /> 滚轮缩放 / 点击设备</span>
        </div>

        <div className="scene-system-diagram-shell-footer">
          <span>只读展示 · 禁止 BA/PLC 写入</span>
          <strong>{animationModeLabel}</strong>
        </div>
      </div>

      {!embedded ? <SystemDiagramInspector
        selectedNode={selectedNode}
        devicePageHref={bindingAuthoritative ? devicePageHref : null}
        operationalEvidence={bindingAuthoritative && operationalEvidence}
      /> : null}
    </section>
  );
}
