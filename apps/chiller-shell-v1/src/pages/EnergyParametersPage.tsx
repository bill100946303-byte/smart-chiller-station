import { startTransition, useEffect, useState } from "react";
import SectionCard from "../components/common/SectionCard";
import SourceStatusBanner from "../components/common/SourceStatusBanner";
import StatCard from "../components/common/StatCard";
import { runtimeConfig } from "../config/runtimeConfig";
import { buildSourceStatusLines, summarizeSourceStatus } from "../i18n/sourceStatusCN";
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
  tone: "neutral" | "good" | "warn";
};

const TIME_OPTIONS = Array.from({ length: 24 }, (_, index) => `${String(index).padStart(2, "0")}:00`);

const PERIOD_SECTIONS: PeriodSection[] = [
  {
    periodKey: "peakPeriod",
    priceKey: "peakPrice",
    periodLabel: zhCN.energyParameterPage.fieldPeakPeriod,
    priceLabel: zhCN.energyParameterPage.fieldPeakPrice,
    summaryTitle: zhCN.energyParameterPage.summaryPeakPrice,
    tone: "good"
  },
  {
    periodKey: "averagePeriod",
    priceKey: "averagePrice",
    periodLabel: zhCN.energyParameterPage.fieldAveragePeriod,
    priceLabel: zhCN.energyParameterPage.fieldAveragePrice,
    summaryTitle: zhCN.energyParameterPage.summaryAveragePrice,
    tone: "neutral"
  },
  {
    periodKey: "valleyPeriod",
    priceKey: "valleyPrice",
    periodLabel: zhCN.energyParameterPage.fieldValleyPeriod,
    priceLabel: zhCN.energyParameterPage.fieldValleyPrice,
    summaryTitle: zhCN.energyParameterPage.summaryValleyPrice,
    tone: "good"
  },
  {
    periodKey: "sharpTime",
    priceKey: "sharpPrice",
    periodLabel: zhCN.energyParameterPage.fieldSharpPeriod,
    priceLabel: zhCN.energyParameterPage.fieldSharpPrice,
    summaryTitle: zhCN.energyParameterPage.summarySharpPrice,
    tone: "warn"
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
    peakPeriod: Array.isArray(item?.peakPeriod) ? item?.peakPeriod.filter(Boolean) : [],
    averagePeriod: Array.isArray(item?.averagePeriod) ? item?.averagePeriod.filter(Boolean) : [],
    valleyPeriod: Array.isArray(item?.valleyPeriod) ? item?.valleyPeriod.filter(Boolean) : [],
    sharpTime: Array.isArray(item?.sharpTime) ? item?.sharpTime.filter(Boolean) : []
  };
}

