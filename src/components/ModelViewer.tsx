import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AmbientLight,
  AxesHelper,
  Box3,
  Color,
  DirectionalLight,
  GridHelper,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  Scene,
  Vector3,
  WebGLRenderer,
} from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { BufferGeometry } from 'three';
import type { OrbitControls as OrbitControlsType } from 'three/addons/controls/OrbitControls.js';
import {
  applyViewPreset,
  fitCameraToBox,
  type ViewPresetId,
} from '../view/cameraViews';

interface ModelViewerProps {
  geometry: BufferGeometry | null;
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

export function ModelViewer({ geometry }: ModelViewerProps) {
  const shellRef = useRef<HTMLDivElement>(null);
  const canvasHostRef = useRef<HTMLDivElement>(null);
  const meshRef = useRef<Mesh | null>(null);
  const sceneRef = useRef<Scene | null>(null);
  const cameraRef = useRef<PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControlsType | null>(null);
  const rendererRef = useRef<WebGLRenderer | null>(null);
  const helpersRef = useRef<{ grid: GridHelper; axes: AxesHelper } | null>(null);
  const frameBoxRef = useRef<Box3 | null>(null);
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

    // Bed is XY at z = 0 (slicer uses Z-up).
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
    });
    const mesh = new Mesh(geometry, material);
    scene.add(mesh);
    meshRef.current = mesh;

    const box = new Box3().setFromObject(mesh);
    frameBoxRef.current = box.clone();
    const size = box.getSize(new Vector3());
    const maxDim = Math.max(size.x, size.y, size.z, 40);
    const gridSpan = Math.max(100, Math.ceil((maxDim * 2.2) / 50) * 50);

    const orbitDistance =
      Math.max(size.x, size.y, size.z, 1) * 1.5;
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
      className="model-viewer"
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
      <p className="viewer-hint">
        Drag orbit · Scroll zoom · Right-drag pan · Shift+drag pan · Double-click home
      </p>
    </div>
  );
}

