import { startTransition, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, RotateCcw, Search } from "lucide-react";
import { runtimeConfig } from "../config/runtimeConfig";
import { formatSourceStatusLineCompact, summarizeSourceStatus } from "../i18n/sourceStatusCN";
import { zhCN } from "../i18n/zhCN";
import {
  type EnvironmentBuildingItemDto,
  type EnvironmentBuildingListDto,
  type EnvironmentConditionItemDto,
  type EnvironmentConditionListDto,
  fetchEnvironmentBuildings,
  fetchEnvironmentConditions
} from "../services/bffClient";

type SummaryCard = {
  title: string;
  value: string;
  unit: string;
  detail: string;
  tone: "neutral" | "good" | "warn";
};

type ConditionEntry = {
  key: string;
  item: EnvironmentConditionItemDto;
};

type DerivedBoundaryMetrics = {
  boundaryCondition: EnvironmentConditionItemDto | null;
  dryBulb: number | null;
  humidity: number | null;
  wetBulb: number | null;
  dewPoint: number | null;
  enthalpy: number | null;
  coolingWaterOut: number | null;
  coolingWaterReturn: number | null;
  coolingDeltaT: number | null;
  towerApproach: number | null;
};

const OUTDOOR_KEYWORDS = ["室外", "户外", "气象", "冷却塔进风", "塔进风", "进风"];
const COOLING_OUT_KEYWORDS = ["冷却水出水", "冷却出水", "冷却水供水", "冷却塔出水", "出水总管"];
const COOLING_RETURN_KEYWORDS = ["冷却水回水", "冷却回水", "冷却水进水", "回水总管"];
const COOLING_KEYWORDS = ["冷却", "冷凝", "冷却塔", "室外", "湿球", "干球", "进风"];

function normalizeText(value: string | null | undefined): string {
  return String(value || "").trim();
}

function valueOrFallback(value: string | null | undefined, fallback = "--"): string {
  const normalized = normalizeText(value);
  return normalized || fallback;
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) {
    return zhCN.common.timeUnknown;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return zhCN.common.timeUnknown;
  }
  return date.toLocaleString();
}

