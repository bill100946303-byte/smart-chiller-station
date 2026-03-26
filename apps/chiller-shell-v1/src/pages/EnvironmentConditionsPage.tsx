import { startTransition, useEffect, useState } from "react";
import { ExternalLink } from "lucide-react";
import SectionCard from "../components/common/SectionCard";
import SourceStatusBanner from "../components/common/SourceStatusBanner";
import StatCard from "../components/common/StatCard";
import { runtimeConfig } from "../config/runtimeConfig";
import { buildSourceStatusLines, formatSourceStatusLine, summarizeSourceStatus } from "../i18n/sourceStatusCN";
import { zhCN } from "../i18n/zhCN";
import {
  type EnvironmentBuildingItemDto,
  type EnvironmentBuildingListDto,
  type EnvironmentConditionItemDto,
  type EnvironmentConditionListDto,
  type SourceEndpointStatusDto,
  fetchEnvironmentBuildings,
  fetchEnvironmentConditions
} from "../services/bffClient";

type SummaryCard = {
  title: string;
  value: string;
  unit: string;
  delta: string;
  tone: "neutral" | "good" | "warn";
};

function buildLegacyHashRedirect(path: string): string {
  const url = new URL(runtimeConfig.legacyBaseUrl);
  url.hash = path.startsWith("/") ? path : `/${path}`;
  return url.toString();
}

function buildSummaryCards(
  buildings: EnvironmentBuildingListDto | null,
  conditions: EnvironmentConditionListDto | null,
  buildingId: string
): SummaryCard[] {
  const buildingCount = buildings?.items?.length || 0;
  const pointCount = conditions?.items?.length || 0;
  const selectedBuilding = (buildings?.items || []).find((item) => item.id === buildingId) || null;
  const sourceOverall = conditions?.sourceStatus?.overall || "failed";
  const sourceReady = sourceOverall === "ok";
  const sourceCompatible = !sourceReady && sourceOverall === "partial" && pointCount > 0;
  const sourceValue = sourceReady
    ? zhCN.environmentPage.stateReady
    : sourceCompatible
      ? zhCN.environmentPage.stateCompatible
      : zhCN.environmentPage.stateFallback;
  const sourceTone: SummaryCard["tone"] = sourceReady || sourceCompatible ? "good" : "warn";
  return [
    {
      title: zhCN.environmentPage.summaryBuildings,
      value: String(buildingCount),
      unit: zhCN.common.unitItem,
      delta: zhCN.environmentPage.summaryBuildingsHint,
      tone: buildingCount > 0 ? "good" : "warn"
    },
    {
      title: zhCN.environmentPage.summaryPoints,
      value: String(pointCount),
      unit: zhCN.common.unitItem,
      delta: zhCN.environmentPage.summaryPointsHint,
      tone: pointCount > 0 ? "good" : "warn"
    },
    {
      title: zhCN.environmentPage.summarySelectedBuilding,
      value: selectedBuilding?.name || zhCN.common.unknown,
      unit: "",
      delta: zhCN.environmentPage.summarySelectedBuildingHint,
      tone: selectedBuilding ? "neutral" : "warn"
    },
    {
      title: zhCN.environmentPage.summaryState,
      value: sourceValue,
      unit: "",
      delta: zhCN.environmentPage.summaryStateHint,
      tone: sourceTone
    }
  ];
}

function valueOrFallback(value: string | null | undefined, fallback: string = "--"): string {
  const normalized = String(value || "").trim();
  return normalized || fallback;
}

function collectSourceDiagnostics(
  sourceStatuses: Array<EnvironmentBuildingListDto["sourceStatus"] | EnvironmentConditionListDto["sourceStatus"] | null | undefined>
): SourceEndpointStatusDto[] {
  const merged = new Map<string, SourceEndpointStatusDto>();
  sourceStatuses.forEach((sourceStatus) => {
    (sourceStatus?.sources || []).forEach((source, index) => {
      const mergeKey = source.key || source.endpoint || `environment-source-${index}`;
      if (!merged.has(mergeKey)) {
        merged.set(mergeKey, source);
      }
    });
  });

  return Array.from(merged.values()).sort((left, right) => {
    const rank = (source: SourceEndpointStatusDto) => {
      if (source.ok === true) {
        return 2;
      }
      if (typeof source.status === "number" && source.status >= 400) {
        return 0;
      }
      return 1;
    };
    return rank(left) - rank(right);
  });
}

