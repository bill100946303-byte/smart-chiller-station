import { startTransition, useEffect, useMemo, useState } from "react";
import { runtimeConfig } from "../config/runtimeConfig";
import { summarizeSourceStatus } from "../i18n/sourceStatusCN";
import { zhCN } from "../i18n/zhCN";
import {
  type EnergyParameterDto,
  type EnergyParameterItemDto,
  fetchEnergyParameters,
  updateEnergyParameters
} from "../services/bffClient";

type PeriodFieldKey = "peakPeriod" | "averagePeriod" | "valleyPeriod" | "sharpTime";
type PriceFieldKey = "peakPrice" | "averagePrice" | "valleyPrice" | "sharpPrice";
type EnergyParameterFieldKey = keyof EnergyParameterItemDto;

type FieldErrors = Partial<Record<EnergyParameterFieldKey, string>>;

type NoticeState = {
  tone: "neutral" | "good" | "warn";
  message: string;
};

type PeriodSection = {
  periodKey: PeriodFieldKey;
  priceKey: PriceFieldKey;
  periodLabel: string;
  priceLabel: string;
  summaryTitle: string;
  shortLabel: string;
  tone: "neutral" | "good" | "warn";
  className: "sharp" | "peak" | "flat" | "valley";
};

type MetricCard = {
  title: string;
  value: string;
  detail: string;
  tone?: "good" | "warn" | "neutral";
};

type SourceRow = {
  label: string;
  detail: string;
  state: string;
  ok: boolean;
};

const TIME_OPTIONS = Array.from({ length: 24 }, (_, index) => `${String(index).padStart(2, "0")}:00`);
const ENERGY_PARAMETER_COUNT_FORMATTER = new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 0 });
const ENERGY_PARAMETER_INTEGER_GROUP_PATTERN = /\B(?=(\d{3})+(?!\d))/g;

const ENERGY_PARAMETER_DEGRADED_TEXT = "能源参数接口暂不可用";
const ENERGY_PARAMETER_SAVE_FAILED_TEXT = "能源参数保存失败";
const ENERGY_PARAMETER_VALIDATION_FAILED_TEXT = "表单校验未通过：必填、日期或时段冲突";
const ENERGY_PARAMETER_READ_ONLY_TEXT = "当前为只读模式，已阻止保存";

const PERIOD_SECTIONS: PeriodSection[] = [
  {
    periodKey: "sharpTime",
    priceKey: "sharpPrice",
    periodLabel: zhCN.energyParameterPage.fieldSharpPeriod,
    priceLabel: zhCN.energyParameterPage.fieldSharpPrice,
    summaryTitle: zhCN.energyParameterPage.summarySharpPrice,
    shortLabel: "尖",
    tone: "warn",
    className: "sharp"
  },
  {
    periodKey: "peakPeriod",
    priceKey: "peakPrice",
    periodLabel: zhCN.energyParameterPage.fieldPeakPeriod,
    priceLabel: zhCN.energyParameterPage.fieldPeakPrice,
    summaryTitle: zhCN.energyParameterPage.summaryPeakPrice,
    shortLabel: "峰",
    tone: "good",
    className: "peak"
  },
  {
    periodKey: "averagePeriod",
    priceKey: "averagePrice",
    periodLabel: zhCN.energyParameterPage.fieldAveragePeriod,
    priceLabel: zhCN.energyParameterPage.fieldAveragePrice,
    summaryTitle: zhCN.energyParameterPage.summaryAveragePrice,
    shortLabel: "平",
    tone: "neutral",
    className: "flat"
  },
  {
    periodKey: "valleyPeriod",
    priceKey: "valleyPrice",
    periodLabel: zhCN.energyParameterPage.fieldValleyPeriod,
    priceLabel: zhCN.energyParameterPage.fieldValleyPrice,
    summaryTitle: zhCN.energyParameterPage.summaryValleyPrice,
    shortLabel: "谷",
    tone: "good",
    className: "valley"
  }
];

function createEmptyForm(): EnergyParameterItemDto {
  return {
    id: "",
    schemeName: "",
    startPeriod: "",
    endPeriod: "",
    peakPeriod: [],
    peakPrice: "",
    averagePeriod: [],
    averagePrice: "",
    valleyPeriod: [],
    valleyPrice: "",
    sharpTime: [],
    sharpPrice: ""
  };
}

