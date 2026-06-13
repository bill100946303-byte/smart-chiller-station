import { getCurrentLocale, type LocaleCode } from "../i18n/zhCN";

export type DeviceModelCategory = "chiller" | "pump" | "cooling-tower" | "valve";

export type DeviceModelRuntimeVariant = "idle" | "running" | "fault";

type DeviceModelRuntimePathMap = Partial<Record<DeviceModelRuntimeVariant, string>>;

export type DeviceModelDescriptor = {
  id: string;
  category: DeviceModelCategory;
  displayName: string;
  path: string;
  runtimePaths?: DeviceModelRuntimePathMap;
  previewPath?: string;
  previewFormat?: "glb" | "fbx";
  sourceLabel: string;
  intakeStatus: "ready" | "planned";
};

const DEVICE_MODEL_REGISTRY: Record<DeviceModelCategory, DeviceModelDescriptor> = {
  chiller: {
    id: "chiller-main",
    category: "chiller",
    displayName: "Chiller Unit",
    path: "/models/chiller/chiller-main-v1-idle.glb",
    runtimePaths: {
      idle: "/models/chiller/chiller-main-v1-idle.glb",
      running: "/models/chiller/chiller-main-v1-running.glb",
      fault: "/models/chiller/chiller-main-v1-fault.glb"
    },
    sourceLabel: "Local Model Library",
    intakeStatus: "ready"
  },
  pump: {
    id: "pump-horizontal",
    category: "pump",
    displayName: "Pump Unit",
    path: "/models/pump/pump-horizontal-v1-idle.glb",
    runtimePaths: {
      idle: "/models/pump/pump-horizontal-v1-idle.glb",
      running: "/models/pump/pump-horizontal-v1-running.glb",
      fault: "/models/pump/pump-horizontal-v1-fault.glb"
    },
    sourceLabel: "Local Model Library",
    intakeStatus: "ready"
  },
  "cooling-tower": {
    id: "cooling-tower",
    category: "cooling-tower",
    displayName: "Cooling Tower Unit",
    path: "/models/cooling-tower/cooling-tower-v1-idle.glb",
    runtimePaths: {
      idle: "/models/cooling-tower/cooling-tower-v1-idle.glb",
      running: "/models/cooling-tower/cooling-tower-v1-running.glb",
      fault: "/models/cooling-tower/cooling-tower-v1-fault.glb"
    },
    sourceLabel: "Local Model Library",
    intakeStatus: "ready"
  },
  valve: {
    id: "valve-check",
    category: "valve",
    displayName: "Valve Unit",
    path: "/models/valve/valve-check-v1.glb",
    sourceLabel: "Local Model Library",
    intakeStatus: "ready"
  }
};

const MODEL_DISPLAY_NAME_BY_LOCALE: Record<DeviceModelCategory, Record<LocaleCode, string>> = {
  chiller: {
    "zh-CN": "冷机",
    "en-US": "Chiller Unit",
    "vi-VN": "Cụm chiller"
  },
  pump: {
    "zh-CN": "水泵",
    "en-US": "Pump Unit",
    "vi-VN": "Cụm bơm"
  },
  "cooling-tower": {
    "zh-CN": "冷却塔",
    "en-US": "Cooling Tower Unit",
    "vi-VN": "Tháp giải nhiệt"
  },
  valve: {
    "zh-CN": "阀门",
    "en-US": "Valve Unit",
    "vi-VN": "Van"
  }
};

const MODEL_SOURCE_LABEL_BY_LOCALE: Record<LocaleCode, string> = {
  "zh-CN": "本地模型库",
  "en-US": "Local Model Library",
  "vi-VN": "Thư viện mô hình cục bộ"
};

function localizeDescriptor(descriptor: DeviceModelDescriptor): DeviceModelDescriptor {
  const locale = getCurrentLocale();
  return {
    ...descriptor,
    displayName: MODEL_DISPLAY_NAME_BY_LOCALE[descriptor.category][locale],
    sourceLabel: MODEL_SOURCE_LABEL_BY_LOCALE[locale]
  };
}

function normalizeText(value: string | null | undefined): string {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function containsAny(value: string, keywords: string[]): boolean {
  return keywords.some((keyword) => value.includes(keyword));
}

export function resolveDeviceModel(systemTypeLabel: string | null | undefined): DeviceModelDescriptor | null {
  const normalized = normalizeText(systemTypeLabel);
  if (!normalized) {
    return null;
  }

  if (
    containsAny(normalized, [
      "chiller",
      "coldwatermachine",
      "mainunit",
      "host",
      "\u51b7\u673a",
      "\u51b0\u673a",
      "\u4e3b\u673a",
      "\u51b7\u6c34\u673a"
    ])
  ) {
    return localizeDescriptor(DEVICE_MODEL_REGISTRY.chiller);
  }

  if (containsAny(normalized, ["coolingtower", "cooling-tower", "cooling tower", "\u51b7\u5374\u5854"])) {
    return localizeDescriptor(DEVICE_MODEL_REGISTRY["cooling-tower"]);
  }

  if (containsAny(normalized, ["chilledpump", "coolingpump", "pump", "\u51b7\u51bb\u6cf5", "\u51b7\u5374\u6cf5"])) {
    return localizeDescriptor(DEVICE_MODEL_REGISTRY.pump);
  }

  if (containsAny(normalized, ["valve"])) {
    return localizeDescriptor(DEVICE_MODEL_REGISTRY.valve);
  }

  return null;
}

export function resolveDeviceModelPathByRuntime(
  descriptor: DeviceModelDescriptor,
  runtimeVariant: DeviceModelRuntimeVariant | null | undefined
): string {
  const normalizedVariant = runtimeVariant || "idle";
  return descriptor.runtimePaths?.[normalizedVariant] || descriptor.path;
}

export function getDeviceModelCatalog(): DeviceModelDescriptor[] {
  return Object.values(DEVICE_MODEL_REGISTRY).map(localizeDescriptor);
}

export function getDeviceModelByCategory(category: DeviceModelCategory): DeviceModelDescriptor {
  return localizeDescriptor(DEVICE_MODEL_REGISTRY[category]);
}
