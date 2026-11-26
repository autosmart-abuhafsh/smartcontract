import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  RotateCcw,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2,
  Layers,
  Upload,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  CheckCircle2,
  Box,
} from 'lucide-react';
import { BimElementSpec, BimModelVersion, Project, RoleId } from '../logic/smartbuildEngine';

interface Bim3DViewerProps {
  projects: Project[];
  selectedProjectId: string;
  onSelectProject: (id: string) => void;
  bimModels: BimModelVersion[];
  bimElementsByProject: Record<string, BimElementSpec[]>;
  activeRole: RoleId;
  activeUserId: string;
  onModelUploaded: () => void;
}

const DEFAULT_BIM_ELEMENTS: BimElementSpec[] = [
  {
    id: 'el-foundation-slab',
    name: 'Pondasi Tapak & Tie Beam Sloof K-350',
    objectType: 'IfcFooting / Reinforced Concrete Foundation',
    ifcCategory: 'IFCFOOTING',
    material: 'Beton Bertulang K-350 + Baja Tulangan Ulir BJTS 420B',
    dimensions: '24.0 m × 16.0 m × 1.2 m (16 Titik Footplat 180×180 cm)',
    volumeM3: 118.5,
    linkedStage: 'foundation',
    stageLabel: 'Tahap Pondasi',
    completionPercent: 100,
    technicalSpec: 'Kuat tekan rata-rata 368 kg/cm², lulus pemeriksaan Project Supervisor.',
  },
  {
    id: 'el-structure-columns',
    name: 'Kolom Utama Pedestal & Portal Baja WF 400×200',
    objectType: 'IfcColumn & IfcBeam Structural Frame',
    ifcCategory: 'IFCCOLUMN / IFCBEAM',
    material: 'Baja Struktural SS400 + Baut Mutu Tinggi HTB A325',
    dimensions: '16 Kolom Tinggi 8.5 m · Bentang Portal 24.0 m',
    volumeM3: 64.2,
    linkedStage: 'structure',
    stageLabel: 'Tahap Struktur',
    completionPercent: 100,
    technicalSpec: 'Sambungan las lulus NDT Ultrasonic 100%, lendutan izin < L/360.',
  },
  {
    id: 'el-walls-acoustic',
    name: 'Dinding Bata Ringan AAC & Panel Akustik Rockwool',
    objectType: 'IfcWallStandardCase',
    ifcCategory: 'IFCWALL',
    material: 'Bata Ringan AAC t=15cm + Rockwool 80 kg/m³',
    dimensions: 'Keliling 80.0 m × Tinggi 7.5 m',
    volumeM3: 90.0,
    linkedStage: 'walls',
    stageLabel: 'Tahap Dinding',
    completionPercent: 20,
    technicalSpec: 'Pasangan dinding terintegrasi insulasi akustik STC >= 52 dB.',
  },
  {
    id: 'el-roof-truss',
    name: 'Rangka Atap Space Truss & Penutup Zincalume Berinsulasi',
    objectType: 'IfcRoof / Steel Space Frame',
    ifcCategory: 'IFCROOF',
    material: 'Baja Galvalum High-Tensile G550 + Insulasi Termal PU Foam',
    dimensions: '25.2 m × 17.2 m · Kemiringan 18°',
    volumeM3: 42.0,
    linkedStage: 'roof',
    stageLabel: 'Tahap Atap',
    completionPercent: 20,
    technicalSpec: 'Rangka atap baja bentang lebar dengan gording C-channel.',
  },
  {
    id: 'el-finishing-facade',
    name: 'Fasad Kaca Curtain Wall, Kanopi Entrance & Lantai Epoksi',
    objectType: 'IfcCurtainWall & IfcCovering',
    ifcCategory: 'IFCCURTAINWALL',
    material: 'Double Tempered Glass Low-E 12mm + Aluminium Anodized',
    dimensions: 'Area Entrance 14.0 m × 6.5 m',
    volumeM3: 28.4,
    linkedStage: 'finishing',
    stageLabel: 'Tahap Finishing',
    completionPercent: 0,
    technicalSpec: 'Kaca fasad depan dan kanopi arsitektural.',
  },
];

