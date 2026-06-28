import { ArrowLeft, Fan, RefreshCw, Save, ShieldAlert, Thermometer, ToggleLeft } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import SectionCard from "../components/common/SectionCard";
import StatCard from "../components/common/StatCard";
import StatusPill from "../components/common/StatusPill";
import { getAdminSession } from "../services/adminAuth";
import {
  buildFcuFieldArmPackage,
  getFcuFieldRemediationStatus,
  refreshFcuFieldRemediationStatus,
  saveFcuFieldRemediationSignoffRow,
  type AdminFcuFieldRemediationRefreshResult,
  type AdminFcuFieldRemediationStatus,
  type AdminFcuFieldArmPackageResult,
  type AdminFcuSignoffRowRecord,
  type AdminFcuSignoffRowSaveResult
} from "../services/adminClient";

const FCU_SIGNOFF_CONFIRM = "I_APPROVE_REPLACE_FCU_SIGNOFF_INPUT";

type FcuWorkOrderItem = NonNullable<NonNullable<AdminFcuFieldRemediationStatus["workOrders"]>["items"]>[number];

type FcuSignoffForm = {
  handledBy: string;
  handledAt: string;
  communicationAlarmAfter: string;
  zoneTemperatureAfterC: string;
  setpointFeedbackAfterC: string;
  writePointMappingChecked: string;
  twoSampleNormal: string;
  localManualLockout: string;
  releaseDecision: string;
  reviewedBy: string;
  reviewedAt: string;
  notes: string;
};

const DEFAULT_FORM: FcuSignoffForm = {
  handledBy: "",
  handledAt: "",
  communicationAlarmAfter: "0",
  zoneTemperatureAfterC: "",
  setpointFeedbackAfterC: "",
  writePointMappingChecked: "yes",
  twoSampleNormal: "yes",
  localManualLockout: "none",
  releaseDecision: "hold",
  reviewedBy: "",
  reviewedAt: "",
  notes: ""
};

function toDateTimeLocalValue(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return [
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
    `${pad(date.getHours())}:${pad(date.getMinutes())}`
  ].join("T");
}

