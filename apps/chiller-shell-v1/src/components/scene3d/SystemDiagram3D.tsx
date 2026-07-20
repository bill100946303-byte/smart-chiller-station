import { useEffect, useMemo, useRef, useState } from "react";
import {
  AmbientLight,
  BackSide,
  Box3,
  BoxGeometry,
  CanvasTexture,
  CapsuleGeometry,
  CatmullRomCurve3,
  CircleGeometry,
  Color,
  CylinderGeometry,
  DirectionalLight,
  DoubleSide,
  EdgesGeometry,
  FogExp2,
  GridHelper,
  Group,
  HemisphereLight,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  type Object3D,
  PerspectiveCamera,
  PlaneGeometry,
  Raycaster,
  RepeatWrapping,
  RingGeometry,
  Scene,
  SphereGeometry,
  Sprite,
  SpriteMaterial,
  SRGBColorSpace,
  TorusGeometry,
  TorusKnotGeometry,
  TubeGeometry,
  Vector2,
  Vector3,
  WebGLRenderer
} from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import {
  getDeviceModelByCategory,
  type DeviceModelCategory
} from "../../config/modelRegistry";
import { zhCN } from "../../i18n/zhCN";
import {
  resolveSystemDiagramFlowVisualState,
  type SystemDiagramFlowVisualState
} from "./systemDiagramFlow";
import { buildSystemDiagramLayout } from "./systemDiagramLayout";
import SystemDiagramInspector, {
  getSystemDiagramStatusLabel,
  getSystemDiagramTypeLabel
} from "./SystemDiagramInspector";
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
  operationalEvidence?: boolean;
};

type SystemDiagramViewMode = "all" | "chilled" | "cooling";

type HoverState = {
  nodeId: string;
  x: number;
  y: number;
} | null;

type FlowMaterialAnimation = {
  mesh: Mesh;
  texture: CanvasTexture;
  material: MeshBasicMaterial;
  offset: number;
  speed: number;
  direction: 1 | -1;
  active: boolean;
  activeOpacity: number;
};

type DiagramLabelEntry = {
  sprite: Sprite;
  node: SystemDiagramResolvedNode;
  selected: boolean;
  worldPosition: Vector3;
  projectedPosition: Vector3;
};