function sanitizeItem(item?: EnergyParameterItemDto | null): EnergyParameterItemDto {
  const empty = createEmptyForm();
  return {
    ...empty,
    ...item,
    peakPeriod: Array.isArray(item?.peakPeriod) ? item.peakPeriod.filter(Boolean) : [],
    averagePeriod: Array.isArray(item?.averagePeriod) ? item.averagePeriod.filter(Boolean) : [],
    valleyPeriod: Array.isArray(item?.valleyPeriod) ? item.valleyPeriod.filter(Boolean) : [],
    sharpTime: Array.isArray(item?.sharpTime) ? item.sharpTime.filter(Boolean) : []
  };
}

function getPeriodValues(form: EnergyParameterItemDto, key: PeriodFieldKey): string[] {
  const values = form[key];
  return Array.isArray(values) ? values : [];
}

function formatPrice(value: string | undefined): string {
  const trimmed = String(value || "").trim();
  if (!trimmed) {
    return "--";
  }
  const sign = trimmed.startsWith("-") ? "-" : "";
  const unsignedValue = sign ? trimmed.slice(1) : trimmed;
  if (!/^\d+(\.\d+)?$/.test(unsignedValue)) {
    return trimmed;
  }
  const [integerPart, decimalPart] = unsignedValue.split(".");
  const groupedInteger = integerPart.replace(ENERGY_PARAMETER_INTEGER_GROUP_PATTERN, ",");
  return `${sign}${groupedInteger}${decimalPart == null ? "" : `.${decimalPart}`}`;
}

function formatCount(value: number | null | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "0";
  }
  return ENERGY_PARAMETER_COUNT_FORMATTER.format(value);
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) {
    return "--";
  }
  const date = new Date(value.replace(" ", "T"));
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString();
}