function extractNumber(value: string | null | undefined): number | null {
  const normalized = normalizeText(value);
  if (!normalized) {
    return null;
  }
  const matched = normalized.match(/-?\d+(?:\.\d+)?/);
  if (!matched) {
    return null;
  }
  const parsed = Number(matched[0]);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatDelta(value: number | null, precision = 1): string {
  if (value == null || !Number.isFinite(value)) {
    return "--";
  }
  const rounded = value.toFixed(precision);
  return value > 0 ? `+${rounded}` : rounded;
}

function formatNumber(value: number | null, unit = "", precision = 1): string {
  if (value == null || !Number.isFinite(value)) {
    return "--";
  }
  return `${value.toFixed(precision)}${unit}`;
}

function sortBuildings(items: EnvironmentBuildingItemDto[]): EnvironmentBuildingItemDto[] {
  return [...items].sort((a, b) => {
    const left = normalizeText(a.name || a.id).toLocaleLowerCase();
    const right = normalizeText(b.name || b.id).toLocaleLowerCase();
    return left.localeCompare(right, "zh-CN");
  });
}

function sortConditions(items: EnvironmentConditionItemDto[]): EnvironmentConditionItemDto[] {
  return [...items].sort((a, b) => {
    const left = normalizeText(a.monitoringSite || a.id).toLocaleLowerCase();
    const right = normalizeText(b.monitoringSite || b.id).toLocaleLowerCase();
    return left.localeCompare(right, "zh-CN");
  });
}

function toConditionEntries(items: EnvironmentConditionItemDto[]): ConditionEntry[] {
  const used = new Set<string>();
  return items.map((item, index) => {
    const idPart = normalizeText(item.id);
    const sitePart = normalizeText(item.monitoringSite);
    let key = idPart || sitePart || `row-${index + 1}`;
    if (used.has(key)) {
      key = `${key}-${index + 1}`;
    }
    used.add(key);
    return { key, item };
  });
}

function includesKeyword(value: string, keywords: string[]): boolean {
  return keywords.some((keyword) => value.includes(keyword));
}

function findConditionByKeywords(
  items: EnvironmentConditionItemDto[],
  keywords: string[]
): EnvironmentConditionItemDto | null {
  return items.find((item) => includesKeyword(normalizeText(item.monitoringSite), keywords)) || null;
}

function estimateWetBulb(tempC: number | null, relativeHumidity: number | null): number | null {
  if (tempC == null || relativeHumidity == null) {
    return null;
  }
  const rh = Math.max(1, Math.min(100, relativeHumidity));
  const wetBulb =
    tempC * Math.atan(0.151977 * Math.sqrt(rh + 8.313659))
    + Math.atan(tempC + rh)
    - Math.atan(rh - 1.676331)
    + 0.00391838 * rh ** 1.5 * Math.atan(0.023101 * rh)
    - 4.686035;
  return Number.isFinite(wetBulb) ? wetBulb : null;
}

function estimateDewPoint(tempC: number | null, relativeHumidity: number | null): number | null {
  if (tempC == null || relativeHumidity == null) {
    return null;
  }
  const rh = Math.max(1, Math.min(100, relativeHumidity));
  const a = 17.27;
  const b = 237.7;
  const gamma = (a * tempC) / (b + tempC) + Math.log(rh / 100);
  const dewPoint = (b * gamma) / (a - gamma);
  return Number.isFinite(dewPoint) ? dewPoint : null;
}

function estimateEnthalpy(tempC: number | null, relativeHumidity: number | null): number | null {
  if (tempC == null || relativeHumidity == null) {
    return null;
  }
  const rh = Math.max(1, Math.min(100, relativeHumidity));
  const saturationPressure = 0.61078 * Math.exp((17.27 * tempC) / (tempC + 237.3));
  const vaporPressure = saturationPressure * (rh / 100);
  const humidityRatio = 0.62198 * vaporPressure / Math.max(0.01, 101.325 - vaporPressure);
  const enthalpy = 1.006 * tempC + humidityRatio * (2501 + 1.86 * tempC);
  return Number.isFinite(enthalpy) ? enthalpy : null;
}

function deriveBoundaryMetrics(items: EnvironmentConditionItemDto[], selected: EnvironmentConditionItemDto | null): DerivedBoundaryMetrics {
  const boundaryCondition =
    findConditionByKeywords(items, OUTDOOR_KEYWORDS)
    || selected
    || items[0]
    || null;
  const coolingOutCondition = findConditionByKeywords(items, COOLING_OUT_KEYWORDS);
  const coolingReturnCondition = findConditionByKeywords(items, COOLING_RETURN_KEYWORDS);
  const dryBulb = extractNumber(boundaryCondition?.temperatureValue);
  const humidity = extractNumber(boundaryCondition?.humidityValue);
  const wetBulb = estimateWetBulb(dryBulb, humidity);
  const dewPoint = estimateDewPoint(dryBulb, humidity);
  const enthalpy = estimateEnthalpy(dryBulb, humidity);
  const coolingWaterOut = extractNumber(coolingOutCondition?.temperatureValue);
  const coolingWaterReturn = extractNumber(coolingReturnCondition?.temperatureValue);
  const coolingDeltaT =
    coolingWaterOut != null && coolingWaterReturn != null
      ? coolingWaterReturn - coolingWaterOut
      : null;
  const towerApproach =
    coolingWaterOut != null && wetBulb != null
      ? coolingWaterOut - wetBulb
      : null;

  return {
    boundaryCondition,
    dryBulb,
    humidity,
    wetBulb,
    dewPoint,
    enthalpy,
    coolingWaterOut,
    coolingWaterReturn,
    coolingDeltaT,
    towerApproach
  };
}

function classifyCondition(item: EnvironmentConditionItemDto): string {
  const name = normalizeText(item.monitoringSite);
  if (includesKeyword(name, OUTDOOR_KEYWORDS)) {
    return "气象";
  }
  if (includesKeyword(name, COOLING_KEYWORDS)) {
    return "冷却侧";
  }
  if (name.includes("送风") || name.includes("回风") || name.includes("室内") || name.includes("房间")) {
    return "室内";
  }
  return "环境";
}

function controlMeaning(item: EnvironmentConditionItemDto): string {
  const name = normalizeText(item.monitoringSite);
  if (includesKeyword(name, OUTDOOR_KEYWORDS)) {
    return "冷却侧主边界";
  }
  if (includesKeyword(name, COOLING_OUT_KEYWORDS)) {
    return "冷却塔出水约束";
  }
  if (includesKeyword(name, COOLING_RETURN_KEYWORDS)) {
    return "冷凝负荷判断";
  }
  if (name.includes("冷冻水") || name.includes("供水")) {
    return "末端舒适约束";
  }
  if (name.includes("送风") || name.includes("回风")) {
    return "末端工况参考";
  }
  return "点位联查参考";
}

function buildSummaryCards(
  buildings: EnvironmentBuildingListDto | null,
  conditions: EnvironmentConditionListDto | null,
  buildingId: string
): SummaryCard[] {
  const buildingCount = buildings?.items?.length || 0;
  const pointCount = conditions?.items?.length || 0;
  const selectedBuilding = (buildings?.items || []).find((item) => String(item.id || "") === buildingId) || null;
  const sourceOverall = conditions?.sourceStatus?.overall || "failed";
  const sourceReady = sourceOverall === "ok";
  const sourceCompatible = !sourceReady && sourceOverall === "partial" && pointCount > 0;
  const sourceValue = sourceReady
    ? zhCN.environmentPage.stateReady
    : sourceCompatible
      ? zhCN.environmentPage.stateCompatible
      : zhCN.environmentPage.stateFallback;

  return [
    {
      title: zhCN.environmentPage.summaryBuildings,
      value: String(buildingCount),
      unit: zhCN.common.unitItem,
      detail: zhCN.environmentPage.summaryBuildingsHint,
      tone: buildingCount > 0 ? "good" : "warn"
    },
    {
      title: zhCN.environmentPage.summaryPoints,
      value: String(pointCount),
      unit: zhCN.common.unitItem,
      detail: zhCN.environmentPage.summaryPointsHint,
      tone: pointCount > 0 ? "good" : "warn"
    },
    {
      title: zhCN.environmentPage.summarySelectedBuilding,
      value: selectedBuilding?.name || zhCN.common.unknown,
      unit: "",
      detail: zhCN.environmentPage.summarySelectedBuildingHint,
      tone: selectedBuilding ? "neutral" : "warn"
    },
    {
      title: zhCN.environmentPage.summaryState,
      value: sourceValue,
      unit: "",
      detail: zhCN.environmentPage.summaryStateHint,
      tone: sourceReady || sourceCompatible ? "good" : "warn"
    }
  ];
}

export default function EnvironmentConditionsPage() {
  const [buildingId, setBuildingId] = useState("");
  const [isBuildingDropdownOpen, setIsBuildingDropdownOpen] = useState(false);
  const [coolingOnly, setCoolingOnly] = useState(false);
  const [monitoringSiteInput, setMonitoringSiteInput] = useState("");
  const [monitoringSiteQuery, setMonitoringSiteQuery] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [buildings, setBuildings] = useState<EnvironmentBuildingListDto | null>(null);
  const [conditions, setConditions] = useState<EnvironmentConditionListDto | null>(null);
  const [buildingError, setBuildingError] = useState<string | null>(null);
  const [conditionError, setConditionError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const buildingDropdownRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setMonitoringSiteQuery(monitoringSiteInput.trim());
    }, 320);
    return () => {
      window.clearTimeout(timer);
    };
  }, [monitoringSiteInput]);

  useEffect(() => {
    let active = true;

    async function loadBuildings() {
      try {
        const result = await fetchEnvironmentBuildings(runtimeConfig.siteId);
        if (!active) {
          return;
        }
        const sortedItems = sortBuildings(result.items || []);
        startTransition(() => {
          setBuildings({
            ...result,
            items: sortedItems
          });
          setBuildingError(null);
          setBuildingId((current) => current || String(sortedItems[0]?.id || ""));
        });
      } catch {
        if (!active) {
          return;
        }
        startTransition(() => {
          setBuildings(null);
          setBuildingError(zhCN.environmentPage.buildingLoadFailed);
        });
      }
    }

    loadBuildings();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    async function loadConditions() {
      setLoading(true);
      try {
        const result = await fetchEnvironmentConditions(runtimeConfig.siteId, {
          buildingId,
          cooledAir: coolingOnly ? "1" : "0",
          monitoringSite: monitoringSiteQuery
        });
        if (!active) {
          return;
        }

        const sortedItems = sortConditions(result.items || []);
        const entries = toConditionEntries(sortedItems);
        startTransition(() => {
          setConditions({
            ...result,
            items: sortedItems
          });
          setConditionError(null);
          setLoading(false);
          setSelectedId((current) => (entries.some((entry) => entry.key === current) ? current : (entries[0]?.key || "")));
        });
      } catch {
        if (!active) {
          return;
        }
        startTransition(() => {
          setConditions(null);
          setConditionError(zhCN.environmentPage.conditionLoadFailed);
          setSelectedId("");
          setLoading(false);
        });
      }
    }

    loadConditions();
    return () => {
      active = false;
    };
  }, [buildingId, coolingOnly, monitoringSiteQuery]);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node | null;
      if (target && buildingDropdownRef.current && !buildingDropdownRef.current.contains(target)) {
        setIsBuildingDropdownOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsBuildingDropdownOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  const sourceSummary = useMemo(
    () => summarizeSourceStatus([buildings?.sourceStatus, conditions?.sourceStatus]),
    [buildings?.sourceStatus, conditions?.sourceStatus]
  );
  const summaryCards = useMemo(
    () => buildSummaryCards(buildings, conditions, buildingId),
    [buildings, conditions, buildingId]
  );

  const buildingOptions = buildings?.items || [];
  const conditionItems = conditions?.items || [];
  const conditionEntries = useMemo(() => toConditionEntries(conditionItems), [conditionItems]);
  const selectedCondition = conditionEntries.find((entry) => entry.key === selectedId)?.item || conditionEntries[0]?.item || null;
  const selectedBuilding = buildingOptions.find((item) => String(item.id || "") === buildingId) || null;
  const selectedBuildingLabel = selectedBuilding?.name || zhCN.environmentPage.filterBuildingPlaceholder;
  const selectedPointLabel = selectedCondition
    ? valueOrFallback(selectedCondition.monitoringSite, zhCN.environmentPage.detailFallback)
    : zhCN.environmentPage.detailFallback;

  const boundaryMetrics = useMemo(
    () => deriveBoundaryMetrics(conditionItems, selectedCondition),
    [conditionItems, selectedCondition]
  );

  const buildingSourceFailed = buildings?.sourceStatus?.overall === "failed";
  const conditionSourceFailed = conditions?.sourceStatus?.overall === "failed";
  const buildingSourceMissing = buildingOptions.length === 0;
  const sourceSummaryText = buildingError
    || conditionError
    || (loading
      ? zhCN.environmentPage.loading
      : buildingSourceFailed
        ? zhCN.environmentPage.buildingLoadFailed
        : conditionSourceFailed
          ? zhCN.environmentPage.conditionLoadFailed
          : sourceSummary.text);
  const sourceStateLabel = summaryCards[3]?.value || zhCN.environmentPage.stateFallback;
  const latestFetchText = formatDateTime(conditions?.generatedAt || buildings?.generatedAt);
  const monitoringTagValue = monitoringSiteQuery || "全部点位";
  const coolingTagValue = coolingOnly ? "冷却相关" : "全部点位";

  const temperatureGap = useMemo(() => {
    if (!selectedCondition) {
      return null;
    }
    const current = extractNumber(selectedCondition.temperatureValue);
    const setting = extractNumber(selectedCondition.temperatureSetting);
    if (current == null || setting == null) {
      return null;
    }
    return current - setting;
  }, [selectedCondition]);

  const humidityGap = useMemo(() => {
    if (!selectedCondition) {
      return null;
    }
    const current = extractNumber(selectedCondition.humidityValue);
    const setting = extractNumber(selectedCondition.humiditySetting);
    if (current == null || setting == null) {
      return null;
    }
    return current - setting;
  }, [selectedCondition]);

  const metricCards = [
    {
      label: "室外湿球",
      value: formatNumber(boundaryMetrics.wetBulb, "°C"),
      detail: boundaryMetrics.wetBulb == null ? "需温湿度点位" : "冷却侧主边界",
      tone: "good"
    },
    {
      label: "室外干球",
      value: formatNumber(boundaryMetrics.dryBulb, "°C"),
      detail: "负荷修正",
      tone: "blue"
    },
    {
      label: "相对湿度",
      value: formatNumber(boundaryMetrics.humidity, "%", 0),
      detail: "湿球输入",
      tone: "blue"
    },
    {
      label: "露点温度",
      value: formatNumber(boundaryMetrics.dewPoint, "°C"),
      detail: "防凝露",
      tone: "blue"
    },
    {
      label: "空气焓值",
      value: formatNumber(boundaryMetrics.enthalpy, "", 1),
      detail: "kJ/kg，负荷修正",
      tone: "blue"
    },
    {
      label: "冷却塔接近度",
      value: formatNumber(boundaryMetrics.towerApproach, "°C"),
      detail: boundaryMetrics.towerApproach == null ? "需冷却水出水点位" : "出水 - 湿球",
      tone: boundaryMetrics.towerApproach != null && boundaryMetrics.towerApproach > 4 ? "warn" : "good"
    }
  ];

  const coolingPoints = conditionEntries.filter((entry) => includesKeyword(normalizeText(entry.item.monitoringSite), COOLING_KEYWORDS)).length;
  const reviewCount = conditionEntries.filter((entry) => !entry.item.temperatureValue && !entry.item.humidityValue).length;
  const tableEntries = conditionEntries.slice(0, 5);
  const sourceRows = [
    ...(conditions?.sourceStatus?.sources || []),
    ...(buildings?.sourceStatus?.sources || [])
  ].slice(0, 4).map((item, index) => ({
    key: item.key || item.interfaceKind || item.originLabel || `source-${index + 1}`,
    label: formatSourceStatusLineCompact(item),
    ok: item.ok !== false && item.fallback !== true,
    rows: typeof item.rows === "number" ? item.rows : null
  }));
  const sourceOverallOk = !buildingError && !conditionError && !sourceSummary.warn;
  const listEmptyText = buildingError
    || conditionError
    || (loading
      ? zhCN.environmentPage.loading
      : buildingSourceMissing
        ? "当前没有可选楼栋。"
        : conditionSourceFailed
          ? "当前楼栋的环境点位暂未返回数据。"
          : zhCN.environmentPage.empty);

  return (
    <div className="environment-compact-page-v2 page-enter">
      <section className="environment-compact-hero">
        <div className="environment-compact-hero-copy">
          <span className="environment-compact-label">{runtimeConfig.appModeLabel || "运行审计"}</span>
          <h2>{zhCN.environmentPage.heading}</h2>
          <div className="environment-compact-tags" aria-label="环境工况当前筛选">
            <span><strong>{zhCN.environmentPage.filterBuilding}</strong><em>{selectedBuildingLabel}</em></span>
            <span><strong>{zhCN.environmentPage.filterMonitoringSite}</strong><em>{monitoringTagValue}</em></span>
            <span><strong>{zhCN.environmentPage.filterCoolingOnly}</strong><em>{coolingTagValue}</em></span>
            <span><strong>{zhCN.environmentPage.selectedPoint}</strong><em>{selectedPointLabel}</em></span>
          </div>
        </div>
        <aside className="environment-compact-hero-side">
          <span className="environment-compact-label">{zhCN.environmentPage.summaryState}</span>
          <strong>{sourceStateLabel}</strong>
          <div className="environment-compact-status-list" aria-label="数据来源状态">
            <span className={sourceOverallOk ? "is-good" : "is-warn"}>{sourceSummaryText}</span>
          </div>
        </aside>
      </section>

      <section className="environment-compact-metrics" aria-label="环境与冷却边界指标">
        {metricCards.map((item) => (
          <article key={item.label} className={`environment-compact-metric is-${item.tone}`}>
            <span>{item.label}</span>
            <strong>{item.value}</strong>
            <small>{item.detail}</small>
          </article>
        ))}
      </section>

      <section className="environment-compact-workspace" aria-label="环境工况工作台">
        <article className="environment-compact-panel">
          <header className="environment-compact-panel-head">
            <h3>筛选与点位</h3>
            <span>{conditionEntries.length} 点</span>
          </header>
          <div className="environment-compact-panel-body">
            <div className="environment-compact-filters">
              <label className="environment-compact-field is-wide">
                <span>{zhCN.environmentPage.filterBuilding}</span>
                <div className="environment-filter-select" ref={buildingDropdownRef}>
                  <button
                    type="button"
                    className={`environment-filter-select-trigger${isBuildingDropdownOpen ? " is-open" : ""}`}
                    onClick={() => setIsBuildingDropdownOpen((current) => !current)}
                    disabled={buildingOptions.length === 0}
                    aria-haspopup="listbox"
                    aria-expanded={isBuildingDropdownOpen}
                    aria-controls="environment-building-listbox"
                  >
                    <span className="environment-filter-select-trigger-text">{selectedBuildingLabel}</span>
                    <ChevronDown className="environment-filter-select-caret" size={14} aria-hidden="true" />
                  </button>
                  {isBuildingDropdownOpen ? (
                    <div
                      id="environment-building-listbox"
                      className="environment-filter-select-menu"
                      role="listbox"
                      aria-label={zhCN.environmentPage.filterBuilding}
                    >
                      <button
                        type="button"
                        role="option"
                        aria-selected={buildingId === ""}
                        className={`environment-filter-select-option${buildingId === "" ? " is-active" : ""}`}
                        onClick={() => {
                          setBuildingId("");
                          setIsBuildingDropdownOpen(false);
                        }}
                        title={zhCN.environmentPage.filterBuildingPlaceholder}
                      >
                        <span className="environment-filter-select-option-label">{zhCN.environmentPage.filterBuildingPlaceholder}</span>
                      </button>
                      {buildingOptions.map((item) => {
                        const optionId = String(item.id || "");
                        const optionLabel = item.name || item.id || "";
                        const isActive = optionId === buildingId;
                        return (
                          <button
                            key={optionId}
                            type="button"
                            role="option"
                            aria-selected={isActive}
                            className={`environment-filter-select-option${isActive ? " is-active" : ""}`}
                            onClick={() => {
                              setBuildingId(optionId);
                              setIsBuildingDropdownOpen(false);
                            }}
                            title={optionLabel}
                          >
                            <span className="environment-filter-select-option-label">{optionLabel}</span>
                          </button>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              </label>
              <label className="environment-compact-field">
                <span>{zhCN.environmentPage.filterMonitoringSite}</span>
                <input
                  type="text"
                  value={monitoringSiteInput}
                  onChange={(event) => setMonitoringSiteInput(event.target.value)}
                  placeholder={zhCN.environmentPage.filterMonitoringSitePlaceholder}
                />
              </label>
              <label className="environment-compact-toggle">
                <input
                  type="checkbox"
                  checked={coolingOnly}
                  onChange={(event) => setCoolingOnly(event.target.checked)}
                />
                <span>{zhCN.environmentPage.filterCoolingOnly}</span>
              </label>
            </div>
            <div className="environment-compact-actions">
              <button
                type="button"
                className="environment-compact-button is-primary"
                onClick={() => setMonitoringSiteQuery(monitoringSiteInput.trim())}
              >
                <Search size={14} aria-hidden="true" />
                查询
              </button>
              <button
                type="button"
                className="environment-compact-button"
                onClick={() => {
                  setCoolingOnly(false);
                  setMonitoringSiteInput("");
                  setMonitoringSiteQuery("");
                }}
              >
                <RotateCcw size={14} aria-hidden="true" />
                重置
              </button>
            </div>
            <div className="environment-compact-point-list">
              {conditionEntries.length > 0 ? conditionEntries.slice(0, 5).map((entry) => {
                const name = valueOrFallback(entry.item.monitoringSite);
                const isActive = entry.key === selectedId;
                return (
                  <button
                    key={entry.key}
                    type="button"
                    className={`environment-compact-point${isActive ? " is-active" : ""}`}
                    onClick={() => setSelectedId(entry.key)}
                    title={name}
                  >
                    <span>
                      <strong>{name}</strong>
                      <small>{`${zhCN.environmentPage.metricTemperature} ${valueOrFallback(entry.item.temperatureValue)} · ${zhCN.environmentPage.metricHumidity} ${valueOrFallback(entry.item.humidityValue)}`}</small>
                    </span>
                    <em>{classifyCondition(entry.item)}</em>
                  </button>
                );
              }) : (
                <div className="environment-compact-empty">{listEmptyText}</div>
              )}
            </div>
          </div>
        </article>

        <article className="environment-compact-panel">
          <header className="environment-compact-panel-head">
            <h3>气象边界与点位台账</h3>
            <span>{`最新拉取 ${latestFetchText}`}</span>
          </header>
          <div className="environment-compact-chart-stage">
            <div className="environment-compact-chart-box">
              <div className="environment-compact-chart-head">
                <span>边界关联</span>
                <span>湿球 / 干球 / 接近度</span>
              </div>
              <svg viewBox="0 0 520 136" aria-label="气象边界关联图" role="img">
                <defs>
                  <linearGradient id="environment-area" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor="#58d3ff" stopOpacity="0.24" />
                    <stop offset="1" stopColor="#58d3ff" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <g stroke="rgba(156,203,233,.18)" strokeWidth="1">
                  <line x1="28" y1="22" x2="500" y2="22" />
                  <line x1="28" y1="59" x2="500" y2="59" />
                  <line x1="28" y1="96" x2="500" y2="96" />
                </g>
                <path d="M30 95 C84 88 116 83 154 77 C198 70 232 60 270 58 C318 55 350 68 398 62 C448 56 472 47 500 42 L500 124 L30 124 Z" fill="url(#environment-area)" />
                <path d="M30 95 C84 88 116 83 154 77 C198 70 232 60 270 58 C318 55 350 68 398 62 C448 56 472 47 500 42" fill="none" stroke="#58d3ff" strokeWidth="3" />
                <path d="M30 77 C90 70 124 69 164 63 C214 56 254 49 302 43 C362 38 424 34 500 31" fill="none" stroke="#ffc86d" strokeWidth="2" strokeDasharray="7 7" />
                <path d="M30 112 C108 110 170 108 240 106 C330 104 412 98 500 94" fill="none" stroke="#73f0b4" strokeWidth="2" />
              </svg>
            </div>
            <div className="environment-compact-note-list">
              <article>
                <span>控制含义</span>
                <strong>湿球优先；干球辅助。</strong>
              </article>
              <article>
                <span>当前判断</span>
                <strong>{boundaryMetrics.towerApproach == null ? "接近度缺冷却水出水点位。" : `接近度 ${formatNumber(boundaryMetrics.towerApproach, "°C")}`}</strong>
              </article>
              <article>
                <span>数据要求</span>
                <strong>气象、水温、塔频同窗联查。</strong>
              </article>
            </div>
          </div>
          <div className="environment-compact-table-wrap">
            <div className="environment-compact-tabs">
              <span className="is-active">全部 {conditionEntries.length}</span>
              <span>冷却侧 {coolingPoints}</span>
              <span>需复核 {reviewCount}</span>
            </div>
            {tableEntries.length > 0 ? (
              <table className="environment-compact-table">
                <thead>
                  <tr>
                    <th>监测点</th>
                    <th>类型</th>
                    <th>温度</th>
                    <th>湿度</th>
                    <th>设定/上限</th>
                    <th>控制意义</th>
                    <th>状态</th>
                  </tr>
                </thead>
                <tbody>
                  {tableEntries.map((entry) => (
                    <tr key={entry.key}>
                      <td title={valueOrFallback(entry.item.monitoringSite)}>{valueOrFallback(entry.item.monitoringSite)}</td>
                      <td>{classifyCondition(entry.item)}</td>
                      <td className="is-number">{valueOrFallback(entry.item.temperatureValue)}</td>
                      <td>{valueOrFallback(entry.item.humidityValue)}</td>
                      <td>{valueOrFallback(entry.item.temperatureSetting || entry.item.temperatureMax)}</td>
                      <td>{controlMeaning(entry.item)}</td>
                      <td className="is-ok">{entry.item.temperatureValue || entry.item.humidityValue ? "正常" : "复核"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="environment-compact-empty">{listEmptyText}</div>
            )}
          </div>
        </article>

        <article className="environment-compact-panel">
          <header className="environment-compact-panel-head">
            <h3>点位详情与来源</h3>
            <span>只读</span>
          </header>
          <div className="environment-compact-panel-body">
            <div className="environment-compact-detail-grid">
              <article>
                <span>选中点位</span>
                <strong className="is-name">{selectedPointLabel}</strong>
                <small>{controlMeaning(selectedCondition || {})}</small>
              </article>
              <article>
                <span>实时偏差</span>
                <strong>{formatDelta(temperatureGap)}°C</strong>
                <small>相对温度设定值</small>
              </article>
              <article>
                <span>{zhCN.environmentPage.settingTemperature}</span>
                <strong>{valueOrFallback(selectedCondition?.temperatureSetting)}</strong>
                <small>{`${zhCN.environmentPage.settingTemperatureMax} ${valueOrFallback(selectedCondition?.temperatureMax)}`}</small>
              </article>
              <article>
                <span>{zhCN.environmentPage.settingHumidity}</span>
                <strong>{valueOrFallback(selectedCondition?.humiditySetting)}</strong>
                <small>{`${zhCN.environmentPage.settingHumidityDeviation} ${formatDelta(humidityGap)}`}</small>
              </article>
            </div>
            <div className="environment-compact-source-list">
              {(sourceRows.length > 0 ? sourceRows : [
                {
                  key: "condition",
                  label: `工况点位：${sourceOverallOk ? "正常" : "需复核"}`,
                  ok: sourceOverallOk,
                  rows: conditionEntries.length
                },
                {
                  key: "buildinfo",
                  label: `楼栋主数据：${buildingError ? "需复核" : "正常"}`,
                  ok: !buildingError,
                  rows: buildingOptions.length
                }
              ]).map((item, index) => (
                <article key={`${item.key || index}`} className="environment-compact-source-row">
                  <span>
                    <strong>{item.label || "数据来源"}</strong>
                    <small>{typeof item.rows === "number" ? `${item.rows} 行` : "行数未知"}</small>
                  </span>
                  <em className={item.ok === false ? "is-warn" : "is-good"}>{item.ok === false ? "复核" : "正常"}</em>
                </article>
              ))}
              <article className="environment-compact-source-row">
                <span>
                  <strong>编辑边界</strong>
                  <small>编辑权限未开放；本页只读。</small>
                </span>
                <em className="is-good">只读</em>
              </article>
            </div>
          </div>
        </article>
      </section>

      <section className="environment-compact-boundary" aria-label="环境工况控制边界">
        <article>
          <span>优化主边界</span>
          <strong>塔侧优化：湿球</strong>
        </article>
        <article>
          <span>辅助变量</span>
          <strong>负荷修正：干球</strong>
        </article>
        <article>
          <span>质量门槛</span>
          <strong>≤10min / 单位完整</strong>
        </article>
        <article>
          <span>控制边界</span>
          <strong>只读 / 审批 / PLC执行</strong>
        </article>
      </section>
    </div>
  );
}
