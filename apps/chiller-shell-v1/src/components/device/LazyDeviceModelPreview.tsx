import { Suspense, lazy } from "react";
import type { DeviceModelCategory, DeviceModelRuntimeVariant } from "../../config/modelRegistry";
import { zhCN } from "../../i18n/zhCN";

const DeviceModelPreview = lazy(() => import("./DeviceModelPreview"));

type LazyDeviceModelPreviewProps = {
  deviceName: string;
  systemType: string;
  systemTypeRaw?: string | null;
  runtimeStatusText?: string | null;
  alarmStatusText?: string | null;
  realtimePowerKw?: number | null;
  forcedCategory?: DeviceModelCategory | null;
  forcedRuntimeVariant?: DeviceModelRuntimeVariant | null;
};

function DeviceModelPreviewLoadingState({
  deviceName,
  systemType
}: Pick<LazyDeviceModelPreviewProps, "deviceName" | "systemType">) {
  return (
    <div className="device-model-card">
      <div className="device-model-header">
        <div>
          <span>{zhCN.devicePage.detailModel}</span>
          <strong>{deviceName || systemType}</strong>
        </div>
        <small>{zhCN.common.routeLoading}</small>
      </div>
      <div className="device-model-placeholder">
        <strong>{zhCN.common.routeLoading}</strong>
        <p>{zhCN.devicePage.modelLoading}</p>
      </div>
    </div>
  );
}

export default function LazyDeviceModelPreview({
  deviceName,
  systemType,
  systemTypeRaw = null,
  runtimeStatusText = null,
  alarmStatusText = null,
  realtimePowerKw = null,
  forcedCategory = null,
  forcedRuntimeVariant = null
}: LazyDeviceModelPreviewProps) {
  return (
    <Suspense fallback={<DeviceModelPreviewLoadingState deviceName={deviceName} systemType={systemType} />}>
      <DeviceModelPreview
        deviceName={deviceName}
        systemType={systemType}
        systemTypeRaw={systemTypeRaw}
        runtimeStatusText={runtimeStatusText}
        alarmStatusText={alarmStatusText}
        realtimePowerKw={realtimePowerKw}
        forcedCategory={forcedCategory}
        forcedRuntimeVariant={forcedRuntimeVariant}
      />
    </Suspense>
  );
}