function formatClock(value: string | null | undefined): string {
  if (!value) {
    return "--";
  }
  const date = new Date(value.replace(" ", "T"));
  if (Number.isNaN(date.getTime())) {
    return "--";
  }
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function countSelectedSlots(value: string[] | undefined): number {
  return Array.isArray(value) ? value.length : 0;
}

function buildSlotOwners(form: EnergyParameterItemDto): Map<string, PeriodSection[]> {
  const slotOwners = new Map<string, PeriodSection[]>();
  PERIOD_SECTIONS.forEach((section) => {
    Array.from(new Set(getPeriodValues(form, section.periodKey))).forEach((slot) => {
      const owners = slotOwners.get(slot) || [];
      owners.push(section);
      slotOwners.set(slot, owners);
    });
  });
  return slotOwners;
}

function buildDuplicateSlotCount(slotOwners: Map<string, PeriodSection[]>): number {
  return Array.from(slotOwners.values()).filter((owners) => owners.length > 1).length;
}

function buildMissingSlotCount(slotOwners: Map<string, PeriodSection[]>): number {
  return TIME_OPTIONS.filter((slot) => !slotOwners.has(slot)).length;
}

function isNumericValue(value: string | undefined): boolean {
  return /^\d+(\.\d+)?$/.test(String(value || "").trim());
}

function buildPriceFieldCount(form: EnergyParameterItemDto): number {
  return PERIOD_SECTIONS.filter((section) => isNumericValue(form[section.priceKey])).length;
}

function buildFieldErrors(form: EnergyParameterItemDto): FieldErrors {
  const errors: FieldErrors = {};

  if (!String(form.schemeName || "").trim()) {
    errors.schemeName = zhCN.energyParameterPage.errorRequired;
  }
  if (!String(form.startPeriod || "").trim()) {
    errors.startPeriod = zhCN.energyParameterPage.errorRequired;
  }
  if (!String(form.endPeriod || "").trim()) {
    errors.endPeriod = zhCN.energyParameterPage.errorRequired;
  }
  if (
    String(form.startPeriod || "").trim()
    && String(form.endPeriod || "").trim()
    && String(form.startPeriod) > String(form.endPeriod)
  ) {
    errors.startPeriod = zhCN.energyParameterPage.errorRange;
    errors.endPeriod = zhCN.energyParameterPage.errorRange;
  }

  PERIOD_SECTIONS.forEach((section) => {
    const slots = getPeriodValues(form, section.periodKey);
    if (slots.length === 0) {
      errors[section.periodKey] = zhCN.energyParameterPage.errorPeriodRequired;
    }
    if (!isNumericValue(form[section.priceKey])) {
      errors[section.priceKey] = zhCN.energyParameterPage.errorNumber;
    }
  });

  const duplicatedSlots = new Set(
    Array.from(buildSlotOwners(form).entries())
      .filter(([, owners]) => owners.length > 1)
      .map(([slot]) => slot)
  );

  if (duplicatedSlots.size > 0) {
    PERIOD_SECTIONS.forEach((section) => {
      const slots = getPeriodValues(form, section.periodKey);
      if (slots.some((slot) => duplicatedSlots.has(slot))) {
        errors[section.periodKey] = zhCN.energyParameterPage.errorPeriodOverlap;
      }
    });
  }

  return errors;
}

function resolveCoverageLabel(assignedSlotCount: number): string {
  return `${formatCount(assignedSlotCount)}/24 · ${
    assignedSlotCount === 24
      ? zhCN.energyParameterPage.coverageComplete
      : zhCN.energyParameterPage.coverageIncomplete
  }`;
}

function getSourceRows(loadError: string | null, savingDisabled: boolean): SourceRow[] {
  return [
    {
      label: "参数读取",
      detail: "当前项目 · 电价方案",
      state: loadError ? "异常" : "正常",
      ok: !loadError
    },
    {
      label: "参数保存",
      detail: "方案、日期、价格、时段",
      state: savingDisabled ? "只读" : "可用",
      ok: !savingDisabled
    },
    {
      label: "权限边界",
      detail: "仅维护电价方案，不下发控制指令",
      state: "受控",
      ok: true
    }
  ];
}

function getSlotSection(slotOwners: Map<string, PeriodSection[]>, slot: string): PeriodSection | null {
  const owners = slotOwners.get(slot) || [];
  return owners[0] || null;
}

function getMetricCards(
  form: EnergyParameterItemDto,
  assignedSlotCount: number,
  missingSlotCount: number,
  duplicateSlotCount: number,
  latestFetchClock: string,
  latestFetchText: string
): MetricCard[] {
  const priceCards = PERIOD_SECTIONS.map((section) => ({
    title: section.summaryTitle,
    value: formatPrice(form[section.priceKey]),
    detail: `${zhCN.energyParameterPage.priceUnit} · ${formatCount(countSelectedSlots(getPeriodValues(form, section.periodKey)))}${zhCN.energyParameterPage.selectedCountSuffix}`,
    tone: section.tone
  }));
  return [
    ...priceCards,
    {
      title: "已分配时段",
      value: formatCount(assignedSlotCount),
      detail: `${missingSlotCount === 0 ? "无空缺" : `${formatCount(missingSlotCount)} 个空缺`} · ${duplicateSlotCount === 0 ? "无重叠" : `${formatCount(duplicateSlotCount)} 个重叠`}`,
      tone: missingSlotCount === 0 && duplicateSlotCount === 0 ? "neutral" : "warn"
    },
    {
      title: zhCN.energyParameterPage.metaLatestFetch.replace(/[：:]$/, ""),
      value: latestFetchClock,
      detail: latestFetchText,
      tone: "neutral"
    }
  ];
}

export default function EnergyParametersPage() {
  const [reloadSeed, setReloadSeed] = useState(0);
  const [data, setData] = useState<EnergyParameterDto | null>(null);
  const [form, setForm] = useState<EnergyParameterItemDto>(() => createEmptyForm());
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [notice, setNotice] = useState<NoticeState | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);

      try {
        const result = await fetchEnergyParameters(runtimeConfig.siteId);
        if (!active) {
          return;
        }
        startTransition(() => {
          setData(result);
          setForm(sanitizeItem(result.item));
          setFieldErrors({});
          setLoadError(null);
          setLoading(false);
        });
      } catch (_error) {
        if (!active) {
          return;
        }
        startTransition(() => {
          setData(null);
          setForm(createEmptyForm());
          setFieldErrors({});
          setLoadError(ENERGY_PARAMETER_DEGRADED_TEXT);
          setLoading(false);
        });
      }
    }

    load();
    return () => {
      active = false;
    };
  }, [reloadSeed]);

  const sourceSummary = summarizeSourceStatus([data?.sourceStatus]);
  const slotOwners = useMemo(
    () => buildSlotOwners(form),
    [form.averagePeriod, form.peakPeriod, form.sharpTime, form.valleyPeriod]
  );
  const assignedSlotCount = slotOwners.size;
  const duplicateSlotCount = buildDuplicateSlotCount(slotOwners);
  const missingSlotCount = buildMissingSlotCount(slotOwners);
  const priceFieldCount = buildPriceFieldCount(form);
  const hasLoadedRecord = Boolean(String(form.id || "").trim());
  const latestFetchValue = data?.generatedAt || data?.freshness?.latestTimestamp;
  const latestFetchText = formatDateTime(latestFetchValue);
  const latestFetchClock = formatClock(latestFetchValue);
  const sourceEntries = data?.sourceStatus?.sources || [];
  const sourceTotal = sourceEntries.length || (data ? 1 : 0);
  const sourceOkCount = sourceEntries.filter((source) => source.ok !== false).length || (data && !sourceSummary.warn ? 1 : 0);
  const sourceStateLabel = loading
    ? zhCN.energyParameterPage.reloadLoading
    : loadError
      ? "待处理"
      : hasLoadedRecord
        ? (sourceSummary.warn ? "待核对" : "已加载")
        : "待配置";
  const parameterStateLabel = saving
    ? zhCN.energyParameterPage.saving
    : notice?.tone === "good"
      ? "已保存"
      : hasLoadedRecord
        ? "待保存"
        : "待配置";
  const metricCards = getMetricCards(form, assignedSlotCount, missingSlotCount, duplicateSlotCount, latestFetchClock, latestFetchText);
  const sourceRows = getSourceRows(loadError, runtimeConfig.readOnlyMode);

  function clearErrors(keys: EnergyParameterFieldKey[]) {
    setFieldErrors((current) => {
      if (keys.every((key) => current[key] == null)) {
        return current;
      }
      const next = { ...current };
      keys.forEach((key) => {
        delete next[key];
      });
      return next;
    });
  }

  function updateField<K extends EnergyParameterFieldKey>(key: K, value: NonNullable<EnergyParameterItemDto[K]>) {
    setForm((current) => ({
      ...current,
      [key]: value
    }));
    clearErrors([key]);
    setNotice(null);
  }

  function openDatePicker(input: HTMLInputElement) {
    if (typeof input.showPicker === "function") {
      try {
        input.showPicker();
      } catch (_error) {
        // Some browsers reject showPicker unless the click is a direct user gesture.
      }
    }
  }

  function handleToggleSlot(key: PeriodFieldKey, slot: string) {
    setForm((current) => {
      const currentValues = getPeriodValues(current, key);
      const nextSet = new Set(currentValues);
      if (nextSet.has(slot)) {
        nextSet.delete(slot);
      } else {
        nextSet.add(slot);
      }
      return {
        ...current,
        [key]: TIME_OPTIONS.filter((item) => nextSet.has(item))
      };
    });
    clearErrors([key]);
    setNotice(null);
  }

  function handleCycleSlot(slot: string) {
    setForm((current) => {
      const currentOwnerIndex = PERIOD_SECTIONS.findIndex((section) => getPeriodValues(current, section.periodKey).includes(slot));
      const nextOwner = PERIOD_SECTIONS[(currentOwnerIndex + 1) % PERIOD_SECTIONS.length];
      const nextForm = {
        ...current,
        peakPeriod: getPeriodValues(current, "peakPeriod").filter((item) => item !== slot),
        averagePeriod: getPeriodValues(current, "averagePeriod").filter((item) => item !== slot),
        valleyPeriod: getPeriodValues(current, "valleyPeriod").filter((item) => item !== slot),
        sharpTime: getPeriodValues(current, "sharpTime").filter((item) => item !== slot)
      };
      const nextValues = new Set(getPeriodValues(nextForm, nextOwner.periodKey));
      nextValues.add(slot);
      return {
        ...nextForm,
        [nextOwner.periodKey]: TIME_OPTIONS.filter((item) => nextValues.has(item))
      };
    });
    clearErrors(PERIOD_SECTIONS.map((section) => section.periodKey));
    setNotice(null);
  }

  function handleReset() {
    setForm(sanitizeItem(data?.item));
    setFieldErrors({});
    setNotice(null);
  }

  async function handleSave() {
    if (runtimeConfig.readOnlyMode) {
      setNotice({
        tone: "warn",
        message: ENERGY_PARAMETER_READ_ONLY_TEXT
      });
      return;
    }

    const errors = buildFieldErrors(form);
    if (Object.keys(errors).length > 0) {
      startTransition(() => {
        setFieldErrors(errors);
        setNotice({
          tone: "warn",
          message: ENERGY_PARAMETER_VALIDATION_FAILED_TEXT
        });
      });
      return;
    }

    setSaving(true);
    try {
      const result = await updateEnergyParameters(runtimeConfig.siteId, form);
      startTransition(() => {
        setFieldErrors({});
        setNotice({
          tone: "good",
          message: result.message || zhCN.energyParameterPage.saveSuccess
        });
        setSaving(false);
        setReloadSeed((value) => value + 1);
      });
    } catch (_error) {
      startTransition(() => {
        setSaving(false);
        setNotice({
          tone: "warn",
          message: ENERGY_PARAMETER_SAVE_FAILED_TEXT
        });
      });
    }
  }

  return (
    <div className="energy-parameter-page energy-parameter-compact-page-v2 page-enter">
      <section className="energy-parameter-compact-hero">
        <div className="energy-parameter-compact-hero-copy">
          <div>
            <span className="energy-parameter-compact-label">{runtimeConfig.appModeLabel}</span>
            <h2>{zhCN.energyParameterPage.heading}</h2>
          </div>
          <div className="energy-parameter-compact-tags" aria-label="能源参数摘要">
            <article>
              <span>{zhCN.energyParameterPage.fieldSchemeName}</span>
              <strong>{form.schemeName || "--"}</strong>
            </article>
            <article>
              <span>{zhCN.energyParameterPage.metaRangePrefix.replace(/[：:]$/, "")}</span>
              <strong>{`${form.startPeriod || "--"} ~ ${form.endPeriod || "--"}`}</strong>
            </article>
            <article>
              <span>时段覆盖</span>
              <strong>{resolveCoverageLabel(assignedSlotCount)}</strong>
            </article>
            <article>
              <span>参数状态</span>
              <strong>{parameterStateLabel}</strong>
            </article>
          </div>
        </div>
        <aside className="energy-parameter-compact-status" aria-label="来源状态">
          <span className="energy-parameter-compact-label">来源状态</span>
          <strong>{sourceStateLabel}</strong>
          <em>数据状态：{sourceTotal > 0 ? `${formatCount(sourceOkCount)}/${formatCount(sourceTotal)} 正常` : "--"}</em>
        </aside>
      </section>

      <section className="energy-parameter-compact-metrics" aria-label={zhCN.energyParameterPage.sectionSummary}>
        {metricCards.map((item) => (
          <article key={item.title} className={`energy-parameter-compact-metric is-${item.tone || "neutral"}`}>
            <span>{item.title}</span>
            <strong>{item.value}</strong>
            <small>{item.detail}</small>
          </article>
        ))}
      </section>

      <section className="energy-parameter-compact-workspace" aria-label="能源参数工作台">
        <article className="energy-parameter-compact-panel">
          <header className="energy-parameter-compact-panel-head">
            <h3>{zhCN.energyParameterPage.sectionForm}</h3>
            <span>可编辑</span>
          </header>
          <div className="energy-parameter-compact-panel-body">
            <div className="energy-parameter-compact-form-grid">
              <label className="energy-parameter-compact-field">
                <span>{zhCN.energyParameterPage.fieldSchemeName}</span>
                <input
                  type="text"
                  value={form.schemeName || ""}
                  aria-label={zhCN.energyParameterPage.fieldSchemeName}
                  onChange={(event) => updateField("schemeName", event.target.value)}
                />
                {fieldErrors.schemeName ? <small>{fieldErrors.schemeName}</small> : null}
              </label>
              <div className="energy-parameter-compact-date-row">
                <label className="energy-parameter-compact-field">
                  <span>{zhCN.energyParameterPage.fieldStartDate}</span>
                  <input
                    type="date"
                    value={form.startPeriod || ""}
                    max={form.endPeriod || undefined}
                    aria-label={zhCN.energyParameterPage.fieldStartDate}
                    onClick={(event) => openDatePicker(event.currentTarget)}
                    onChange={(event) => {
                      updateField("startPeriod", event.target.value);
                      clearErrors(["startPeriod", "endPeriod"]);
                    }}
                  />
                  {fieldErrors.startPeriod ? <small>{fieldErrors.startPeriod}</small> : null}
                </label>
                <label className="energy-parameter-compact-field">
                  <span>{zhCN.energyParameterPage.fieldEndDate}</span>
                  <input
                    type="date"
                    value={form.endPeriod || ""}
                    min={form.startPeriod || undefined}
                    aria-label={zhCN.energyParameterPage.fieldEndDate}
                    onClick={(event) => openDatePicker(event.currentTarget)}
                    onChange={(event) => {
                      updateField("endPeriod", event.target.value);
                      clearErrors(["startPeriod", "endPeriod"]);
                    }}
                  />
                  {fieldErrors.endPeriod ? <small>{fieldErrors.endPeriod}</small> : null}
                </label>
              </div>
              <div className="energy-parameter-compact-actions">
                <button
                  type="button"
                  className="energy-parameter-compact-button"
                  onClick={() => {
                    setNotice(null);
                    setReloadSeed((value) => value + 1);
                  }}
                  disabled={loading || saving}
                >
                  {loading ? zhCN.energyParameterPage.reloadLoading : zhCN.energyParameterPage.reload}
                </button>
                <button
                  type="button"
                  className="energy-parameter-compact-button"
                  onClick={handleReset}
                  disabled={loading || saving}
                >
                  撤销改动
                </button>
                <button
                  type="button"
                  className="energy-parameter-compact-button is-primary"
                  onClick={handleSave}
                  disabled={!hasLoadedRecord || loading || saving}
                >
                  {saving ? zhCN.energyParameterPage.saving : zhCN.energyParameterPage.save}
                </button>
              </div>
            </div>
            {notice ? (
              <div className={`energy-parameter-compact-notice is-${notice.tone}`}>{notice.message}</div>
            ) : null}
            <div className="energy-parameter-compact-source-list">
              {sourceRows.map((item) => (
                <article key={item.label} className="energy-parameter-compact-source-row">
                  <div>
                    <strong>{item.label}</strong>
                    <small>{item.detail}</small>
                  </div>
                  <span className={item.ok ? "is-ok" : "is-warn"}>{item.state}</span>
                </article>
              ))}
            </div>
          </div>
        </article>

        <article className="energy-parameter-compact-panel energy-parameter-compact-matrix-panel">
          <header className="energy-parameter-compact-panel-head">
            <h3>分时时段矩阵</h3>
            <span>24 个整点唯一归属 · 价格单位 {zhCN.energyParameterPage.priceUnit}</span>
          </header>
          <div className="energy-parameter-compact-panel-body">
            <div className="energy-parameter-compact-timeline" aria-label="24 小时时段归属">
              {TIME_OPTIONS.map((slot) => {
                const section = getSlotSection(slotOwners, slot);
                const hour = slot.slice(0, 2);
                return (
                  <button
                    key={slot}
                    type="button"
                    className={`energy-parameter-compact-hour is-${section?.className || "empty"}`}
                    onClick={() => handleCycleSlot(slot)}
                    title={`${slot} ${section?.periodLabel || "未分配"}`}
                  >
                    <em>{hour}</em>
                    <strong>{section?.shortLabel || "空"}</strong>
                  </button>
                );
              })}
            </div>

            <div className="energy-parameter-compact-period-grid">
              {PERIOD_SECTIONS.map((section) => {
                const selectedValues = getPeriodValues(form, section.periodKey);
                return (
                  <article key={section.periodKey} className={`energy-parameter-compact-period is-${section.className}`}>
                    <header>
                      <div>
                        <h3>{section.periodLabel}</h3>
                        <span>{`${formatCount(countSelectedSlots(selectedValues))}${zhCN.energyParameterPage.selectedCountSuffix}`}</span>
                      </div>
                      <label className="energy-parameter-compact-price-field">
                        <span>{section.priceLabel}</span>
                        <div>
                          <input
                            type="text"
                            inputMode="decimal"
                            value={form[section.priceKey] || ""}
                            aria-label={section.priceLabel}
                            onChange={(event) => updateField(section.priceKey, event.target.value)}
                          />
                          <strong>{zhCN.energyParameterPage.priceUnit}</strong>
                        </div>
                        {fieldErrors[section.priceKey] ? <small>{fieldErrors[section.priceKey]}</small> : null}
                      </label>
                    </header>
                    <div className="energy-parameter-compact-slot-list">
                      {selectedValues.length > 0 ? selectedValues.map((slot) => (
                        <button
                          key={`${section.periodKey}-${slot}`}
                          type="button"
                          className={`energy-parameter-compact-slot is-${section.className}`}
                          onClick={() => handleToggleSlot(section.periodKey, slot)}
                        >
                          {slot}
                        </button>
                      )) : <span className="energy-parameter-compact-slot-empty">未分配</span>}
                    </div>
                    {fieldErrors[section.periodKey] ? (
                      <div className="energy-parameter-compact-error">{fieldErrors[section.periodKey]}</div>
                    ) : null}
                  </article>
                );
              })}
            </div>
          </div>
        </article>

        <article className="energy-parameter-compact-panel">
          <header className="energy-parameter-compact-panel-head">
            <h3>校验口径</h3>
            <span>完整</span>
          </header>
          <div className="energy-parameter-compact-panel-body">
            <div className="energy-parameter-compact-legend">
              {PERIOD_SECTIONS.map((section) => (
                <div key={section.periodKey}>
                  <i className={`is-${section.className}`} />
                  <span>{section.shortLabel}</span>
                </div>
              ))}
            </div>
            <div className="energy-parameter-compact-audit-grid">
              <article><span>覆盖率</span><strong>{assignedSlotCount === 24 && duplicateSlotCount === 0 ? "100%" : `${formatCount(assignedSlotCount)}/24`}</strong></article>
              <article><span>冲突时段</span><strong>{formatCount(duplicateSlotCount)}</strong></article>
              <article><span>缺失时段</span><strong>{formatCount(missingSlotCount)}</strong></article>
              <article><span>价格字段</span><strong>{`${formatCount(priceFieldCount)}/4`}</strong></article>
            </div>
            <div className="energy-parameter-compact-audit-list">
              <div><span>方案 ID</span><strong>{form.id || "--"}</strong></div>
              <div><span>{zhCN.energyParameterPage.fieldStartDate}</span><strong>{form.startPeriod || "--"}</strong></div>
              <div><span>{zhCN.energyParameterPage.fieldEndDate}</span><strong>{form.endPeriod || "--"}</strong></div>
              <div><span>时段规则</span><strong>{duplicateSlotCount === 0 ? "整点唯一归属" : "存在重叠"}</strong></div>
              <div><span>价格单位</span><strong>{zhCN.energyParameterPage.priceUnit}</strong></div>
              <div><span>保存状态</span><strong>{parameterStateLabel}</strong></div>
              <div><span>维护对象</span><strong>电价方案</strong></div>
              <div><span>控制边界</span><strong>不下发控制</strong></div>
            </div>
          </div>
        </article>
      </section>

      <section className="energy-parameter-compact-boundary" aria-label="能源参数边界">
        <article><span>生效规则</span><strong>按起止日期匹配</strong></article>
        <article><span>时段规则</span><strong>24 个整点唯一归属</strong></article>
        <article><span>保存内容</span><strong>方案、日期、价格、时段</strong></article>
        <article><span>页面边界</span><strong>只维护参数，不下发控制</strong></article>
      </section>
    </div>
  );
}
