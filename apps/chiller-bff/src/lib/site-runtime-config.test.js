import test from "node:test";
import assert from "node:assert/strict";

import { resolveSiteRuntimeConfig } from "./site-runtime-config.js";

test("resolveSiteRuntimeConfig falls back to base config when no site override exists", () => {
  const baseConfig = {
    legacyBaseUrl: "http://127.0.0.1:8098",
    defaultSiteId: "site-a"
  };
  const adminStore = {
    getSiteSourceConfig() {
      return null;
    }
  };

  const result = resolveSiteRuntimeConfig(baseConfig, adminStore, "site-a");
  assert.equal(result.legacyBaseUrl, "http://127.0.0.1:8098");
});

test("resolveSiteRuntimeConfig prefers site-level legacy base url override", () => {
  const baseConfig = {
    legacyBaseUrl: "http://127.0.0.1:8098",
    defaultSiteId: "site-a"
  };
  const adminStore = {
    getSiteSourceConfig(siteId) {
      if (siteId === "site-a") {
        return {
          legacyBaseUrl: "https://legacy.example.com/station-a/"
        };
      }
      return null;
    }
  };

  const result = resolveSiteRuntimeConfig(baseConfig, adminStore, "site-a");
  assert.equal(result.legacyBaseUrl, "https://legacy.example.com/station-a");
});

test("resolveSiteRuntimeConfig exposes builtin source mapping when site needs a legacy project key", () => {
  const baseConfig = {
    legacyBaseUrl: "https://www.ssge.com.cn:8098",
    defaultSiteId: "126lnoffice"
  };
  const adminStore = {
    getSiteSourceConfig() {
      return null;
    }
  };

  const result = resolveSiteRuntimeConfig(baseConfig, adminStore, "btwentyfive");
  assert.equal(result.legacyBaseUrl, "https://www.ssge.com.cn:8098");
  assert.equal(result.legacyAppId, "140");
  assert.equal(result.siteSourceConfig?.legacyAppId, "140");
  assert.equal(result.siteSourceConfig?.databaseKey, "140btwentyfive");
  assert.equal(result.siteSourceConfig?.modelKey, "126lnoffice");
  assert.equal(result.siteSourceConfig?.preferredProjectKey, "126lnoffice");
  assert.equal(result.siteSourceConfig?.template, "1");
  assert.equal(result.siteSourceConfig?.ratedCoolingCapacityKw, 25322.4);
  assert.equal(result.ratedCoolingCapacityKw, 25322.4);
});

test("resolveSiteRuntimeConfig exposes builtin source mapping for numeric B25 site id", () => {
  const baseConfig = {
    legacyBaseUrl: "https://www.ssge.com.cn:8098",
    defaultSiteId: "126lnoffice"
  };
  const adminStore = {
    getSiteSourceConfig() {
      return null;
    }
  };

  const result = resolveSiteRuntimeConfig(baseConfig, adminStore, "140");
  assert.equal(result.legacyBaseUrl, "https://www.ssge.com.cn:8098");
  assert.equal(result.legacyAppId, "140");
  assert.equal(result.siteSourceConfig?.legacyAppId, "140");
  assert.equal(result.siteSourceConfig?.databaseKey, "140btwentyfive");
  assert.equal(result.siteSourceConfig?.modelKey, "126lnoffice");
  assert.equal(result.siteSourceConfig?.preferredProjectKey, "126lnoffice");
  assert.equal(result.siteSourceConfig?.template, "1");
  assert.equal(result.siteSourceConfig?.ratedCoolingCapacityKw, 25322.4);
  assert.equal(result.ratedCoolingCapacityKw, 25322.4);
});