function readSummaryNumber(summary: Record<string, unknown> | null | undefined, key: string): number | null {
  const value = summary?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function matchesFcuWorkOrder(
  workOrder: FcuWorkOrderItem,
  reference?: { workOrderId?: string; deviceCode?: string; deviceName?: string } | null
): boolean {
  if (!reference) {
    return false;
  }
  return Boolean(
    (reference.workOrderId && workOrder.workOrderId === reference.workOrderId) ||
      (reference.deviceCode && workOrder.deviceCode === reference.deviceCode) ||
      (reference.deviceName && workOrder.deviceName === reference.deviceName)
  );
}

function findNextPendingFcuWorkOrder(
  status: AdminFcuFieldRemediationStatus | null,
  currentWorkOrder: FcuWorkOrderItem | null
) {
  const workOrders = status?.workOrders?.items || [];
  if (!currentWorkOrder || workOrders.length === 0) {
    return null;
  }
  const deviceQueue = status?.finalControlFieldExecutionPack?.deviceQueue || [];
  const currentQueueItem = deviceQueue.find((item) => matchesFcuWorkOrder(currentWorkOrder, item)) || null;
  const currentSequence = typeof currentQueueItem?.sequence === "number" ? currentQueueItem.sequence : Number.NaN;
  const nextQueueItem =
    deviceQueue.find((item) => {
      const isCurrent = matchesFcuWorkOrder(currentWorkOrder, item);
      const sequence = typeof item.sequence === "number" ? item.sequence : Number.NaN;
      return !isCurrent && item.canEnterCanary !== true && (!Number.isFinite(currentSequence) || !Number.isFinite(sequence) || sequence > currentSequence);
    }) ||
    deviceQueue.find((item) => !matchesFcuWorkOrder(currentWorkOrder, item) && item.canEnterCanary !== true) ||
    null;
  const nextFromQueue = nextQueueItem ? workOrders.find((item) => matchesFcuWorkOrder(item, nextQueueItem)) || null : null;
  if (nextFromQueue) {
    return nextFromQueue;
  }
  return (
    workOrders.find((item) => {
      if (!item.workOrderId || item.workOrderId === currentWorkOrder.workOrderId) {
        return false;
      }
      const reasons = item.currentEvidence?.reasons || [];
      const fieldRelease = item.fieldVerification?.releaseDecision || "";
      const signedRelease = item.signoff?.notes?.includes("release") ? "release" : "";
      return reasons.length > 0 || (fieldRelease !== "release" && signedRelease !== "release");
    }) ||
    workOrders.find((item) => item.workOrderId && item.workOrderId !== currentWorkOrder.workOrderId) ||
    null
  );
}

function formatDraftValue(value: unknown): string {
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  return typeof value === "string" ? value : "";
}

export default function FcuWorkOrderDetailPage() {
  const navigate = useNavigate();
  const { siteId = "", workOrderId = "" } = useParams();
  const session = getAdminSession();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorText, setErrorText] = useState("");
  const [notice, setNotice] = useState("");
  const [status, setStatus] = useState<AdminFcuFieldRemediationStatus | null>(null);
  const [confirmText, setConfirmText] = useState("");
  const [form, setForm] = useState<FcuSignoffForm>(DEFAULT_FORM);
  const [saveResult, setSaveResult] = useState<AdminFcuSignoffRowSaveResult | null>(null);
  const [refreshResult, setRefreshResult] = useState<AdminFcuFieldRemediationRefreshResult | null>(null);
  const [fieldArmPackage, setFieldArmPackage] = useState<AdminFcuFieldArmPackageResult | null>(null);
  const [autoAdvanceAfterSave, setAutoAdvanceAfterSave] = useState(true);

  const workOrders = status?.workOrders?.items || [];
  const workOrder = useMemo(
    () => workOrders.find((item) => item.workOrderId === workOrderId) || null,
    [workOrders, workOrderId]
  );

  async function loadData() {
    if (!session || !siteId) {
      return;
    }
    setLoading(true);
    setErrorText("");
    setNotice("");
    try {
      const nextStatus = await getFcuFieldRemediationStatus(session.token, session.userId, siteId);
      setStatus(nextStatus);
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : "FCU 工单加载失败");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.token, siteId, workOrderId]);

  useEffect(() => {
    if (!workOrder) {
      return;
    }
    setForm((current) => ({
      ...current,
      handledBy: workOrder.signoff?.handledBy || current.handledBy,
      handledAt: workOrder.signoff?.handledAt || current.handledAt,
      reviewedBy: workOrder.signoff?.reviewedBy || current.reviewedBy,
      reviewedAt: workOrder.signoff?.reviewedAt || current.reviewedAt,
      notes: workOrder.signoff?.notes || current.notes
    }));
  }, [workOrder]);

  function patchForm(patch: Partial<FcuSignoffForm>) {
    setForm((current) => ({
      ...current,
      ...patch
    }));
  }

  function handleFillCurrentEvidenceDraft() {
    if (!workOrder) {
      return;
    }
    const returnTemplateDevice = (status?.returnTemplate?.devices || []).find((item) =>
      [item.workOrderId, item.deviceCode, item.deviceName]
        .filter(Boolean)
        .some((value) => value === workOrder.workOrderId || value === workOrder.deviceCode || value === workOrder.deviceName)
    ) || null;
    const reviewDraft = returnTemplateDevice?.reviewDraft || null;
    if (reviewDraft) {
      const suggestedValues = reviewDraft.suggestedValues || {};
      const releaseDecisionDefault = reviewDraft.releaseDecisionDefault || "recheck";
      patchForm({
        communicationAlarmAfter: formatDraftValue(suggestedValues.communicationAlarmAfter) || form.communicationAlarmAfter,
        zoneTemperatureAfterC: formatDraftValue(suggestedValues.zoneTemperatureAfterC) || form.zoneTemperatureAfterC,
        setpointFeedbackAfterC: formatDraftValue(suggestedValues.setpointFeedbackAfterC) || form.setpointFeedbackAfterC,
        releaseDecision: releaseDecisionDefault === "release" ? "recheck" : releaseDecisionDefault,
        notes: [
          form.notes,
          `按 reviewDraft 填入现场复核草稿；默认 ${releaseDecisionDefault === "release" ? "recheck" : releaseDecisionDefault}，需人工核查后才可改为 release。`
        ].filter(Boolean).join("；")
      });
      setNotice("已按 reviewDraft 填入可参考字段；草稿不自动 release、不保存、不下发 BA/PLC。");
      setErrorText("");
      return;
    }
    const zoneTemperature = workOrder.currentEvidence?.zoneTemperatureC;
    const setpointFeedback = workOrder.currentEvidence?.setpointC;
    const communicationAlarm = workOrder.currentEvidence?.communicationAlarm;
    patchForm({
      communicationAlarmAfter: communicationAlarm === false ? "0" : communicationAlarm === true ? "1" : form.communicationAlarmAfter,
      zoneTemperatureAfterC:
        typeof zoneTemperature === "number" && zoneTemperature > 5 && zoneTemperature < 45 ? String(zoneTemperature) : form.zoneTemperatureAfterC,
      setpointFeedbackAfterC:
        typeof setpointFeedback === "number" && setpointFeedback >= 10 && setpointFeedback <= 32 ? String(setpointFeedback) : form.setpointFeedbackAfterC,
      releaseDecision: "recheck",
      notes: [
        form.notes,
        "未读取到 reviewDraft，按当前有效测点生成 recheck 草稿，需现场人工复核。"
      ].filter(Boolean).join("；")
    });
    setNotice("已按当前有效测点填入 recheck 草稿；不会自动 release。");
    setErrorText("");
  }

  function buildRecord(): AdminFcuSignoffRowRecord | null {
    if (!workOrder?.workOrderId || !workOrder.deviceCode) {
      return null;
    }
    return {
      workOrderId: workOrder.workOrderId,
      deviceCode: workOrder.deviceCode,
      ...form
    };
  }

  async function handleSaveRow() {
    if (!session || !siteId || saving) {
      return;
    }
    const record = buildRecord();
    if (!record) {
      setErrorText("当前工单缺少 workOrderId 或 deviceCode，不能保存。");
      return;
    }
    setSaving(true);
    setErrorText("");
    setNotice("");
    try {
      const result = await saveFcuFieldRemediationSignoffRow(session.token, session.userId, siteId, record, confirmText);
      setSaveResult(result);
      if (result.refreshedStatus) {
        setStatus(result.refreshedStatus);
      }
      const completeRows = result.signoff?.summary && "completeRows" in result.signoff.summary
        ? Number(result.signoff.summary.completeRows)
        : 0;
      const expectedRows = result.signoff?.summary && "expectedWorkOrders" in result.signoff.summary
        ? Number(result.signoff.summary.expectedWorkOrders)
        : 0;
      const nextAfterSave = findNextPendingFcuWorkOrder(result.refreshedStatus || status, workOrder);
      const nextHref = nextAfterSave?.workOrderId
        ? `/sites/${encodeURIComponent(siteId)}/subsystems/fcu/${encodeURIComponent(nextAfterSave.workOrderId)}`
        : "";
      if (nextAfterSave && nextHref && autoAdvanceAfterSave) {
        setNotice(
          `本台签字行已保存：${completeRows}/${expectedRows} 行通过；未下发 BA/PLC。即将按最终执行包队列跳转到 ${nextAfterSave.deviceCode || nextAfterSave.deviceName || nextAfterSave.workOrderId}。`
        );
        window.setTimeout(() => {
          navigate(nextHref);
        }, 800);
      } else if (nextAfterSave && nextHref) {
        setNotice(
          `本台签字行已保存：${completeRows}/${expectedRows} 行通过；未下发 BA/PLC。下一台待处理：${nextAfterSave.deviceCode || nextAfterSave.deviceName || nextAfterSave.workOrderId}。`
        );
      } else {
        setNotice(
          `本台签字行已保存：${completeRows}/${expectedRows} 行通过；未下发 BA/PLC。当前队列没有下一台待处理设备，请刷新 signoff / closeout / final gates。`
        );
      }
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : "本台签字行保存失败");
    } finally {
      setSaving(false);
    }
  }

  async function handleRefresh() {
    if (!session || !siteId || saving) {
      return;
    }
    setSaving(true);
    setErrorText("");
    setNotice("");
    try {
      const result = await refreshFcuFieldRemediationStatus(session.token, session.userId, siteId);
      setRefreshResult(result);
      if (result.status) {
        setStatus(result.status);
      }
      setNotice("FCU 门禁已刷新；未下发 BA/PLC。");
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : "刷新 FCU 门禁失败");
    } finally {
      setSaving(false);
    }
  }

  async function handleBuildFieldArmPackage() {
    if (!session || !siteId || saving || !workOrder?.deviceCode) {
      return;
    }
    setSaving(true);
    setErrorText("");
    setNotice("");
    try {
      const result = await buildFcuFieldArmPackage(session.token, session.userId, siteId, workOrder.deviceCode);
      setFieldArmPackage(result);
      if (result.refreshedStatus) {
        setStatus(result.refreshedStatus);
      }
      setNotice(`已生成 ${workOrder.deviceName || workOrder.deviceCode} 开闸预检包；未下发 BA/PLC。`);
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : "生成开闸预检包失败");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="admin-loading">正在加载 FCU 工单...</div>;
  }

  if (!workOrder) {
    return (
      <div className="admin-page-stack">
        <SectionCard title="FCU 单台消缺">
          <div className="admin-empty-state">未找到工单 {workOrderId}。请返回 FCU 现场消缺列表刷新后重试。</div>
        </SectionCard>
      </div>
    );
  }

  const finalSummary = status?.summary;
  const latestGatePassed = saveResult?.finalControlGates?.ok || refreshResult?.status?.summary?.finalGatePassed || finalSummary?.finalGatePassed;
  const latestSummary = saveResult?.refreshedStatus?.summary || refreshResult?.status?.summary || finalSummary || null;
  const latestGateSummary = saveResult?.finalControlGates?.summary || status?.finalControlGates?.summary || null;
  const latestGatePassedCount = readSummaryNumber(latestGateSummary, "passed");
  const latestGateCount = readSummaryNumber(latestGateSummary, "gateCount");
  const latestGateBlockedCount = readSummaryNumber(latestGateSummary, "blocked");
  const latestSignoffCompleteRows = readSummaryNumber(latestSummary as Record<string, unknown> | null, "signoffCompleteRows");
  const latestSignoffExpectedRows = readSummaryNumber(latestSummary as Record<string, unknown> | null, "signoffExpectedRows");
  const latestOpenP0Devices = readSummaryNumber(latestSummary as Record<string, unknown> | null, "openP0Devices");
  const latestCanaryReady = latestSummary?.canaryReady === true || saveResult?.finalControlGates?.summary?.canaryReady === true;
  const latestDispatch = saveResult?.dispatch === true || refreshResult?.dispatch === true;
  const latestControlMutation = saveResult?.controlMutation === true || refreshResult?.controlMutation === true;
  const returnToSignoffQueueHref = `/sites/${encodeURIComponent(siteId)}/subsystems`;
  const finalExecutionPack = status?.finalControlFieldExecutionPack || null;
  const finalExecutionPackSummary = finalExecutionPack?.summary || null;
  const finalDeviceQueueItem = (finalExecutionPack?.deviceQueue || []).find((item) =>
    [item.workOrderId, item.deviceCode, item.deviceName]
      .filter(Boolean)
      .some((value) => value === workOrder.workOrderId || value === workOrder.deviceCode || value === workOrder.deviceName)
  ) || null;
  const onsiteCanaryCandidate = finalDeviceQueueItem?.onsiteCanaryCandidate === true;
  const returnTemplateDevice = (status?.returnTemplate?.devices || []).find((item) =>
    [item.workOrderId, item.deviceCode, item.deviceName]
      .filter(Boolean)
      .some((value) => value === workOrder.workOrderId || value === workOrder.deviceCode || value === workOrder.deviceName)
  ) || null;
  const reviewDraft = returnTemplateDevice?.reviewDraft || null;
  const reviewDraftSuggestedValues = reviewDraft?.suggestedValues || {};
  const reviewDraftSuggestedEntries = Object.entries(reviewDraftSuggestedValues);
  const reviewDraftBlockedFields = reviewDraft?.blockedAutoFillFields || [];
  const reviewDraftManualOnlyFields = reviewDraft?.manualOnlyFields || [];
  const finalReleaseChecklist = finalExecutionPack?.finalReleaseChecklist || [];
  const nextPendingWorkOrder = findNextPendingFcuWorkOrder(status, workOrder);
  const nextPendingWorkOrderHref = nextPendingWorkOrder?.workOrderId
    ? `/sites/${encodeURIComponent(siteId)}/subsystems/fcu/${encodeURIComponent(nextPendingWorkOrder.workOrderId)}`
    : "";
  const currentReasons = workOrder.currentEvidence?.reasons || [];
  const hasCommunicationAlarm = workOrder.currentEvidence?.communicationAlarm === true;
  const zoneTemperature = workOrder.currentEvidence?.zoneTemperatureC;
  const setpointFeedback = workOrder.currentEvidence?.setpointC;
  const temperatureInvalid = typeof zoneTemperature !== "number" || zoneTemperature <= 5 || zoneTemperature >= 45;
  const setpointInvalid = typeof setpointFeedback === "number" && (setpointFeedback < 10 || setpointFeedback > 32);
  const canEnterSingleDevicePrecheck = !hasCommunicationAlarm && !temperatureInvalid && !setpointInvalid && form.releaseDecision === "release";
  const controlModeLabel = canEnterSingleDevicePrecheck || onsiteCanaryCandidate ? "可生成预检包" : "禁止闭环";
  const nextControlAction = hasCommunicationAlarm
    ? "先处理通讯报警，平台不允许抢控制。"
    : temperatureInvalid
      ? "先复核区域温度点，0°C/越界点不能参与控制。"
      : setpointInvalid
        ? "先复核设定反馈点，避免大幅错误写设定。"
        : onsiteCanaryCandidate || form.releaseDecision === "release"
          ? "可生成本台开闸预检包，仍需实时 closeout、Field Arm、Canary readiness 和最终总门禁。"
          : "现场签字保持 hold/recheck，本台不进入闭环。";

  return (
    <div className="admin-page-stack">
      <SectionCard
        title="FCU 单台消缺"
        action={
          <div className="admin-actions">
            <button className="admin-button" type="button" onClick={() => navigate(`/sites/${encodeURIComponent(siteId)}/subsystems`)}>
              <ArrowLeft size={14} />
              返回列表
            </button>
            <button className="admin-button" type="button" onClick={() => navigate(returnToSignoffQueueHref)}>
              返回签核队列
            </button>
            <button className="admin-button" type="button" onClick={() => void handleRefresh()} disabled={saving}>
              <RefreshCw size={14} />
              刷新门禁
            </button>
            <button className="admin-button" type="button" onClick={() => void handleBuildFieldArmPackage()} disabled={saving}>
              生成开闸预检包
            </button>
          </div>
        }
      >
        <div className="admin-section-stack">
          <div className="admin-chip-row">
            <StatusPill label={workOrder.deviceName || workOrder.deviceCode || workOrder.workOrderId || "--"} tone="good" />
            <StatusPill label={workOrder.priority || "P0"} tone="warn" />
            <StatusPill label={latestGatePassed ? "总门禁通过" : "总门禁阻断"} tone={latestGatePassed ? "good" : "warn"} />
            <StatusPill label={controlModeLabel} tone={canEnterSingleDevicePrecheck ? "good" : "warn"} />
            <StatusPill label="不下发 BA/PLC" tone="neutral" />
          </div>
          <p className="admin-warning-note">
            本页只保存现场消缺签字证据。即使本台签字为 release，仍需实时 closeout、canary 和最终总门禁全部通过后，才允许进入真实闭环。
          </p>
        </div>
      </SectionCard>

      {errorText ? <p className="admin-error">{errorText}</p> : null}
      {notice ? <p className="admin-success">{notice}</p> : null}
      {(saveResult || refreshResult) ? (
        <SectionCard title="保存后闭环刷新结果">
          <div className="admin-section-stack">
            <div className="admin-chip-row">
              <StatusPill label={latestGatePassed ? "最终门禁通过" : "最终门禁仍阻断"} tone={latestGatePassed ? "good" : "warn"} />
              <StatusPill label={latestCanaryReady ? "Canary 就绪" : "Canary 阻断"} tone={latestCanaryReady ? "good" : "warn"} />
              <StatusPill label={latestDispatch ? "存在下发" : "无下发"} tone={latestDispatch ? "danger" : "neutral"} />
              <StatusPill label={latestControlMutation ? "存在控制写入" : "无控制写入"} tone={latestControlMutation ? "danger" : "neutral"} />
            </div>
            <div className="admin-fcu-command-grid">
              <div>
                <span>签核进度</span>
                <strong>{latestSignoffCompleteRows ?? "--"}/{latestSignoffExpectedRows ?? "--"}</strong>
                <p>保存本台后自动读取 refreshedStatus；未完成前不能进入真实闭环。</p>
              </div>
              <div>
                <span>最终总门禁</span>
                <strong>{latestGatePassedCount ?? 0}/{latestGateCount ?? 8}</strong>
                <p>阻断 {latestGateBlockedCount ?? "--"} 项；总门禁未全绿时 3001 继续锁定。</p>
              </div>
              <div>
                <span>P0 现场阻断</span>
                <strong>{latestOpenP0Devices ?? "--"}</strong>
                <p>需要回到签核队列继续处理剩余设备。</p>
              </div>
              <div>
                <span>安全边界</span>
                <strong>{latestControlMutation || latestDispatch ? "需复核" : "保持只读证据"}</strong>
                <p>保存签核和刷新门禁只更新证据链，不执行 BA/PLC 写入。</p>
              </div>
            </div>
            <div className="admin-action-row">
              {nextPendingWorkOrder ? (
                <button className="admin-button is-primary" type="button" onClick={() => navigate(nextPendingWorkOrderHref)}>
                  下一台待处理 FCU：{nextPendingWorkOrder.deviceCode || nextPendingWorkOrder.deviceName || nextPendingWorkOrder.workOrderId}
                </button>
              ) : null}
              <button className="admin-button" type="button" onClick={() => navigate(returnToSignoffQueueHref)}>
                返回签核队列继续下一台
              </button>
              <button className="admin-button" type="button" onClick={() => void handleRefresh()} disabled={saving}>
                刷新 closeout / 总门禁
              </button>
            </div>
            <p className="admin-inline-note">
              单台 release 只是现场证据完成，不等于最终控制完成；仍需 signoff、closeout、Canary readiness、Field Arm、BA 写适配器和最终总门禁全部通过。
              {nextPendingWorkOrder ? ` 系统已定位下一台待处理设备 ${nextPendingWorkOrder.deviceCode || nextPendingWorkOrder.deviceName || nextPendingWorkOrder.workOrderId}。` : " 当前列表没有下一台待处理设备，回到签核队列复核总门禁。"}
            </p>
          </div>
        </SectionCard>
      ) : null}

      <SectionCard title="最终执行队列定位">
        <div className="admin-section-stack">
          <div className="admin-chip-row">
            <StatusPill
              label={`最终执行包 ${finalExecutionPack?.ok ? "ready" : "blocked"}`}
              tone={finalExecutionPack?.ok ? "good" : "warn"}
            />
            <StatusPill
              label={`队列 ${finalExecutionPackSummary?.openDevices ?? "--"}/${finalExecutionPackSummary?.totalDevices ?? "--"} 未放行`}
              tone={(finalExecutionPackSummary?.openDevices || 0) > 0 ? "warn" : "good"}
            />
            <StatusPill
              label={`本台顺序 ${finalDeviceQueueItem?.sequence ?? "--"}`}
              tone={finalDeviceQueueItem ? "neutral" : "warn"}
            />
            <StatusPill
              label={finalDeviceQueueItem?.canEnterCanary ? "本台可进 Canary" : onsiteCanaryCandidate ? "现场候选/待预检" : "本台仍阻断"}
              tone={finalDeviceQueueItem?.canEnterCanary ? "good" : onsiteCanaryCandidate ? "neutral" : "warn"}
            />
          </div>
          <div className="admin-fcu-command-grid">
            <div>
              <span>第一阻断</span>
              <strong>{finalExecutionPackSummary?.firstBlocker || "--"}</strong>
              <p>{finalExecutionPackSummary?.nextAction || "按最终执行包逐台补齐现场签核证据。"}</p>
            </div>
            <div>
              <span>本台 Canary 状态</span>
              <strong>{finalDeviceQueueItem?.canaryBlockReason || (finalDeviceQueueItem?.canEnterCanary ? "canary-ready" : onsiteCanaryCandidate ? "onsite-candidate" : "未匹配执行包")}</strong>
              <p>{onsiteCanaryCandidate ? "现场签核已完整，可生成本台 Field Arm / Canary 预检包；未通过前仍禁止真实下发。" : finalDeviceQueueItem?.todayAction || "先回到 3002 刷新最终执行包和签核队列。"}</p>
            </div>
            <div>
              <span>本台缺项</span>
              <strong>{(finalDeviceQueueItem?.missingFields || []).length || "--"}</strong>
              <p>{(finalDeviceQueueItem?.missingFields || []).slice(0, 5).join(" / ") || "未读取到缺项字段。"}</p>
            </div>
            <div>
              <span>安全边界</span>
              <strong>{finalExecutionPack?.controlMutation || finalExecutionPack?.dispatch ? "需复核" : "只读证据"}</strong>
              <p>最终执行包、签核保存和门禁刷新均不直接下发 BA/PLC。</p>
            </div>
          </div>
          {finalReleaseChecklist.length > 0 ? (
            <div className="admin-table-scroll">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>最终放行项</th>
                    <th>状态</th>
                    <th>细节</th>
                    <th>下一步</th>
                  </tr>
                </thead>
                <tbody>
                  {finalReleaseChecklist.map((item) => (
                    <tr key={item.key || item.label}>
                      <td>{item.label || item.key || "--"}</td>
                      <td>{item.ok ? "通过" : "阻断"}</td>
                      <td>{item.detail || "--"}</td>
                      <td>{item.action || "--"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      </SectionCard>

      <SectionCard title="单台控制资格">
        <div className="admin-fcu-control-layout">
          <div className="admin-fcu-control-primary">
            <div>
              <span>当前结论</span>
              <strong>{controlModeLabel}</strong>
              <p>{nextControlAction}</p>
            </div>
            <div className="admin-fcu-control-actions">
              <button className="admin-button" type="button" onClick={() => void handleBuildFieldArmPackage()} disabled={saving || !workOrder.deviceCode}>
                生成本台预检包
              </button>
              <button className="admin-button" type="button" onClick={() => void handleRefresh()} disabled={saving}>
                刷新总门禁
              </button>
            </div>
          </div>
          <div className="admin-fcu-control-grid">
            <div className={`admin-fcu-control-tile ${hasCommunicationAlarm ? "is-blocked" : "is-ready"}`}>
              <ShieldAlert size={17} />
              <span>通讯</span>
              <strong>{hasCommunicationAlarm ? "报警" : "正常"}</strong>
              <small>报警立即退出自动控制</small>
            </div>
            <div className={`admin-fcu-control-tile ${temperatureInvalid ? "is-blocked" : "is-ready"}`}>
              <Thermometer size={17} />
              <span>温度</span>
              <strong>{typeof zoneTemperature === "number" ? `${zoneTemperature}°C` : "--"}</strong>
              <small>有效范围 5-45°C</small>
            </div>
            <div className={`admin-fcu-control-tile ${setpointInvalid ? "is-blocked" : "is-ready"}`}>
              <Fan size={17} />
              <span>设定反馈</span>
              <strong>{typeof setpointFeedback === "number" ? `${setpointFeedback}°C` : "--"}</strong>
              <small>有效范围 10-32°C</small>
            </div>
            <div className={`admin-fcu-control-tile ${form.releaseDecision === "release" ? "is-ready" : "is-blocked"}`}>
              <ToggleLeft size={17} />
              <span>现场放行</span>
              <strong>{form.releaseDecision}</strong>
              <small>release 后才进后续门禁</small>
            </div>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="控制动作预览">
        <div className="admin-fcu-command-grid">
          <div>
              <span>启停命令</span>
            <strong>{canEnterSingleDevicePrecheck || onsiteCanaryCandidate ? "待预检" : "阻断"}</strong>
            <p>只对白名单设备开放，最小启停保持 30 分钟。</p>
          </div>
          <div>
            <span>温度设定</span>
            <strong>{canEnterSingleDevicePrecheck || onsiteCanaryCandidate ? "预检后 0.5°C 步长" : "不允许写"}</strong>
            <p>单次最大调整 0.5°C，每日累计不超过 2°C。</p>
          </div>
          <div>
            <span>风速模式</span>
            <strong>{canEnterSingleDevicePrecheck || onsiteCanaryCandidate ? "预检后优先自动" : "仅建议"}</strong>
            <p>第一版不直接写阀门，阀门只作为反馈。</p>
          </div>
          <div>
            <span>写入边界</span>
            <strong>当前无写入</strong>
            <p>保存签字、生成预检包、刷新门禁均不下发 BA/PLC。</p>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="现场复核草稿">
        <div className="admin-section-stack">
          <div className="admin-chip-row">
            <StatusPill
              label={reviewDraft?.canSuggestAnyValue ? "有可参考值" : "无可自动参考值"}
              tone={reviewDraft?.canSuggestAnyValue ? "good" : "warn"}
            />
            <StatusPill label={`默认 ${reviewDraft?.releaseDecisionDefault || "recheck"}`} tone="warn" />
            <StatusPill label="不自动 release" tone="neutral" />
            <StatusPill label="不下发 BA/PLC" tone="neutral" />
          </div>
          <div className="admin-fcu-command-grid">
            <div>
              <span>可参考字段</span>
              <strong>{reviewDraftSuggestedEntries.length || "--"}</strong>
              <p>{reviewDraftSuggestedEntries.map(([field, value]) => `${field}=${value}`).join(" / ") || "当前通讯或质量不满足，必须现场手工复核。"}</p>
            </div>
            <div>
              <span>不可自动填</span>
              <strong>{reviewDraftBlockedFields.length || "--"}</strong>
              <p>{reviewDraftBlockedFields.join(" / ") || "无阻断字段。"}</p>
            </div>
            <div>
              <span>人工必填</span>
              <strong>{reviewDraftManualOnlyFields.length || "--"}</strong>
              <p>{reviewDraftManualOnlyFields.join(" / ") || "按现场签核要求填写。"}</p>
            </div>
            <div>
              <span>不能放行原因</span>
              <strong>{(reviewDraft?.cannotReleaseReasons || []).length || "--"}</strong>
              <p>{(reviewDraft?.cannotReleaseReasons || []).join(" / ") || "仍需人工确认 releaseDecision。"}</p>
            </div>
          </div>
          <p className="admin-warning-note">
            reviewDraft 只把当前可信读数作为现场复核参考，不能替代 BA 工程师签字；系统默认 recheck，人工确认后才可改为 release。
          </p>
        </div>
      </SectionCard>

      <div className="admin-summary-grid">
        <StatCard title="通讯报警" value={workOrder.currentEvidence?.communicationAlarm === true ? "1" : workOrder.currentEvidence?.communicationAlarm === false ? "0" : "--"} delta="0 才可放行" tone={workOrder.currentEvidence?.communicationAlarm ? "warn" : "good"} />
        <StatCard title="区域温度" value={`${workOrder.currentEvidence?.zoneTemperatureC ?? "--"}`} unit="°C" delta="有效范围 5-45" tone={(workOrder.currentEvidence?.zoneTemperatureC || 0) <= 0 ? "warn" : "neutral"} />
        <StatCard title="设定反馈" value={`${workOrder.currentEvidence?.setpointC ?? "--"}`} unit="°C" delta="策略边界 10-32" tone="neutral" />
        <StatCard title="签字进度" value={`${finalSummary?.signoffCompleteRows ?? 0}/${finalSummary?.signoffExpectedRows ?? 0}`} delta="完成/应完成" tone={finalSummary?.signoffComplete ? "good" : "warn"} />
      </div>

      <SectionCard title="现场处理记录">
        <div className="admin-section-stack">
          <div className="admin-form-grid">
            <label className="admin-field-block">
              <span>处理人</span>
              <input value={form.handledBy} onChange={(event) => patchForm({ handledBy: event.target.value })} />
            </label>
            <label className="admin-field-block">
              <span>处理时间</span>
              <input type="datetime-local" value={form.handledAt} onChange={(event) => patchForm({ handledAt: event.target.value })} />
            </label>
            <label className="admin-field-block">
              <span>通讯报警复核</span>
              <select value={form.communicationAlarmAfter} onChange={(event) => patchForm({ communicationAlarmAfter: event.target.value })}>
                <option value="0">0 - 已恢复</option>
                <option value="1">1 - 仍报警</option>
              </select>
            </label>
            <label className="admin-field-block">
              <span>区域温度复核 °C</span>
              <input value={form.zoneTemperatureAfterC} onChange={(event) => patchForm({ zoneTemperatureAfterC: event.target.value })} placeholder="5-45" />
            </label>
            <label className="admin-field-block">
              <span>设定反馈复核 °C</span>
              <input value={form.setpointFeedbackAfterC} onChange={(event) => patchForm({ setpointFeedbackAfterC: event.target.value })} placeholder="10-32，可留空" />
            </label>
            <label className="admin-field-block">
              <span>写点映射复核</span>
              <select value={form.writePointMappingChecked} onChange={(event) => patchForm({ writePointMappingChecked: event.target.value })}>
                <option value="yes">yes - 已复核</option>
                <option value="no">no - 未复核</option>
              </select>
            </label>
            <label className="admin-field-block">
              <span>连续两次采样</span>
              <select value={form.twoSampleNormal} onChange={(event) => patchForm({ twoSampleNormal: event.target.value })}>
                <option value="yes">yes - 正常</option>
                <option value="no">no - 不正常</option>
              </select>
            </label>
            <label className="admin-field-block">
              <span>就地/手动锁定</span>
              <select value={form.localManualLockout} onChange={(event) => patchForm({ localManualLockout: event.target.value })}>
                <option value="none">none - 无锁定</option>
                <option value="manual">manual - 手动优先</option>
                <option value="lockout">lockout - 禁控</option>
              </select>
            </label>
            <label className="admin-field-block">
              <span>放行决定</span>
              <select value={form.releaseDecision} onChange={(event) => patchForm({ releaseDecision: event.target.value })}>
                <option value="hold">hold - 继续阻断</option>
                <option value="recheck">recheck - 需复核</option>
                <option value="release">release - 允许进入后续门禁</option>
              </select>
            </label>
            <label className="admin-field-block">
              <span>复核人</span>
              <input value={form.reviewedBy} onChange={(event) => patchForm({ reviewedBy: event.target.value })} />
            </label>
            <label className="admin-field-block">
              <span>复核时间</span>
              <input type="datetime-local" value={form.reviewedAt} onChange={(event) => patchForm({ reviewedAt: event.target.value })} />
            </label>
            <label className="admin-field-block is-full">
              <span>备注</span>
              <input value={form.notes} onChange={(event) => patchForm({ notes: event.target.value })} />
            </label>
          </div>
          <div className="admin-action-row">
            <button className="admin-button" type="button" onClick={handleFillCurrentEvidenceDraft}>
              按 reviewDraft 填草稿
            </button>
            <button className="admin-button" type="button" onClick={() => patchForm({ handledAt: toDateTimeLocalValue(new Date()) })}>
              填入处理时间
            </button>
            <button className="admin-button" type="button" onClick={() => patchForm({ reviewedAt: toDateTimeLocalValue(new Date()) })}>
              填入复核时间
            </button>
            <span className="admin-inline-note">reviewDraft 草稿只填表单，不保存、不放行、不下发 BA/PLC。</span>
          </div>
          <label className="admin-field-block">
            <span>保存确认短语</span>
            <input value={confirmText} onChange={(event) => setConfirmText(event.target.value)} placeholder={FCU_SIGNOFF_CONFIRM} spellCheck={false} />
          </label>
          <div className="admin-action-row">
            <label className="admin-inline-toggle">
              <input
                type="checkbox"
                checked={autoAdvanceAfterSave}
                onChange={(event) => setAutoAdvanceAfterSave(event.target.checked)}
              />
              <span>保存后按最终执行包队列自动跳转下一台</span>
            </label>
            <button className="admin-button is-primary" type="button" onClick={() => void handleSaveRow()} disabled={saving || confirmText !== FCU_SIGNOFF_CONFIRM}>
              <Save size={14} />
              保存本台签字行
            </button>
            {saveResult ? (
              <StatusPill label={saveResult.finalControlGates?.ok ? "总门禁通过" : "保存后仍阻断"} tone={saveResult.finalControlGates?.ok ? "good" : "warn"} />
            ) : null}
          </div>
        </div>
      </SectionCard>

      <SectionCard title="放行条件">
        <div className="admin-section-stack">
          <div className="admin-fcu-auth-check is-blocked">
            <strong>当前阻断原因</strong>
            <span>{currentReasons.join(" / ") || "暂无原因字段"}</span>
          </div>
          <div className="admin-table-scroll">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>现场动作</th>
                  <th>放行标准</th>
                </tr>
              </thead>
              <tbody>
                {(workOrder.plannedAction || []).slice(0, 8).map((action, index) => (
                  <tr key={`${action}-${index}`}>
                    <td>{action}</td>
                    <td>{workOrder.releaseCriteria?.[index] || "--"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </SectionCard>

      {fieldArmPackage ? (
        <SectionCard title="开闸预检 / Canary 包">
          <div className="admin-section-stack">
            <div className="admin-chip-row">
              <StatusPill
                label={fieldArmPackage.fieldArmPackage?.ok ? "Field Arm 就绪" : "Field Arm 阻断"}
                tone={fieldArmPackage.fieldArmPackage?.ok ? "good" : "warn"}
              />
              <StatusPill
                label={fieldArmPackage.canaryExecutionPackage?.ok ? "Canary 包就绪" : "Canary 包阻断"}
                tone={fieldArmPackage.canaryExecutionPackage?.ok ? "good" : "warn"}
              />
              <StatusPill label={fieldArmPackage.dispatch ? "存在下发" : "未下发"} tone={fieldArmPackage.dispatch ? "danger" : "neutral"} />
              <StatusPill label={fieldArmPackage.controlMutation ? "存在控制写入" : "无控制写入"} tone={fieldArmPackage.controlMutation ? "danger" : "neutral"} />
            </div>
            {(fieldArmPackage.fieldArmPackage?.blockers || []).length > 0 ? (
              <div className="admin-fcu-auth-check is-blocked">
                <strong>开闸阻断项</strong>
                <span>
                  {(fieldArmPackage.fieldArmPackage?.blockers || [])
                    .slice(0, 5)
                    .map((item) => `${item.label || item.key || "blocker"} ${item.evidence || ""}`)
                    .join(" / ")}
                </span>
              </div>
            ) : null}
            <div className="admin-table-scroll">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>检查项</th>
                    <th>阶段</th>
                    <th>状态</th>
                    <th>责任人</th>
                    <th>动作</th>
                  </tr>
                </thead>
                <tbody>
                  {(fieldArmPackage.fieldArmPackage?.checklist || []).slice(0, 8).map((item) => (
                    <tr key={item.key || item.label}>
                      <td>{item.label || item.key || "--"}</td>
                      <td>{item.phase || "--"}</td>
                      <td>{item.status || "--"}</td>
                      <td>{item.owner || "--"}</td>
                      <td>{item.writesControl ? "真实写控制，需授权窗口" : item.action || "--"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </SectionCard>
      ) : null}
    </div>
  );
}
