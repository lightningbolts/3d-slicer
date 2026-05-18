import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AmbientLight,
  AxesHelper,
  Box3,
  Color,
  DirectionalLight,
  DoubleSide,
  GridHelper,
  Group,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Plane,
  PlaneGeometry,
  PerspectiveCamera,
  Scene,
  Vector3,
  WebGLRenderer,
} from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { BufferGeometry } from 'three';
import type { OrbitControls as OrbitControlsType } from 'three/addons/controls/OrbitControls.js';
import type { SliceBounds, SliceResult } from '../types/slicer';
import {
  applyViewPreset,
  fitCameraToBox,
  type ViewPresetId,
} from '../view/cameraViews';
import {
  buildSliceContourGroup,
  planeCenterFromBounds,
  planeSpanFromBounds,
} from '../view/sliceContours3d';

interface ModelViewerProps {
  geometry: BufferGeometry | null;
  slice?: SliceResult | null;
  sliceBounds?: SliceBounds | null;
  clipZ?: number | null;
  activeLayerIndex?: number;
  slicing?: boolean;
  sliceProgress?: number;
}

const VIEW_PRESETS: { id: ViewPresetId; label: string; title: string }[] = [
  { id: 'home', label: '⌂', title: 'Home / iso (H)' },
  { id: 'top', label: 'T', title: 'Top — look down +Z' },
  { id: 'bottom', label: 'B', title: 'Bottom — look up −Z' },
  { id: 'front', label: 'F', title: 'Front — from −Y' },
  { id: 'back', label: 'K', title: 'Back — from +Y' },
  { id: 'left', label: 'L', title: 'Left — from −X' },
  { id: 'right', label: 'R', title: 'Right — from +X' },
];

const PRESET_KEYS: Record<string, ViewPresetId> = {
  h: 'home',
  t: 'top',
  b: 'bottom',
  f: 'front',
  k: 'back',
  l: 'left',
  r: 'right',
};

function disposeGroup(group: Group) {
  group.traverse((obj) => {
    if (obj instanceof Mesh || obj instanceof LineSegments) {
      obj.geometry.dispose();
      const mat = obj.material;
      if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
      else mat.dispose();
    }
  });
}

