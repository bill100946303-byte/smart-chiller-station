import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import {
  getDeviceModelByCategory,
  type DeviceModelCategory
} from "../../config/modelRegistry";
import { zhCN } from "../../i18n/zhCN";
import { buildSystemDiagramLayout } from "./systemDiagramLayout";
import type {
  SystemDiagramEdgeKind,
  SystemDiagramRenderableCategory,
  SystemDiagramResolvedNode,
  SystemDiagramResolvedTopology,
  SystemDiagramTopology
} from "./systemDiagramTypes";

type SystemDiagram3DProps = {
  topology: SystemDiagramTopology;
  selectedNodeId?: string | null;
  onNodeSelect?: (node: SystemDiagramResolvedNode) => void;
  devicePageHref?: string | null;
};

type SystemDiagramViewMode = "all" | "chilled" | "cooling";

type HoverState = {
  nodeId: string;
  x: number;
  y: number;
} | null;

type FlowPulse = {
  mesh: THREE.Mesh;
  curve: THREE.CatmullRomCurve3;
  offset: number;
  speed: number;
};

const PIPE_COLORS: Record<SystemDiagramEdgeKind, number> = {
  "chilled-supply": 0x69e4ff,
  "chilled-return": 0x38a9ff,
  "cooling-supply": 0x8ff7d7,
  "cooling-return": 0xffc56d
};

const NODE_STATUS_COLORS: Record<SystemDiagramResolvedNode["status"], string> = {
  running: "#8ff7d7",
  standby: "#69e4ff",
  alert: "#ff9b7b"
};

const gltfLoader = new GLTFLoader();
gltfLoader.setMeshoptDecoder(MeshoptDecoder);
const modelPrototypeCache = new Map<DeviceModelCategory, Promise<THREE.Object3D>>();

function loadModelPrototype(category: DeviceModelCategory): Promise<THREE.Object3D> {
  const cached = modelPrototypeCache.get(category);
  if (cached) {
    return cached;
  }

  const descriptor = getDeviceModelByCategory(category);
  const pending = new Promise<THREE.Object3D>((resolve, reject) => {
    gltfLoader.load(
      descriptor.path,
      (gltf) => resolve(gltf.scene),
      undefined,
      reject
    );
  });
  modelPrototypeCache.set(category, pending);
  return pending;
}

function getNodeStatusLabel(status: SystemDiagramResolvedNode["status"]) {
  if (status === "running") {
    return zhCN.topologyStatus.running;
  }
  if (status === "alert") {
    return zhCN.topologyStatus.alert;
  }
  return zhCN.topologyStatus.stable;
}

function getViewModeLabel(viewMode: SystemDiagramViewMode) {
  if (viewMode === "chilled") {
    return zhCN.sceneControl.systemDiagramFilterChilled;
  }
  if (viewMode === "cooling") {
    return zhCN.sceneControl.systemDiagramFilterCooling;
  }
  return zhCN.sceneControl.systemDiagramFilterAll;
}

function createLabelSprite(title: string, subtitle: string, color: string) {
  const canvas = document.createElement("canvas");
  canvas.width = 640;
  canvas.height = 184;
  const context = canvas.getContext("2d");
  if (!context) {
    return null;
  }

  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "rgba(6, 22, 41, 0.86)";
  context.strokeStyle = "rgba(105, 228, 255, 0.22)";
  context.lineWidth = 4;
  context.beginPath();
  context.roundRect(10, 10, canvas.width - 20, canvas.height - 20, 26);
  context.fill();
  context.stroke();

  context.fillStyle = color;
  context.fillRect(26, 22, 118, 8);

  context.beginPath();
  context.fillStyle = color;
  context.arc(44, 86, 10, 0, Math.PI * 2);
  context.fill();

  context.fillStyle = "rgba(236, 244, 249, 0.74)";
  context.font = "600 26px Space Grotesk, Noto Sans SC";
  context.textAlign = "left";
  context.textBaseline = "middle";
  context.fillText(subtitle, 68, 86);

  context.fillStyle = color;
  context.font = "700 54px Space Grotesk, Noto Sans SC";
  context.textAlign = "left";
  context.textBaseline = "middle";
  context.fillText(title, 34, 130);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true
  });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(3.4, 0.98, 1);
  return sprite;
}

