import { useEffect, useMemo, useRef, useState } from "react";
import {
  AdditiveBlending,
  AmbientLight,
  Box3,
  CanvasTexture,
  CircleGeometry,
  Color,
  DirectionalLight,
  DoubleSide,
  Group,
  LoadingManager,
  Material,
  MathUtils,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  SRGBColorSpace,
  TorusGeometry,
  Vector3,
  WebGLRenderer,
  type Object3D
} from "three";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { TGALoader } from "three/examples/jsm/loaders/TGALoader.js";
import {
  getDeviceModelByCategory,
  resolveDeviceModel,
  type DeviceModelCategory,
  type DeviceModelRuntimeVariant
} from "../../config/modelRegistry";
import { zhCN } from "../../i18n/zhCN";

type DeviceModelPreviewProps = {
  deviceName: string;
  systemType: string;
  systemTypeRaw?: string | null;
  runtimeStatusText?: string | null;
  alarmStatusText?: string | null;
  realtimePowerKw?: number | null;
  forcedCategory?: DeviceModelCategory | null;
  forcedRuntimeVariant?: DeviceModelRuntimeVariant | null;
};

type ModelState = "checking" | "ready" | "missing" | "unsupported";
type PreviewFormat = "glb" | "fbx" | null;

type RuntimeHud = {
  meshes: Array<Mesh>;
  update: (time: number) => void;
  dispose: () => void;
};

type SciFiFx = {
  meshes: Array<Mesh>;
  update: (time: number) => void;
  dispose: () => void;
};

type EmissiveMaterialHandle = {
  material: Material & {
    emissive: Color;
    emissiveIntensity: number;
  };
  baseIntensity: number;
  pulseAmplitude: number;
  pulseSpeed: number;
};

const HUD_NUMBER_FORMATTERS = new Map<number, Intl.NumberFormat>();

function formatHudNumber(value: number, digits: number): string {
  const normalizedDigits = Math.max(0, Math.min(3, digits));
  let formatter = HUD_NUMBER_FORMATTERS.get(normalizedDigits);
  if (!formatter) {
    formatter = new Intl.NumberFormat("zh-CN", {
      minimumFractionDigits: normalizedDigits,
      maximumFractionDigits: normalizedDigits
    });
    HUD_NUMBER_FORMATTERS.set(normalizedDigits, formatter);
  }
  return formatter.format(value);
}