type ScreenLabelBox = {
  left: number;
  right: number;
  top: number;
  bottom: number;
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
const modelPrototypeCache = new Map<DeviceModelCategory, Promise<Object3D>>();

function loadModelPrototype(category: DeviceModelCategory): Promise<Object3D> {
  const cached = modelPrototypeCache.get(category);
  if (cached) {
    return cached;
  }

  const descriptor = getDeviceModelByCategory(category);
  const pending = new Promise<Object3D>((resolve, reject) => {
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

function getViewModeLabel(viewMode: SystemDiagramViewMode) {
  if (viewMode === "chilled") {
    return zhCN.sceneControl.systemDiagramFilterChilled;
  }
  if (viewMode === "cooling") {
    return zhCN.sceneControl.systemDiagramFilterCooling;
  }
  return zhCN.sceneControl.systemDiagramFilterAll;
}

function createLabelSprite(title: string, subtitle: string, color: string, selected = false) {
  const canvas = document.createElement("canvas");
  canvas.width = 640;
  canvas.height = 184;
  const context = canvas.getContext("2d");
  if (!context) {
    return null;
  }

  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = selected ? "rgba(8, 38, 55, 0.96)" : "rgba(6, 22, 41, 0.86)";
  context.strokeStyle = selected ? color : "rgba(105, 228, 255, 0.22)";
  context.lineWidth = selected ? 8 : 4;
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

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  const material = new SpriteMaterial({
    map: texture,
    transparent: true
  });
  const sprite = new Sprite(material);
  sprite.scale.set(3.4, 0.98, 1);
  return sprite;
}

function screenLabelBoxesOverlap(left: ScreenLabelBox, right: ScreenLabelBox, gap = 8): boolean {
  return !(
    left.right + gap <= right.left ||
    left.left >= right.right + gap ||
    left.bottom + gap <= right.top ||
    left.top >= right.bottom + gap
  );
}

function updateDiagramLabelVisibility(
  entries: DiagramLabelEntry[],
  camera: PerspectiveCamera,
  renderer: WebGLRenderer
) {
  const viewportWidth = renderer.domElement.clientWidth || 320;
  const viewportHeight = renderer.domElement.clientHeight || 260;
  const compactViewport = viewportWidth < 760;
  const maxDistance = compactViewport ? 22 : 30;
  const acceptedBoxes: ScreenLabelBox[] = [];

  const projectedEntries = entries
    .map((entry) => {
      entry.sprite.getWorldPosition(entry.worldPosition);
      entry.projectedPosition.copy(entry.worldPosition).project(camera);
      return {
        entry,
        distance: camera.position.distanceTo(entry.worldPosition),
        x: (entry.projectedPosition.x * 0.5 + 0.5) * viewportWidth,
        y: (-entry.projectedPosition.y * 0.5 + 0.5) * viewportHeight,
        depth: entry.projectedPosition.z
      };
    })
    .sort((left, right) => {
      if (left.entry.selected !== right.entry.selected) {
        return left.entry.selected ? -1 : 1;
      }
      const leftAlert = left.entry.node.status === "alert";
      const rightAlert = right.entry.node.status === "alert";
      if (leftAlert !== rightAlert) {
        return leftAlert ? -1 : 1;
      }
      return left.distance - right.distance;
    });

  projectedEntries.forEach(({ entry, distance, x, y, depth }) => {
    const labelWidth = entry.selected ? (compactViewport ? 142 : 176) : (compactViewport ? 112 : 146);
    const labelHeight = entry.selected ? 48 : 40;
    const box: ScreenLabelBox = {
      left: x - labelWidth / 2,
      right: x + labelWidth / 2,
      top: y - labelHeight / 2,
      bottom: y + labelHeight / 2
    };
    const outsideViewport =
      depth < -1 ||
      depth > 1 ||
      box.right < 8 ||
      box.left > viewportWidth - 8 ||
      box.bottom < 8 ||
      box.top > viewportHeight - 8;
    const distanceHidden = !entry.selected && distance > maxDistance;
    const collisionHidden = !entry.selected && acceptedBoxes.some((accepted) => screenLabelBoxesOverlap(box, accepted));
    const visible = !outsideViewport && !distanceHidden && !collisionHidden;

    entry.sprite.visible = visible;
    if (visible) {
      acceptedBoxes.push(box);
    }
  });
}

function createPipeCurve(points: Vector3[]) {
  return new CatmullRomCurve3(points, false, "catmullrom", 0.02);
}

function createPipeMesh(curve: CatmullRomCurve3, color: number, options?: { radius?: number; opacity?: number }) {
  const geometry = new TubeGeometry(curve, 64, options?.radius ?? 0.09, 14, false);
  const material = new MeshStandardMaterial({
    color,
    transparent: typeof options?.opacity === "number",
    opacity: options?.opacity ?? 1,
    metalness: 0.28,
    roughness: 0.42,
    emissive: color,
    emissiveIntensity: 0.12
  });
  return new Mesh(geometry, material);
}

function createLoopDeck(width: number, depth: number, color: number) {
  const group = new Group();
  const surface = new Mesh(
    new PlaneGeometry(width, depth),
    new MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.12,
      side: DoubleSide
    })
  );
  surface.rotation.x = -Math.PI / 2;
  surface.position.y = 0.015;
  group.add(surface);

  const innerSurface = new Mesh(
    new PlaneGeometry(width * 0.92, depth * 0.84),
    new MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.06,
      side: DoubleSide
    })
  );
  innerSurface.rotation.x = -Math.PI / 2;
  innerSurface.position.y = 0.022;
  group.add(innerSurface);

  const outline = new LineSegments(
    new EdgesGeometry(new PlaneGeometry(width, depth)),
    new LineBasicMaterial({
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

function createFlowArrowTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 64;
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Unable to create water-flow arrow texture");
  }
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.strokeStyle = "rgba(255,255,255,0.96)";
  context.lineWidth = 9;
  context.lineCap = "round";
  context.lineJoin = "round";
  for (let x = 12; x <= 236; x += 56) {
    context.beginPath();
    context.moveTo(x, 12);
    context.lineTo(x + 24, 32);
    context.lineTo(x, 52);
    context.stroke();
  }
  const texture = new CanvasTexture(canvas);
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.colorSpace = SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function createScrollingFlowOverlay(
  curve: CatmullRomCurve3,
  color: number,
  state: SystemDiagramFlowVisualState,
  offset: number
): FlowMaterialAnimation {
  const texture = createFlowArrowTexture();
  texture.repeat.set(Math.max(2, curve.getLength() / 1.5), 1);
  const material = new MeshBasicMaterial({
    map: texture,
    color,
    transparent: true,
    opacity: state.active ? state.activeOpacity : 0.1,
    depthWrite: false
  });
  const mesh = new Mesh(new TubeGeometry(curve, 64, 0.108, 10, false), material);
  mesh.renderOrder = 5;
  return { mesh, texture, material, offset, ...state };
}

function fitModelToNode(model: Object3D, targetHeight: number) {
  const modelRoot = new Group();
  modelRoot.add(model);
  const box = new Box3().setFromObject(modelRoot);
  const size = box.getSize(new Vector3());
  const center = box.getCenter(new Vector3());
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
    new Vector3(fromNode.position[0], 0.9, fromNode.position[2]),
    ...(edge.via || []).map(([x, y, z]) => new Vector3(x, y, z)),
    new Vector3(toNode.position[0], 0.9, toNode.position[2])
  ];
  return points;
}

function createFallbackGeometry(category: SystemDiagramRenderableCategory) {
  if (category === "load") {
    return new BoxGeometry(2.2, 0.92, 1.8);
  }
  if (category === "valve") {
    return new TorusKnotGeometry(0.36, 0.12, 64, 10);
  }
  if (category === "pump") {
    return new CapsuleGeometry(0.26, 0.9, 8, 14);
  }
  if (category === "cooling-tower") {
    return new CylinderGeometry(0.52, 0.78, 1.2, 18);
  }
  return new BoxGeometry(1.4, 0.8, 3);
}

export default function SystemDiagram3D({
  topology,
  selectedNodeId = null,
  onNodeSelect,
  devicePageHref = null,
  operationalEvidence = true
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
  const selectedNodeStatusLabel = getSystemDiagramStatusLabel(selectedNode, operationalEvidence);
  const modelBindingState = !operationalEvidence
    ? "sample-generic"
    : selectedNode?.primaryDeviceId
      ? "bound-generic"
      : "unbound-generic";
  const modelBindingLabel = modelBindingState === "sample-generic"
    ? "样例拓扑 · 通用设备模型"
    : modelBindingState === "bound-generic"
      ? "现场点位已关联 · 通用设备模型"
      : "设备绑定待确认 · 通用设备模型";
  const shellDeviceValue = operationalEvidence
    ? selectedNode?.primaryDeviceId || getSystemDiagramTypeLabel(selectedNode)
    : zhCN.sceneControl.systemDiagramSampleDevice;
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

    const renderer = new WebGLRenderer({
      alpha: true,
      antialias: true
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    renderer.outputColorSpace = SRGBColorSpace;
    mountNode.appendChild(renderer.domElement);

    const scene = new Scene();
    scene.fog = new FogExp2(0x07172b, 0.026);

    const camera = new PerspectiveCamera(34, width / height, 0.1, 160);
    camera.position.set(0.8, 8.8, 17.2);
    camera.lookAt(0, 1.8, 0.4);

    const ambientLight = new AmbientLight(0xffffff, 1.55);
    const hemiLight = new HemisphereLight(0xbfe7ff, 0x04111d, 1.2);
    const keyLight = new DirectionalLight(0xc3ecff, 2.4);
    keyLight.position.set(9, 11, 7);
    const fillLight = new DirectionalLight(0xffffff, 1.3);
    fillLight.position.set(-8, 5, -6);
    const rimLight = new DirectionalLight(0x69e4ff, 1.1);
    rimLight.position.set(0, 7, -10);
    scene.add(ambientLight, hemiLight, keyLight, fillLight, rimLight);

    const atmosphere = new Mesh(
      new SphereGeometry(34, 32, 32),
      new MeshBasicMaterial({
        color: 0x0a1d33,
        side: BackSide,
        transparent: true,
        opacity: 0.32
      })
    );
    atmosphere.position.set(0, 8.5, 0);
    scene.add(atmosphere);

    const root = new Group();
    scene.add(root);
    const raycaster = new Raycaster();
    const pointer = new Vector2();
    const clickTargets: Object3D[] = [];

    const ground = new Mesh(
      new CircleGeometry(12.5, 64),
      new MeshBasicMaterial({
        color: 0x0a2645,
        transparent: true,
        opacity: 0.5
      })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.02;
    root.add(ground);

    const innerGround = new Mesh(
      new RingGeometry(8.2, 10.4, 56),
      new MeshBasicMaterial({
        color: 0x3b7ad4,
        transparent: true,
        opacity: 0.12,
        side: DoubleSide
      })
    );
    innerGround.rotation.x = -Math.PI / 2;
    innerGround.position.y = -0.01;
    root.add(innerGround);

    const grid = new GridHelper(24, 18, 0x2d6f91, 0x163753);
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
    const flowMaterials: FlowMaterialAnimation[] = [];
    const animatedRings: Array<{ mesh: Mesh; baseScale: number }> = [];
    const animatedBeacons: Mesh[] = [];
    const diagramLabels: DiagramLabelEntry[] = [];

    resolved.edges.forEach((edge, edgeIndex) => {
      const points = buildEdgePoints(edge, nodesById);
      if (!points) {
        return;
      }
      const color = PIPE_COLORS[edge.kind];
      const curve = createPipeCurve(points);
      root.add(createPipeMesh(curve, color));
      root.add(createPipeMesh(curve, color, { radius: 0.16, opacity: 0.12 }));
      const flowOverlay = createScrollingFlowOverlay(
        curve,
        color,
        resolveSystemDiagramFlowVisualState(edge),
        (edgeIndex * 0.173) % 1
      );
      root.add(flowOverlay.mesh);
      flowMaterials.push(flowOverlay);
    });

    let disposed = false;
    let animationFrame = 0;
    let resizeFrame = 0;

    resolved.nodes.forEach((node) => {
      const anchor = new Group();
      anchor.position.set(node.position[0], node.position[1], node.position[2]);
      root.add(anchor);
      const isSelected = selectedNodeId === node.id;
      const nodeStatusColor = operationalEvidence ? NODE_STATUS_COLORS[node.status] : "#e4b464";
      const statusColor = new Color(nodeStatusColor);

      const pad = new Mesh(
        new CylinderGeometry(0.88, 1, 0.14, 24),
        new MeshStandardMaterial({
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

      const halo = new Mesh(
        new RingGeometry(1.2, 1.42, 42),
        new MeshBasicMaterial({
          color: statusColor,
          transparent: true,
          opacity: isSelected ? 0.62 : 0.14,
          side: DoubleSide
        })
      );
      halo.rotation.x = -Math.PI / 2;
      halo.position.y = 0.02;
      anchor.add(halo);

      const ring = new Mesh(
        new TorusGeometry(1.08, 0.05, 10, 36),
        new MeshBasicMaterial({
          color: statusColor,
          transparent: true,
          opacity: isSelected ? 1 : 0.82
        })
      );
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 0.16;
      ring.scale.setScalar(isSelected ? 1.08 : 1);
      anchor.add(ring);
      animatedRings.push({ mesh: ring, baseScale: isSelected ? 1.08 : 1 });
      ring.userData.systemNodeId = node.id;
      clickTargets.push(ring);

      const beaconStem = new Mesh(
        new CylinderGeometry(0.02, 0.02, node.targetHeight + 0.42, 10, 1, true),
        new MeshBasicMaterial({
          color: statusColor,
          transparent: true,
          opacity: isSelected ? 0.22 : 0.12
        })
      );
      beaconStem.position.y = (node.targetHeight + 0.42) / 2 + 0.14;
      anchor.add(beaconStem);

      const beacon = new Mesh(
        new SphereGeometry(0.13, 18, 18),
        new MeshBasicMaterial({
          color: statusColor,
          transparent: true,
          opacity: 0.92
        })
      );
      beacon.position.set(0, node.targetHeight + 0.62, 0);
      anchor.add(beacon);
      animatedBeacons.push(beacon);

      const label = createLabelSprite(
        node.label,
        `${isSelected ? `${zhCN.sceneControl.systemDiagramSelected} · ` : ""}${getSystemDiagramTypeLabel(node)} · ${node.instanceCount || 1} ${zhCN.sceneControl.systemDiagramUnit}`,
        nodeStatusColor,
        isSelected
      );
      if (label) {
        label.position.set(0, node.targetHeight + 1.55, 0);
        anchor.add(label);
        diagramLabels.push({
          sprite: label,
          node,
          selected: isSelected,
          worldPosition: new Vector3(),
          projectedPosition: new Vector3()
        });
      }
      const instanceOffsets = buildInstanceOffsets(node.instanceCount || 1);

      const fallbackGroup = new Group();
      instanceOffsets.forEach((instance) => {
        const fallback = new Mesh(
          createFallbackGeometry(node.category),
          new MeshStandardMaterial({
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

          const modelGroup = new Group();
          instanceOffsets.forEach((instance) => {
            const clone = prototype.clone(true);
            const fitted = fitModelToNode(clone, node.targetHeight * instance.scale);
            fitted.rotation.y = node.rotationY;
            fitted.position.set(instance.x, 0, instance.z);
            fitted.traverse((child: Object3D) => {
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
      camera.updateMatrixWorld();
      root.updateMatrixWorld(true);
      updateDiagramLabelVisibility(diagramLabels, camera, renderer);

      animatedRings.forEach((item, index) => {
        const pulse = 1 + Math.sin(time * 0.004 + index) * 0.04;
        item.mesh.scale.setScalar(item.baseScale * pulse);
      });

      animatedBeacons.forEach((beacon, index) => {
        const pulse = 1 + Math.sin(time * 0.005 + index) * 0.12;
        beacon.scale.setScalar(pulse);
      });

      flowMaterials.forEach((flow) => {
        flow.material.opacity = flow.active ? flow.activeOpacity : 0.1;
        if (flow.active) {
          const nextOffset = flow.offset - time * 0.0001 * flow.speed * flow.direction;
          flow.texture.offset.x = ((nextOffset % 1) + 1) % 1;
        }
      });

      renderer.render(scene, camera);
    };
    renderLoop();

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
        camera.updateProjectionMatrix();
      });
    });
    resizeObserver.observe(mountNode);

    return () => {
      disposed = true;
      window.cancelAnimationFrame(animationFrame);
      window.cancelAnimationFrame(resizeFrame);
      resizeObserver.disconnect();
      renderer.domElement.removeEventListener("pointerdown", handlePointerDown);
      renderer.domElement.removeEventListener("pointermove", handlePointerMove);
      renderer.domElement.removeEventListener("pointerleave", handlePointerLeave);
      flowMaterials.forEach((flow) => {
        flow.texture.dispose();
        flow.material.dispose();
        flow.mesh.geometry.dispose();
      });
      renderer.dispose();
      root.clear();
      mountNode.innerHTML = "";
    };
  }, [onNodeSelect, operationalEvidence, resolved, selectedNodeId]);

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
                ? `${getSystemDiagramTypeLabel(selectedNode)} · ${operationalEvidence
                  ? selectedNode.primaryDeviceLabel || zhCN.sceneControl.systemDiagramSelectionNotBound
                  : zhCN.sceneControl.systemDiagramSampleDevice}`
                : resolved.description}
            </small>
          </div>
          <div className="scene-system-diagram-shell-chip-group">
            <span className="scene-system-diagram-shell-chip">{selectedNodeStatusLabel}</span>
            <span className="scene-system-diagram-shell-chip">{shellDeviceValue}</span>
            <span className="scene-system-diagram-shell-chip" data-model-binding={modelBindingState}>
              {modelBindingLabel}
            </span>
          </div>
        </div>
        <div className="scene-system-diagram-shell-zones">
          <span className={viewMode === "cooling" ? "scene-system-diagram-shell-zone is-muted" : "scene-system-diagram-shell-zone"}>
            {zhCN.sceneControl.systemDiagramFilterChilled}
          </span>
          <span className="scene-system-diagram-shell-zone">{zhCN.sceneControl.systemDiagramLoadSide}</span>
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
            <small>{getSystemDiagramTypeLabel(hoveredNode)}</small>
            <div className="scene-system-diagram-hover-meta">
              <span>{getSystemDiagramStatusLabel(hoveredNode, operationalEvidence)}</span>
              {operationalEvidence && hoveredNode.primaryDeviceId ? <span>{hoveredNode.primaryDeviceId}</span> : null}
            </div>
          </div>
        ) : null}
        <div className="scene-system-diagram-shell-footer">
          <span>
            {operationalEvidence
              ? selectedNode?.primaryDeviceLabel || resolved.title
              : zhCN.sceneControl.systemDiagramSampleDevice}
          </span>
          <strong>
            {nodeCount} {zhCN.sceneControl.systemDiagramNodes} / {edgeCount} {zhCN.sceneControl.systemDiagramEdges}
          </strong>
        </div>
      </div>

      <SystemDiagramInspector
        selectedNode={selectedNode}
        devicePageHref={devicePageHref}
        operationalEvidence={operationalEvidence}
      />
    </section>
  );
}
