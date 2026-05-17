import { useEffect, useRef } from 'react';
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

interface ModelViewerProps {
  geometry: BufferGeometry | null;
}

/** Frame camera so `box` is centered in view (orbit target = bbox center). */
function fitCameraToBox(
  camera: PerspectiveCamera,
  controls: OrbitControlsType,
  box: Box3,
): void {
  const center = new Vector3();
  const size = new Vector3();
  box.getCenter(center);
  box.getSize(size);

  const maxDim = Math.max(size.x, size.y, size.z, 1);
  const fovRad = (camera.fov * Math.PI) / 180;
  const distance =
    (maxDim / (2 * Math.tan(fovRad / 2))) * Math.max(1, 1 / Math.max(camera.aspect, 0.25)) * 1.35;

  controls.target.copy(center);
  camera.position.set(
    center.x + distance * 0.75,
    center.y + distance * 0.75,
    center.z + distance * 0.55,
  );
  camera.near = Math.max(0.1, distance / 200);
  camera.far = Math.max(2000, distance * 20);
  camera.updateProjectionMatrix();
  controls.update();
}

export function ModelViewer({ geometry }: ModelViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const meshRef = useRef<Mesh | null>(null);
  const sceneRef = useRef<Scene | null>(null);
  const cameraRef = useRef<PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControlsType | null>(null);
  const rendererRef = useRef<WebGLRenderer | null>(null);
  const helpersRef = useRef<{ grid: GridHelper; axes: AxesHelper } | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const scene = new Scene();
    scene.background = new Color(0x1a1d24);
    sceneRef.current = scene;

    const camera = new PerspectiveCamera(45, 1, 0.1, 5000);
    camera.position.set(120, 90, 90);
    cameraRef.current = camera;

    const renderer = new WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x1a1d24);
    rendererRef.current = renderer;

    const canvas = renderer.domElement;
    container.appendChild(canvas);

    const controls = new OrbitControls(camera, canvas);
    controls.enableDamping = true;
    controls.target.set(0, 0, 30);
    controlsRef.current = controls;

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
      const w = Math.max(1, container.clientWidth);
      const h = Math.max(1, container.clientHeight);
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
      controls.dispose();
      renderer.dispose();
      container.removeChild(canvas);
      sceneRef.current = null;
      cameraRef.current = null;
      controlsRef.current = null;
      rendererRef.current = null;
      helpersRef.current = null;
      meshRef.current = null;
    };
  }, []);

  useEffect(() => {
    const scene = sceneRef.current;
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    const container = containerRef.current;
    if (!scene || !camera || !controls || !container) return;

    if (meshRef.current) {
      scene.remove(meshRef.current);
      meshRef.current.geometry.dispose();
      (meshRef.current.material as MeshStandardMaterial).dispose();
      meshRef.current = null;
    }

    if (!geometry) return;

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
    const size = box.getSize(new Vector3());
    const maxDim = Math.max(size.x, size.y, size.z, 40);
    const gridSpan = Math.max(100, Math.ceil((maxDim * 2.2) / 50) * 50);

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
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (w < 16 || h < 16) {
        requestAnimationFrame(frameOnce);
        return;
      }
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      fitCameraToBox(camera, controls, new Box3().setFromObject(meshRef.current));
    };
    requestAnimationFrame(() => requestAnimationFrame(frameOnce));

    return () => {
      cancelled = true;
    };
  }, [geometry]);

  return <div ref={containerRef} className="model-viewer" />;
}