function getPeriodValues(form: EnergyParameterItemDto, key: PeriodFieldKey): string[] {
  const values = form[key];
  return Array.isArray(values) ? values : [];
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

function formatPrice(value: string | undefined): string {
  const trimmed = String(value || "").trim();
  return trimmed || "--";
}

function countSelectedSlots(value: string[] | undefined): number {
  return Array.isArray(value) ? value.length : 0;
}

function buildAssignedSlotCount(form: EnergyParameterItemDto): number {
  return new Set(
    PERIOD_SECTIONS.flatMap((section) => getPeriodValues(form, section.periodKey))
  ).size;
}

function isNumericValue(value: string | undefined): boolean {
  return /^\d+(\.\d+)?$/.test(String(value || "").trim());
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
  if (String(form.startPeriod || "").trim() && String(form.endPeriod || "").trim() && String(form.startPeriod) > String(form.endPeriod)) {
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

  const slotOwners = new Map<string, PeriodFieldKey[]>();
  PERIOD_SECTIONS.forEach((section) => {
    const values = Array.from(new Set(getPeriodValues(form, section.periodKey)));
    values.forEach((slot) => {
      const owners = slotOwners.get(slot) || [];
      owners.push(section.periodKey);
      slotOwners.set(slot, owners);
    });
  });

  const duplicatedSlots = new Set(
    Array.from(slotOwners.entries())
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

function buildSummaryCards(form: EnergyParameterItemDto) {
  return PERIOD_SECTIONS.map((section) => ({
    title: section.summaryTitle,
    value: formatPrice(form[section.priceKey]),
    unit: zhCN.energyParameterPage.priceUnit,
    delta: `${countSelectedSlots(getPeriodValues(form, section.periodKey))}${zhCN.energyParameterPage.selectedCountSuffix}`,
    tone: section.tone
  }));
}

function buildConflictOwnerLabel(form: EnergyParameterItemDto, currentKey: PeriodFieldKey, slot: string): string | null {
  const matched = PERIOD_SECTIONS.find((section) => {
    if (section.periodKey === currentKey) {
      return false;
    }
    return getPeriodValues(form, section.periodKey).includes(slot);
  });
  return matched ? matched.periodLabel : null;
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
          setLoadError(zhCN.energyParameterPage.degraded);
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
  const sourceStatusLines = buildSourceStatusLines([data?.sourceStatus]);
  const sourceStatusLinesCompact = buildSourceStatusLines([data?.sourceStatus], { labelMode: "short" });
  const summaryCards = buildSummaryCards(form);
  const assignedSlotCount = buildAssignedSlotCount(form);
  const hasLoadedRecord = Boolean(String(form.id || "").trim());

  const bannerText = notice?.message
    || loadError
    || (loading
      ? zhCN.energyParameterPage.loading
      : hasLoadedRecord
        ? sourceSummary.text
        : zhCN.energyParameterPage.empty);

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

  function handleReset() {
    setForm(sanitizeItem(data?.item));
    setFieldErrors({});
    setNotice(null);
  }

  async function handleSave() {
    if (runtimeConfig.readOnlyMode) {
      setNotice({
        tone: "warn",
        message: zhCN.runtimeMode.writeBlocked
      });
      return;
    }

    const errors = buildFieldErrors(form);
    if (Object.keys(errors).length > 0) {
      startTransition(() => {
        setFieldErrors(errors);
        setNotice({
          tone: "warn",
          message: zhCN.energyParameterPage.validationFailed
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
          message: zhCN.energyParameterPage.saveFailed
        });
      });
    }
  }

  return (
    <div className="energy-parameter-page page-enter">
      <SourceStatusBanner
        summary={bannerText}
        warn={Boolean(loadError) || notice?.tone === "warn" || sourceSummary.warn}
        detailLines={sourceStatusLines}
        detailLinesCompact={sourceStatusLinesCompact}
      />

      <section className="energy-parameter-header">
        <h2>{zhCN.energyParameterPage.heading}</h2>
        <p>{zhCN.energyParameterPage.subtitle}</p>
      </section>

      <SectionCard
        title={zhCN.energyParameterPage.sectionSummary}
        action={
          <button
            type="button"
            className="energy-parameter-button"
            onClick={() => {
              setNotice(null);
              setReloadSeed((value) => value + 1);
            }}
            disabled={loading || saving}
          >
            {loading ? zhCN.energyParameterPage.reloadLoading : zhCN.energyParameterPage.reload}
          </button>
        }
      >
        <div className="energy-parameter-meta">
          <span>{`${zhCN.energyParameterPage.metaSchemePrefix} ${form.schemeName || "--"}`}</span>
          <span>{`${zhCN.energyParameterPage.metaRangePrefix} ${form.startPeriod || "--"} ~ ${form.endPeriod || "--"}`}</span>
          <span>
            {`${zhCN.energyParameterPage.metaCoveragePrefix} ${assignedSlotCount}/24 · ${
              assignedSlotCount === 24
                ? zhCN.energyParameterPage.coverageComplete
                : zhCN.energyParameterPage.coverageIncomplete
            }`}
          </span>
          <span>{`${zhCN.energyParameterPage.metaLatestFetch} ${formatDateTime(data?.generatedAt || data?.freshness?.latestTimestamp)}`}</span>
        </div>
        <div className="energy-parameter-summary-grid">
          {summaryCards.map((item) => (
            <StatCard
              key={item.title}
              title={item.title}
              value={item.value}
              unit={item.unit}
              delta={item.delta}
              tone={item.tone}
            />
          ))}
        </div>
      </SectionCard>

      <SectionCard title={zhCN.energyParameterPage.sectionForm}>
        <div className="energy-parameter-core-grid">
          <label className="energy-parameter-field">
            <span>{zhCN.energyParameterPage.fieldSchemeName}</span>
            <input
              type="text"
              value={form.schemeName || ""}
              onChange={(event) => updateField("schemeName", event.target.value)}
              placeholder={zhCN.energyParameterPage.fieldSchemeName}
            />
            {fieldErrors.schemeName ? <small>{fieldErrors.schemeName}</small> : null}
          </label>
          <label className="energy-parameter-field">
            <span>{zhCN.energyParameterPage.fieldStartDate}</span>
            <input
              type="date"
              value={form.startPeriod || ""}
              max={form.endPeriod || undefined}
              onChange={(event) => {
                updateField("startPeriod", event.target.value);
                clearErrors(["startPeriod", "endPeriod"]);
              }}
            />
            {fieldErrors.startPeriod ? <small>{fieldErrors.startPeriod}</small> : null}
          </label>
          <label className="energy-parameter-field">
            <span>{zhCN.energyParameterPage.fieldEndDate}</span>
            <input
              type="date"
              value={form.endPeriod || ""}
              min={form.startPeriod || undefined}
              onChange={(event) => {
                updateField("endPeriod", event.target.value);
                clearErrors(["startPeriod", "endPeriod"]);
              }}
            />
            {fieldErrors.endPeriod ? <small>{fieldErrors.endPeriod}</small> : null}
          </label>
        </div>

        <div className="energy-parameter-helper">
          <p>{zhCN.energyParameterPage.periodHint}</p>
          <p>{zhCN.energyParameterPage.saveHint}</p>
        </div>

        <div className="energy-parameter-period-grid">
          {PERIOD_SECTIONS.map((section) => {
            const selectedValues = getPeriodValues(form, section.periodKey);
            return (
              <article key={section.periodKey} className="energy-period-card">
                <header>
                  <div>
                    <h3>{section.periodLabel}</h3>
                    <p>{`${countSelectedSlots(selectedValues)}${zhCN.energyParameterPage.selectedCountSuffix}`}</p>
                  </div>
                  <label className="energy-parameter-field energy-price-field">
                    <span>{section.priceLabel}</span>
                    <div className="energy-price-input">
                      <input
                        type="text"
                        inputMode="decimal"
                        value={form[section.priceKey] || ""}
                        onChange={(event) => updateField(section.priceKey, event.target.value)}
                        placeholder="0.00"
                      />
                      <strong>{zhCN.energyParameterPage.priceUnit}</strong>
                    </div>
                    {fieldErrors[section.priceKey] ? <small>{fieldErrors[section.priceKey]}</small> : null}
                  </label>
                </header>

                <div className="energy-slot-grid">
                  {TIME_OPTIONS.map((slot) => {
                    const active = selectedValues.includes(slot);
                    const conflictOwner = active ? null : buildConflictOwnerLabel(form, section.periodKey, slot);
                    return (
                      <button
                        key={`${section.periodKey}-${slot}`}
                        type="button"
                        className={`energy-slot-button${active ? " is-active" : ""}${conflictOwner ? " is-blocked" : ""}`}
                        onClick={() => handleToggleSlot(section.periodKey, slot)}
                        aria-pressed={active}
                        disabled={Boolean(conflictOwner)}
                        title={conflictOwner ? `${zhCN.energyParameterPage.slotClaimedBy} ${conflictOwner}` : slot}
                      >
                        {slot}
                      </button>
                    );
                  })}
                </div>
                {fieldErrors[section.periodKey] ? (
                  <div className="energy-period-error">{fieldErrors[section.periodKey]}</div>
                ) : null}
              </article>
            );
          })}
        </div>

        <div className="energy-parameter-actions">
          <button
            type="button"
            className="energy-parameter-button is-primary"
            onClick={handleSave}
            disabled={!hasLoadedRecord || loading || saving}
          >
            {saving ? zhCN.energyParameterPage.saving : zhCN.energyParameterPage.save}
          </button>
          <button
            type="button"
            className="energy-parameter-button"
            onClick={handleReset}
            disabled={loading || saving}
          >
            {zhCN.energyParameterPage.reset}
          </button>
        </div>

        {!hasLoadedRecord ? (
          <div className="energy-parameter-empty">{zhCN.energyParameterPage.empty}</div>
        ) : null}
      </SectionCard>
    </div>
  );
}