test("resolveSiteRuntimeConfig keeps builtin B25 project data access when admin source config is empty", () => {
  const baseConfig = {
    legacyBaseUrl: "http://127.0.0.1:8098",
    defaultSiteId: "126lnoffice"
  };
  const adminStore = {
    getSiteSourceConfig(siteId) {
      return {
        siteId,
        legacyBaseUrl: null,
        ipAddress: null,
        port: null,
        databaseKey: null,
        modelKey: null,
        preferredProjectKey: null,
        template: null,
        controlMode: null,
        status: null
      };
    }
  };

  const result = resolveSiteRuntimeConfig(baseConfig, adminStore, "140");

  assert.equal(result.legacyBaseUrl, "https://www.ssge.com.cn:8098");
  assert.equal(result.siteSourceConfig?.deviceDataProjectKey, "140btwentyfive");
  assert.equal(result.siteSourceConfig?.defaultDeviceQuery?.build, 1);
  assert.equal(result.siteSourceConfig?.defaultDeviceQuery?.floor, 0);
  assert.equal(result.siteSourceConfig?.deviceDataInterfaces?.[0]?.endpointKind, "legacy-reg-findAllByDrTypeId");
});

test("resolveSiteRuntimeConfig exposes B25 chiller staging inventory", () => {
  const baseConfig = {
    legacyBaseUrl: "https://www.ssge.com.cn:8098",
    defaultSiteId: "126lnoffice"
  };
  const adminStore = {
    getSiteSourceConfig() {
      return null;
    }
  };

  const result = resolveSiteRuntimeConfig(baseConfig, adminStore, "140");
  const chillers = result.chillerStaging?.chillers || [];
  const ch5 = chillers.find((item) => item.id === "CH5");
  const ch6 = chillers.find((item) => item.id === "CH6");
  const ch7 = chillers.find((item) => item.id === "CH7");

  assert.equal(chillers.length, 7);
  assert.equal(ch5?.ratedCapacityRt, 1300);
  assert.equal(ch5?.ratedCapacityKw, 4571.9);
  assert.equal(ch6?.available, false);
  assert.equal(ch6?.lockedByOperator, true);
  assert.equal(ch7?.ratedCapacityRt, 1500);
  assert.equal(ch7?.ratedCapacityKw, 5275.3);
  assert.equal(ch7?.maxPracticalCapacityRt, 1700);
  assert.equal(ch7?.maxPracticalCapacityKw, 5978.6);
  assert.deepEqual(result.chillerStaging?.candidateCombinations?.[0], ["CH4", "CH5", "CH7"]);
  assert.deepEqual(result.chillerStaging?.unavailableChillerIds, ["CH6"]);
  assert.equal(result.siteSourceConfig?.chillerStaging?.chillers?.length, 7);
});

test("resolveSiteRuntimeConfig exposes B25 operational diagnostics point dictionary", () => {
  const baseConfig = {
    legacyBaseUrl: "https://www.ssge.com.cn:8098",
    defaultSiteId: "126lnoffice"
  };
  const adminStore = {
    getSiteSourceConfig() {
      return null;
    }
  };

  const result = resolveSiteRuntimeConfig(baseConfig, adminStore, "140");
  const dictionary = result.siteSourceConfig?.operationalDiagnosticsPointDictionary;

  assert.equal(dictionary?.source, "builtin_site_140_b25_operational_diagnostics_dictionary");
  assert.deepEqual(dictionary?.deviceSelectors?.chilledPumps?.codePatterns, ["^CHP\\d+$"]);
  assert.deepEqual(dictionary?.deviceSelectors?.coolingPumps?.codePatterns, ["^CWP\\d+$"]);
  assert.deepEqual(dictionary?.deviceSelectors?.coolingTowers?.codePatterns, ["^CT\\d+$"]);
  assert.ok(dictionary?.branchLabels?.allowedNamePatterns?.includes("支路\\s*\\d+"));
  assert.ok(dictionary?.coolingTowerCellLabels?.excludePatterns?.includes("阀|阀门|开到位|关到位"));
});