export const Bim3DViewer: React.FC<Bim3DViewerProps> = ({
  projects,
  selectedProjectId,
  onSelectProject,
  bimModels,
  bimElementsByProject,
  activeRole,
  activeUserId,
  onModelUploaded,
}) => {
  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const viewerContainerRef = useRef<HTMLDivElement | null>(null);

  const projectModels = bimModels.filter((m) => m.projectId === selectedProjectId);
  const [selectedVersionId, setSelectedVersionId] = useState<string>(
    projectModels[0]?.id || ''
  );
  const [stageFilter, setStageFilter] = useState<
    'ALL' | 'foundation' | 'structure' | 'walls' | 'roof' | 'finishing'
  >('ALL');
  const [explodedFactor, setExplodedFactor] = useState<number>(0);
  const [selectedElement, setSelectedElement] = useState<BimElementSpec | null>(null);
  const [dockCollapsed, setDockCollapsed] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  // Upload & Error Simulation states (Bagian 25.G PRD: Upload GLB, Model tidak ditemukan, File tidak valid)
  const [uploadFileName, setUploadFileName] = useState<string>('');
  const [uploadVersion, setUploadVersion] = useState<string>('');
  const [uploadNotes, setUploadNotes] = useState<string>('');
  const [uploadError, setUploadError] = useState<string>('');
  const [uploadSuccess, setUploadSuccess] = useState<string>('');

  const elements = bimElementsByProject[selectedProjectId] || DEFAULT_BIM_ELEMENTS;

  useEffect(() => {
    const models = bimModels.filter((m) => m.projectId === selectedProjectId);
    setSelectedVersionId(models[0]?.id || '');
    setSelectedElement(elements[0] || null);
  }, [selectedProjectId, bimModels]);

  // Mutable refs for Three.js scene orchestration without tearing down WebGL context
  const sceneApiRef = useRef<{
    setFilter: (stage: string) => void;
    setExplode: (val: number) => void;
    zoomBy: (delta: number) => void;
    rotateBy: (angle: number) => void;
    resetCamera: () => void;
    selectByStage: (stage: string) => void;
  } | null>(null);

  const elementsRef = useRef<BimElementSpec[]>(elements);
  elementsRef.current = elements;

  useEffect(() => {
    const container = canvasMountRef.current;
    if (!container) return;

    // 1. Software-WebGL detection from GPU renderer string (Three.js Skill Directive 2.1)
    const isSoftwareGl = (() => {
      const probeCanvas = document.createElement('canvas');
      const gl = probeCanvas.getContext('webgl2');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    const width = container.clientWidth || 960;
    const height = container.clientHeight || 520;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0b192c);
    scene.fog = new THREE.FogExp2(0x0b192c, 0.012);

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.5, 250);
    camera.position.set(22, 16, 24);

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // 2. Studio Environment Map (RoomEnvironment + PMREMGenerator)
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    pmremGenerator.dispose();

    // 3. Warm/Cool 3-Point Studio Lighting Rig
    const hemiLight = new THREE.HemisphereLight(0xdbeafe, 0x1e293b, 0.85);
    hemiLight.position.set(0, 30, 0);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xfff7ed, 1.6);
    keyLight.position.set(24, 34, 20);
    keyLight.castShadow = !isSoftwareGl;
    if (!isSoftwareGl) {
      keyLight.shadow.mapSize.set(1024, 1024);
      keyLight.shadow.camera.left = -22;
      keyLight.shadow.camera.right = 22;
      keyLight.shadow.camera.top = 22;
      keyLight.shadow.camera.bottom = -22;
      keyLight.shadow.bias = -0.0005;
      keyLight.shadow.normalBias = 0.02;
    }
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x38bdf8, 0.65);
    rimLight.position.set(-22, 18, -20);
    scene.add(rimLight);

    // 4. Procedural Ground Pad, Contact Shadow Disc & Engineering Grid (Disjoint Y offsets >= 0.02)
    const groundGeo = new THREE.PlaneGeometry(90, 90);
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.9,
      metalness: 0.1,
    });
    const groundMesh = new THREE.Mesh(groundGeo, groundMat);
    groundMesh.rotation.x = -Math.PI / 2;
    groundMesh.position.y = -0.04;
    groundMesh.receiveShadow = true;
    scene.add(groundMesh);

    const contactShadowGeo = new THREE.CircleGeometry(17, 32);
    const contactShadowMat = new THREE.MeshBasicMaterial({
      color: 0x020617,
      transparent: true,
      opacity: 0.45,
      depthWrite: false,
    });
    const contactShadow = new THREE.Mesh(contactShadowGeo, contactShadowMat);
    contactShadow.rotation.x = -Math.PI / 2;
    contactShadow.position.y = -0.015;
    scene.add(contactShadow);

    const gridHelper = new THREE.GridHelper(48, 24, 0x38bdf8, 0x1e3a5f);
    gridHelper.position.y = 0.0;
    scene.add(gridHelper);

    // 5. Composite Multi-Part BIM Building Hierarchy (5 Stage Groups, 12+ parts)
    const buildingRoot = new THREE.Group();
    scene.add(buildingRoot);

    const stageGroups: Record<string, THREE.Group> = {
      foundation: new THREE.Group(),
      structure: new THREE.Group(),
      walls: new THREE.Group(),
      roof: new THREE.Group(),
      finishing: new THREE.Group(),
    };
    const interactables: THREE.Mesh[] = [];

    const registerPart = (mesh: THREE.Mesh, stageKey: string) => {
      mesh.castShadow = !isSoftwareGl;
      mesh.receiveShadow = !isSoftwareGl;
      mesh.userData.stageKey = stageKey;
      stageGroups[stageKey].add(mesh);
      interactables.push(mesh);
    };

    // --- Stage 1: Foundation (Footings, Pad Slab & Tie Beams) ---
    const concreteMat = new THREE.MeshStandardMaterial({
      color: 0x10b981,
      roughness: 0.8,
      metalness: 0.15,
    });
    const padSlab = new THREE.Mesh(new THREE.BoxGeometry(18, 0.5, 12), concreteMat.clone());
    padSlab.position.set(0, 0.25, 0);
    registerPart(padSlab, 'foundation');

    const footGeo = new THREE.BoxGeometry(1.6, 0.45, 1.6);
    const colPositions = [
      [-7.5, -4.8],
      [-2.5, -4.8],
      [2.5, -4.8],
      [7.5, -4.8],
      [-7.5, 4.8],
      [-2.5, 4.8],
      [2.5, 4.8],
      [7.5, 4.8],
    ];
    for (const [cx, cz] of colPositions) {
      const footing = new THREE.Mesh(footGeo, concreteMat.clone());
      footing.position.set(cx, 0.65, cz);
      registerPart(footing, 'foundation');
    }

    // --- Stage 2: Structure (Steel WF Columns, Longitudinal & Transverse Beams) ---
    const steelMat = new THREE.MeshStandardMaterial({
      color: 0x0284c7,
      roughness: 0.32,
      metalness: 0.78,
    });
    const colGeo = new THREE.BoxGeometry(0.55, 6.2, 0.55);
    for (const [cx, cz] of colPositions) {
      const col = new THREE.Mesh(colGeo, steelMat.clone());
      col.position.set(cx, 3.8, cz);
      registerPart(col, 'structure');
    }

    const longBeamGeo = new THREE.BoxGeometry(16, 0.45, 0.45);
    for (const cz of [-4.8, 4.8]) {
      const beamTop = new THREE.Mesh(longBeamGeo, steelMat.clone());
      beamTop.position.set(0, 6.8, cz);
      registerPart(beamTop, 'structure');

      const beamMid = new THREE.Mesh(longBeamGeo, steelMat.clone());
      beamMid.position.set(0, 3.6, cz);
      registerPart(beamMid, 'structure');
    }

    const crossBeamGeo = new THREE.BoxGeometry(0.42, 0.45, 10.2);
    for (const cx of [-7.5, -2.5, 2.5, 7.5]) {
      const cBeam = new THREE.Mesh(crossBeamGeo, steelMat.clone());
      cBeam.position.set(cx, 6.8, 0);
      registerPart(cBeam, 'structure');
    }

    // --- Stage 3: Walls (Acoustic AAC Wall Panels) ---
    const wallMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      roughness: 0.68,
      metalness: 0.12,
    });
    const backWall = new THREE.Mesh(new THREE.BoxGeometry(14.6, 5.8, 0.32), wallMat.clone());
    backWall.position.set(0, 3.6, -4.8);
    registerPart(backWall, 'walls');

    const leftWall = new THREE.Mesh(new THREE.BoxGeometry(0.32, 5.8, 9.2), wallMat.clone());
    leftWall.position.set(-7.5, 3.6, 0);
    registerPart(leftWall, 'walls');

    const rightWall = new THREE.Mesh(new THREE.BoxGeometry(0.32, 5.8, 9.2), wallMat.clone());
    rightWall.position.set(7.5, 3.6, 0);
    registerPart(rightWall, 'walls');

    // --- Stage 4: Roof (Pitched Steel Space Truss & Insulated Roof Slabs) ---
    const roofMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      roughness: 0.4,
      metalness: 0.55,
    });
    const roofSlopeGeo = new THREE.BoxGeometry(16.8, 0.28, 6.2);
    const roofNorth = new THREE.Mesh(roofSlopeGeo, roofMat.clone());
    roofNorth.position.set(0, 8.15, -2.65);
    roofNorth.rotation.x = 0.36;
    registerPart(roofNorth, 'roof');

    const roofSouth = new THREE.Mesh(roofSlopeGeo, roofMat.clone());
    roofSouth.position.set(0, 8.15, 2.65);
    roofSouth.rotation.x = -0.36;
    registerPart(roofSouth, 'roof');

    const ridgeBeam = new THREE.Mesh(
      new THREE.BoxGeometry(17.0, 0.4, 0.5),
      roofMat.clone()
    );
    ridgeBeam.position.set(0, 9.15, 0);
    registerPart(ridgeBeam, 'roof');

    // --- Stage 5: Finishing (Front Low-E Glass Curtain Wall & Entrance Canopy) ---
    const glassMat = new THREE.MeshPhysicalMaterial({
      color: 0xbae6fd,
      roughness: 0.15,
      metalness: 0.1,
      transparent: true,
      opacity: 0.48,
      depthWrite: false,
    });
    const frontFacade = new THREE.Mesh(new THREE.BoxGeometry(14.2, 5.6, 0.2), glassMat.clone());
    frontFacade.position.set(0, 3.6, 4.82);
    frontFacade.renderOrder = 2;
    registerPart(frontFacade, 'finishing');

    const entranceCanopy = new THREE.Mesh(
      new THREE.BoxGeometry(6.5, 0.25, 2.6),
      new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.3, metalness: 0.65 })
    );
    entranceCanopy.position.set(0, 4.1, 6.1);
    registerPart(entranceCanopy, 'finishing');

    Object.values(stageGroups).forEach((grp) => buildingRoot.add(grp));

    // OrbitControls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 3.8, 0);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.07;
    controls.minDistance = 8;
    controls.maxDistance = 65;
    controls.maxPolarAngle = Math.PI / 2 - 0.03;

    // Software-WebGL Paced On-Demand Render Pipeline (Three.js Skill Directive 2.3)
    let frameId = 0;
    let renderBusy = false;
    let renderDirty = false;
    let targetExplode = 0;
    let currentExplode = 0;

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      if (gl && typeof gl.fenceSync === 'function') {
        const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
        gl.flush();
        const poll = () => {
          const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
          if (state === gl.UNSIGNALED) {
            frameId = window.setTimeout(poll, 5);
          } else {
            gl.deleteSync(sync);
            frameId = window.setTimeout(cb, 80);
          }
        };
        frameId = window.setTimeout(poll, 5);
      } else {
        frameId = window.setTimeout(cb, 80);
      }
    }

    function applyExplodeOffsets(factor: number) {
      stageGroups.foundation.position.y = 0;
      stageGroups.structure.position.y = factor * 1.4;
      stageGroups.walls.position.y = factor * 2.8;
      stageGroups.finishing.position.y = factor * 3.4;
      stageGroups.finishing.position.z = factor * 1.8;
      stageGroups.roof.position.y = factor * 4.8;
    }

    function requestRender() {
      if (renderBusy) {
        renderDirty = true;
        return;
      }
      renderBusy = true;
      frameId = requestAnimationFrame(() => {
        renderDirty = false;
        if (Math.abs(targetExplode - currentExplode) > 0.005) {
          currentExplode = THREE.MathUtils.damp(currentExplode, targetExplode, 10, 0.03);
          applyExplodeOffsets(currentExplode);
          renderDirty = true;
        }
        controls.update();
        renderer.render(scene, camera);
        const done = () => {
          renderBusy = false;
          if (renderDirty) requestRender();
        };
        if (isSoftwareGl) afterDraw(done);
        else done();
      });
    }

    controls.addEventListener('change', requestRender);

    // Raycasting object selection
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();

    const highlightStage = (selectedStageKey: string | null) => {
      for (const mesh of interactables) {
        const mat = mesh.material as THREE.MeshStandardMaterial;
        if (selectedStageKey && mesh.userData.stageKey === selectedStageKey) {
          mat.emissive = new THREE.Color(0x1e40af);
          mat.emissiveIntensity = 0.45;
        } else {
          mat.emissive = new THREE.Color(0x000000);
          mat.emissiveIntensity = 0;
        }
      }
      requestRender();
    };

    const handleCanvasClick = (event: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const visibleMeshes = interactables.filter(
        (m) => stageGroups[m.userData.stageKey]?.visible !== false
      );
      const hits = raycaster.intersectObjects(visibleMeshes, false);
      if (hits.length > 0) {
        const hitStage = hits[0].object.userData.stageKey as string;
        highlightStage(hitStage);
        const foundSpec =
          elementsRef.current.find((el) => el.linkedStage === hitStage) ||
          elementsRef.current[0];
        if (foundSpec) {
          setSelectedElement(foundSpec);
        }
      }
    };

    renderer.domElement.addEventListener('click', handleCanvasClick);

    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth || 960;
      const h = container.clientHeight || 520;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      requestRender();
    };
    window.addEventListener('resize', handleResize);

    // Expose scene methods to React controls
    sceneApiRef.current = {
      setFilter: (stage: string) => {
        Object.entries(stageGroups).forEach(([key, grp]) => {
          grp.visible = stage === 'ALL' || key === stage;
        });
        if (stage !== 'ALL') {
          const spec = elementsRef.current.find((e) => e.linkedStage === stage);
          if (spec) setSelectedElement(spec);
        }
        requestRender();
      },
      setExplode: (val: number) => {
        targetExplode = val;
        requestRender();
      },
      zoomBy: (delta: number) => {
        const dir = new THREE.Vector3();
        camera.getWorldDirection(dir);
        camera.position.addScaledVector(dir, delta);
        requestRender();
      },
      rotateBy: (angle: number) => {
        const offset = camera.position.clone().sub(controls.target);
        offset.applyAxisAngle(new THREE.Vector3(0, 1, 0), angle);
        camera.position.copy(controls.target).add(offset);
        camera.lookAt(controls.target);
        requestRender();
      },
      resetCamera: () => {
        camera.position.set(22, 16, 24);
        controls.target.set(0, 3.8, 0);
        targetExplode = 0;
        setExplodedFactor(0);
        highlightStage(null);
        requestRender();
      },
      selectByStage: (stage: string) => {
        highlightStage(stage);
        const spec = elementsRef.current.find((e) => e.linkedStage === stage);
        if (spec) setSelectedElement(spec);
      },
    };

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }
    requestRender();

    return () => {
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      window.removeEventListener('resize', handleResize);
      renderer.domElement.removeEventListener('click', handleCanvasClick);
      controls.dispose();
      renderer.dispose();
    };
  }, []);

  const handleUploadBim = async (e: React.FormEvent) => {
    e.preventDefault();
    setUploadError('');
    setUploadSuccess('');

    if (!uploadFileName.trim()) {
      setUploadError('Masukkan nama file model 3D (.glb, .gltf, atau .ifc).');
      return;
    }

    try {
      const res = await fetch('/api/bim/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          actorRole: activeRole,
          actorId: activeUserId,
          projectId: selectedProjectId,
          versionNumber: uploadVersion || 'v2.2 (Pembaruan Lapangan)',
          fileName: uploadFileName.trim(),
          fileSizeMb: 19.2,
          notes: uploadNotes || 'Pembaruan model BIM 3D proyek.',
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setUploadError(data.error || 'Gagal mengunggah model BIM.');
      } else {
        setUploadSuccess(`Model BIM "${data.bimModel.fileName}" berhasil diunggah dan divalidasi.`);
        setUploadFileName('');
        setUploadVersion('');
        setUploadNotes('');
        onModelUploaded();
      }
    } catch {
      setUploadError('Kesalahan jaringan saat mengunggah model BIM.');
    }
  };

  const toggleFullscreen = () => {
    if (!viewerContainerRef.current) return;
    if (!document.fullscreenElement) {
      viewerContainerRef.current.requestFullscreen?.().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.().catch(() => {});
      setIsFullscreen(false);
    }
  };

  const currentModel = projectModels.find((m) => m.id === selectedVersionId) || projectModels[0];

  return (
    <div className="space-y-6">
      {/* Top Control & Project Selector Bar */}
      <div className="bg-white border border-slate-200 rounded-lg p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <label htmlFor="bim-project-select" className="block text-[11px] font-semibold text-slate-500">
              Proyek Konstruksi
            </label>
            <select
              id="bim-project-select"
              value={selectedProjectId}
              onChange={(e) => onSelectProject(e.target.value)}
              className="mt-1 px-3 py-1.5 text-xs font-semibold text-slate-900 bg-slate-50 border border-slate-300 rounded-md"
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.overallProgress}%)
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="bim-version-select" className="block text-[11px] font-semibold text-slate-500">
              Versi Model BIM (GLB / glTF)
            </label>
            <select
              id="bim-version-select"
              value={selectedVersionId}
              onChange={(e) => setSelectedVersionId(e.target.value)}
              className="mt-1 px-3 py-1.5 text-xs font-mono text-slate-900 bg-slate-50 border border-slate-300 rounded-md"
            >
              {projectModels.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.versionNumber} — {m.fileName} ({m.format})
                </option>
              ))}
              <option value="MISSING_MODEL_TEST">[Simulasi QA] Model Tidak Ditemukan (404 Guard)</option>
            </select>
          </div>
        </div>

        {/* Stage Integration Filter Buttons */}
        <div>
          <div className="text-[11px] font-semibold text-slate-500 mb-1">
            Filter Layer Tahapan Konstruksi
          </div>
          <div className="flex flex-wrap items-center gap-1 bg-slate-100 p-1 rounded-md">
            {[
              { id: 'ALL', label: 'Semua Tahap' },
              { id: 'foundation', label: '1. Pondasi' },
              { id: 'structure', label: '2. Struktur' },
              { id: 'walls', label: '3. Dinding' },
              { id: 'roof', label: '4. Atap' },
              { id: 'finishing', label: '5. Finishing' },
            ].map((st) => (
              <button
                key={st.id}
                type="button"
                onClick={() => {
                  setStageFilter(st.id as typeof stageFilter);
                  sceneApiRef.current?.setFilter(st.id);
                }}
                className={`px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 ${
                  stageFilter === st.id
                    ? 'bg-[#0B1E3D] text-white'
                    : 'text-slate-700 hover:bg-white'
                }`}
              >
                {st.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main 3D Viewport Container (Unobstructed Center + Collapsible Bottom Dock) */}
      <div
        ref={viewerContainerRef}
        className="relative w-full h-[520px] bg-[#0B192C] border border-slate-300 rounded-lg overflow-hidden"
        data-testid="bim-3d-viewport"
      >
        {/* Top-Left Minimal Spec Header */}
        <div className="absolute top-3 left-3 z-10 bg-slate-900/90 border border-slate-700 rounded-md px-3 py-2 text-xs text-slate-200 pointer-events-auto">
          <div className="font-semibold text-white">
            {currentModel ? currentModel.fileName : 'Model Tidak Ditemukan'}
          </div>
          <div className="text-[11px] font-mono text-slate-400">
            Format: {currentModel?.format || 'N/A'} · Klik elemen 3D untuk inspeksi parameter IFC
          </div>
        </div>

        {/* QA Fallback when user tests "Model Tidak Ditemukan" */}
        {selectedVersionId === 'MISSING_MODEL_TEST' && (
          <div className="absolute inset-0 z-20 bg-slate-950/95 flex flex-col items-center justify-center p-6 text-center text-white">
            <AlertCircle className="w-10 h-10 text-amber-400 mb-2" />
            <h3 className="text-base font-bold">Berkas Model BIM 3D Tidak Ditemukan</h3>
            <p className="text-xs text-slate-300 max-w-md mt-1">
              Sistem mendeteksi referensi model tidak tersedia di repositori penyimpanan proyek.
              Silakan pilih versi model yang valid atau unggah file .GLB / .glTF baru.
            </p>
            <button
              type="button"
              onClick={() => setSelectedVersionId(projectModels[0]?.id || '')}
              className="mt-4 px-4 py-2 text-xs font-semibold bg-sky-600 hover:bg-sky-500 text-white rounded-md"
            >
              Kembalikan ke Versi Aktif ({projectModels[0]?.versionNumber})
            </button>
          </div>
        )}

        {/* Isolated WebGL Canvas Mount Ref */}
        <div ref={canvasMountRef} className="w-full h-full" />

        {/* Collapsible Unified Bottom Control Dock (Zero backdrop-filter over WebGL) */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 w-[94%] max-w-[880px] pointer-events-auto">
          <div className="flex justify-center mb-1">
            <button
              type="button"
              onClick={() => setDockCollapsed((prev) => !prev)}
              className="inline-flex items-center gap-1 px-3 py-1 text-[11px] font-semibold text-slate-200 bg-slate-900 border border-slate-700 rounded-t-md hover:bg-slate-800"
            >
              {dockCollapsed ? (
                <>
                  <ChevronUp className="w-3.5 h-3.5" /> Tampilkan Kontrol 3D
                </>
              ) : (
                <>
                  <ChevronDown className="w-3.5 h-3.5" /> Sembunyikan Kontrol
                </>
              )}
            </button>
          </div>

          {!dockCollapsed && (
            <div className="bg-slate-900/95 border border-slate-700 rounded-lg px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-200">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => sceneApiRef.current?.rotateBy(-Math.PI / 6)}
                  aria-label="Putar 360 Kiri"
                  className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 rounded text-xs font-medium whitespace-nowrap shrink-0"
                >
                  Putar Kiri 30°
                </button>
                <button
                  type="button"
                  onClick={() => sceneApiRef.current?.rotateBy(Math.PI / 6)}
                  aria-label="Putar 360 Kanan"
                  className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 rounded text-xs font-medium whitespace-nowrap shrink-0"
                >
                  Putar Kanan 30°
                </button>
                <button
                  type="button"
                  onClick={() => sceneApiRef.current?.zoomBy(3.5)}
                  aria-label="Zoom In Model 3D"
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 rounded text-xs font-medium whitespace-nowrap shrink-0"
                >
                  <ZoomIn className="w-3.5 h-3.5" /> Zoom In
                </button>
                <button
                  type="button"
                  onClick={() => sceneApiRef.current?.zoomBy(-3.5)}
                  aria-label="Zoom Out Model 3D"
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 rounded text-xs font-medium whitespace-nowrap shrink-0"
                >
                  <ZoomOut className="w-3.5 h-3.5" /> Zoom Out
                </button>
              </div>

              {/* Exploded View Slider */}
              <div className="flex items-center gap-2">
                <Layers className="w-3.5 h-3.5 text-sky-400" />
                <label htmlFor="bim-explode-slider" className="text-[11px] font-medium text-slate-300">
                  Exploded View:
                </label>
                <input
                  id="bim-explode-slider"
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={explodedFactor}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    setExplodedFactor(val);
                    sceneApiRef.current?.setExplode(val);
                  }}
                  className="w-24 accent-sky-500"
                />
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => sceneApiRef.current?.resetCamera()}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 rounded text-xs font-medium whitespace-nowrap shrink-0"
                >
                  <RotateCcw className="w-3.5 h-3.5" /> Reset Kamera
                </button>
                <button
                  type="button"
                  onClick={toggleFullscreen}
                  aria-label="Layar Penuh BIM Viewer"
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-sky-700 hover:bg-sky-600 text-white rounded text-xs font-medium whitespace-nowrap shrink-0"
                >
                  {isFullscreen ? (
                    <Minimize2 className="w-3.5 h-3.5" />
                  ) : (
                    <Maximize2 className="w-3.5 h-3.5" />
                  )}
                  Fullscreen
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Inspection & Version Management Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Column 1: Selected BIM Object Metadata */}
        <div className="bg-white border border-slate-200 rounded-lg p-5">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3 mb-3">
            <h3 className="text-sm font-bold text-slate-900">
              Informasi Teknis Elemen BIM Terpilih
            </h3>
            <Box className="w-4 h-4 text-sky-700" />
          </div>

          {selectedElement ? (
            <div className="space-y-2.5 text-xs">
              <div>
                <div className="text-slate-500">Nama Objek</div>
                <div className="font-semibold text-slate-900">{selectedElement.name}</div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <div className="text-slate-500">Jenis Objek</div>
                  <div className="font-medium text-slate-800">{selectedElement.objectType}</div>
                </div>
                <div>
                  <div className="text-slate-500">Kategori IFC</div>
                  <div className="font-mono font-semibold text-sky-800">
                    {selectedElement.ifcCategory}
                  </div>
                </div>
              </div>
              <div>
                <div className="text-slate-500">Material & Mutu</div>
                <div className="font-medium text-slate-800">{selectedElement.material}</div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <div className="text-slate-500">Ukuran / Dimensi</div>
                  <div className="font-mono text-slate-800">{selectedElement.dimensions}</div>
                </div>
                <div>
                  <div className="text-slate-500">Volume Estimasi</div>
                  <div className="font-mono text-slate-800">{selectedElement.volumeM3} m³</div>
                </div>
              </div>
              <div className="pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-slate-600 font-medium">{selectedElement.stageLabel}</span>
                  <span className="font-mono font-bold text-slate-900">
                    {selectedElement.completionPercent}%
                  </span>
                </div>
                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-600"
                    style={{ width: `${selectedElement.completionPercent}%` }}
                  />
                </div>
                <p className="text-[11px] text-slate-500 mt-2">
                  Catatan Teknis: {selectedElement.technicalSpec}
                </p>
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-500">
              Klik salah satu elemen pada viewport 3D atau daftar komponen di samping untuk melihat
              parameter teknis BIM.
            </p>
          )}
        </div>

        {/* Column 2: Interactive Element Selector List & Disclaimer (Bagian 11.3 PRD) */}
        <div className="bg-white border border-slate-200 rounded-lg p-5 flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900 border-b border-slate-200 pb-3 mb-3">
              Daftar Komponen Bangunan & Integrasi Tahapan
            </h3>
            <div className="space-y-2">
              {elements.map((el) => (
                <button
                  key={el.id}
                  type="button"
                  onClick={() => {
                    setSelectedElement(el);
                    sceneApiRef.current?.selectByStage(el.linkedStage);
                  }}
                  className={`w-full text-left p-2.5 rounded-md border text-xs transition-colors flex items-center justify-between ${
                    selectedElement?.id === el.id
                      ? 'bg-sky-50 border-sky-300 text-slate-900'
                      : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <div>
                    <div className="font-semibold">{el.name}</div>
                    <div className="text-[11px] text-slate-500 font-mono">
                      {el.ifcCategory} · {el.stageLabel}
                    </div>
                  </div>
                  <span className="font-mono font-bold text-slate-900">
                    {el.completionPercent}%
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-md text-[11px] text-amber-900">
            <strong>Kepatuhan Teknis BIM (Bagian 11.3 PRD):</strong> Visualisasi model 3D BIM
            digunakan sebagai acuan desain dan pemetaan tahapan. Pemeriksaan kesesuaian kondisi
            aktual lapangan tetap wajib divalidasi oleh <strong>Project Supervisor</strong> yang
            berwenang.
          </div>
        </div>

        {/* Column 3: Upload GLB / glTF & Version History */}
        <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
          <h3 className="text-sm font-bold text-slate-900 border-b border-slate-200 pb-3">
            Unggah Versi Model BIM (.GLB / .glTF / .IFC)
          </h3>

          {uploadError && (
            <div
              role="alert"
              className="p-2.5 bg-red-50 border border-red-200 rounded text-xs text-red-800 flex items-start gap-2"
            >
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <span>{uploadError}</span>
            </div>
          )}

          {uploadSuccess && (
            <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded text-xs text-emerald-800 flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>{uploadSuccess}</span>
            </div>
          )}

          <form onSubmit={handleUploadBim} className="space-y-3 text-xs">
            <div>
              <label htmlFor="bim-file-name" className="block font-semibold text-slate-700 mb-1">
                Nama File Model (.glb / .gltf / .ifc)
              </label>
              <input
                id="bim-file-name"
                type="text"
                value={uploadFileName}
                onChange={(e) => setUploadFileName(e.target.value)}
                placeholder="Contoh: Gedung_Aula_v2.2.glb"
                className="w-full px-3 py-1.5 border border-slate-300 rounded-md font-mono"
              />
            </div>
            <div>
              <label htmlFor="bim-version-label" className="block font-semibold text-slate-700 mb-1">
                Label Versi Model
              </label>
              <input
                id="bim-version-label"
                type="text"
                value={uploadVersion}
                onChange={(e) => setUploadVersion(e.target.value)}
                placeholder="Contoh: v2.2 (Update Rangka Atap)"
                className="w-full px-3 py-1.5 border border-slate-300 rounded-md"
              />
            </div>
            <div>
              <label htmlFor="bim-notes" className="block font-semibold text-slate-700 mb-1">
                Catatan Revisi Model
              </label>
              <input
                id="bim-notes"
                type="text"
                value={uploadNotes}
                onChange={(e) => setUploadNotes(e.target.value)}
                placeholder="Deskripsi perubahan geometri BIM..."
                className="w-full px-3 py-1.5 border border-slate-300 rounded-md"
              />
            </div>
            <button
              type="submit"
              className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-[#0B1E3D] hover:bg-slate-800 text-white font-semibold rounded-md transition-colors"
            >
              <Upload className="w-3.5 h-3.5" />
              Unggah & Validasi Model BIM
            </button>
          </form>

          <div className="pt-2 border-t border-slate-200">
            <div className="text-xs font-bold text-slate-800 mb-2">Riwayat Versi Model</div>
            <div className="space-y-2 max-h-36 overflow-y-auto">
              {projectModels.map((ver) => (
                <div
                  key={ver.id}
                  className="p-2 bg-slate-50 border border-slate-200 rounded text-[11px]"
                >
                  <div className="font-semibold text-slate-900">{ver.versionNumber}</div>
                  <div className="font-mono text-slate-600">
                    {ver.fileName} · {ver.fileSizeMb} MB · {ver.uploadedAt}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