export default function EnvironmentConditionsPage() {
  const [buildingId, setBuildingId] = useState("");
  const [coolingOnly, setCoolingOnly] = useState(false);
  const [monitoringSite, setMonitoringSite] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [buildings, setBuildings] = useState<EnvironmentBuildingListDto | null>(null);
  const [conditions, setConditions] = useState<EnvironmentConditionListDto | null>(null);
  const [buildingError, setBuildingError] = useState<string | null>(null);
  const [conditionError, setConditionError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadBuildings() {
      try {
        const result = await fetchEnvironmentBuildings(runtimeConfig.siteId);
        if (!active) {
          return;
        }
        startTransition(() => {
          setBuildings(result);
          setBuildingError(null);
          if (!buildingId) {
            setBuildingId(String(result.items?.[0]?.id || ""));
          }
        });
      } catch (_error) {
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
      if (!buildingId) {
        startTransition(() => {
          setConditions(null);
          setConditionError(null);
          setLoading(false);
          setSelectedId("");
        });
        return;
      }

      setLoading(true);
      try {
        const result = await fetchEnvironmentConditions(runtimeConfig.siteId, {
          buildingId,
          cooledAir: coolingOnly ? "1" : "0",
          monitoringSite: monitoringSite.trim()
        });
        if (!active) {
          return;
        }
        const items = result.items || [];
        startTransition(() => {
          setConditions(result);
          setConditionError(null);
          setLoading(false);
          setSelectedId((current) => (items.some((item) => item.id === current) ? current : String(items[0]?.id || "")));
        });
      } catch (_error) {
        if (!active) {
          return;
        }
        startTransition(() => {
          setConditions(null);
          setConditionError(zhCN.environmentPage.conditionLoadFailed);
          setLoading(false);
          setSelectedId("");
        });
      }
    }

    loadConditions();
    return () => {
      active = false;
    };
  }, [buildingId, coolingOnly, monitoringSite]);

  const sourceSummary = summarizeSourceStatus([buildings?.sourceStatus, conditions?.sourceStatus]);
  const sourceStatusLines = buildSourceStatusLines([buildings?.sourceStatus, conditions?.sourceStatus]);
  const sourceStatusLinesCompact = buildSourceStatusLines([buildings?.sourceStatus, conditions?.sourceStatus], {
    labelMode: "short"
  });
  const sourceDiagnostics = collectSourceDiagnostics([buildings?.sourceStatus, conditions?.sourceStatus]);
  const summaryCards = buildSummaryCards(buildings, conditions, buildingId);
  const buildingOptions = buildings?.items || [];
  const conditionItems = conditions?.items || [];
  const selectedCondition =
    conditionItems.find((item) => item.id === selectedId)
    || conditionItems[0]
    || null;
  const selectedBuilding =
    buildingOptions.find((item) => item.id === buildingId)
    || buildingOptions[0]
    || null;
  const buildingSourceFailed = buildings?.sourceStatus?.overall === "failed";
  const conditionSourceFailed = conditions?.sourceStatus?.overall === "failed";
  const bannerText =
    buildingError
    || conditionError
    || (loading
      ? zhCN.environmentPage.loading
      : buildingSourceFailed
        ? zhCN.environmentPage.buildingLoadFailed
        : conditionSourceFailed
          ? zhCN.environmentPage.conditionLoadFailed
          : sourceSummary.text);
  const bannerWarn = Boolean(conditionError || buildingError) || sourceSummary.warn;
  const listEmptyText =
    buildingError
    || conditionError
    || (loading
      ? zhCN.environmentPage.loading
      : conditionSourceFailed
        ? zhCN.environmentPage.conditionLoadFailed
        : zhCN.environmentPage.empty);
  const legacyEnvironmentUrl = buildLegacyHashRedirect("/environment/index");

  return (
    <div className="environment-compat-page page-enter">
      <section className="environment-compat-header">
        <div>
          <h2>{zhCN.environmentPage.heading}</h2>
          <p>{zhCN.environmentPage.subtitle}</p>
        </div>
        <a className="environment-compat-link" href={legacyEnvironmentUrl} target="_blank" rel="noreferrer">
          <ExternalLink size={14} />
          {zhCN.environmentPage.openLegacy}
        </a>
      </section>

      <div className="environment-compat-summary-grid">
        {summaryCards.map((item) => (
          <StatCard key={item.title} title={item.title} value={item.value} unit={item.unit} delta={item.delta} tone={item.tone} />
        ))}
      </div>

      <div className="environment-compat-layout">
        <SectionCard title={zhCN.environmentPage.sectionFilters}>
          <div className="environment-compat-filter-grid">
            <label className="environment-compat-field">
              <span>{zhCN.environmentPage.filterBuilding}</span>
              <select value={buildingId} onChange={(event) => setBuildingId(event.target.value)}>
                <option value="">{zhCN.environmentPage.filterBuildingPlaceholder}</option>
                {buildingOptions.map((item: EnvironmentBuildingItemDto) => (
                  <option key={item.id} value={item.id}>
                    {item.name || item.id || ""}
                  </option>
                ))}
              </select>
            </label>
            <label className="environment-compat-field">
              <span>{zhCN.environmentPage.filterMonitoringSite}</span>
              <input
                type="text"
                value={monitoringSite}
                onChange={(event) => setMonitoringSite(event.target.value)}
                placeholder={zhCN.environmentPage.filterMonitoringSitePlaceholder}
              />
            </label>
            <label className="environment-compat-checkbox">
              <input
                type="checkbox"
                checked={coolingOnly}
                onChange={(event) => setCoolingOnly(event.target.checked)}
              />
              <span>{zhCN.environmentPage.filterCoolingOnly}</span>
            </label>
          </div>
          <p className="environment-compat-note">
            {selectedBuilding?.description || zhCN.environmentPage.buildingDescriptionFallback}
          </p>
        </SectionCard>

        <SectionCard title={zhCN.environmentPage.sectionList}>
          {conditionItems.length > 0 ? (
            <div className="environment-compat-list">
              {conditionItems.map((item: EnvironmentConditionItemDto) => (
                <button
                  key={item.id || item.monitoringSite}
                  type="button"
                  className={`environment-compat-list-item${selectedCondition?.id === item.id ? " is-active" : ""}`}
                  onClick={() => setSelectedId(String(item.id || ""))}
                >
                  <strong>{valueOrFallback(item.monitoringSite)}</strong>
                  <span>{`${zhCN.environmentPage.metricTemperature} ${valueOrFallback(item.temperatureValue)}`}</span>
                  <span>{`${zhCN.environmentPage.metricHumidity} ${valueOrFallback(item.humidityValue)}`}</span>
                </button>
              ))}
            </div>
          ) : (
            <div className="environment-compat-empty">
              {listEmptyText}
            </div>
          )}
        </SectionCard>
        <div className="environment-compat-main">
          <SectionCard title={zhCN.environmentPage.sectionList}>
            {conditionItems.length > 0 ? (
              <div className="environment-compat-list">
                {conditionItems.map((item: EnvironmentConditionItemDto) => (
                  <button
                    key={item.id || item.monitoringSite}
                    type="button"
                    className={`environment-compat-list-item${selectedCondition?.id === item.id ? " is-active" : ""}`}
                    onClick={() => setSelectedId(String(item.id || ""))}
                  >
                    <strong>{valueOrFallback(item.monitoringSite)}</strong>
                    <span>{`${zhCN.environmentPage.metricTemperature} ${valueOrFallback(item.temperatureValue)}`}</span>
                    <span>{`${zhCN.environmentPage.metricHumidity} ${valueOrFallback(item.humidityValue)}`}</span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="environment-compat-empty">
                {listEmptyText}
              </div>
            )}
          </SectionCard>

          <SectionCard title={zhCN.environmentPage.sectionDetail}>
            <div className="environment-compat-detail-header">
              <h3>{valueOrFallback(selectedCondition?.monitoringSite, zhCN.environmentPage.detailFallback)}</h3>
              <span>{zhCN.environmentPage.readOnlyNotice}</span>
            </div>
            <div className="environment-compat-metric-grid">
              <article>
                <span>{zhCN.environmentPage.metricTemperature}</span>
                <strong>{valueOrFallback(selectedCondition?.temperatureValue)}</strong>
              </article>
              <article>
                <span>{zhCN.environmentPage.metricHumidity}</span>
                <strong>{valueOrFallback(selectedCondition?.humidityValue)}</strong>
              </article>
              <article>
                <span>{zhCN.environmentPage.metricSupplyAir}</span>
                <strong>{valueOrFallback(selectedCondition?.supplyAirValue)}</strong>
              </article>
              <article>
                <span>{zhCN.environmentPage.metricReturnAir}</span>
                <strong>{valueOrFallback(selectedCondition?.returnAirValue)}</strong>
              </article>
            </div>
            <div className="environment-compat-setting-grid">
              <article>
                <span>{zhCN.environmentPage.settingTemperature}</span>
                <strong>{valueOrFallback(selectedCondition?.temperatureSetting)}</strong>
                <small>{`${zhCN.environmentPage.settingTemperatureMax} ${valueOrFallback(selectedCondition?.temperatureMax)}`}</small>
                <small>{`${zhCN.environmentPage.settingTemperatureDeviation} ${valueOrFallback(selectedCondition?.temperatureDeviation)}`}</small>
              </article>
              <article>
                <span>{zhCN.environmentPage.settingHumidity}</span>
                <strong>{valueOrFallback(selectedCondition?.humiditySetting)}</strong>
                <small>{`${zhCN.environmentPage.settingHumidityMax} ${valueOrFallback(selectedCondition?.humidityMax)}`}</small>
                <small>{`${zhCN.environmentPage.settingHumidityDeviation} ${valueOrFallback(selectedCondition?.humidityDeviation)}`}</small>
              </article>
              <article>
                <span>{zhCN.environmentPage.settingTemperatureTag}</span>
                <strong>{valueOrFallback(selectedCondition?.temperatureTagName)}</strong>
                <small>{`${zhCN.environmentPage.settingSupplyAirTag} ${valueOrFallback(selectedCondition?.supplyAirTagName)}`}</small>
                <small>{`${zhCN.environmentPage.settingReturnAirTag} ${valueOrFallback(selectedCondition?.returnAirTagName)}`}</small>
              </article>
              <article>
                <span>{zhCN.environmentPage.settingHumidityTag}</span>
                <strong>{valueOrFallback(selectedCondition?.humidityTagName)}</strong>
                <small>{zhCN.environmentPage.settingsUnavailable}</small>
              </article>
            </div>
          </SectionCard>
        </div>
      </div>

      <SectionCard title={zhCN.environmentPage.sectionDiagnostics}>
        <p className="environment-compat-diagnostics-hint">{zhCN.environmentPage.diagnosticsHint}</p>
        {sourceDiagnostics.length > 0 ? (
          <div className="environment-compat-diagnostics-grid">
            {sourceDiagnostics.map((source, index) => {
              const detail = [source.error, source.message].map((item) => String(item || "").trim()).find(Boolean)
                || zhCN.environmentPage.sourceHealthy;
              return (
                <article
                  key={`${source.key || source.endpoint || "environment-source"}-${index + 1}`}
                  className={`environment-compat-diagnostic-card${source.ok ? " is-ok" : " is-warn"}`}
                >
                  <strong>{formatSourceStatusLine(source)}</strong>
                  <div className="environment-compat-diagnostic-meta">
                    <span>{`${zhCN.environmentPage.sourceEndpoint} ${valueOrFallback(source.endpoint)}`}</span>
                    <span>{`${zhCN.environmentPage.sourceStatusCode} ${valueOrFallback(source.status == null ? null : String(source.status))}`}</span>
                    <span>{`${zhCN.environmentPage.sourceRows} ${valueOrFallback(source.rows == null ? null : String(source.rows))}`}</span>
                  </div>
                  <p>{detail}</p>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="environment-compat-empty">{zhCN.environmentPage.diagnosticsEmpty}</div>
        )}
      </SectionCard>

      <SourceStatusBanner
        summary={bannerText}
        warn={bannerWarn}
        detailLines={sourceStatusLines}
        detailLinesCompact={sourceStatusLinesCompact}
      />
    </div>
  );
}