test("resolveSiteRuntimeConfig exposes B25 tower and pump shadow mapping baseline", () => {
  const baseConfig = {
    legacyBaseUrl: "https://www.ssge.com.cn:8098",
    defaultSiteId: "126lnoffice"
  };
  const adminStore = {
    getSiteSourceConfig() {
      return null;
    }
  };

  const result = resolveSiteRuntimeConfig(baseConfig, adminStore, "140");

  assert.equal(result.towerApproach?.source, "builtin_site_140_b25_tower_approach_shadow_mapping");
  assert.equal(result.towerApproach?.minCondenserInletTempC, 30);
  assert.equal(result.towerApproach?.dispatch?.mode, "shadow");
  assert.equal(result.towerApproach?.controlTargets?.approve?.commands?.[0]?.deviceName, "冷却回水手动值");
  assert.equal(result.towerApproach?.controlTargets?.approve?.commands?.[0]?.tagName, "SY-1-509-41413");
  assert.equal(result.towerApproach?.controlTargets?.rollback?.commands?.[0]?.valueSource, "rollbackTarget.targetTcwsC");

  assert.equal(result.pumpDeltaT?.source, "builtin_site_140_b25_pump_delta_t_shadow_mapping");
  assert.equal(result.pumpDeltaT?.dispatchMode, "shadow");
  assert.equal(result.pumpDeltaT?.dispatch?.mode, "shadow");
  assert.equal(result.pumpDeltaT?.controlTargets?.approve?.commands?.[0]?.chwpTagName, "B25_AI_ChwpFreqTrim_Hz");
  assert.equal(result.pumpDeltaT?.controlTargets?.approve?.commands?.[1]?.cwpTagName, "B25_AI_CwpFreqTrim_Hz");
  assert.equal(
    result.pumpDeltaT?.controlTargets?.rollback?.commands?.[0]?.valueSource,
    "rollbackTarget.targetChwpFreqTrimHz"
  );
  assert.equal(result.pumpDeltaT?.safetyInputs?.plcPumpTrimProtected, "TODO");
  assert.equal(result.pumpDeltaT?.safetyInputs?.pumpFrequencyFeedbackReady, "TODO");
  assert.equal(result.siteSourceConfig?.towerApproach?.source, "builtin_site_140_b25_tower_approach_shadow_mapping");
  assert.equal(result.siteSourceConfig?.pumpDeltaT?.source, "builtin_site_140_b25_pump_delta_t_shadow_mapping");
});

test("resolveSiteRuntimeConfig does not let runtime tower minimum weaken B25 condenser guardrail", () => {
  const baseConfig = {
    legacyBaseUrl: "https://www.ssge.com.cn:8098",
    defaultSiteId: "126lnoffice"
  };
  const adminStore = {
    getSiteSourceConfig() {
      return null;
    },
    getSiteRuntimeConfig(siteId) {
      if (siteId !== "140") {
        return null;
      }
      return {
        siteId,
        ruleThresholds: {
          towerApproach: {
            minCondenserInletTempC: 15,
            minCondenserInletTempCByChiller: {
              CH7: 28,
              CH5: 31
            }
          }
        },
        featureFlags: {},
        version: 6,
        createdAt: "2026-06-12T00:00:00.000Z",
        updatedAt: "2026-06-12T00:10:00.000Z"
      };
    }
  };

  const result = resolveSiteRuntimeConfig(baseConfig, adminStore, "140");

  assert.equal(result.towerApproach?.minCondenserInletTempC, 30);
  assert.equal(result.towerApproach?.minCondenserInletTempCByChiller?.CH7, 30);
  assert.equal(result.towerApproach?.minCondenserInletTempCByChiller?.CH5, 31);
});

test("resolveSiteRuntimeConfig switches recognized project realtime traffic to cloud base url", () => {
  const baseConfig = {
    legacyBaseUrl: "http://127.0.0.1:8098",
    defaultSiteId: "126lnoffice"
  };
  const adminStore = {
    getSiteSourceConfig() {
      return null;
    }
  };

  const result = resolveSiteRuntimeConfig(baseConfig, adminStore, "140");
  assert.equal(result.legacyBaseUrl, "https://www.ssge.com.cn:8098");
  assert.equal(result.siteSourceConfig?.legacyBaseUrl, "https://www.ssge.com.cn:8098");
  assert.equal(result.siteSourceConfig?.deviceDataProjectKey, "140btwentyfive");
});

