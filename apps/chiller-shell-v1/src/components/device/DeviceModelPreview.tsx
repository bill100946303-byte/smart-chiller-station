import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { TGALoader } from "three/examples/jsm/loaders/TGALoader.js";
import { getDeviceModelByCategory, type DeviceModelCategory, resolveDeviceModel } from "../../config/modelRegistry";
import { zhCN } from "../../i18n/zhCN";

type DeviceModelPreviewProps = {
  deviceName: string;
  systemType: string;
  forcedCategory?: DeviceModelCategory | null;
};

type ModelState = "checking" | "ready" | "missing" | "unsupported";
type PreviewFormat = "glb" | "fbx" | null;

export default function DeviceModelPreview({ deviceName, systemType, forcedCategory = null }: DeviceModelPreviewProps) {
  const descriptor = useMemo(
    () => (forcedCategory ? getDeviceModelByCategory(forcedCategory) : resolveDeviceModel(systemType)),
    [forcedCategory, systemType]
  );
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
    const candidates = [
      {
        path: descriptor.path,
        format: "glb" as const
      },
      descriptor.previewPath
        ? {
            path: descriptor.previewPath,
            format: descriptor.previewFormat || ("fbx" as const)
          }
        : null
    ].filter(Boolean) as Array<{ path: string; format: "glb" | "fbx" }>;

    setState("checking");
    setActivePath(null);
    setActiveFormat(null);
    async function probeModel() {
      for (const candidate of candidates) {
        try {
          const response = await fetch(candidate.path, {
            cache: "no-store"
          });
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
  }, [descriptor]);

  useEffect(() => {
    if (state !== "ready" || !activeFormat || !activePath || !previewMountRef.current) {
      return;
    }

    const mountNode = previewMountRef.current;
    mountNode.innerHTML = "";

    const width = mountNode.clientWidth || 320;
    const height = mountNode.clientHeight || 240;

    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    mountNode.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 200);
    camera.position.set(0, 0, 4.6);
    camera.lookAt(0, 0, 0);

    const ambientLight = new THREE.AmbientLight(0xffffff, 1.8);
    const keyLight = new THREE.DirectionalLight(0x9bdcff, 2.4);
    keyLight.position.set(4, 6, 5);
    const fillLight = new THREE.DirectionalLight(0xffffff, 1.2);
    fillLight.position.set(-4, 3, -3);
    scene.add(ambientLight, keyLight, fillLight);
    const rimLight = new THREE.DirectionalLight(0x69e4ff, 1.1);
    rimLight.position.set(0, 2, -4);
    scene.add(rimLight);

    const manager = new THREE.LoadingManager();
    manager.addHandler(/\.tga$/i, new TGALoader(manager));

    const frameGroup = new THREE.Group();
    scene.add(frameGroup);

    let disposed = false;
    let animationFrame = 0;

    const attachObject = (object: THREE.Object3D) => {
      if (disposed) {
        return;
      }

      object.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.castShadow = false;
          child.receiveShadow = false;
        }
      });

      const box = new THREE.Box3().setFromObject(object);
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());
      object.position.sub(center);
      const maxAxis = Math.max(size.x, size.y, size.z) || 1;
      const scale = 2.4 / maxAxis;
      object.scale.setScalar(scale);
      frameGroup.add(object);

      const fittedBox = new THREE.Box3().setFromObject(frameGroup);
      const fittedSize = fittedBox.getSize(new THREE.Vector3());
      const fittedCenter = fittedBox.getCenter(new THREE.Vector3());
      frameGroup.position.sub(fittedCenter);
      frameGroup.position.y += fittedSize.y * 0.12;

      const halfFov = THREE.MathUtils.degToRad(camera.fov * 0.5);
      const fitHeightDistance = fittedSize.y / (2 * Math.tan(halfFov));
      const fitWidthDistance = fittedSize.x / (2 * Math.tan(halfFov)) / camera.aspect;
      const distance = Math.max(fitHeightDistance, fitWidthDistance, fittedSize.z) * 1.7;

      camera.position.set(0, fittedSize.y * 0.14, distance);
      camera.lookAt(0, fittedSize.y * 0.04, 0);
      camera.updateProjectionMatrix();

      const renderLoop = () => {
        animationFrame = window.requestAnimationFrame(renderLoop);
        frameGroup.rotation.y += 0.008;
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
      loader.load(
        activePath,
        (object) => {
          attachObject(object);
        },
        undefined,
        failLoad
      );
    } else if (activeFormat === "glb") {
      const loader = new GLTFLoader(manager);
      loader.setMeshoptDecoder(MeshoptDecoder);
      loader.load(
        activePath,
        (gltf) => {
          attachObject(gltf.scene);
        },
        undefined,
        failLoad
      );
    }

    const resizeObserver = new ResizeObserver((entries) => {
      const nextWidth = entries[0]?.contentRect.width || width;
      const nextHeight = entries[0]?.contentRect.height || height;
      renderer.setSize(nextWidth, nextHeight);
      camera.aspect = nextWidth / nextHeight;
      camera.updateProjectionMatrix();
    });
    resizeObserver.observe(mountNode);

    return () => {
      disposed = true;
      window.cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();
      renderer.dispose();
      frameGroup.clear();
      mountNode.innerHTML = "";
    };
  }, [activeFormat, activePath, state]);

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

  return (
    <div className="device-model-card">
      <div className="device-model-header">
        <div>
          <span>{zhCN.devicePage.detailModel}</span>
          <strong>{descriptor?.displayName || systemType}</strong>
        </div>
        <small>{stateLabel}</small>
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
        <span>{`${zhCN.devicePage.modelSourcePrefix}：${descriptor?.sourceLabel || zhCN.common.unknown}`}</span>
        <span>{`${zhCN.devicePage.modelStatusPrefix}：${
          descriptor ? (descriptor.intakeStatus === "ready" ? zhCN.devicePage.modelStatusReady : zhCN.devicePage.modelStatusPlanned) : zhCN.common.unknown
        }`}</span>
        <span>{`${zhCN.devicePage.modelPathPrefix}：${activePath || descriptor?.path || "--"}`}</span>
      </div>
    </div>
  );
}
