import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const worklistScriptPath = path.join(__dirname, "build-fcu-final-control-worklist.js");

function writeJson(filePath, payload) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`);
}

function runNodeScript(scriptPath, env) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [scriptPath], {
      cwd: path.resolve(__dirname, ".."),
      env: {
        ...process.env,
        FCU_FINAL_WORKLIST_REFRESH_CLOSEOUT: "false",
        FCU_FINAL_WORKLIST_REFRESH_WORK_ORDERS: "false",
        FCU_FINAL_WORKLIST_REFRESH_EXECUTION_PACK: "false",
        FCU_FINAL_WORKLIST_REFRESH_HANDOFF: "false",
        FCU_FINAL_WORKLIST_REFRESH_RETURN_TEMPLATE: "false",
        ...env
      },
      stdio: ["ignore", "pipe", "pipe"]
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("close", (status) => {
      resolve({
        status: status ?? 0,
        stdout,
        stderr
      });
    });
  });
}

function buildActiveAuthorizationWindow() {
  return {
    start: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
    end: new Date(Date.now() + 50 * 60 * 1000).toISOString()
  };
}

test("final control worklist includes explicit 3002 site authorization action", async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "fcu-final-worklist-"));
  try {
    const files = {
      preflight: path.join(tempDir, "preflight.json"),
      fieldArm: path.join(tempDir, "field-arm.json"),
      finalCompletion: path.join(tempDir, "final-completion.json"),
      quality: path.join(tempDir, "quality.json"),
      canaryPackage: path.join(tempDir, "canary-package.json"),
      canaryReadiness: path.join(tempDir, "canary-readiness.json"),
      adapterReadiness: path.join(tempDir, "adapter-readiness.json"),
      canaryFeedback: path.join(tempDir, "canary-feedback.json"),
      canaryWindow: path.join(tempDir, "canary-window.json"),
      siteAuthorization: path.join(tempDir, "site-authorization.json"),
      allPlan: path.join(tempDir, "all-plan.json"),
      fieldSignoffInput: path.join(tempDir, "field-signoff-input.csv"),
      fieldSignoff: path.join(tempDir, "field-signoff.json"),
      fieldSignoffClean: path.join(tempDir, "field-signoff-clean.json"),
      fieldSignoffPromote: path.join(tempDir, "field-signoff-promote.json"),
      fieldHandoff: path.join(tempDir, "field-handoff.json"),
      fieldReturnTemplate: path.join(tempDir, "field-return-template.json"),
      rollout: path.join(tempDir, "rollout.json"),
      outputJson: path.join(tempDir, "worklist.json"),
      outputMd: path.join(tempDir, "worklist.md")
    };

    writeJson(files.preflight, { ok: false, verdict: "go_live_blocked" });
    writeJson(files.fieldArm, {
      ok: false,
      verdict: "field_arm_blocked",
      firstCanary: "BGS01",
      blockingItems: [
        {
          key: "execution_gate_open",
          label: "全局投运闸门",
          ok: false,
          severity: "P0",
          message: "未打开：site_authorization_approved / site_authorization_owner_recorded / site_authorization_window_configured / site_authorization_window_active / ba_write_confirm_armed / final_rollout_confirm_armed / backend_not_readonly"
        }
      ]
    });
    writeJson(files.finalCompletion, {
      ok: false,
      firstCanary: "BGS01",
      milestones: {
        canary: { ok: false, deviceCode: "BGS01" },
        smallBatch: { ok: false, devices: 0 },
        allDevice: { ok: false, targetDevices: 29, confirmedDevices: 0 }
      },
      blockingItems: [{ key: "backend_write_gate" }]
    });
    writeJson(files.quality, { ok: true, summary: { p0Count: 0 }, devices: [] });
    writeJson(files.canaryPackage, { ok: false, verdict: "canary_package_ready_with_open_gates", canary: { deviceCode: "BGS01" } });
    writeJson(files.canaryReadiness, {
      ok: false,
      verdict: "canary_blocked",
      firstCanary: "BGS01",
      summary: { canaryReady: false, blockedCount: 2 },
      readinessPlaybook: {
        canExecuteCanary: false,
        readyGateCount: 1,
        blockedGateCount: 5,
        firstBlockedPhase: "现场签字",
        firstBlockedOwner: "现场/运维",
        firstBlockedAction: "填写并复核 fcu-field-remediation-signoff-input-latest.csv 后重跑 check:fcu-field-remediation-signoff",
        fieldBlocked: true,
        baBlocked: true,
        canaryPackageBlocked: true,
        phasePlan: [
          {
            key: "field_signoff_complete",
            phase: "现场签字",
            owner: "现场/运维",
            ready: false,
            blocking: true,
            evidence: "0/1 complete",
            sourceFile: files.fieldSignoff,
            nextAction: "填写并复核 fcu-field-remediation-signoff-input-latest.csv 后重跑 check:fcu-field-remediation-signoff"
          }
        ]
      }
    });
    writeJson(files.adapterReadiness, { ok: false, verdict: "ba_write_adapter_blocked", canary: { deviceCode: "BGS01" } });
    writeJson(files.canaryFeedback, { ok: false, verdict: "waiting_for_canary_dispatch", canary: { deviceCode: "BGS01" } });
    writeJson(files.canaryWindow, { ok: false, verdict: "canary_window_blocked", canary: { deviceCode: "BGS01" } });
    writeJson(files.fieldSignoff, {
      ok: false,
      summary: { signoffComplete: false, completeRows: 0, expectedWorkOrders: 1, stillRequiresRealtimeCloseout: true },
      records: [
        {
          workOrderId: "FCU-P0-BGS01",
          deviceCode: "BGS01",
          deviceName: "办公室01",
          signoffComplete: false,
          issues: ["handledBy_missing"],
          missingChecklist: [
            {
              field: "handledBy",
              requiredValue: "现场处理人姓名",
              action: "填写实际处理人。"
            }
          ]
        }
      ],
      outputs: {
        json: files.fieldSignoff,
        markdown: path.join(tempDir, "field-signoff.md"),
        csv: path.join(tempDir, "field-signoff.csv"),
        releaseMatrixCsv: path.join(tempDir, "field-signoff-release-matrix.csv")
      },
      releaseMatrix: [
        {
          workOrderId: "FCU-P0-BGS01",
          deviceCode: "BGS01",
          deviceName: "办公室01",
          owner: "BA/自控工程师",
          signoffComplete: false,
          canEnterCanary: false,
          canaryBlockReason: "signoff_incomplete",
          missingFields: ["handledBy"],
          requiredValues: ["handledBy=现场处理人姓名"],
          nextActions: ["填写实际处理人。"],
          releaseCriteria: ["通讯报警=0"],
          verificationTarget: "通讯=必填：0；温度=必填：5-45",
          rerunCommand: "npm --prefix apps/chiller-bff run check:fcu-field-remediation-signoff"
        }
      ],
      onsiteReleasePrecheck: {
        ok: false,
        onsiteReleaseReadyCount: 0,
        onsiteReleaseBlockedCount: 1,
        canaryCandidateCount: 0,
        canaryStillBlockedCount: 1,
        blockFieldCounts: { handledBy: 1 },
        nextGlobalActions: ["补齐所有 onsiteReleaseReady=false 的现场签字字段"],
        devices: [
          {
            workOrderId: "FCU-P0-BGS01",
            deviceCode: "BGS01",
            deviceName: "办公室01",
            onsiteReleaseReady: false,
            canEnterCanary: false,
            canaryBlockReason: "signoff_incomplete",
            nextBlockingFields: ["handledBy"],
            nextAction: "填写实际处理人。"
          }
        ]
      }
    });
    writeJson(files.fieldSignoffClean, {
      ok: false,
      summary: { currentRows: 1, staleRows: 1, generatedMissingRows: 0 },
      outputs: {
        currentCsv: path.join(tempDir, "current.csv"),
        staleCsv: path.join(tempDir, "stale.csv"),
        markdown: path.join(tempDir, "clean.md"),
        json: files.fieldSignoffClean
      }
    });
    writeJson(files.fieldSignoffPromote, {
      ok: true,
      mode: "dry_run",
      fileMutation: false,
      confirmMatched: false,
      summary: { currentRows: 1, staleRows: 1 },
      target: {
        signoffInputCsv: files.fieldSignoffInput,
        backupCsv: path.join(tempDir, "signoff-backup.csv")
      },
      outputs: {
        markdown: path.join(tempDir, "promote.md"),
        json: files.fieldSignoffPromote
      }
    });
    writeJson(files.fieldHandoff, {
      ok: false,
      controlMutation: false,
      dispatch: false,
      outputFiles: {
        json: files.fieldHandoff,
        markdown: path.join(tempDir, "field-handoff.md"),
        csv: path.join(tempDir, "field-handoff.csv"),
        currentOnlyCsv: path.join(tempDir, "current.csv"),
        staleCsv: path.join(tempDir, "stale.csv"),
        signoffInputCsv: files.fieldSignoffInput
      },
      summary: {
        openP0Devices: 1,
        staleSignoffRows: 1,
        signoffCompleteRows: 0,
        signoffExpectedRows: 1,
        nextAllowedStep: "先清理过期签核行，生成 current-only 输入表。"
      },
      devices: [
        {
          workOrderId: "FCU-P0-BGS01",
          deviceCode: "BGS01",
          deviceName: "办公室01",
          owner: "BA/自控工程师",
          reasonLabels: ["通讯报警"],
          todayAction: "先恢复通讯报警，再做温度和设定反馈复核。"
        }
      ]
    });
    writeJson(files.fieldReturnTemplate, {
      ok: true,
      controlMutation: false,
      dispatch: false,
      outputs: {
        json: files.fieldReturnTemplate,
        markdown: path.join(tempDir, "field-return-template.md"),
        csv: path.join(tempDir, "field-return-template.csv")
      },
      summary: {
        deviceCount: 1,
        communicationBlocked: 1,
        temperatureBlocked: 0,
        setpointBlocked: 0,
        draftSuggestibleDevices: 1,
        draftTemperatureSuggestions: 1,
        draftSetpointSuggestions: 1,
        signoffCompleteRows: 0,
        signoffExpectedRows: 1
      },
      requiredColumns: ["workOrderId", "deviceCode", "handledBy", "releaseDecision"],
      devices: [
        {
          workOrderId: "FCU-P0-BGS01",
          deviceCode: "BGS01",
          deviceName: "办公室01",
          currentEvidence: {
            reasons: ["communication_alarm"],
            reasonLabels: ["通讯报警未恢复"]
          },
          missingFields: ["handledBy"],
          reviewDraft: {
            releaseDecisionDefault: "recheck",
            suggestedValues: {
              zoneTemperatureAfterC: "26",
              setpointFeedbackAfterC: "24"
            },
            blockedAutoFillFields: ["communicationAlarmAfter"],
            manualOnlyFields: ["handledBy", "releaseDecision"]
          },
          releaseCriteria: ["通讯报警=0"]
        }
      ]
    });
    const authorizationWindow = buildActiveAuthorizationWindow();
    writeJson(files.siteAuthorization, {
      ok: true,
      persisted: false,
      dryRun: true,
      controlMutation: false,
      confirmMatched: false,
      window: {
        active: true
      },
      after: {
        siteAuthorizationBy: "业主值班长",
        commissioningOwner: "平台工程师",
        baOwner: "BA工程师",
        siteAuthorizationWindowStart: authorizationWindow.start,
        siteAuthorizationWindowEnd: authorizationWindow.end,
        baWriteConfirmArmed: true,
        finalRolloutConfirmArmed: true
      }
    });
    writeJson(files.allPlan, { ok: true, summary: { total: 29, plannedDeviceCount: 21, blocked: 8 } });
    writeJson(files.rollout, { ok: false, confirm: { finalRolloutConfirmPresent: false, smallBatchConfirmPresent: false } });

    const result = await runNodeScript(worklistScriptPath, {
      FCU_GO_LIVE_PREFLIGHT_JSON: files.preflight,
      FCU_FIELD_ARM_CHECK_JSON: files.fieldArm,
      FCU_FINAL_CONTROL_COMPLETION_JSON: files.finalCompletion,
      FCU_QUALITY_REMEDIATION_JSON: files.quality,
      FCU_CANARY_EXECUTION_PACKAGE_JSON: files.canaryPackage,
      FCU_CANARY_READINESS_JSON: files.canaryReadiness,
      FCU_FINAL_WORKLIST_REFRESH_CANARY_READINESS: "false",
      FCU_BA_WRITE_ADAPTER_READINESS_JSON: files.adapterReadiness,
      FCU_CANARY_FEEDBACK_MONITOR_JSON: files.canaryFeedback,
      FCU_CANARY_WINDOW_JSON: files.canaryWindow,
      FCU_FIELD_REMEDIATION_SIGNOFF_INPUT_CSV: files.fieldSignoffInput,
      FCU_FIELD_REMEDIATION_SIGNOFF_JSON: files.fieldSignoff,
      FCU_FIELD_REMEDIATION_SIGNOFF_CLEAN_JSON: files.fieldSignoffClean,
      FCU_FIELD_REMEDIATION_SIGNOFF_PROMOTE_JSON: files.fieldSignoffPromote,
      FCU_FIELD_HANDOFF_PACK_JSON: files.fieldHandoff,
      FCU_FIELD_REMEDIATION_RETURN_TEMPLATE_JSON: files.fieldReturnTemplate,
      FCU_FINAL_WORKLIST_REFRESH_SIGNOFF: "false",
      FCU_FINAL_WORKLIST_REFRESH_SIGNOFF_CLEAN: "false",
      FCU_FINAL_WORKLIST_REFRESH_SIGNOFF_PROMOTE: "false",
      FCU_FINAL_WORKLIST_REFRESH_RETURN_TEMPLATE: "false",
      FCU_SITE_AUTHORIZATION_JSON: files.siteAuthorization,
      FCU_ALL_DEVICE_DISPATCH_PLAN_JSON: files.allPlan,
      FCU_FINAL_CONTROL_ROLLOUT_JSON: files.rollout,
      FCU_FINAL_CONTROL_WORKLIST_JSON: files.outputJson,
      FCU_FINAL_CONTROL_WORKLIST_MD: files.outputMd
    });

    assert.equal(result.status, 2, result.stdout || result.stderr);
    const worklist = JSON.parse(fs.readFileSync(files.outputJson, "utf8"));
    const action = worklist.actions.find((item) => item.key === "approve-site-authorization-in-3002");
    assert.ok(action, "missing 3002 site authorization action");
    assert.equal(action.priority, "P0");
    assert.equal(action.phase, "authorization");
    assert.equal(action.source, "siteAuthorization");
    assert.match(action.command, /FCU_SITE_AUTHORIZATION_CONFIRM=I_APPROVE_FCU_SITE_AUTHORIZATION/);
    assert.match(action.command, /--authorized-by=业主值班长/);
    assert.match(action.acceptance, /authorizationStatus=approved/);
    assert.equal(worklist.fieldPackages.siteAuthorization.ok, true);
    assert.equal(worklist.fieldPackages.siteAuthorization.persisted, false);
    assert.equal(worklist.fieldPackages.siteAuthorization.controlMutation, false);
    assert.equal(worklist.qualityRefresh.skipped, true);
    assert.equal(worklist.allDevicePlanRefresh.skipped, true);
    assert.equal(worklist.summary.plannedDeviceCount, 21);
    assert.equal(worklist.actions.some((item) => item.key === "record-site-authorization-owners-in-3002"), false);
    assert.equal(worklist.actions.some((item) => item.key === "configure-site-authorization-window-in-3002"), false);
    assert.equal(worklist.actions.some((item) => item.key === "activate-site-authorization-window"), false);
    const canaryReadinessAction = worklist.actions.find((item) => item.key === "pass-canary-readiness");
    assert.ok(canaryReadinessAction, "missing Canary readiness gate action");
    assert.equal(canaryReadinessAction.priority, "P0");
    assert.equal(canaryReadinessAction.phase, "canary_readiness");
    assert.match(canaryReadinessAction.acceptance, /verdict=canary_ready/);
    assert.equal(worklist.phases.find((item) => item.key === "canary_readiness")?.status, "blocked");
    assert.equal(worklist.fieldPackages.fieldRemediationSignoff.openRecords[0].deviceCode, "BGS01");
    assert.equal(worklist.fieldPackages.fieldRemediationSignoff.openRecords[0].missingChecklist[0].field, "handledBy");
    assert.match(worklist.fieldPackages.fieldRemediationSignoff.releaseMatrixCsv, /field-signoff-release-matrix\.csv$/);
    assert.equal(worklist.fieldPackages.fieldRemediationSignoff.releaseMatrix[0].deviceCode, "BGS01");
    assert.equal(worklist.fieldPackages.fieldRemediationSignoff.releaseMatrix[0].canEnterCanary, false);
    assert.equal(worklist.fieldPackages.fieldRemediationSignoff.releaseMatrix[0].canaryBlockReason, "signoff_incomplete");
    assert.match(worklist.fieldPackages.fieldRemediationSignoff.releaseMatrix[0].verificationTarget, /通讯=必填：0/);
    assert.equal(worklist.fieldPackages.fieldRemediationSignoff.onsiteReleasePrecheck.onsiteReleaseBlockedCount, 1);
    assert.equal(worklist.fieldPackages.fieldRemediationSignoff.onsiteReleasePrecheck.devices[0].nextBlockingFields[0], "handledBy");
    assert.equal(worklist.fieldPackages.canaryReadiness.readinessPlaybook.canExecuteCanary, false);
    assert.equal(worklist.fieldPackages.canaryReadiness.readinessPlaybook.firstBlockedPhase, "现场签字");
    assert.equal(worklist.fieldPackages.canaryReadiness.readinessPlaybook.firstBlockedOwner, "现场/运维");
    assert.equal(worklist.fieldPackages.canaryReadiness.readinessPlaybook.phasePlan[0].sourceFile, files.fieldSignoff);
    assert.equal(worklist.fieldPackages.fieldRemediationSignoffCleanInput.staleRows, 1);
    assert.match(worklist.fieldPackages.fieldRemediationSignoffCleanInput.currentCsv, /current\.csv/);
    assert.equal(worklist.fieldPackages.fieldRemediationSignoffPromote.mode, "dry_run");
    assert.equal(worklist.fieldPackages.fieldRemediationSignoffPromote.fileMutation, false);
    assert.equal(worklist.fieldPackages.fieldHandoff.openP0Devices, 1);
    assert.equal(worklist.fieldPackages.fieldHandoff.staleSignoffRows, 1);
    assert.match(worklist.fieldPackages.fieldHandoff.nextAllowedStep, /current-only/);
    assert.equal(worklist.fieldPackages.fieldHandoff.devices[0].deviceCode, "BGS01");
    assert.match(worklist.fieldPackages.fieldHandoff.currentOnlyCsv, /current\.csv/);
    assert.equal(worklist.fieldPackages.fieldReturnTemplate.deviceCount, 1);
    assert.equal(worklist.fieldPackages.fieldReturnTemplate.communicationBlocked, 1);
    assert.equal(worklist.fieldPackages.fieldReturnTemplate.draftSuggestibleDevices, 1);
    assert.equal(worklist.fieldPackages.fieldReturnTemplate.draftTemperatureSuggestions, 1);
    assert.equal(worklist.fieldPackages.fieldReturnTemplate.draftSetpointSuggestions, 1);
    assert.match(worklist.fieldPackages.fieldReturnTemplate.csv, /field-return-template\.csv$/);
    assert.equal(worklist.fieldPackages.fieldReturnTemplate.devices[0].deviceCode, "BGS01");
    assert.equal(worklist.fieldPackages.fieldReturnTemplate.devices[0].reviewDraft.releaseDecisionDefault, "recheck");
    assert.equal(worklist.fieldPackages.fieldReturnTemplate.devices[0].reviewDraft.suggestedValues.zoneTemperatureAfterC, "26");
    assert.deepEqual(worklist.fieldPackages.fieldReturnTemplate.devices[0].reviewDraft.blockedAutoFillFields, ["communicationAlarmAfter"]);
    assert.equal(worklist.fieldRemediationPlaybook.deviceCount, 1);
    assert.equal(worklist.fieldRemediationPlaybook.canaryBlockedByField, true);
    assert.deepEqual(worklist.fieldRemediationPlaybook.reasonGroups[0], {
      reason: "communication_alarm",
      devices: ["BGS01"]
    });
    assert.equal(worklist.fieldRemediationPlaybook.devices[0].fieldPriority[0], "通讯恢复");
    const signoffInputAction = worklist.actions.find((item) => item.key === "promote-current-signoff-input");
    assert.ok(signoffInputAction, "missing signoff input promote action");
    assert.equal(signoffInputAction.priority, "P0");
    assert.equal(signoffInputAction.phase, "signoff_input");
    assert.match(signoffInputAction.command, /FCU_SIGNOFF_INPUT_PROMOTE_CONFIRM=I_APPROVE_REPLACE_FCU_SIGNOFF_INPUT/);
    assert.equal(worklist.phases.find((item) => item.key === "signoff_input")?.status, "blocked");
    const fieldSignoffAction = worklist.actions.find((item) => item.key === "complete-field-remediation-signoff");
    assert.ok(fieldSignoffAction, "missing field signoff completion action");
    assert.equal(fieldSignoffAction.priority, "P0");
    assert.equal(fieldSignoffAction.phase, "field_signoff");
    assert.match(fieldSignoffAction.acceptance, /summary\.signoffComplete=true/);
    assert.equal(worklist.phases.find((item) => item.key === "field_signoff")?.status, "blocked");
    assert.match(fs.readFileSync(files.outputMd, "utf8"), /确认并写入 3002 FCU 现场授权/);
    assert.match(fs.readFileSync(files.outputMd, "utf8"), /现场授权准备/);
    assert.match(fs.readFileSync(files.outputMd, "utf8"), /逐台放行矩阵 CSV/);
    assert.match(fs.readFileSync(files.outputMd, "utf8"), /现场交接包/);
    assert.match(fs.readFileSync(files.outputMd, "utf8"), /现场回填模板/);
    assert.match(fs.readFileSync(files.outputMd, "utf8"), /现场放行预检/);
    assert.match(fs.readFileSync(files.outputMd, "utf8"), /现场消缺作战表/);
    assert.match(fs.readFileSync(files.outputMd, "utf8"), /先清理过期签核行/);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("final control worklist refuses stale site authorization window command", async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "fcu-final-worklist-stale-auth-"));
  try {
    const files = {
      preflight: path.join(tempDir, "preflight.json"),
      fieldArm: path.join(tempDir, "field-arm.json"),
      finalCompletion: path.join(tempDir, "final-completion.json"),
      quality: path.join(tempDir, "quality.json"),
      canaryPackage: path.join(tempDir, "canary-package.json"),
      canaryReadiness: path.join(tempDir, "canary-readiness.json"),
      adapterReadiness: path.join(tempDir, "adapter-readiness.json"),
      canaryFeedback: path.join(tempDir, "canary-feedback.json"),
      canaryWindow: path.join(tempDir, "canary-window.json"),
      siteAuthorization: path.join(tempDir, "site-authorization.json"),
      allPlan: path.join(tempDir, "all-plan.json"),
      fieldSignoffInput: path.join(tempDir, "field-signoff-input.csv"),
      fieldSignoff: path.join(tempDir, "field-signoff.json"),
      fieldSignoffClean: path.join(tempDir, "field-signoff-clean.json"),
      fieldSignoffPromote: path.join(tempDir, "field-signoff-promote.json"),
      fieldReturnTemplate: path.join(tempDir, "field-return-template.json"),
      rollout: path.join(tempDir, "rollout.json"),
      outputJson: path.join(tempDir, "worklist.json"),
      outputMd: path.join(tempDir, "worklist.md")
    };

    writeJson(files.preflight, { ok: false, verdict: "go_live_blocked" });
    writeJson(files.fieldArm, {
      ok: false,
      verdict: "field_arm_blocked",
      firstCanary: "BGS01",
      blockingItems: [
        {
          key: "execution_gate_open",
          message: "site_authorization_approved / site_authorization_window_active"
        }
      ]
    });
    writeJson(files.finalCompletion, {
      ok: false,
      firstCanary: "BGS01",
      milestones: {
        canary: { ok: false },
        smallBatch: { ok: false },
        allDevice: { ok: false, targetDevices: 29, confirmedDevices: 0 }
      },
      blockingItems: []
    });
    writeJson(files.quality, { ok: true, summary: { p0Count: 0 }, devices: [] });
    writeJson(files.canaryPackage, { ok: false, verdict: "canary_package_ready_with_open_gates", canary: { deviceCode: "BGS01" } });
    writeJson(files.canaryReadiness, {
      ok: false,
      verdict: "canary_blocked",
      firstCanary: "BGS01",
      summary: { canaryReady: false, blockedCount: 2 }
    });
    writeJson(files.adapterReadiness, { ok: false, verdict: "ba_write_adapter_blocked", canary: { deviceCode: "BGS01" } });
    writeJson(files.canaryFeedback, { ok: false, verdict: "waiting_for_canary_dispatch", canary: { deviceCode: "BGS01" } });
    writeJson(files.canaryWindow, { ok: false, verdict: "canary_window_blocked", canary: { deviceCode: "BGS01" } });
    writeJson(files.siteAuthorization, {
      ok: true,
      persisted: false,
      dryRun: true,
      controlMutation: false,
      confirmMatched: false,
      window: {
        active: true
      },
      after: {
        siteAuthorizationBy: "业主值班长",
        commissioningOwner: "平台工程师",
        baOwner: "BA工程师",
        siteAuthorizationWindowStart: "2020-01-01T01:00:00.000Z",
        siteAuthorizationWindowEnd: "2020-01-01T02:00:00.000Z",
        baWriteConfirmArmed: true,
        finalRolloutConfirmArmed: true
      }
    });
    writeJson(files.allPlan, { ok: true, summary: { total: 29, plannedDeviceCount: 21, blocked: 8 } });
    writeJson(files.fieldSignoff, {
      ok: true,
      summary: { signoffComplete: true, completeRows: 0, expectedWorkOrders: 0, stillRequiresRealtimeCloseout: true },
      outputs: {
        json: files.fieldSignoff,
        markdown: path.join(tempDir, "field-signoff.md"),
        csv: path.join(tempDir, "field-signoff.csv"),
        releaseMatrixCsv: path.join(tempDir, "field-signoff-release-matrix.csv")
      },
      records: [],
      releaseMatrix: []
    });
    writeJson(files.fieldSignoffClean, { ok: true, summary: { currentRows: 0, staleRows: 0, generatedMissingRows: 0 }, outputs: {} });
    writeJson(files.fieldSignoffPromote, { ok: true, mode: "dry_run", fileMutation: false, confirmMatched: false, summary: { currentRows: 0, staleRows: 0 }, target: {}, outputs: {} });
    writeJson(files.rollout, { ok: false, confirm: { finalRolloutConfirmPresent: false, smallBatchConfirmPresent: false } });

    const result = await runNodeScript(worklistScriptPath, {
      FCU_GO_LIVE_PREFLIGHT_JSON: files.preflight,
      FCU_FIELD_ARM_CHECK_JSON: files.fieldArm,
      FCU_FINAL_CONTROL_COMPLETION_JSON: files.finalCompletion,
      FCU_QUALITY_REMEDIATION_JSON: files.quality,
      FCU_CANARY_EXECUTION_PACKAGE_JSON: files.canaryPackage,
      FCU_CANARY_READINESS_JSON: files.canaryReadiness,
      FCU_FINAL_WORKLIST_REFRESH_CANARY_READINESS: "false",
      FCU_BA_WRITE_ADAPTER_READINESS_JSON: files.adapterReadiness,
      FCU_CANARY_FEEDBACK_MONITOR_JSON: files.canaryFeedback,
      FCU_CANARY_WINDOW_JSON: files.canaryWindow,
      FCU_SITE_AUTHORIZATION_JSON: files.siteAuthorization,
      FCU_ALL_DEVICE_DISPATCH_PLAN_JSON: files.allPlan,
      FCU_FIELD_REMEDIATION_SIGNOFF_INPUT_CSV: files.fieldSignoffInput,
      FCU_FIELD_REMEDIATION_SIGNOFF_JSON: files.fieldSignoff,
      FCU_FINAL_WORKLIST_REFRESH_SIGNOFF: "false",
      FCU_FIELD_REMEDIATION_SIGNOFF_CLEAN_JSON: files.fieldSignoffClean,
      FCU_FIELD_REMEDIATION_SIGNOFF_PROMOTE_JSON: files.fieldSignoffPromote,
      FCU_FINAL_WORKLIST_REFRESH_SIGNOFF_CLEAN: "false",
      FCU_FINAL_WORKLIST_REFRESH_SIGNOFF_PROMOTE: "false",
      FCU_FINAL_CONTROL_ROLLOUT_JSON: files.rollout,
      FCU_FINAL_CONTROL_WORKLIST_JSON: files.outputJson,
      FCU_FINAL_CONTROL_WORKLIST_MD: files.outputMd
    });

    assert.equal(result.status, 2, result.stdout || result.stderr);
    const worklist = JSON.parse(fs.readFileSync(files.outputJson, "utf8"));
    const action = worklist.actions.find((item) => item.key === "approve-site-authorization-in-3002");
    assert.ok(action, "missing site authorization action");
    assert.match(action.command, /npm --prefix apps\/chiller-bff run prepare:fcu-site-authorization/);
    assert.match(action.command, /--authorized-by=业主值班长/);
    assert.match(action.command, /--window-start=2020-01-01T01:00:00.000Z/);
    assert.doesNotMatch(action.command, /FCU_SITE_AUTHORIZATION_CONFIRM/);
    assert.equal(worklist.fieldPackages.siteAuthorization.windowActive, false);
    assert.equal(worklist.fieldPackages.siteAuthorization.windowStatus, "authorization_window_expired");
    assert.equal(worklist.qualityRefresh.skipped, true);
    assert.equal(worklist.allDevicePlanRefresh.skipped, true);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("final control worklist keeps P0 quality action when quality evidence is incomplete", async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "fcu-final-worklist-quality-incomplete-"));
  try {
    const files = {
      preflight: path.join(tempDir, "preflight.json"),
      fieldArm: path.join(tempDir, "field-arm.json"),
      finalCompletion: path.join(tempDir, "final-completion.json"),
      quality: path.join(tempDir, "quality.json"),
      canaryPackage: path.join(tempDir, "canary-package.json"),
      canaryReadiness: path.join(tempDir, "canary-readiness.json"),
      adapterReadiness: path.join(tempDir, "adapter-readiness.json"),
      canaryFeedback: path.join(tempDir, "canary-feedback.json"),
      canaryWindow: path.join(tempDir, "canary-window.json"),
      siteAuthorization: path.join(tempDir, "site-authorization.json"),
      allPlan: path.join(tempDir, "all-plan.json"),
      fieldSignoffInput: path.join(tempDir, "field-signoff-input.csv"),
      fieldSignoff: path.join(tempDir, "field-signoff.json"),
      fieldSignoffClean: path.join(tempDir, "field-signoff-clean.json"),
      fieldSignoffPromote: path.join(tempDir, "field-signoff-promote.json"),
      fieldReturnTemplate: path.join(tempDir, "field-return-template.json"),
      rollout: path.join(tempDir, "rollout.json"),
      outputJson: path.join(tempDir, "worklist.json"),
      outputMd: path.join(tempDir, "worklist.md")
    };

    writeJson(files.preflight, { ok: true, verdict: "go_live_ready" });
    writeJson(files.fieldArm, { ok: true, verdict: "field_arm_ready", firstCanary: "BGS01", blockingItems: [] });
    writeJson(files.finalCompletion, {
      ok: false,
      firstCanary: "BGS01",
      milestones: {
        canary: { ok: false, deviceCode: "BGS01" },
        smallBatch: { ok: false },
        allDevice: { ok: false, targetDevices: 29, confirmedDevices: 0 }
      },
      blockingItems: []
    });
    writeJson(files.quality, {
      ok: false,
      summary: {
        p0Count: 0,
        canCompleteFinalControl: false,
        evidenceIncomplete: true
      },
      devices: []
    });
    writeJson(files.canaryPackage, { ok: true, verdict: "canary_package_ready", canary: { deviceCode: "BGS01" } });
    writeJson(files.canaryReadiness, {
      ok: true,
      verdict: "canary_ready",
      firstCanary: "BGS01",
      summary: { canaryReady: true, blockedCount: 0 }
    });
    writeJson(files.adapterReadiness, { ok: true, verdict: "ba_write_adapter_ready", canary: { deviceCode: "BGS01" } });
    writeJson(files.canaryFeedback, { ok: false, verdict: "waiting_for_canary_dispatch", canary: { deviceCode: "BGS01" } });
    writeJson(files.canaryWindow, { ok: true, verdict: "canary_window_ready", canary: { deviceCode: "BGS01" } });
    writeJson(files.siteAuthorization, { ok: true, persisted: true, dryRun: false, controlMutation: false, window: { active: true } });
    writeJson(files.allPlan, { ok: true, summary: { total: 29, plannedDeviceCount: 20, blocked: 9 } });
    writeJson(files.fieldSignoff, {
      ok: true,
      summary: { signoffComplete: true, completeRows: 0, expectedWorkOrders: 0, stillRequiresRealtimeCloseout: true },
      outputs: {
        json: files.fieldSignoff,
        markdown: path.join(tempDir, "field-signoff.md"),
        csv: path.join(tempDir, "field-signoff.csv"),
        releaseMatrixCsv: path.join(tempDir, "field-signoff-release-matrix.csv")
      },
      records: [],
      releaseMatrix: []
    });
    writeJson(files.fieldSignoffClean, { ok: true, summary: { currentRows: 0, staleRows: 0, generatedMissingRows: 0 }, outputs: {} });
    writeJson(files.fieldSignoffPromote, { ok: true, mode: "dry_run", fileMutation: false, confirmMatched: false, summary: { currentRows: 0, staleRows: 0 }, target: {}, outputs: {} });
    writeJson(files.rollout, { ok: true, confirm: { finalRolloutConfirmPresent: true, smallBatchConfirmPresent: true } });

    const result = await runNodeScript(worklistScriptPath, {
      FCU_GO_LIVE_PREFLIGHT_JSON: files.preflight,
      FCU_FIELD_ARM_CHECK_JSON: files.fieldArm,
      FCU_FINAL_CONTROL_COMPLETION_JSON: files.finalCompletion,
      FCU_QUALITY_REMEDIATION_JSON: files.quality,
      FCU_CANARY_EXECUTION_PACKAGE_JSON: files.canaryPackage,
      FCU_CANARY_READINESS_JSON: files.canaryReadiness,
      FCU_FINAL_WORKLIST_REFRESH_CANARY_READINESS: "false",
      FCU_BA_WRITE_ADAPTER_READINESS_JSON: files.adapterReadiness,
      FCU_CANARY_FEEDBACK_MONITOR_JSON: files.canaryFeedback,
      FCU_CANARY_WINDOW_JSON: files.canaryWindow,
      FCU_SITE_AUTHORIZATION_JSON: files.siteAuthorization,
      FCU_ALL_DEVICE_DISPATCH_PLAN_JSON: files.allPlan,
      FCU_FIELD_REMEDIATION_SIGNOFF_INPUT_CSV: files.fieldSignoffInput,
      FCU_FIELD_REMEDIATION_SIGNOFF_JSON: files.fieldSignoff,
      FCU_FINAL_WORKLIST_REFRESH_SIGNOFF: "false",
      FCU_FIELD_REMEDIATION_SIGNOFF_CLEAN_JSON: files.fieldSignoffClean,
      FCU_FIELD_REMEDIATION_SIGNOFF_PROMOTE_JSON: files.fieldSignoffPromote,
      FCU_FINAL_WORKLIST_REFRESH_SIGNOFF_CLEAN: "false",
      FCU_FINAL_WORKLIST_REFRESH_SIGNOFF_PROMOTE: "false",
      FCU_FINAL_CONTROL_ROLLOUT_JSON: files.rollout,
      FCU_FINAL_CONTROL_WORKLIST_JSON: files.outputJson,
      FCU_FINAL_CONTROL_WORKLIST_MD: files.outputMd
    });

    assert.equal(result.status, 2, result.stdout || result.stderr);
    const worklist = JSON.parse(fs.readFileSync(files.outputJson, "utf8"));
    assert.equal(worklist.summary.qualityP0Devices, 9);
    assert.equal(worklist.phases.find((item) => item.key === "quality")?.status, "blocked");
    const qualityAction = worklist.actions.find((item) => item.key === "remediate-p0-quality-devices");
    assert.ok(qualityAction, "missing conservative quality remediation action");
    assert.equal(qualityAction.priority, "P0");
    assert.match(qualityAction.reason, /质量证据不完整/);
    assert.match(fs.readFileSync(files.outputMd, "utf8"), /整改通讯报警、0°C\/无效温度和写点缺失设备/);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("final control worklist suppresses stale environment actions when current gates are ready", async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "fcu-final-worklist-env-ready-"));
  try {
    const files = {
      preflight: path.join(tempDir, "preflight.json"),
      fieldArm: path.join(tempDir, "field-arm.json"),
      finalCompletion: path.join(tempDir, "final-completion.json"),
      quality: path.join(tempDir, "quality.json"),
      canaryPackage: path.join(tempDir, "canary-package.json"),
      canaryReadiness: path.join(tempDir, "canary-readiness.json"),
      adapterReadiness: path.join(tempDir, "adapter-readiness.json"),
      canaryFeedback: path.join(tempDir, "canary-feedback.json"),
      canaryWindow: path.join(tempDir, "canary-window.json"),
      siteAuthorization: path.join(tempDir, "site-authorization.json"),
      allPlan: path.join(tempDir, "all-plan.json"),
      fieldCloseout: path.join(tempDir, "field-closeout.json"),
      fieldWorkOrders: path.join(tempDir, "field-work-orders.json"),
      fieldSignoffInput: path.join(tempDir, "field-signoff-input.csv"),
      fieldSignoff: path.join(tempDir, "field-signoff.json"),
      fieldSignoffClean: path.join(tempDir, "field-signoff-clean.json"),
      fieldSignoffPromote: path.join(tempDir, "field-signoff-promote.json"),
      fieldReturnTemplate: path.join(tempDir, "field-return-template.json"),
      rollout: path.join(tempDir, "rollout.json"),
      outputJson: path.join(tempDir, "worklist.json"),
      outputMd: path.join(tempDir, "worklist.md")
    };

    writeJson(files.preflight, { ok: true, verdict: "go_live_ready" });
    writeJson(files.fieldArm, {
      ok: true,
      verdict: "field_arm_ready",
      firstCanary: "BGS01",
      blockingItems: []
    });
    writeJson(files.finalCompletion, {
      ok: false,
      firstCanary: "BGS01",
      milestones: {
        canary: { ok: false, deviceCode: "BGS01" },
        smallBatch: { ok: false, devices: 0 },
        allDevice: { ok: false, targetDevices: 2, confirmedDevices: 0 }
      },
      blockingItems: [{ key: "backend_write_gate" }]
    });
    writeJson(files.quality, {
      ok: true,
      summary: { p0Count: 0, canCompleteFinalControl: true },
      devices: []
    });
    writeJson(files.canaryPackage, {
      ok: true,
      verdict: "canary_ready_for_authorized_window",
      canary: { deviceCode: "BGS01" },
      blockers: []
    });
    writeJson(files.canaryReadiness, {
      ok: true,
      verdict: "canary_ready",
      firstCanary: "BGS01",
      summary: { canaryReady: true, blockedCount: 0 }
    });
    writeJson(files.adapterReadiness, {
      ok: true,
      verdict: "ba_write_adapter_ready",
      bffBaseUrl: "http://127.0.0.1:8877",
      evidence: { health: { readOnlyMode: false } },
      blockingItems: []
    });
    writeJson(files.canaryFeedback, { ok: false, verdict: "waiting_for_canary_dispatch", canary: { deviceCode: "BGS01" } });
    writeJson(files.canaryWindow, { ok: true, verdict: "canary_window_ready", canary: { deviceCode: "BGS01" } });
    writeJson(files.siteAuthorization, { ok: true, persisted: true });
    writeJson(files.allPlan, {
      ok: true,
      firstCanary: "BGS01",
      summary: { total: 2, plannedDeviceCount: 2, blocked: 0 }
    });
    writeJson(files.fieldCloseout, {
      ok: true,
      verdict: "field_remediation_ready_for_canary",
      summary: { readyForCanary: true, remainingDeviceCount: 0, qualityP0Count: 0, planBlockedCount: 0 }
    });
    writeJson(files.fieldWorkOrders, {
      ok: true,
      summary: { totalWorkOrders: 0, openCount: 0 },
      outputs: {}
    });
    fs.writeFileSync(files.fieldSignoffInput, "");
    writeJson(files.fieldSignoff, {
      ok: true,
      summary: { signoffComplete: true, expectedWorkOrders: 0, completeRows: 0 }
    });
    writeJson(files.fieldSignoffClean, {
      ok: true,
      summary: { staleRows: 0 }
    });
    writeJson(files.fieldSignoffPromote, {
      ok: true,
      summary: { staleRows: 0 },
      fileMutation: false,
      confirmMatched: false
    });
    writeJson(files.fieldReturnTemplate, {
      ok: true,
      summary: {
        deviceCount: 0,
        communicationBlocked: 0,
        temperatureBlocked: 0,
        setpointBlocked: 0,
        signoffCompleteRows: 0,
        signoffExpectedRows: 0
      },
      devices: [],
      outputs: {
        json: files.fieldReturnTemplate,
        markdown: files.fieldReturnTemplate.replace(/\.json$/, ".md"),
        csv: files.fieldReturnTemplate.replace(/\.json$/, ".csv")
      }
    });
    writeJson(files.rollout, {
      ok: false,
      confirm: {
        finalRolloutConfirmPresent: false,
        smallBatchConfirmPresent: false
      }
    });

    const result = await runNodeScript(worklistScriptPath, {
      FCU_GO_LIVE_PREFLIGHT_JSON: files.preflight,
      FCU_FIELD_ARM_CHECK_JSON: files.fieldArm,
      FCU_FINAL_CONTROL_COMPLETION_JSON: files.finalCompletion,
      FCU_QUALITY_REMEDIATION_JSON: files.quality,
      FCU_CANARY_EXECUTION_PACKAGE_JSON: files.canaryPackage,
      FCU_CANARY_READINESS_JSON: files.canaryReadiness,
      FCU_BA_WRITE_ADAPTER_READINESS_JSON: files.adapterReadiness,
      FCU_CANARY_FEEDBACK_MONITOR_JSON: files.canaryFeedback,
      FCU_CANARY_WINDOW_JSON: files.canaryWindow,
      FCU_ALL_DEVICE_DISPATCH_PLAN_JSON: files.allPlan,
      FCU_FIELD_REMEDIATION_CLOSEOUT_JSON: files.fieldCloseout,
      FCU_FIELD_REMEDIATION_WORK_ORDERS_JSON: files.fieldWorkOrders,
      FCU_FIELD_REMEDIATION_SIGNOFF_INPUT_CSV: files.fieldSignoffInput,
      FCU_FIELD_REMEDIATION_SIGNOFF_JSON: files.fieldSignoff,
      FCU_FIELD_REMEDIATION_SIGNOFF_CLEAN_JSON: files.fieldSignoffClean,
      FCU_FIELD_REMEDIATION_SIGNOFF_PROMOTE_JSON: files.fieldSignoffPromote,
      FCU_FIELD_REMEDIATION_RETURN_TEMPLATE_JSON: files.fieldReturnTemplate,
      FCU_FINAL_CONTROL_ROLLOUT_JSON: files.rollout,
      FCU_SITE_AUTHORIZATION_JSON: files.siteAuthorization,
      FCU_FINAL_CONTROL_WORKLIST_JSON: files.outputJson,
      FCU_FINAL_CONTROL_WORKLIST_MD: files.outputMd,
      FCU_FINAL_WORKLIST_REFRESH_QUALITY: "false",
      FCU_FINAL_WORKLIST_REFRESH_PLAN: "false",
      FCU_FINAL_WORKLIST_REFRESH_CLOSEOUT: "false",
      FCU_FINAL_WORKLIST_REFRESH_WORK_ORDERS: "false",
      FCU_FINAL_WORKLIST_REFRESH_SIGNOFF: "false",
      FCU_FINAL_WORKLIST_REFRESH_SIGNOFF_CLEAN: "false",
      FCU_FINAL_WORKLIST_REFRESH_SIGNOFF_PROMOTE: "false",
      FCU_FINAL_WORKLIST_REFRESH_CANARY_READINESS: "false",
      FCU_SMALL_BATCH_CONFIRM: "I_UNDERSTAND_REAL_BA_WRITE",
      FCU_FINAL_CONTROL_ROLLOUT_CONFIRM: "I_UNDERSTAND_REAL_BA_WRITE"
    });

    assert.equal(result.status, 2, result.stdout || result.stderr);
    const report = JSON.parse(fs.readFileSync(files.outputJson, "utf8"));
    const actionKeys = report.actions.map((item) => item.key);
    assert.ok(!actionKeys.includes("set-final-rollout-confirm"));
    assert.ok(!actionKeys.includes("set-ba-write-confirm"));
    assert.ok(!actionKeys.includes("open-backend-write-gate"));
    assert.ok(actionKeys.includes("execute-canary"));
    assert.equal(report.phases.find((item) => item.key === "authorization")?.status, "ready");
    assert.equal(report.phases.find((item) => item.key === "environment")?.status, "ready");
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