test("resolveSiteRuntimeConfig keeps explicit site legacy base url override over builtin realtime cloud base", () => {
  const baseConfig = {
    legacyBaseUrl: "http://127.0.0.1:8098",
    defaultSiteId: "126lnoffice"
  };
  const adminStore = {
    getSiteSourceConfig(siteId) {
      if (siteId === "140") {
        return {
          legacyBaseUrl: "https://legacy.example.com/custom",
          databaseKey: "140btwentyfive",
          modelKey: "126lnoffice",
          preferredProjectKey: "126lnoffice"
        };
      }
      return null;
    }
  };

  const result = resolveSiteRuntimeConfig(baseConfig, adminStore, "140");
  assert.equal(result.legacyBaseUrl, "https://legacy.example.com/custom");
  assert.equal(result.siteSourceConfig?.legacyBaseUrl, "https://legacy.example.com/custom");
});

test("resolveSiteRuntimeConfig merges tower approach thresholds from site runtime config", () => {
  const baseConfig = {
    legacyBaseUrl: "http://127.0.0.1:8098",
    defaultSiteId: "btwentyfive",
    towerApproach: {
      advisoryMode: "manual-only"
    }
  };
  const adminStore = {
    getSiteSourceConfig() {
      return null;
    },
    getSiteRuntimeConfig(siteId) {
      if (siteId !== "btwentyfive") {
        return null;
      }
      return {
        siteId,
        energyParams: {},
        ruleThresholds: {
          towerApproach: {
            minCondenserInletTempC: 30.2
          }
        },
        featureFlags: {},
        version: 2,
        createdAt: "2026-04-03T00:00:00.000Z",
        updatedAt: "2026-04-03T00:10:00.000Z"
      };
    }
  };

  const result = resolveSiteRuntimeConfig(baseConfig, adminStore, "btwentyfive");
  assert.equal(result.towerApproach?.advisoryMode, "manual-only");
  assert.equal(result.towerApproach?.minCondenserInletTempC, 30.2);
  assert.equal(result.siteRuntimeAdminConfig?.version, 2);
  assert.equal(result.siteRuntimeAdminConfig?.ruleThresholds?.towerApproach?.minCondenserInletTempC, 30.2);
  assert.equal(result.siteSourceConfig?.legacyAppId, "140");
});

test("resolveSiteRuntimeConfig merges tower approach selectors from base config and site runtime config", () => {
  const baseConfig = {
    legacyBaseUrl: "http://127.0.0.1:8098",
    defaultSiteId: "btwentyfive",
    towerApproach: {
      advisoryMode: "manual-only",
      minCondenserInletTempCByModel: {
        "YK-01": 29.6
      },
      activeChillerModels: ["YK-01"]
    }
  };
  const adminStore = {
    getSiteSourceConfig() {
      return null;
    },
    getSiteRuntimeConfig(siteId) {
      if (siteId !== "btwentyfive") {
        return null;
      }
      return {
        siteId,
        energyParams: {},
        ruleThresholds: {
          towerApproach: {
            minCondenserInletTempC: 30.2,
            minCondenserInletTempCByModel: {
              "YK-02": 30.4
            },
            minCondenserInletTempCByChiller: {
              "ch-01": 30.6
            },
            activeChillerIds: ["ch-01", "ch-02"]
          }
        },
        featureFlags: {},
        version: 3,
        createdAt: "2026-04-03T00:00:00.000Z",
        updatedAt: "2026-04-03T00:10:00.000Z"
      };
    }
  };

  const result = resolveSiteRuntimeConfig(baseConfig, adminStore, "btwentyfive");
  assert.equal(result.towerApproach?.advisoryMode, "manual-only");
  assert.equal(result.towerApproach?.minCondenserInletTempC, 30.2);
  assert.deepEqual(result.towerApproach?.minCondenserInletTempCByModel, {
    "YK-01": 29.6,
    "YK-02": 30.4
  });
  assert.deepEqual(result.towerApproach?.minCondenserInletTempCByChiller, {
    CH1: 30,
    CH2: 30,
    CH3: 30,
    CH4: 30,
    CH5: 30,
    CH7: 30,
    "ch-01": 30.6
  });
  assert.deepEqual(result.towerApproach?.activeChillerIds, ["ch-01", "ch-02"]);
  assert.deepEqual(result.towerApproach?.activeChillerModels, ["YK-01"]);
});