function normalizeStatusText(value: string | null | undefined): string {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function hasAnyToken(value: string, tokens: string[]): boolean {
  return tokens.some((token) => value.includes(token));
}

function resolveDeviceRuntimeVariant(
  runtimeStatusText: string | null | undefined,
  alarmStatusText: string | null | undefined
): DeviceModelRuntimeVariant {
  const runtime = normalizeStatusText(runtimeStatusText);
  const alarm = normalizeStatusText(alarmStatusText);
  const joint = `${runtime} ${alarm}`.trim();

  if (
    hasAnyToken(joint, [
      "fault",
      "error",
      "alarm",
      "alert",
      "abnormal",
      "trip",
      "failed",
      "failure",
      "\u6545\u969c",
      "\u544a\u8b66",
      "\u62a5\u8b66",
      "\u5f02\u5e38",
      "\u8df3\u95f8",
      "\u5f85\u6062\u590d"
    ])
  ) {
    return "fault";
  }

  if (
    hasAnyToken(runtime, [
      "running",
      "run",
      "online",
      "active",
      "open",
      "on",
      "start",
      "\u5f00\u542f",
      "\u8fd0\u884c",
      "\u5728\u7ebf",
      "\u5f00\u673a",
      "\u542f\u52a8"
    ])
  ) {
    return "running";
  }

  return "idle";
}

function inferFormatByPath(path: string): PreviewFormat {
  const normalized = path.toLowerCase();
  if (normalized.endsWith(".fbx")) {
    return "fbx";
  }
  if (normalized.endsWith(".glb") || normalized.endsWith(".gltf")) {
    return "glb";
  }
  return "glb";
}

function getVariantAccent(variant: DeviceModelRuntimeVariant): { accent: number; glow: number } {
  // Photo-aligned host palette: dark metal body + blue running + red fault.
  if (variant === "fault") {
    return { accent: 0x6b232d, glow: 0xff6d7a };
  }
  if (variant === "running") {
    return { accent: 0x234f7f, glow: 0x4bb8ff };
  }
  return { accent: 0x2f3744, glow: 0x6b7b8f };
}

function getVariantMetalTint(variant: DeviceModelRuntimeVariant): Color {
  if (variant === "fault") {
    return new Color(0x343742);
  }
  if (variant === "running") {
    return new Color(0x313b4a);
  }
  return new Color(0x2b3340);
}

function rgbaFromHex(hex: number, alpha: number): string {
  const color = new Color(hex);
  const r = Math.round(color.r * 255);
  const g = Math.round(color.g * 255);
  const b = Math.round(color.b * 255);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function createMetalSheenTexture(variant: DeviceModelRuntimeVariant): CanvasTexture {
  const palette = getVariantAccent(variant);
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    const fallback = new CanvasTexture(canvas);
    fallback.colorSpace = SRGBColorSpace;
    return fallback;
  }

  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);

  const base = ctx.createLinearGradient(0, 0, 0, h);
  base.addColorStop(0, rgbaFromHex(0x8c97a5, 0.2));
  base.addColorStop(0.45, rgbaFromHex(0x2f353d, 0.5));
  base.addColorStop(1, rgbaFromHex(0x171b20, 0.72));
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, w, h);

  const streak = ctx.createLinearGradient(0, 0, w, 0);
  streak.addColorStop(0, rgbaFromHex(0x8a93a0, 0));
  streak.addColorStop(0.2, rgbaFromHex(palette.glow, 0.1));
  streak.addColorStop(0.5, rgbaFromHex(0x98a1ad, 0.44));
  streak.addColorStop(0.8, rgbaFromHex(palette.glow, 0.1));
  streak.addColorStop(1, rgbaFromHex(0x8a93a0, 0));
  ctx.fillStyle = streak;
  ctx.fillRect(0, 0, w, h);

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function createSciFiFx(
  container: Group,
  fittedSize: Vector3,
  variant: DeviceModelRuntimeVariant,
  modelCategory?: DeviceModelCategory
): SciFiFx {
  const palette = getVariantAccent(variant);
  const isPump = modelCategory === "pump";
  const radius = Math.max(0.48, Math.max(fittedSize.x, fittedSize.z) * 0.56);
  const baseY = -fittedSize.y * 0.47;
  const scanHeight = Math.max(0.8, fittedSize.y * 0.86);
  const sheenTexture = createMetalSheenTexture(variant);

  const ring = new Mesh(
    new TorusGeometry(radius, Math.max(0.02, radius * 0.05), 24, 120),
    new MeshBasicMaterial({
      color: palette.accent,
      transparent: true,
      opacity: 0.7,
      depthWrite: false,
      blending: AdditiveBlending
    })
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.set(0, baseY, 0);

  const halo = new Mesh(
    new CircleGeometry(radius * 1.14, 72),
    new MeshBasicMaterial({
      color: palette.glow,
      transparent: true,
      opacity: 0.16,
      side: DoubleSide,
      depthWrite: false,
      blending: AdditiveBlending
    })
  );
  halo.rotation.x = -Math.PI / 2;
  halo.position.set(0, baseY + 0.003, 0);

  const scanBand = new Mesh(
    new PlaneGeometry(radius * 1.72, Math.max(0.4, fittedSize.y * 0.2)),
    new MeshBasicMaterial({
      color: palette.glow,
      transparent: true,
      opacity: isPump ? 0 : variant === "fault" ? 0.2 : 0.14,
      side: DoubleSide,
      depthWrite: false,
      blending: AdditiveBlending
    })
  );
  scanBand.position.set(0, -scanHeight * 0.34, fittedSize.z * 0.1);

  const sheenWidth = Math.max(0.9, fittedSize.x * 0.92);
  const sheenHeight = Math.max(0.95, fittedSize.y * 1.02);
  const sheenA = new Mesh(
    new PlaneGeometry(sheenWidth, sheenHeight),
    new MeshBasicMaterial({
      map: sheenTexture,
      color: 0x8f99a6,
      transparent: true,
      opacity: variant === "fault" ? 0.24 : 0.19,
      side: DoubleSide,
      depthWrite: false,
      blending: AdditiveBlending
    })
  );
  sheenA.position.set(0, -fittedSize.y * 0.02, 0);
  sheenA.rotation.y = 0.62;

  const sheenB = new Mesh(
    new PlaneGeometry(sheenWidth * 0.9, sheenHeight * 0.92),
    new MeshBasicMaterial({
      map: sheenTexture,
      color: 0x7b8796,
      transparent: true,
      opacity: variant === "fault" ? 0.2 : 0.16,
      side: DoubleSide,
      depthWrite: false,
      blending: AdditiveBlending
    })
  );
  sheenB.position.set(0, -fittedSize.y * 0.015, 0);
  sheenB.rotation.y = -0.66;

  container.add(halo);
  container.add(ring);
  if (!isPump) {
    container.add(scanBand);
  }
  container.add(sheenA);
  container.add(sheenB);

  const ringMaterial = ring.material as MeshBasicMaterial;
  const haloMaterial = halo.material as MeshBasicMaterial;
  const scanMaterial = scanBand.material as MeshBasicMaterial;
  const sheenAMaterial = sheenA.material as MeshBasicMaterial;
  const sheenBMaterial = sheenB.material as MeshBasicMaterial;

  const update = (time: number) => {
    const pulse = 0.55 + Math.sin(time * 2.8) * 0.3;
    const glossPulse = 0.5 + Math.sin(time * 1.9 + 0.8) * 0.5;
    ring.rotation.z += variant === "fault" ? -0.01 : 0.008;
    ringMaterial.opacity = 0.4 + pulse * 0.55;
    haloMaterial.opacity = 0.08 + pulse * 0.14;
    scanMaterial.opacity = isPump
      ? 0
      : (variant === "fault" ? 0.12 : 0.08) + pulse * (variant === "fault" ? 0.14 : 0.1);
    sheenA.rotation.y = 0.62 + Math.sin(time * 0.55) * 0.05;
    sheenB.rotation.y = -0.66 - Math.sin(time * 0.5 + 1.4) * 0.05;
    sheenAMaterial.opacity = (variant === "fault" ? 0.14 : 0.1) + glossPulse * (variant === "fault" ? 0.16 : 0.12);
    sheenBMaterial.opacity = (variant === "fault" ? 0.12 : 0.08) + (1 - glossPulse) * (variant === "fault" ? 0.14 : 0.1);
  };

  const dispose = () => {
    ring.geometry.dispose();
    ringMaterial.dispose();
    halo.geometry.dispose();
    haloMaterial.dispose();
    scanBand.geometry.dispose();
    scanMaterial.dispose();
    sheenA.geometry.dispose();
    sheenAMaterial.dispose();
    sheenB.geometry.dispose();
    sheenBMaterial.dispose();
    sheenTexture.dispose();
  };

  return {
    meshes: [halo, ring, scanBand, sheenA, sheenB],
    update,
    dispose
  };
}

function tuneModelMaterials(object: Object3D, variant: DeviceModelRuntimeVariant): EmissiveMaterialHandle[] {
  const palette = getVariantAccent(variant);
  const emissiveColor = new Color(variant === "fault" ? palette.glow : palette.accent);
  const metalTint = getVariantMetalTint(variant);
  const handles: EmissiveMaterialHandle[] = [];

  object.traverse((child) => {
    if (!(child instanceof Mesh)) {
      return;
    }
    const materials = (Array.isArray(child.material) ? child.material : [child.material]) as Material[];
    materials.forEach((material) => {
      const candidate = material as Material & {
        color?: Color;
        metalness?: number;
        roughness?: number;
        envMapIntensity?: number;
        clearcoat?: number;
        clearcoatRoughness?: number;
        sheen?: number;
        sheenRoughness?: number;
        sheenColor?: Color;
        reflectivity?: number;
        specularIntensity?: number;
        shininess?: number;
        emissive?: Color;
        emissiveIntensity?: number;
        needsUpdate?: boolean;
      };

      const isMetalSurfaceMaterial =
        typeof candidate.metalness === "number" || typeof candidate.roughness === "number" || typeof candidate.shininess === "number";

      if (candidate.color && isMetalSurfaceMaterial) {
        candidate.color.lerp(metalTint, 0.22);
      }
      if (typeof candidate.metalness === "number") {
        candidate.metalness = Math.min(1, Math.max(candidate.metalness, 0.93));
      }
      if (typeof candidate.roughness === "number") {
        candidate.roughness = Math.min(candidate.roughness, 0.14);
      }
      if (typeof candidate.envMapIntensity === "number") {
        candidate.envMapIntensity = Math.max(candidate.envMapIntensity, 2.6);
      }
      if (typeof candidate.clearcoat === "number") {
        candidate.clearcoat = Math.max(candidate.clearcoat, 0.9);
      }
      if (typeof candidate.clearcoatRoughness === "number") {
        candidate.clearcoatRoughness = Math.min(candidate.clearcoatRoughness, 0.12);
      }
      if (typeof candidate.sheen === "number") {
        candidate.sheen = Math.max(candidate.sheen, 0.22);
      }
      if (typeof candidate.sheenRoughness === "number") {
        candidate.sheenRoughness = Math.min(candidate.sheenRoughness, 0.35);
      }
      if (candidate.sheenColor) {
        candidate.sheenColor.copy(metalTint);
      }
      if (typeof candidate.reflectivity === "number") {
        candidate.reflectivity = Math.max(candidate.reflectivity, 0.95);
      }
      if (typeof candidate.specularIntensity === "number") {
        candidate.specularIntensity = Math.max(candidate.specularIntensity, 1.15);
      }
      if (typeof candidate.shininess === "number") {
        candidate.shininess = Math.max(candidate.shininess, 150);
      }
      if (candidate.emissive && typeof candidate.emissiveIntensity === "number") {
        candidate.emissive.copy(emissiveColor);
        const baseIntensity = variant === "running" ? 0.52 : variant === "fault" ? 0.46 : 0.3;
        candidate.emissiveIntensity = baseIntensity;
        candidate.needsUpdate = true;
        handles.push({
          material: candidate as EmissiveMaterialHandle["material"],
          baseIntensity,
          pulseAmplitude: variant === "running" ? 0.22 : variant === "fault" ? 0.18 : 0.1,
          pulseSpeed: variant === "fault" ? 5.5 : 3.4
        });
      }
    });
  });

  return handles;
}

function createRuntimeHud(
  container: Group,
  variant: DeviceModelRuntimeVariant,
  fittedSize: Vector3,
  realtimePowerKw: number | null | undefined,
  modelCategory: DeviceModelCategory | undefined
): RuntimeHud | null {
  const baseWidth = Math.max(0.36, Math.min(0.92, fittedSize.x * 0.4));
  const categoryScale = modelCategory === "cooling-tower" ? 4 / 3 : 1;
  const width = baseWidth * categoryScale;
  const height = width * 0.66;
  const zOffset = fittedSize.z * 0.52;
  // Per-category screen vertical tuning:
  // - chiller keeps current position
  // - pump and cooling-tower move a bit higher as requested
  const yFactor =
    modelCategory === "pump" ? 0.01 : modelCategory === "cooling-tower" ? 0.13 : -0.06;
  const yBase = fittedSize.y * yFactor;
  const isChiller = modelCategory === "chiller";
  const frameColor = isChiller ? 0x0f1520 : 0x122133;
  const glassColor = variant === "idle" ? 0x1f2a3b : 0x2b8cff;
  const glassOpacity = variant === "idle" ? 0.16 : 0.3;

  const frame = new Mesh(
    new PlaneGeometry(width * 1.12, height * 1.18),
    new MeshBasicMaterial({
      color: frameColor,
      transparent: true,
      opacity: 0.84,
      side: DoubleSide,
      depthWrite: false
    })
  );
  frame.position.set(0, yBase, zOffset);

  const glass = new Mesh(
    new PlaneGeometry(width, height),
    new MeshBasicMaterial({
      color: glassColor,
      transparent: true,
      opacity: glassOpacity,
      side: DoubleSide,
      depthWrite: false
    })
  );
  glass.position.set(0, yBase, zOffset + 0.0015);

  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 576;
  const ctx = canvas.getContext("2d");
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.needsUpdate = true;

  const hud = new Mesh(
    new PlaneGeometry(width * 0.96, height * 0.92),
    new MeshBasicMaterial({
      map: texture,
      transparent: true,
      opacity: 0.95,
      side: DoubleSide,
      depthWrite: false
    })
  );
  hud.position.set(0, yBase, zOffset + 0.003);

  const pumpLampScale = modelCategory === "pump" ? 0.62 : 1;
  const lampRadius = Math.max(0.018, Math.min(0.05, width * 0.15)) * pumpLampScale;
  const lampY = yBase + height * (modelCategory === "pump" ? 1.02 : 0.82);
  const lampZ = zOffset + 0.007;
  const lampSpacing = lampRadius * 2.65;
  const yellowLampX = variant === "fault" ? -lampSpacing : 0;

  const greenLamp = new Mesh(
    new CircleGeometry(lampRadius, 24),
    new MeshBasicMaterial({
      color: 0x38ff6c,
      transparent: true,
      opacity: 0,
      side: DoubleSide,
      depthWrite: false,
      depthTest: false,
      blending: AdditiveBlending
    })
  );
  greenLamp.position.set(-lampSpacing, lampY, lampZ);

  const yellowLamp = new Mesh(
    new CircleGeometry(lampRadius, 24),
    new MeshBasicMaterial({
      color: 0xfff176,
      transparent: true,
      opacity: 0,
      side: DoubleSide,
      depthWrite: false,
      depthTest: false,
      blending: AdditiveBlending
    })
  );
  yellowLamp.position.set(yellowLampX, lampY, lampZ);

  const redLamp = new Mesh(
    new CircleGeometry(lampRadius, 24),
    new MeshBasicMaterial({
      color: 0xff2a52,
      transparent: true,
      opacity: 0,
      side: DoubleSide,
      depthWrite: false,
      depthTest: false,
      blending: AdditiveBlending
    })
  );
  redLamp.position.set(lampSpacing, lampY, lampZ);

  const greenHalo = new Mesh(
    new CircleGeometry(lampRadius * 2.55, 24),
    new MeshBasicMaterial({
      color: 0x7dff9c,
      transparent: true,
      opacity: 0,
      side: DoubleSide,
      depthWrite: false,
      depthTest: false,
      blending: AdditiveBlending
    })
  );
  greenHalo.position.set(-lampSpacing, lampY, lampZ - 0.0005);

  const yellowHalo = new Mesh(
    new CircleGeometry(lampRadius * 2.55, 24),
    new MeshBasicMaterial({
      color: 0xfff3aa,
      transparent: true,
      opacity: 0,
      side: DoubleSide,
      depthWrite: false,
      depthTest: false,
      blending: AdditiveBlending
    })
  );
  yellowHalo.position.set(yellowLampX, lampY, lampZ - 0.0005);

  const redHalo = new Mesh(
    new CircleGeometry(lampRadius * 2.55, 24),
    new MeshBasicMaterial({
      color: 0xff6f8a,
      transparent: true,
      opacity: 0,
      side: DoubleSide,
      depthWrite: false,
      depthTest: false,
      blending: AdditiveBlending
    })
  );
  redHalo.position.set(lampSpacing, lampY, lampZ - 0.0005);

  const sideBeamColor = variant === "fault" ? 0xff5e6f : variant === "running" ? 0x4bb8ff : 0x4b596d;
  const sideBeamOpacity = 0;
  const sideBeamLength = Math.max(width * 0.62, 0.34);
  const sideBeamHeight = Math.max(height * 0.11, 0.05);
  const sideBeamInset = width * 0.58;
  const sideBeamLeft = new Mesh(
    new PlaneGeometry(sideBeamLength, sideBeamHeight),
    new MeshBasicMaterial({
      color: sideBeamColor,
      transparent: true,
      opacity: sideBeamOpacity,
      side: DoubleSide,
      depthWrite: false,
      blending: AdditiveBlending
    })
  );
  sideBeamLeft.position.set(-sideBeamInset, yBase - height * 0.08, zOffset - 0.03);

  const sideBeamRight = new Mesh(
    new PlaneGeometry(sideBeamLength, sideBeamHeight),
    new MeshBasicMaterial({
      color: sideBeamColor,
      transparent: true,
      opacity: sideBeamOpacity,
      side: DoubleSide,
      depthWrite: false,
      blending: AdditiveBlending
    })
  );
  sideBeamRight.position.set(sideBeamInset, yBase - height * 0.08, zOffset - 0.03);

  container.add(frame);
  container.add(glass);
  container.add(hud);
  container.add(greenHalo);
  container.add(yellowHalo);
  container.add(redHalo);
  container.add(greenLamp);
  container.add(yellowLamp);
  container.add(redLamp);
  // Keep progress visuals inside the screen; no external horizontal bars.

  const update = (time: number) => {
    if (!ctx) {
      return;
    }
    const w = canvas.width;
    const h = canvas.height;
    const blink = 0.6 + Math.sin(time * 4.2) * 0.32;
    const powerBase = typeof realtimePowerKw === "number" && Number.isFinite(realtimePowerKw) ? realtimePowerKw : null;
    const powerDynamic = powerBase == null
      ? 15 + Math.sin(time * 1.7) * 2.8 + Math.cos(time * 3.1) * 1.2
      : powerBase + Math.sin(time * 2.2) * Math.max(0.03, powerBase * 0.002);

    ctx.clearRect(0, 0, w, h);

    const idleScreen = variant === "idle";
    if (isChiller) {
      const baseLoadRatio =
        powerBase != null && powerBase > 0
          ? MathUtils.clamp(0.35 + Math.log10(powerBase + 1) / 3.2, 0.35, 0.9)
          : 0.62;
      const runRatio = MathUtils.clamp(
        baseLoadRatio + Math.sin(time * 1.25) * 0.02 + Math.cos(time * 0.63) * 0.012,
        0.1,
        0.98
      );
      const runPercent = Math.round(runRatio * 100);
      const powerDisplayKw = Math.max(0, powerDynamic);

      const bg = ctx.createLinearGradient(0, 0, 0, h);
      bg.addColorStop(0, "rgba(3, 10, 20, 0.96)");
      bg.addColorStop(1, "rgba(2, 6, 13, 0.96)");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);

      ctx.strokeStyle = idleScreen ? "rgba(84, 96, 114, 0.46)" : "rgba(82, 190, 255, 0.9)";
      ctx.lineWidth = 4;
      ctx.strokeRect(12, 12, w - 24, h - 24);

      if (idleScreen) {
        ctx.fillStyle = "rgba(176, 188, 206, 0.9)";
        ctx.font = "700 86px 'Segoe UI', sans-serif";
        ctx.textAlign = "left";
        ctx.fillText("OFF", 54, 132);
        ctx.fillStyle = "rgba(104, 116, 132, 0.72)";
        ctx.font = "600 38px 'Segoe UI', sans-serif";
        ctx.fillText("SYSTEM STANDBY", 54, 196);
            } else if (variant === "running") {
        const cx = 250;
        const cy = 286;
        const radius = 136;
        const circleAlpha = 0.3 + Math.sin(time * 2.8) * 0.08;
        ctx.strokeStyle = `rgba(75, 184, 255, ${0.24 + circleAlpha * 0.3})`;
        ctx.lineWidth = 24;
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.stroke();

        ctx.strokeStyle = "rgba(78, 205, 255, 0.95)";
        ctx.lineWidth = 24;
        ctx.beginPath();
        ctx.arc(cx, cy, radius, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * runRatio);
        ctx.stroke();

        ctx.fillStyle = "rgba(172, 234, 255, 0.95)";
        ctx.font = "700 88px 'Segoe UI', sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(`${runPercent}%`, cx, cy + 28);

        ctx.textAlign = "left";
        ctx.fillStyle = "rgba(98, 205, 255, 0.96)";
        ctx.font = "600 32px 'Segoe UI', 'Microsoft YaHei', sans-serif";
        ctx.fillText("实时功率", 560, 126);
        ctx.font = "700 72px 'Consolas', monospace";
        ctx.fillText(formatHudNumber(powerDisplayKw, 1), 560, 206);
        ctx.font = "600 44px 'Segoe UI', sans-serif";
        ctx.fillText("kW", 792, 206);

        ctx.fillStyle = "rgba(138, 212, 247, 0.92)";
        ctx.font = "600 32px 'Segoe UI', 'Microsoft YaHei', sans-serif";
        ctx.fillText("当前负荷", 560, 288);
        ctx.font = "700 64px 'Consolas', monospace";
        ctx.fillText(`${runPercent}%`, 560, 360);
      } else {
        const warnAlpha = 0.7 + Math.sin(time * 7.2) * 0.2;
        ctx.fillStyle = `rgba(255, 108, 124, ${0.9})`;
        ctx.font = "700 104px 'Segoe UI', sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("FAULT", w * 0.5, 186);

        ctx.strokeStyle = `rgba(255, 135, 145, ${warnAlpha})`;
        ctx.lineWidth = 12;
        ctx.beginPath();
        ctx.moveTo(w * 0.5, 248);
        ctx.lineTo(w * 0.5 - 84, 418);
        ctx.lineTo(w * 0.5 + 84, 418);
        ctx.closePath();
        ctx.stroke();

        ctx.fillStyle = "rgba(255, 126, 136, 0.95)";
        ctx.font = "900 116px 'Segoe UI', sans-serif";
        ctx.fillText("!", w * 0.5, 392);

        ctx.textAlign = "left";
        ctx.fillStyle = "rgba(176, 225, 255, 0.95)";
        ctx.font = "600 30px 'Segoe UI', 'Microsoft YaHei', sans-serif";
        ctx.fillText(`实时功率 ${formatHudNumber(powerDisplayKw, 1)} kW`, 54, 468);
        ctx.fillText(`当前负荷 ${runPercent}%`, 54, 516);
      }

      const runPulse = 0.82 + Math.sin(time * 6.2) * 0.18;
      const faultBlink = 0.26 + Math.max(0, Math.sin(time * 10.4)) * 0.74;
      (greenLamp.material as MeshBasicMaterial).opacity = variant === "running" ? 0.8 + runPulse * 0.18 : 0;
      (greenHalo.material as MeshBasicMaterial).opacity = variant === "running" ? 0.34 + runPulse * 0.2 : 0;
      (yellowLamp.material as MeshBasicMaterial).opacity = variant === "fault" ? 0.24 + faultBlink * 0.72 : 0;
      (yellowHalo.material as MeshBasicMaterial).opacity = variant === "fault" ? 0.22 + faultBlink * 0.4 : 0;
      (redLamp.material as MeshBasicMaterial).opacity = variant === "fault" ? 0.92 : variant === "running" ? 0.78 + runPulse * 0.16 : 0;
      (redHalo.material as MeshBasicMaterial).opacity = variant === "fault" ? 0.4 + faultBlink * 0.22 : variant === "running" ? 0.3 + runPulse * 0.14 : 0;
      (sideBeamLeft.material as MeshBasicMaterial).opacity = 0;
      (sideBeamRight.material as MeshBasicMaterial).opacity = 0;
    } else {
      ctx.fillStyle = idleScreen ? "rgba(18, 28, 40, 0.68)" : "rgba(25, 112, 255, 0.18)";
      ctx.fillRect(0, 0, w, h);

      ctx.strokeStyle = idleScreen ? "rgba(116, 196, 255, 0.28)" : "rgba(116, 196, 255, 0.85)";
      ctx.lineWidth = 4;
      ctx.strokeRect(10, 10, w - 20, h - 20);

      ctx.strokeStyle = idleScreen ? "rgba(116, 196, 255, 0.08)" : "rgba(116, 196, 255, 0.25)";
      ctx.lineWidth = 1;
      for (let i = 0; i < 9; i += 1) {
        const y = 62 + i * 52;
        ctx.beginPath();
        ctx.moveTo(20, y);
        ctx.lineTo(w - 20, y);
        ctx.stroke();
      }

      ctx.font = "600 46px 'Segoe UI', 'Microsoft YaHei', sans-serif";
      ctx.fillStyle = idleScreen ? "rgba(206, 235, 255, 0.42)" : "rgba(206, 235, 255, 0.9)";
      ctx.fillText(
        variant === "running" ? "RUNNING MONITOR" : variant === "fault" ? "FAULT MONITOR" : "STANDBY SCREEN",
        42,
        76
      );

      if (!idleScreen) {
        ctx.font = "700 130px 'Consolas', 'JetBrains Mono', monospace";
        ctx.fillStyle = "rgba(176, 225, 255, 0.95)";
        ctx.fillText(formatHudNumber(powerDynamic, 2), 56, 302);

        ctx.font = "700 52px 'Consolas', 'JetBrains Mono', monospace";
        ctx.fillStyle = "rgba(139, 206, 255, 0.92)";
        ctx.fillText("kW", 770, 302);

        ctx.font = "500 34px 'Segoe UI', 'Microsoft YaHei', sans-serif";
        ctx.fillStyle = "rgba(160, 210, 255, 0.9)";
        ctx.fillText("实时功率", 56, 352);
      } else {
        ctx.font = "600 86px 'Consolas', 'JetBrains Mono', monospace";
        ctx.fillStyle = "rgba(176, 225, 255, 0.24)";
        ctx.fillText("--.--", 56, 302);
        ctx.font = "600 34px 'Segoe UI', 'Microsoft YaHei', sans-serif";
        ctx.fillStyle = "rgba(160, 210, 255, 0.35)";
        ctx.fillText("SYSTEM IDLE", 56, 352);
      }

      if (variant === "running") {
        if (modelCategory !== "pump") {
          ctx.fillStyle = `rgba(116, 226, 168, ${0.3 + blink * 0.3})`;
          ctx.fillRect(56, 394, 500 * (0.62 + Math.sin(time * 1.8) * 0.04), 26);
          ctx.strokeStyle = "rgba(116, 226, 168, 0.92)";
          ctx.lineWidth = 2;
          ctx.strokeRect(56, 394, 520, 26);
        }
        ctx.fillStyle = "rgba(178, 245, 210, 0.95)";
        ctx.font = "600 30px 'Segoe UI', 'Microsoft YaHei', sans-serif";
        ctx.fillText("SYSTEM STATUS: NORMAL RUN", 56, 458);

        (greenLamp.material as MeshBasicMaterial).opacity = 0.95;
        (greenHalo.material as MeshBasicMaterial).opacity = 0.38;
        (yellowLamp.material as MeshBasicMaterial).opacity = 0.06;
        (yellowHalo.material as MeshBasicMaterial).opacity = 0.02;
        (redLamp.material as MeshBasicMaterial).opacity = 0.95;
        (redHalo.material as MeshBasicMaterial).opacity = 0.34;
      } else if (variant === "fault") {
        const warnAlpha = 0.56 + Math.sin(time * 7.4) * 0.3;
        ctx.fillStyle = `rgba(255, 222, 95, ${warnAlpha})`;
        ctx.beginPath();
        ctx.moveTo(770, 388);
        ctx.lineTo(936, 388);
        ctx.lineTo(852, 520);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = "rgba(255, 196, 66, 0.98)";
        ctx.lineWidth = 4;
        ctx.stroke();

        ctx.fillStyle = "rgba(163, 55, 40, 0.94)";
        ctx.font = "800 84px 'Segoe UI', sans-serif";
        ctx.fillText("!", 826, 488);

        ctx.fillStyle = "rgba(255, 226, 130, 0.96)";
        ctx.font = "600 30px 'Segoe UI', 'Microsoft YaHei', sans-serif";
        ctx.fillText("ALARM ACTIVE", 56, 458);

        const yellowBlink = Math.sin(time * 10) > 0 ? 1 : 0.12;
        (greenLamp.material as MeshBasicMaterial).opacity = 0.06;
        (greenHalo.material as MeshBasicMaterial).opacity = 0.02;
        (yellowLamp.material as MeshBasicMaterial).opacity = yellowBlink;
        (yellowHalo.material as MeshBasicMaterial).opacity = 0.1 + yellowBlink * 0.35;
        (redLamp.material as MeshBasicMaterial).opacity = 0.95;
        (redHalo.material as MeshBasicMaterial).opacity = 0.34;
      } else {
        ctx.fillStyle = "rgba(130, 182, 225, 0.5)";
        ctx.font = "600 30px 'Segoe UI', 'Microsoft YaHei', sans-serif";
        ctx.fillText("SYSTEM STATUS: STOPPED", 56, 458);
        (greenLamp.material as MeshBasicMaterial).opacity = 0;
        (greenHalo.material as MeshBasicMaterial).opacity = 0;
        (yellowLamp.material as MeshBasicMaterial).opacity = 0;
        (yellowHalo.material as MeshBasicMaterial).opacity = 0;
        (redLamp.material as MeshBasicMaterial).opacity = 0;
        (redHalo.material as MeshBasicMaterial).opacity = 0;
      }
    }

    texture.needsUpdate = true;
  };

  const dispose = () => {
    frame.geometry.dispose();
    frame.material.dispose();
    glass.geometry.dispose();
    glass.material.dispose();
    hud.geometry.dispose();
    hud.material.dispose();
    greenLamp.geometry.dispose();
    (greenLamp.material as MeshBasicMaterial).dispose();
    yellowLamp.geometry.dispose();
    (yellowLamp.material as MeshBasicMaterial).dispose();
    redLamp.geometry.dispose();
    (redLamp.material as MeshBasicMaterial).dispose();
    greenHalo.geometry.dispose();
    (greenHalo.material as MeshBasicMaterial).dispose();
    yellowHalo.geometry.dispose();
    (yellowHalo.material as MeshBasicMaterial).dispose();
    redHalo.geometry.dispose();
    (redHalo.material as MeshBasicMaterial).dispose();
    sideBeamLeft.geometry.dispose();
    (sideBeamLeft.material as MeshBasicMaterial).dispose();
    sideBeamRight.geometry.dispose();
    (sideBeamRight.material as MeshBasicMaterial).dispose();
    texture.dispose();
  };

  return {
    meshes: [frame, glass, hud, greenLamp, yellowLamp, redLamp, greenHalo, yellowHalo, redHalo, sideBeamLeft, sideBeamRight],
    update,
    dispose
  };
}