function createPipeCurve(points: THREE.Vector3[]) {
  return new THREE.CatmullRomCurve3(points, false, "catmullrom", 0.02);
}

function createPipeMesh(curve: THREE.CatmullRomCurve3, color: number, options?: { radius?: number; opacity?: number }) {
  const geometry = new THREE.TubeGeometry(curve, 64, options?.radius ?? 0.09, 14, false);
  const material = new THREE.MeshStandardMaterial({
    color,
    transparent: typeof options?.opacity === "number",
    opacity: options?.opacity ?? 1,
    metalness: 0.28,
    roughness: 0.42,
    emissive: color,
    emissiveIntensity: 0.12
  });
  return new THREE.Mesh(geometry, material);
}

function createLoopDeck(width: number, depth: number, color: number) {
  const group = new THREE.Group();
  const surface = new THREE.Mesh(
    new THREE.PlaneGeometry(width, depth),
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.12,
      side: THREE.DoubleSide
    })
  );
  surface.rotation.x = -Math.PI / 2;
  surface.position.y = 0.015;
  group.add(surface);

  const innerSurface = new THREE.Mesh(
    new THREE.PlaneGeometry(width * 0.92, depth * 0.84),
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.06,
      side: THREE.DoubleSide
    })
  );
  innerSurface.rotation.x = -Math.PI / 2;
  innerSurface.position.y = 0.022;
  group.add(innerSurface);

  const outline = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.PlaneGeometry(width, depth)),
    new THREE.LineBasicMaterial({
      color,
      transparent: true,
      opacity: 0.32
    })
  );
  outline.rotation.x = -Math.PI / 2;
  outline.position.y = 0.024;
  group.add(outline);

  return group;
}

function createFlowPulse(color: number) {
  return new THREE.Mesh(
    new THREE.SphereGeometry(0.14, 18, 18),
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.84
    })
  );
}

function fitModelToNode(model: THREE.Object3D, targetHeight: number) {
  const modelRoot = new THREE.Group();
  modelRoot.add(model);
  const box = new THREE.Box3().setFromObject(modelRoot);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const safeHeight = size.y || Math.max(size.x, size.z, 1);
  const scale = targetHeight / safeHeight;
  model.scale.setScalar(scale);
  model.position.set(-center.x * scale, -box.min.y * scale, -center.z * scale);
  return modelRoot;
}

function buildInstanceOffsets(count: number) {
  if (count <= 1) {
    return [{ x: 0, z: 0, scale: 1 }];
  }

  const offsets = [{ x: 0, z: 0, scale: 1 }];
  const satelliteCount = Math.min(count - 1, 5);
  const radius = 1.3;

  for (let index = 0; index < satelliteCount; index += 1) {
    const angle = -Math.PI * 0.75 + (index / Math.max(satelliteCount - 1, 1)) * Math.PI * 1.5;
    offsets.push({
      x: Math.cos(angle) * radius,
      z: Math.sin(angle) * radius,
      scale: 0.58
    });
  }

  return offsets;
}

function buildEdgePoints(
  edge: SystemDiagramResolvedTopology["edges"][number],
  nodesById: Map<string, SystemDiagramResolvedNode>
) {
  const fromNode = nodesById.get(edge.from);
  const toNode = nodesById.get(edge.to);
  if (!fromNode || !toNode) {
    return null;
  }

  const points = [
    new THREE.Vector3(fromNode.position[0], 0.9, fromNode.position[2]),
    ...(edge.via || []).map(([x, y, z]) => new THREE.Vector3(x, y, z)),
    new THREE.Vector3(toNode.position[0], 0.9, toNode.position[2])
  ];
  return points;
}

function createFallbackGeometry(category: SystemDiagramRenderableCategory) {
  if (category === "load") {
    return new THREE.BoxGeometry(2.2, 0.92, 1.8);
  }
  if (category === "valve") {
    return new THREE.TorusKnotGeometry(0.36, 0.12, 64, 10);
  }
  if (category === "pump") {
    return new THREE.CapsuleGeometry(0.26, 0.9, 8, 14);
  }
  if (category === "cooling-tower") {
    return new THREE.CylinderGeometry(0.52, 0.78, 1.2, 18);
  }
  return new THREE.BoxGeometry(1.4, 0.8, 3);
}