test("resolveSiteRuntimeConfig merges tower approach controlTargets from base config and site runtime config", () => {
  const baseConfig = {
    legacyBaseUrl: "http://127.0.0.1:8098",
    defaultSiteId: "btwentyfive",
    towerApproach: {
      advisoryMode: "manual-only",
      controlTargets: {
        approve: {
          endpoint: "/zsqy/qstag/{siteId}/doimplements",
          strategy: "device-reg-command"
        }
      }
    }
  };
  const adminStore = {
    getSiteSourceConfig() {
      return null;
    },
    getSiteRuntimeConfig(siteId) {
      if (siteId !== "btwentyfive") {
        return null;
      }
      return {
        siteId,
        energyParams: {},
        ruleThresholds: {
          towerApproach: {
            controlTargets: {
              approve: {
                endpoint: "/zsqy/qstag/{siteId}/doimplements",
                commandTemplate: "{deviceName}|{targetTcwsC}|{tagName}"
              },
              rollback: {
                endpoint: "/zsqy/qstag/{siteId}/doimplements",
                commandTemplate: "{deviceName}|{rollbackTarget.targetTcwsC}|{tagName}"
              }
            }
          }
        },
        featureFlags: {},
        version: 4,
        createdAt: "2026-04-09T00:00:00.000Z",
        updatedAt: "2026-04-09T00:10:00.000Z"
      };
    }
  };

  const result = resolveSiteRuntimeConfig(baseConfig, adminStore, "btwentyfive");
  assert.equal(result.towerApproach?.controlTargets?.approve?.strategy, "device-reg-command");
  assert.equal(
    result.towerApproach?.controlTargets?.approve?.commandTemplate,
    "{deviceName}|{targetTcwsC}|{tagName}"
  );
  assert.equal(
    result.towerApproach?.controlTargets?.rollback?.commandTemplate,
    "{deviceName}|{rollbackTarget.targetTcwsC}|{tagName}"
  );
});

test("resolveSiteRuntimeConfig merges pump delta-t dispatch and controlTargets from site runtime config", () => {
  const baseConfig = {
    legacyBaseUrl: "http://127.0.0.1:8098",
    defaultSiteId: "141",
    pumpDeltaT: {
      dispatchMode: "shadow",
      dispatch: {
        timeoutMs: 8000
      },
      controlTargets: {
        approve: {
          strategy: "json-command"
        }
      },
      safetyInputs: {
        terminalComplaintClear: "ready"
      }
    }
  };
  const adminStore = {
    getSiteSourceConfig() {
      return null;
    },
    getSiteRuntimeConfig(siteId) {
      if (siteId !== "141") {
        return null;
      }
      return {
        siteId,
        energyParams: {},
        ruleThresholds: {
          pumpDeltaT: {
            dispatchMode: "assisted",
            dispatch: {
              approveEndpoint: "/pump/trim/approve",
              rollbackEndpoint: "/pump/trim/rollback"
            },
            controlTargets: {
              approve: {
                commandTemplate: "{AI_ChwpFreqTrim_Hz}|{AI_CwpFreqTrim_Hz}",
                commands: [
                  {
                    chwpTagName: "AI_ChwpFreqTrim_Hz",
                    valueSource: "targetChwpFreqTrimHz",
                    valueTransform: "round1"
                  },
                  {
                    cwpTagName: "AI_CwpFreqTrim_Hz",
                    valueSource: "targetCwpFreqTrimHz",
                    valueTransform: "round1"
                  }
                ]
              },
              rollback: {
                endpoint: "/pump/trim/rollback",
                commands: [
                  {
                    chwpTagName: "AI_ChwpFreqTrim_Hz",
                    valueSource: "rollbackTarget.targetChwpFreqTrimHz",
                    valueTransform: "round1"
                  },
                  {
                    cwpTagName: "AI_CwpFreqTrim_Hz",
                    valueSource: "rollbackTarget.targetCwpFreqTrimHz",
                    valueTransform: "round1"
                  }
                ]
              }
            },
            safetyInputs: {
              plcPumpTrimProtected: "TODO"
            }
          }
        },
        featureFlags: {},
        version: 5,
        createdAt: "2026-06-10T00:00:00.000Z",
        updatedAt: "2026-06-10T00:10:00.000Z"
      };
    }
  };

  const result = resolveSiteRuntimeConfig(baseConfig, adminStore, "141");
  assert.equal(result.pumpDeltaT?.dispatchMode, "assisted");
  assert.equal(result.pumpDeltaT?.dispatch?.timeoutMs, 8000);
  assert.equal(result.pumpDeltaT?.dispatch?.approveEndpoint, "/pump/trim/approve");
  assert.equal(result.pumpDeltaT?.dispatch?.rollbackEndpoint, "/pump/trim/rollback");
  assert.equal(result.pumpDeltaT?.controlTargets?.approve?.strategy, "json-command");
  assert.equal(
    result.pumpDeltaT?.controlTargets?.approve?.commandTemplate,
    "{AI_ChwpFreqTrim_Hz}|{AI_CwpFreqTrim_Hz}"
  );
  assert.equal(
    result.pumpDeltaT?.controlTargets?.approve?.commands?.[0]?.chwpTagName,
    "AI_ChwpFreqTrim_Hz"
  );
  assert.equal(
    result.pumpDeltaT?.controlTargets?.approve?.commands?.[1]?.cwpTagName,
    "AI_CwpFreqTrim_Hz"
  );
  assert.equal(
    result.pumpDeltaT?.controlTargets?.rollback?.commands?.[0]?.valueSource,
    "rollbackTarget.targetChwpFreqTrimHz"
  );
  assert.equal(result.pumpDeltaT?.safetyInputs?.terminalComplaintClear, "ready");
  assert.equal(result.pumpDeltaT?.safetyInputs?.plcPumpTrimProtected, "TODO");
  assert.equal(result.siteRuntimeAdminConfig?.ruleThresholds?.pumpDeltaT?.dispatchMode, "assisted");
});