export default function DeviceModelPreview({
  deviceName,
  systemType,
  systemTypeRaw = null,
  runtimeStatusText = null,
  alarmStatusText = null,
  realtimePowerKw = null,
  forcedCategory = null,
  forcedRuntimeVariant = null
}: DeviceModelPreviewProps) {
  const descriptor = useMemo(
    () => (forcedCategory ? getDeviceModelByCategory(forcedCategory) : resolveDeviceModel(systemTypeRaw || systemType)),
    [forcedCategory, systemTypeRaw, systemType]
  );
  const runtimeVariant = useMemo(
    () => forcedRuntimeVariant || resolveDeviceRuntimeVariant(runtimeStatusText, alarmStatusText),
    [forcedRuntimeVariant, runtimeStatusText, alarmStatusText]
  );
  const preferredModelPath = useMemo(() => {
    if (!descriptor) {
      return null;
    }
    // Always use idle model as base; running/fault are represented by overlay runtime screen.
    return descriptor.runtimePaths?.idle || descriptor.path;
  }, [descriptor]);

  const [state, setState] = useState<ModelState>(descriptor ? "checking" : "unsupported");
  const [activePath, setActivePath] = useState<string | null>(null);
  const [activeFormat, setActiveFormat] = useState<PreviewFormat>(null);
  const previewMountRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let active = true;
    if (!descriptor) {
      setState("unsupported");
      setActivePath(null);
      setActiveFormat(null);
      return;
    }
    if (descriptor.intakeStatus !== "ready") {
      setState("missing");
      setActivePath(null);
      setActiveFormat(null);
      return;
    }

    const candidatesRaw = [preferredModelPath || descriptor.path, descriptor.path, descriptor.previewPath || null].filter(Boolean) as string[];
    const deduped = Array.from(new Set(candidatesRaw));
    const candidates = deduped.map((path) => ({ path, format: inferFormatByPath(path) }));

    setState("checking");
    setActivePath(null);
    setActiveFormat(null);

    async function probeModel() {
      for (const candidate of candidates) {
        try {
          const response = await fetch(candidate.path, { cache: "no-store" });
          if (!active) {
            return;
          }
          const contentType = response.headers.get("content-type") || "";
          if (response.ok && !contentType.includes("text/html")) {
            setActivePath(candidate.path);
            setActiveFormat(candidate.format);
            setState("ready");
            return;
          }
        } catch {
          if (!active) {
            return;
          }
        }
      }
      setState("missing");
    }

    probeModel();
    return () => {
      active = false;
    };
  }, [descriptor, preferredModelPath]);

  useEffect(() => {
    if (!previewMountRef.current || state !== "ready" || !activeFormat || !activePath || !descriptor) {
      return;
    }

    const mountNode = previewMountRef.current;
    mountNode.innerHTML = "";

    const width = mountNode.clientWidth || 320;
    const height = mountNode.clientHeight || 240;

    const renderer = new WebGLRenderer({ alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    renderer.outputColorSpace = SRGBColorSpace;
    mountNode.appendChild(renderer.domElement);

    const scene = new Scene();
    const camera = new PerspectiveCamera(38, width / height, 0.1, 200);
    camera.position.set(0, 0, 4.6);
    camera.lookAt(0, 0, 0);

    const ambientLight = new AmbientLight(0x7f8895, 1.75);
    const keyLight = new DirectionalLight(0x9bdcff, 2.2);
    keyLight.position.set(4, 6, 5);
    const fillLight = new DirectionalLight(0x6f7886, 1.1);
    fillLight.position.set(-4, 3, -3);
    const rimLight = new DirectionalLight(0x69e4ff, 1.0);
    rimLight.position.set(0, 2, -4);
    const metalLightA = new DirectionalLight(0x7f8c9b, 1.55);
    metalLightA.position.set(6, 1.5, 1.6);
    const metalLightB = new DirectionalLight(0x647080, 1.25);
    metalLightB.position.set(-5.5, 1.1, 2.8);
    scene.add(ambientLight, keyLight, fillLight, rimLight, metalLightA, metalLightB);

    const manager = new LoadingManager();
    manager.addHandler(/\.tga$/i, new TGALoader(manager));

    const frameGroup = new Group();
    scene.add(frameGroup);

    let disposed = false;
    let animationFrame = 0;
    let resizeFrame = 0;
    let runtimeHud: RuntimeHud | null = null;
    let sciFiFx: SciFiFx | null = null;
    let emissiveHandles: EmissiveMaterialHandle[] = [];
    let fittedSizeForCamera: Vector3 | null = null;

    function fitCameraToFrame(fittedSize: Vector3) {
      const halfFov = MathUtils.degToRad(camera.fov * 0.5);
      const fitHeightDistance = fittedSize.y / (2 * Math.tan(halfFov));
      const fitWidthDistance = fittedSize.x / (2 * Math.tan(halfFov)) / camera.aspect;
      const fitDepthDistance = fittedSize.z * 1.28;
      const distance = Math.max(fitHeightDistance, fitWidthDistance, fitDepthDistance) * 1.45;

      camera.position.set(0, fittedSize.y * 0.08, distance);
      camera.lookAt(0, fittedSize.y * 0.02, 0);
      camera.updateProjectionMatrix();
    }

    const attachObject = (object: Object3D) => {
      if (disposed) {
        return;
      }

      object.traverse((child) => {
        if (!(child instanceof Mesh)) {
          return;
        }
        child.castShadow = false;
        child.receiveShadow = false;
      });
      emissiveHandles = tuneModelMaterials(object, runtimeVariant);

      const box = new Box3().setFromObject(object);
      const size = box.getSize(new Vector3());
      const maxAxis = Math.max(size.x, size.y, size.z) || 1;
      const scale = 2.4 / maxAxis;
      object.scale.setScalar(scale);

      // Re-center AFTER scale, otherwise models with off-origin pivots may orbit while rotating.
      const centeredBox = new Box3().setFromObject(object);
      const centered = centeredBox.getCenter(new Vector3());
      object.position.sub(centered);
      frameGroup.add(object);

      const fittedBox = new Box3().setFromObject(frameGroup);
      const fittedSize = fittedBox.getSize(new Vector3());
      const fittedCenter = fittedBox.getCenter(new Vector3());
      frameGroup.position.sub(fittedCenter);
      frameGroup.position.y += fittedSize.y * 0.11;
      fittedSizeForCamera = fittedSize.clone();

      sciFiFx = createSciFiFx(frameGroup, fittedSize, runtimeVariant, descriptor.category);
      runtimeHud = createRuntimeHud(frameGroup, runtimeVariant, fittedSize, realtimePowerKw, descriptor.category);

      fitCameraToFrame(fittedSize);

      const renderLoop = () => {
        animationFrame = window.requestAnimationFrame(renderLoop);
        const time = performance.now() * 0.001;
        frameGroup.rotation.y += 0.0072;
        const rhythm = Math.sin(time * 2.7);
        emissiveHandles.forEach((handle) => {
          handle.material.emissiveIntensity = Math.max(
            0,
            handle.baseIntensity + handle.pulseAmplitude * (0.5 + Math.sin(time * handle.pulseSpeed) * 0.5) + rhythm * 0.02
          );
        });
        sciFiFx?.update(time);
        runtimeHud?.update(time);
        renderer.render(scene, camera);
      };
      renderLoop();
    };

    const failLoad = () => {
      if (disposed) {
        return;
      }
      setState("missing");
    };

    if (activeFormat === "fbx") {
      const loader = new FBXLoader(manager);
      loader.load(activePath, (object) => attachObject(object), undefined, failLoad);
    } else {
      const loader = new GLTFLoader(manager);
      loader.setMeshoptDecoder(MeshoptDecoder);
      loader.load(activePath, (gltf) => attachObject(gltf.scene), undefined, failLoad);
    }

    const resizeObserver = new ResizeObserver((entries) => {
      const nextWidth = entries[0]?.contentRect.width || width;
      const nextHeight = entries[0]?.contentRect.height || height;
      window.cancelAnimationFrame(resizeFrame);
      resizeFrame = window.requestAnimationFrame(() => {
        if (disposed || nextWidth <= 0 || nextHeight <= 0) {
          return;
        }
        renderer.setSize(nextWidth, nextHeight);
        camera.aspect = nextWidth / nextHeight;
        if (fittedSizeForCamera) {
          fitCameraToFrame(fittedSizeForCamera);
        } else {
          camera.updateProjectionMatrix();
        }
      });
    });
    resizeObserver.observe(mountNode);

    return () => {
      disposed = true;
      window.cancelAnimationFrame(animationFrame);
      window.cancelAnimationFrame(resizeFrame);
      resizeObserver.disconnect();
      sciFiFx?.dispose();
      runtimeHud?.dispose();
      renderer.dispose();
      frameGroup.clear();
      mountNode.innerHTML = "";
    };
  }, [activeFormat, activePath, descriptor, realtimePowerKw, runtimeVariant, state]);

  useEffect(() => {
    if (state !== "ready" || !activePath || !activeFormat) {
      return;
    }
    return () => {
      if (previewMountRef.current) {
        previewMountRef.current.innerHTML = "";
      }
    };
  }, [activeFormat, activePath, state]);

  const stateLabel =
    state === "ready"
      ? zhCN.devicePage.modelReady
      : state === "checking"
        ? zhCN.devicePage.modelLoading
        : state === "missing"
          ? zhCN.devicePage.modelMissing
          : zhCN.devicePage.modelUnsupported;
  const runtimeVariantLabel = descriptor?.runtimePaths
    ? runtimeVariant === "running"
      ? "运行态"
      : runtimeVariant === "fault"
        ? "故障态"
        : "停止态"
    : null;

  return (
    <div className="device-model-card">
      <div className="device-model-header">
        <div>
          <span>{zhCN.devicePage.detailModel}</span>
          <strong>{descriptor?.displayName || systemType}</strong>
        </div>
        <small>{runtimeVariantLabel ? `${stateLabel} · ${runtimeVariantLabel}` : stateLabel}</small>
      </div>

      {state === "ready" && activePath ? (
        <div className="device-model-viewer-shell">
          <div ref={previewMountRef} className="device-model-fbx-canvas" />
        </div>
      ) : (
        <div className="device-model-placeholder">
          <strong>{deviceName}</strong>
          <p>
            {state === "unsupported"
              ? zhCN.devicePage.modelHint
              : descriptor?.intakeStatus === "planned"
                ? zhCN.devicePage.modelPlannedHint
                : zhCN.devicePage.modelMissingHint}
          </p>
        </div>
      )}

      <div className="device-model-meta">
        <span>{`${zhCN.devicePage.modelSourcePrefix}: ${descriptor?.sourceLabel || zhCN.common.unknown}`}</span>
        <span>{`${zhCN.devicePage.modelStatusPrefix}: ${
          descriptor ? (descriptor.intakeStatus === "ready" ? zhCN.devicePage.modelStatusReady : zhCN.devicePage.modelStatusPlanned) : zhCN.common.unknown
        }`}</span>
        <span>{`${zhCN.devicePage.modelPathPrefix}: ${activePath || descriptor?.path ? "已配置" : "待配置"}`}</span>
      </div>
    </div>
  );
}