export default function SystemDiagram3D({
  topology,
  selectedNodeId = null,
  onNodeSelect,
  devicePageHref = null
}: SystemDiagram3DProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [viewMode, setViewMode] = useState<SystemDiagramViewMode>("all");
  const [hoverState, setHoverState] = useState<HoverState>(null);
  const filteredTopology = useMemo(() => {
    if (viewMode === "all") {
      return topology;
    }

    const visibleLayoutRoles =
      viewMode === "chilled"
        ? new Set(["chiller", "chilled-pump", "valve-chilled", "load"])
        : new Set(["chiller", "cooling-pump", "valve-cooling", "cooling-tower"]);
    const visibleEdgeKinds =
      viewMode === "chilled"
        ? new Set(["chilled-supply", "chilled-return"])
        : new Set(["cooling-supply", "cooling-return"]);

    return {
      ...topology,
      nodes: topology.nodes.filter((node) => visibleLayoutRoles.has(node.layoutRole)),
      edges: topology.edges.filter((edge) => visibleEdgeKinds.has(edge.kind))
    };
  }, [topology, viewMode]);
  const resolved = useMemo(() => buildSystemDiagramLayout(filteredTopology), [filteredTopology]);
  const nodeCount = resolved.nodes.length;
  const edgeCount = resolved.edges.length;
  const selectedNode = resolved.nodes.find((node) => node.id === selectedNodeId) || resolved.nodes[0] || null;
  const hoveredNode = hoverState ? resolved.nodes.find((node) => node.id === hoverState.nodeId) || null : null;
  const selectedNodeStatusLabel = selectedNode ? getNodeStatusLabel(selectedNode.status) : zhCN.topologyStatus.stable;
  const shellDeviceValue = selectedNode?.primaryDeviceId || selectedNode?.systemType || resolved.title;
  const hoverLeft = hoverState
    ? Math.max(14, Math.min(hoverState.x + 14, (mountRef.current?.clientWidth || 360) - 236))
    : 14;
  const hoverTop = hoverState ? Math.max(14, hoverState.y - 18) : 14;

  useEffect(() => {
    const mountNode = mountRef.current;
    if (!mountNode) {
      return;
    }

    mountNode.innerHTML = "";
    const width = mountNode.clientWidth || 320;
    const height = mountNode.clientHeight || 260;

    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    mountNode.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x07172b, 0.026);

    const camera = new THREE.PerspectiveCamera(34, width / height, 0.1, 160);
    camera.position.set(0.8, 8.8, 17.2);
    camera.lookAt(0, 1.8, 0.4);

    const ambientLight = new THREE.AmbientLight(0xffffff, 1.55);
    const hemiLight = new THREE.HemisphereLight(0xbfe7ff, 0x04111d, 1.2);
    const keyLight = new THREE.DirectionalLight(0xc3ecff, 2.4);
    keyLight.position.set(9, 11, 7);
    const fillLight = new THREE.DirectionalLight(0xffffff, 1.3);
    fillLight.position.set(-8, 5, -6);
    const rimLight = new THREE.DirectionalLight(0x69e4ff, 1.1);
    rimLight.position.set(0, 7, -10);
    scene.add(ambientLight, hemiLight, keyLight, fillLight, rimLight);

    const atmosphere = new THREE.Mesh(
      new THREE.SphereGeometry(34, 32, 32),
      new THREE.MeshBasicMaterial({
        color: 0x0a1d33,
        side: THREE.BackSide,
        transparent: true,
        opacity: 0.32
      })
    );
    atmosphere.position.set(0, 8.5, 0);
    scene.add(atmosphere);

    const root = new THREE.Group();
    scene.add(root);
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const clickTargets: THREE.Object3D[] = [];

    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(12.5, 64),
      new THREE.MeshBasicMaterial({
        color: 0x0a2645,
        transparent: true,
        opacity: 0.5
      })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.02;
    root.add(ground);

    const innerGround = new THREE.Mesh(
      new THREE.RingGeometry(8.2, 10.4, 56),
      new THREE.MeshBasicMaterial({
        color: 0x3b7ad4,
        transparent: true,
        opacity: 0.12,
        side: THREE.DoubleSide
      })
    );
    innerGround.rotation.x = -Math.PI / 2;
    innerGround.position.y = -0.01;
    root.add(innerGround);

    const grid = new THREE.GridHelper(24, 18, 0x2d6f91, 0x163753);
    grid.position.y = 0;
    root.add(grid);

    const chilledDeck = createLoopDeck(10.8, 7.4, 0x2b7fff);
    chilledDeck.position.set(-3.35, 0, 3.9);
    const coolingDeck = createLoopDeck(10.6, 8.8, 0x4fdac8);
    coolingDeck.position.set(4.45, 0, -1.3);
    const loadDeck = createLoopDeck(4.6, 2.9, 0x80dfff);
    loadDeck.position.set(-0.8, 0, 6.1);

    if (viewMode !== "cooling") {
      root.add(chilledDeck, loadDeck);
    }
    if (viewMode !== "chilled") {
      root.add(coolingDeck);
    }

    const nodesById = new Map(resolved.nodes.map((node) => [node.id, node]));
    const flowPulses: FlowPulse[] = [];
    const animatedRings: Array<{ mesh: THREE.Mesh; baseScale: number }> = [];
    const animatedBeacons: THREE.Mesh[] = [];

    resolved.edges.forEach((edge, edgeIndex) => {
      const points = buildEdgePoints(edge, nodesById);
      if (!points) {
        return;
      }
      const color = PIPE_COLORS[edge.kind];
      const curve = createPipeCurve(points);
      root.add(createPipeMesh(curve, color));
      root.add(createPipeMesh(curve, color, { radius: 0.16, opacity: 0.12 }));

      for (let index = 0; index < 2; index += 1) {
        const pulse = createFlowPulse(color);
        root.add(pulse);
        flowPulses.push({
          mesh: pulse,
          curve,
          offset: edgeIndex * 0.17 + index * 0.37,
          speed: 0.06 + index * 0.012
        });
      }
    });

    let disposed = false;
    let animationFrame = 0;

    resolved.nodes.forEach((node) => {
      const anchor = new THREE.Group();
      anchor.position.set(node.position[0], node.position[1], node.position[2]);
      root.add(anchor);
      const isSelected = selectedNodeId === node.id;
      const statusColor = new THREE.Color(NODE_STATUS_COLORS[node.status]);

      const pad = new THREE.Mesh(
        new THREE.CylinderGeometry(0.88, 1, 0.14, 24),
        new THREE.MeshStandardMaterial({
          color: isSelected ? 0x1f5478 : 0x13395e,
          metalness: 0.24,
          roughness: 0.6
        })
      );
      pad.position.y = 0.08;
      pad.scale.setScalar(isSelected ? 1.06 : 1);
      anchor.add(pad);
      pad.userData.systemNodeId = node.id;
      clickTargets.push(pad);

      const halo = new THREE.Mesh(
        new THREE.RingGeometry(1.2, 1.42, 42),
        new THREE.MeshBasicMaterial({
          color: statusColor,
          transparent: true,
          opacity: isSelected ? 0.28 : 0.14,
          side: THREE.DoubleSide
        })
      );
      halo.rotation.x = -Math.PI / 2;
      halo.position.y = 0.02;
      anchor.add(halo);

      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(1.08, 0.05, 10, 36),
        new THREE.MeshBasicMaterial({
          color: statusColor,
          transparent: true,
          opacity: isSelected ? 1 : 0.9
        })
      );
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 0.16;
      ring.scale.setScalar(isSelected ? 1.08 : 1);
      anchor.add(ring);
      animatedRings.push({ mesh: ring, baseScale: isSelected ? 1.08 : 1 });
      ring.userData.systemNodeId = node.id;
      clickTargets.push(ring);

      const beaconStem = new THREE.Mesh(
        new THREE.CylinderGeometry(0.02, 0.02, node.targetHeight + 0.42, 10, 1, true),
        new THREE.MeshBasicMaterial({
          color: statusColor,
          transparent: true,
          opacity: isSelected ? 0.22 : 0.12
        })
      );
      beaconStem.position.y = (node.targetHeight + 0.42) / 2 + 0.14;
      anchor.add(beaconStem);

      const beacon = new THREE.Mesh(
        new THREE.SphereGeometry(0.13, 18, 18),
        new THREE.MeshBasicMaterial({
          color: statusColor,
          transparent: true,
          opacity: 0.92
        })
      );
      beacon.position.set(0, node.targetHeight + 0.62, 0);
      anchor.add(beacon);
      animatedBeacons.push(beacon);

      const label = createLabelSprite(node.label, `${node.systemType} · ${node.instanceCount || 1}台`, NODE_STATUS_COLORS[node.status]);
      if (label) {
        label.position.set(0, node.targetHeight + 1.55, 0);
        anchor.add(label);
      }
      const instanceOffsets = buildInstanceOffsets(node.instanceCount || 1);

      const fallbackGroup = new THREE.Group();
      instanceOffsets.forEach((instance) => {
        const fallback = new THREE.Mesh(
          createFallbackGeometry(node.category),
          new THREE.MeshStandardMaterial({
            color: 0x6fd8ff,
            transparent: true,
            opacity: isSelected ? 0.56 : 0.4,
            metalness: 0.12,
            roughness: 0.72
          })
        );
        fallback.position.set(instance.x, node.targetHeight * 0.42, instance.z);
        fallback.scale.setScalar(instance.scale);
        fallback.userData.systemNodeId = node.id;
        clickTargets.push(fallback);
        fallbackGroup.add(fallback);
      });
      anchor.add(fallbackGroup);

      if (node.category === "load") {
        return;
      }

      loadModelPrototype(node.category)
        .then((prototype) => {
          if (disposed) {
            return;
          }

          const modelGroup = new THREE.Group();
          instanceOffsets.forEach((instance) => {
            const clone = prototype.clone(true);
            const fitted = fitModelToNode(clone, node.targetHeight * instance.scale);
            fitted.rotation.y = node.rotationY;
            fitted.position.set(instance.x, 0, instance.z);
            fitted.traverse((child) => {
              child.userData.systemNodeId = node.id;
              clickTargets.push(child);
            });
            modelGroup.add(fitted);
          });

          anchor.remove(fallbackGroup);
          anchor.add(modelGroup);
        })
        .catch(() => {
          // Keep fallback geometry in place.
        });
    });

    const handlePointerDown = (event: PointerEvent) => {
      if (!onNodeSelect) {
        return;
      }
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const intersections = raycaster.intersectObjects(clickTargets, false);
      const matched = intersections
        .map((item) => item.object.userData.systemNodeId as string | undefined)
        .find(Boolean);
      if (!matched) {
        return;
      }
      const node = resolved.nodes.find((item) => item.id === matched);
      if (node) {
        onNodeSelect(node);
      }
    };
    const handlePointerMove = (event: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const intersections = raycaster.intersectObjects(clickTargets, false);
      const matched = intersections
        .map((item) => item.object.userData.systemNodeId as string | undefined)
        .find(Boolean);

      if (!matched) {
        setHoverState(null);
        renderer.domElement.style.cursor = onNodeSelect ? "pointer" : "default";
        return;
      }

      setHoverState({
        nodeId: matched,
        x: event.clientX - rect.left,
        y: event.clientY - rect.top
      });
      renderer.domElement.style.cursor = "pointer";
    };
    const handlePointerLeave = () => {
      setHoverState(null);
      renderer.domElement.style.cursor = onNodeSelect ? "pointer" : "default";
    };
    renderer.domElement.addEventListener("pointerdown", handlePointerDown);
    renderer.domElement.addEventListener("pointermove", handlePointerMove);
    renderer.domElement.addEventListener("pointerleave", handlePointerLeave);
    renderer.domElement.style.cursor = onNodeSelect ? "pointer" : "default";

    const renderLoop = () => {
      animationFrame = window.requestAnimationFrame(renderLoop);
      const time = performance.now();
      const idleSwing = Math.sin(time * 0.00024) * (viewMode === "all" ? 0.08 : 0.03);
      const focusX = selectedNode
        ? selectedNode.position[0] * 0.12
        : viewMode === "chilled"
          ? -1.5
          : viewMode === "cooling"
            ? 2.2
            : 0;
      const focusZ = selectedNode
        ? selectedNode.position[2] * 0.08
        : viewMode === "chilled"
          ? 2.6
          : viewMode === "cooling"
            ? -1.8
            : 0.5;
      const cameraBaseX = viewMode === "cooling" ? 3.8 : viewMode === "chilled" ? -2.2 : 0.8;
      const cameraBaseZ = viewMode === "cooling" ? 16.2 : viewMode === "chilled" ? 16.0 : 17.2;

      root.rotation.y = idleSwing;
      root.position.y = Math.sin(time * 0.00058) * 0.05;
      camera.position.x = cameraBaseX + Math.sin(time * 0.00031) * 0.38;
      camera.position.z = cameraBaseZ + Math.cos(time * 0.00024) * 0.22;
      camera.lookAt(focusX, 1.8, focusZ);

      animatedRings.forEach((item, index) => {
        const pulse = 1 + Math.sin(time * 0.004 + index) * 0.04;
        item.mesh.scale.setScalar(item.baseScale * pulse);
      });

      animatedBeacons.forEach((beacon, index) => {
        const pulse = 1 + Math.sin(time * 0.005 + index) * 0.12;
        beacon.scale.setScalar(pulse);
      });

      flowPulses.forEach((pulse, index) => {
        const progress = (time * 0.0001 * pulse.speed + pulse.offset) % 1;
        const point = pulse.curve.getPointAt(progress);
        pulse.mesh.position.copy(point);
        pulse.mesh.position.y += 0.04 + Math.sin(time * 0.004 + index) * 0.025;
        pulse.mesh.scale.setScalar(0.9 + Math.sin(time * 0.006 + index) * 0.16);
      });

      renderer.render(scene, camera);
    };
    renderLoop();

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
      renderer.domElement.removeEventListener("pointerdown", handlePointerDown);
      renderer.domElement.removeEventListener("pointermove", handlePointerMove);
      renderer.domElement.removeEventListener("pointerleave", handlePointerLeave);
      renderer.dispose();
      root.clear();
      mountNode.innerHTML = "";
    };
  }, [onNodeSelect, resolved, selectedNodeId]);

  return (
    <section className="scene-system-diagram-card">
      <div className="scene-system-diagram-topbar">
        <div className="scene-system-diagram-copy">
          <span>{zhCN.sceneControl.systemDiagramEyebrow}</span>
          <strong>{resolved.title}</strong>
          <p>{resolved.description}</p>
        </div>

        <div className="scene-system-diagram-filter">
          <button
            type="button"
            className={viewMode === "all" ? "scene-system-diagram-filter-button active" : "scene-system-diagram-filter-button"}
            onClick={() => setViewMode("all")}
          >
            {zhCN.sceneControl.systemDiagramFilterAll}
          </button>
          <button
            type="button"
            className={viewMode === "chilled" ? "scene-system-diagram-filter-button active" : "scene-system-diagram-filter-button"}
            onClick={() => setViewMode("chilled")}
          >
            {zhCN.sceneControl.systemDiagramFilterChilled}
          </button>
          <button
            type="button"
            className={viewMode === "cooling" ? "scene-system-diagram-filter-button active" : "scene-system-diagram-filter-button"}
            onClick={() => setViewMode("cooling")}
          >
            {zhCN.sceneControl.systemDiagramFilterCooling}
          </button>
        </div>
      </div>

      <div className="scene-system-diagram-meta">
        <div className="scene-system-diagram-stat">
          <label>{zhCN.sceneControl.systemDiagramNodes}</label>
          <strong>{nodeCount}</strong>
        </div>
        <div className="scene-system-diagram-stat">
          <label>{zhCN.sceneControl.systemDiagramEdges}</label>
          <strong>{edgeCount}</strong>
        </div>
        <div className="scene-system-diagram-stat">
          <label>{zhCN.sceneControl.systemDiagramMode}</label>
          <strong>{zhCN.sceneControl.systemDiagramModeValue}</strong>
        </div>
      </div>

      <div className="scene-system-diagram-shell">
        <div className="scene-system-diagram-shell-hud">
          <div className="scene-system-diagram-shell-copy">
            <span>{getViewModeLabel(viewMode)}</span>
            <strong>{selectedNode ? selectedNode.label : resolved.title}</strong>
            <small>
              {selectedNode
                ? `${selectedNode.systemType} · ${selectedNode.primaryDeviceLabel || zhCN.sceneControl.systemDiagramSelectionNotBound}`
                : resolved.description}
            </small>
          </div>
          <div className="scene-system-diagram-shell-chip-group">
            <span className="scene-system-diagram-shell-chip">{selectedNodeStatusLabel}</span>
            <span className="scene-system-diagram-shell-chip">{shellDeviceValue}</span>
          </div>
        </div>
        <div className="scene-system-diagram-shell-zones">
          <span className={viewMode === "cooling" ? "scene-system-diagram-shell-zone is-muted" : "scene-system-diagram-shell-zone"}>
            {zhCN.sceneControl.systemDiagramFilterChilled}
          </span>
          <span className="scene-system-diagram-shell-zone">负荷侧</span>
          <span className={viewMode === "chilled" ? "scene-system-diagram-shell-zone is-muted" : "scene-system-diagram-shell-zone"}>
            {zhCN.sceneControl.systemDiagramFilterCooling}
          </span>
        </div>
        <div ref={mountRef} className="scene-system-diagram-canvas" />
        {hoveredNode && hoverState ? (
          <div
            className="scene-system-diagram-hover"
            style={{
              left: `${hoverLeft}px`,
              top: `${hoverTop}px`
            }}
          >
            <strong>{hoveredNode.label}</strong>
            <small>{hoveredNode.systemType}</small>
            <div className="scene-system-diagram-hover-meta">
              <span>{getNodeStatusLabel(hoveredNode.status)}</span>
              {hoveredNode.primaryDeviceId ? <span>{hoveredNode.primaryDeviceId}</span> : null}
            </div>
          </div>
        ) : null}
        <div className="scene-system-diagram-shell-footer">
          <span>{selectedNode?.primaryDeviceLabel || resolved.title}</span>
          <strong>
            {nodeCount} {zhCN.sceneControl.systemDiagramNodes} / {edgeCount} {zhCN.sceneControl.systemDiagramEdges}
          </strong>
        </div>
      </div>

      {selectedNode ? (
        <div className="scene-system-diagram-selection">
          <div className="scene-system-diagram-selection-header">
            <span>{zhCN.sceneControl.systemDiagramSelectionEyebrow}</span>
            <strong>{selectedNode.label}</strong>
          </div>
          <div className="scene-system-diagram-selection-grid">
            <div className="scene-system-diagram-selection-item">
              <label>{zhCN.sceneControl.systemDiagramSelectionSystemType}</label>
              <strong>{selectedNode.systemType}</strong>
            </div>
            <div className="scene-system-diagram-selection-item">
              <label>{zhCN.sceneControl.systemDiagramSelectionInstances}</label>
              <strong>{selectedNode.instanceCount || 1}</strong>
            </div>
            <div className="scene-system-diagram-selection-item">
              <label>{zhCN.sceneControl.systemDiagramSelectionPrimaryDevice}</label>
              <strong>
                {selectedNode.primaryDeviceId
                  ? `${selectedNode.primaryDeviceLabel || zhCN.common.unknown} · ${selectedNode.primaryDeviceId}`
                  : zhCN.sceneControl.systemDiagramSelectionNotBound}
              </strong>
            </div>
            <div className="scene-system-diagram-selection-item">
              <label>{zhCN.systemOverview.labels.status}</label>
              <strong>{getNodeStatusLabel(selectedNode.status)}</strong>
            </div>
          </div>
          {devicePageHref ? (
            <a className="scene-system-diagram-link" href={devicePageHref}>
              {zhCN.sceneControl.systemDiagramOpenDevicePage}
            </a>
          ) : null}
        </div>
      ) : null}

      <div className="scene-system-diagram-legend">
        <div className="scene-system-diagram-legend-item">
          <span style={{ background: "#69e4ff" }} />
          <small>{zhCN.sceneControl.systemDiagramLegendChilledSupply}</small>
        </div>
        <div className="scene-system-diagram-legend-item">
          <span style={{ background: "#38a9ff" }} />
          <small>{zhCN.sceneControl.systemDiagramLegendChilledReturn}</small>
        </div>
        <div className="scene-system-diagram-legend-item">
          <span style={{ background: "#8ff7d7" }} />
          <small>{zhCN.sceneControl.systemDiagramLegendCoolingSupply}</small>
        </div>
        <div className="scene-system-diagram-legend-item">
          <span style={{ background: "#ffc56d" }} />
          <small>{zhCN.sceneControl.systemDiagramLegendCoolingReturn}</small>
        </div>
      </div>

      <div className="scene-system-diagram-reading-note">
        <strong>{zhCN.sceneControl.systemDiagramReadingTitle}</strong>
        <ul>
          <li>{zhCN.sceneControl.systemDiagramReadingCluster}</li>
          <li>{zhCN.sceneControl.systemDiagramReadingPrimary}</li>
          <li>{zhCN.sceneControl.systemDiagramReadingValve}</li>
        </ul>
      </div>
    </section>
  );
}