test("resolveSiteRuntimeConfig exposes builtin project data interfaces for office project", () => {
  const baseConfig = {
    legacyBaseUrl: "https://www.ssge.com.cn:8098",
    defaultSiteId: "126lnoffice"
  };
  const adminStore = {
    getSiteSourceConfig() {
      return null;
    }
  };

  const result = resolveSiteRuntimeConfig(baseConfig, adminStore, "126lnoffice");
  assert.equal(result.siteSourceConfig?.deviceDataProjectKey, "126lnoffice");
  assert.equal(result.siteSourceConfig?.defaultDeviceQuery?.build, 1);
  assert.equal(result.siteSourceConfig?.defaultDeviceQuery?.floor, 1);
  assert.equal(result.siteSourceConfig?.defaultDeviceQuery?.mock, true);
  assert.ok(Array.isArray(result.siteSourceConfig?.deviceDataInterfaces));
  assert.equal(result.siteSourceConfig?.deviceDataInterfaces?.length, 2);
  assert.equal(
    result.siteSourceConfig?.deviceDataInterfaces?.[0]?.endpoint,
    "/api/device/126lnoffice/data?mock=1&build=1&floor=1"
  );
});

test("resolveSiteRuntimeConfig prefers databaseKey for builtin project data interfaces", () => {
  const baseConfig = {
    legacyBaseUrl: "https://www.ssge.com.cn:8098",
    defaultSiteId: "btwentyfive"
  };
  const adminStore = {
    getSiteSourceConfig() {
      return null;
    }
  };

  const result = resolveSiteRuntimeConfig(baseConfig, adminStore, "btwentyfive");
  assert.equal(result.siteSourceConfig?.deviceDataProjectKey, "140btwentyfive");
  assert.equal(result.siteSourceConfig?.defaultDeviceQuery?.build, 1);
  assert.equal(result.siteSourceConfig?.defaultDeviceQuery?.floor, 0);
  assert.equal(result.siteSourceConfig?.defaultDeviceQuery?.mock, false);
  assert.equal(
    result.siteSourceConfig?.deviceDataInterfaces?.[0]?.endpoint,
    "/zsqy/reg/140btwentyfive/findAllByDrTypeId?build=1&floor=0"
  );
});