export function ModelViewer({
  geometry,
  slice = null,
  sliceBounds = null,
  clipZ = null,
  activeLayerIndex = 0,
  slicing = false,
  sliceProgress = 0,
}: ModelViewerProps) {
  const shellRef = useRef<HTMLDivElement>(null);
  const canvasHostRef = useRef<HTMLDivElement>(null);
  const meshRef = useRef<Mesh | null>(null);
  const sceneRef = useRef<Scene | null>(null);
  const cameraRef = useRef<PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControlsType | null>(null);
  const rendererRef = useRef<WebGLRenderer | null>(null);
  const helpersRef = useRef<{ grid: GridHelper; axes: AxesHelper } | null>(null);
  const frameBoxRef = useRef<Box3 | null>(null);
  const clipPlaneRef = useRef<Plane>(new Plane(new Vector3(0, 0, -1), 0));
  const zPlaneMeshRef = useRef<Mesh | null>(null);
  const planeCenterRef = useRef({ x: 0, y: 0 });
  const contourGroupRef = useRef<Group | null>(null);
  const viewerFocusedRef = useRef(false);
  const goToPresetRef = useRef<(preset: ViewPresetId) => void>(() => {});
  const [activePreset, setActivePreset] = useState<ViewPresetId | null>('home');

  const goToPreset = useCallback((preset: ViewPresetId) => {
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    const box = frameBoxRef.current;
    if (!camera || !controls || !box) return;
    applyViewPreset(camera, controls, box, preset);
    setActivePreset(preset);
  }, []);

  goToPresetRef.current = goToPreset;

  useEffect(() => {
    const host = canvasHostRef.current;
    if (!host) return;

    const scene = new Scene();
    scene.background = new Color(0x1a1d24);
    sceneRef.current = scene;

    const camera = new PerspectiveCamera(45, 1, 0.1, 5000);
    camera.up.set(0, 0, 1);
    camera.position.set(120, 90, 90);
    cameraRef.current = camera;

    const renderer = new WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x1a1d24);
    renderer.localClippingEnabled = true;
    rendererRef.current = renderer;

    const canvas = renderer.domElement;
    host.appendChild(canvas);

    const controls = new OrbitControls(camera, canvas);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.rotateSpeed = 0.9;
    controls.screenSpacePanning = true;
    controls.target.set(0, 0, 30);
    controlsRef.current = controls;

    const onControlStart = () => setActivePreset(null);
    controls.addEventListener('start', onControlStart);

    const onDblClick = (event: MouseEvent) => {
      event.preventDefault();
      goToPresetRef.current('home');
    };
    canvas.addEventListener('dblclick', onDblClick);

    scene.add(new AmbientLight(0xffffff, 0.55));
    const key = new DirectionalLight(0xffffff, 0.85);
    key.position.set(50, 80, 60);
    scene.add(key);

    const grid = new GridHelper(200, 20, 0x3d4452, 0x2a2f3a);
    grid.rotation.x = Math.PI / 2;
    scene.add(grid);
    const axes = new AxesHelper(40);
    scene.add(axes);
    helpersRef.current = { grid, axes };

    let frameId = 0;
    const tick = () => {
      frameId = requestAnimationFrame(tick);
      const w = Math.max(1, host.clientWidth);
      const h = Math.max(1, host.clientHeight);
      if (camera.aspect !== w / h) {
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
      }
      renderer.setSize(w, h);
      controls.update();
      renderer.render(scene, camera);
    };
    tick();

    return () => {
      cancelAnimationFrame(frameId);
      controls.removeEventListener('start', onControlStart);
      canvas.removeEventListener('dblclick', onDblClick);
      controls.dispose();
      renderer.dispose();
      host.removeChild(canvas);
      sceneRef.current = null;
      cameraRef.current = null;
      controlsRef.current = null;
      rendererRef.current = null;
      helpersRef.current = null;
      meshRef.current = null;
      frameBoxRef.current = null;
      zPlaneMeshRef.current = null;
      contourGroupRef.current = null;
    };
  }, []);

  useEffect(() => {
    const scene = sceneRef.current;
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    const host = canvasHostRef.current;
    if (!scene || !camera || !controls || !host) return;

    if (meshRef.current) {
      scene.remove(meshRef.current);
      meshRef.current.geometry.dispose();
      (meshRef.current.material as MeshStandardMaterial).dispose();
      meshRef.current = null;
    }

    if (!geometry) {
      frameBoxRef.current = null;
      return;
    }

    geometry.computeBoundingBox();
    const material = new MeshStandardMaterial({
      color: 0x4f8cff,
      metalness: 0.15,
      roughness: 0.45,
      flatShading: true,
      clippingPlanes: [],
    });
    const mesh = new Mesh(geometry, material);
    scene.add(mesh);
    meshRef.current = mesh;

    const box = new Box3().setFromObject(mesh);
    frameBoxRef.current = box.clone();
    const size = box.getSize(new Vector3());
    const maxDim = Math.max(size.x, size.y, size.z, 40);
    const gridSpan = Math.max(100, Math.ceil((maxDim * 2.2) / 50) * 50);

    const orbitDistance = Math.max(size.x, size.y, size.z, 1) * 1.5;
    controls.minDistance = Math.max(5, orbitDistance * 0.05);
    controls.maxDistance = Math.max(500, orbitDistance * 8);

    const helpers = helpersRef.current;
    if (helpers) {
      scene.remove(helpers.grid, helpers.axes);
      helpers.grid.geometry.dispose();
      (helpers.grid.material as { dispose: () => void }).dispose();
      helpers.axes.dispose();
    }
    const grid = new GridHelper(gridSpan, 20, 0x3d4452, 0x2a2f3a);
    grid.rotation.x = Math.PI / 2;
    scene.add(grid);
    const axes = new AxesHelper(Math.max(25, maxDim * 0.4));
    scene.add(axes);
    helpersRef.current = { grid, axes };

    let cancelled = false;
    const frameOnce = () => {
      if (cancelled || !meshRef.current) return;
      const w = host.clientWidth;
      const h = host.clientHeight;
      if (w < 16 || h < 16) {
        requestAnimationFrame(frameOnce);
        return;
      }
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      const frameBox = new Box3().setFromObject(meshRef.current);
      frameBoxRef.current = frameBox.clone();
      fitCameraToBox(camera, controls, frameBox);
      setActivePreset('home');
    };
    requestAnimationFrame(() => requestAnimationFrame(frameOnce));

    return () => {
      cancelled = true;
    };
  }, [geometry]);

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    if (zPlaneMeshRef.current) {
      scene.remove(zPlaneMeshRef.current);
      zPlaneMeshRef.current.geometry.dispose();
      (zPlaneMeshRef.current.material as MeshBasicMaterial).dispose();
      zPlaneMeshRef.current = null;
    }

    if (!sliceBounds) return;

    const span = planeSpanFromBounds(sliceBounds);
    const center = planeCenterFromBounds(sliceBounds);
    planeCenterRef.current = center;

    const planeMat = new MeshBasicMaterial({
      color: 0x5eead4,
      transparent: true,
      opacity: 0.16,
      side: DoubleSide,
      depthWrite: false,
    });
    const zPlane = new Mesh(new PlaneGeometry(span, span), planeMat);
    zPlane.visible = false;
    scene.add(zPlane);
    zPlaneMeshRef.current = zPlane;

    return () => {
      if (zPlaneMeshRef.current) {
        scene.remove(zPlaneMeshRef.current);
        zPlaneMeshRef.current.geometry.dispose();
        (zPlaneMeshRef.current.material as MeshBasicMaterial).dispose();
        zPlaneMeshRef.current = null;
      }
    };
  }, [sliceBounds]);

  useEffect(() => {
    const zPlane = zPlaneMeshRef.current;
    const planeMat = zPlane?.material as MeshBasicMaterial | undefined;
    if (planeMat) {
      planeMat.opacity = slicing ? 0.22 : 0.14;
    }
  }, [slicing]);

  useEffect(() => {
    const mesh = meshRef.current;
    const clipPlane = clipPlaneRef.current;
    const zPlane = zPlaneMeshRef.current;
    const center = planeCenterRef.current;

    if (mesh) {
      const material = mesh.material as MeshStandardMaterial;
      if (clipZ !== null) {
        clipPlane.constant = clipZ;
        material.clippingPlanes = [clipPlane];
      } else {
        material.clippingPlanes = [];
      }
      material.needsUpdate = true;
    }

    if (zPlane) {
      if (clipZ !== null) {
        zPlane.position.set(center.x, center.y, clipZ);
        zPlane.visible = true;
      } else {
        zPlane.visible = false;
      }
    }
  }, [clipZ]);

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    if (contourGroupRef.current) {
      scene.remove(contourGroupRef.current);
      disposeGroup(contourGroupRef.current);
      contourGroupRef.current = null;
    }

    if (slicing || !slice || clipZ === null) return;

    const contours = buildSliceContourGroup(slice.layers, activeLayerIndex);
    if (contours.children.length > 0) {
      scene.add(contours);
      contourGroupRef.current = contours;
    }

    return () => {
      if (contourGroupRef.current) {
        scene.remove(contourGroupRef.current);
        disposeGroup(contourGroupRef.current);
        contourGroupRef.current = null;
      }
    };
  }, [slice, activeLayerIndex, slicing, clipZ]);

  useEffect(() => {
    const shell = shellRef.current;
    if (!shell) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (!viewerFocusedRef.current) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const preset = PRESET_KEYS[event.key.toLowerCase()];
      if (!preset) return;
      event.preventDefault();
      goToPreset(preset);
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [goToPreset]);

  return (
    <div
      ref={shellRef}
      className={`model-viewer${slicing ? ' model-viewer--slicing' : ''}`}
      onPointerEnter={() => {
        viewerFocusedRef.current = true;
      }}
      onPointerLeave={() => {
        viewerFocusedRef.current = false;
      }}
    >
      <div ref={canvasHostRef} className="model-viewer-canvas" />
      <div className="viewer-toolbar" role="toolbar" aria-label="Camera views">
        {VIEW_PRESETS.map(({ id, label, title }) => (
          <button
            key={id}
            type="button"
            className={`viewer-view-btn${activePreset === id ? ' viewer-view-btn--active' : ''}`}
            title={title}
            aria-label={title}
            aria-pressed={activePreset === id}
            onClick={() => goToPreset(id)}
          >
            {label}
          </button>
        ))}
      </div>
      {slicing && clipZ !== null && (
        <div className="slicing-progress" aria-hidden>
          <div
            className="slicing-progress-bar"
            style={{ width: `${Math.round(sliceProgress * 100)}%` }}
          />
        </div>
      )}
      <p className="viewer-hint">
        Drag orbit · Scroll zoom · Right-drag pan · Shift+drag pan · Double-click home
        {clipZ !== null ? ` · Z plane ${clipZ.toFixed(2)} mm` : ''}
      </p>
    </div>
  );
}