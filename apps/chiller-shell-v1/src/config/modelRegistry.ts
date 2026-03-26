export type DeviceModelCategory = "chiller" | "pump" | "cooling-tower" | "valve";

export type DeviceModelDescriptor = {
  id: string;
  category: DeviceModelCategory;
  displayName: string;
  path: string;
  previewPath?: string;
  previewFormat?: "glb" | "fbx";
  sourceLabel: string;
  intakeStatus: "ready" | "planned";
};

const DEVICE_MODEL_REGISTRY: Record<DeviceModelCategory, DeviceModelDescriptor> = {
  chiller: {
    id: "chiller-main",
    category: "chiller",
    displayName: "冷机主设备",
    path: "/models/chiller/chiller-main-v1.glb",
    previewPath: "/models/chiller/source/FBX/LiXinZhuJi_V1.fbx",
    previewFormat: "fbx",
    sourceLabel: "CG模型网",
    intakeStatus: "ready"
  },
  pump: {
    id: "pump-horizontal",
    category: "pump",
    displayName: "卧式端吸离心泵",
    path: "/models/pump/pump-horizontal-v1.glb",
    sourceLabel: "CG模型网",
    intakeStatus: "ready"
  },
  "cooling-tower": {
    id: "cooling-tower",
    category: "cooling-tower",
    displayName: "冷却塔",
    path: "/models/cooling-tower/cooling-tower-v1.glb",
    sourceLabel: "CG模型网",
    intakeStatus: "ready"
  },
  valve: {
    id: "valve-check",
    category: "valve",
    displayName: "工业阀门",
    path: "/models/valve/valve-check-v1.glb",
    sourceLabel: "CG模型网",
    intakeStatus: "ready"
  }
};

export function resolveDeviceModel(systemTypeLabel: string | null | undefined): DeviceModelDescriptor | null {
  if (!systemTypeLabel) {
    return null;
  }
  if (systemTypeLabel === "冷机") {
    return DEVICE_MODEL_REGISTRY.chiller;
  }
  if (systemTypeLabel === "冷冻泵" || systemTypeLabel === "冷却泵") {
    return DEVICE_MODEL_REGISTRY.pump;
  }
  if (systemTypeLabel === "冷却塔") {
    return DEVICE_MODEL_REGISTRY["cooling-tower"];
  }
  if (systemTypeLabel.includes("阀")) {
    return DEVICE_MODEL_REGISTRY.valve;
  }
  return null;
}

export function getDeviceModelCatalog(): DeviceModelDescriptor[] {
  return Object.values(DEVICE_MODEL_REGISTRY);
}

export function getDeviceModelByCategory(category: DeviceModelCategory): DeviceModelDescriptor {
  return DEVICE_MODEL_REGISTRY[category];
}
