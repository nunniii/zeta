import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

type CircleData = {
  a: number;
  b: number;
  r2: number;
};

type CircleDivisorAtomProps = {
  n: number;
};

function getParesDivisores(n: number): [number, number][] {
  const pares: [number, number][] = [];

  for (let d = 1; d * d <= n; d++) {
    if (n % d === 0) {
      pares.push([d, n / d]);
    }
  }

  return pares;
}

function simplifySqrt(n: number) {
  if (n === 0) {
    return {
      coefficient: 0,
      radicand: 1,
    };
  }

  let coefficient = 1;
  let radicand = n;

  for (let i = Math.floor(Math.sqrt(n)); i >= 2; i--) {
    const square = i * i;

    if (n % square === 0) {
      coefficient = i;
      radicand = n / square;
      break;
    }
  }

  return {
    coefficient,
    radicand,
  };
}

function formatSqrt(n: number) {
  const { coefficient, radicand } = simplifySqrt(n);

  if (radicand === 1) {
    return `${coefficient}`;
  }

  if (coefficient === 1) {
    return `√${radicand}`;
  }

  return `${coefficient}√${radicand}`;
}

function formatSqrtMultiple(multiplier: number, n: number) {
  const { coefficient, radicand } = simplifySqrt(n);
  const value = multiplier * coefficient;

  if (radicand === 1) {
    return `${value}`;
  }

  if (value === 1) {
    return `√${radicand}`;
  }

  return `${value}√${radicand}`;
}

function getCircles(n: number): CircleData[] {
  return getParesDivisores(n).map(([a, b]) => ({
    a,
    b,
    r2: a * a + b * b,
  }));
}

function getIntegerPoints(r2: number): [number, number][] {
  const points: [number, number][] = [];
  const limit = Math.floor(Math.sqrt(r2));

  for (let x = -limit; x <= limit; x++) {
    for (let y = -limit; y <= limit; y++) {
      if (x * x + y * y === r2) {
        points.push([x, y]);
      }
    }
  }

  return points;
}

const COLORS = [
  0xB6DB00,
  0xE5F0FE,
  0x4B75FF,
  0xFF94DB,
  0x566700,
];

export function CircleDivisorAtom({
  n,
}: CircleDivisorAtomProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const circles = useMemo(
    () => getCircles(n),
    [n]
  );

  useEffect(() => {
    const container = containerRef.current;

    if (!container) return;

    // =========================================================
    // SCENE
    // =========================================================

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000422);

    // =========================================================
    // CAMERA
    // =========================================================

    const maxRadius = Math.max(
      ...circles.map((circle) => Math.sqrt(circle.r2)),
      1
    );

    const camera = new THREE.PerspectiveCamera(
      45,
      container.clientWidth / container.clientHeight,
      0.1,
      1000
    );

    camera.position.set(
      maxRadius * 2.4,
      maxRadius * 1.8,
      maxRadius * 2.4
    );

    // =========================================================
    // RENDERER
    // =========================================================

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
    });

    renderer.setPixelRatio(
      Math.min(window.devicePixelRatio, 2)
    );

    renderer.setSize(
      container.clientWidth,
      container.clientHeight
    );

    renderer.outputColorSpace =
      THREE.SRGBColorSpace;

    container.appendChild(renderer.domElement);

    // =========================================================
    // CONTROLS
    // =========================================================

    const controls = new OrbitControls(
      camera,
      renderer.domElement
    );

    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.minDistance = 2;
    controls.maxDistance = maxRadius * 10;

    // =========================================================
    // GRUPO PRINCIPAL
    // =========================================================

    const atomGroup = new THREE.Group();
    scene.add(atomGroup);

    // =========================================================
    // ESFERAS
    // =========================================================

    const sphereGeometry = new THREE.SphereGeometry(
      Math.max(maxRadius * 0.010, 0.06),
      20,
      20
    );

    // =========================================================
    // CÍRCULOS
    // =========================================================

    circles.forEach((circle, index) => {
      const radius = Math.sqrt(circle.r2);
      const arcColor = COLORS[index % COLORS.length];
      const pointColor = 0xffffff;

      // -------------------------------------------------------
      // ARGOLA
      // -------------------------------------------------------

      const segments = 256;
      const circlePoints: THREE.Vector3[] = [];

      for (let i = 0; i < segments; i++) {
        const theta = (i / segments) * Math.PI * 2;

        circlePoints.push(
          new THREE.Vector3(
            radius * Math.cos(theta),
            radius * Math.sin(theta),
            0
          )
        );
      }

      const circleGeometry =
        new THREE.BufferGeometry().setFromPoints(
          circlePoints
        );

      const circleMaterial =
        new THREE.LineBasicMaterial({
          color: arcColor,
          transparent: true,
          opacity: 0.9,
        });

      const torus = new THREE.LineLoop(
        circleGeometry,
        circleMaterial
      );

      // -------------------------------------------------------
      // INCLINAÇÃO
      // -------------------------------------------------------

      const angle = index * 1.1;

      torus.rotation.x =
        Math.PI *
        0.25 *
        Math.sin(angle);

      torus.rotation.y =
        Math.PI *
        0.35 *
        Math.cos(angle);

      torus.rotation.z =
        Math.PI *
        0.20 *
        Math.sin(angle * 1.7);

      atomGroup.add(torus);

      // -------------------------------------------------------
      // PONTOS INTEIROS
      // -------------------------------------------------------

      const integerPoints =
        getIntegerPoints(circle.r2);

      integerPoints.forEach(([x, y]) => {
        /*
         * Posição matemática original:
         *
         * x² + y² = r²
         */

        const point = new THREE.Vector3(
          x,
          y,
          0
        );

        /*
         * Aplica a mesma rotação da argola.
         */

        point.applyEuler(torus.rotation);

        // -----------------------------------------------------
        // ESFERA
        // -----------------------------------------------------

        const sphereMaterial =
          new THREE.MeshStandardMaterial({
            color: pointColor,
            emissive: pointColor,
            emissiveIntensity: 0.8,
            roughness: 0.2,
            metalness: 0.1,
          });

        const sphere = new THREE.Mesh(
          sphereGeometry,
          sphereMaterial
        );

        sphere.position.copy(point);
        atomGroup.add(sphere);
      });
    });

    // =========================================================
    // NÚCLEO / ORIGEM
    // =========================================================

    const nucleusGeometry =
      new THREE.SphereGeometry(
        Math.max(maxRadius * 0.07, 0.1),
        32,
        32
      );

    const nucleusMaterial =
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        emissive: 0xffffff,
        emissiveIntensity: 1.5,
      });

    const nucleus = new THREE.Mesh(
      nucleusGeometry,
      nucleusMaterial
    );

    nucleus.position.set(0, 0, 0);
    atomGroup.add(nucleus);

    // =========================================================
    // RESIZE
    // =========================================================

    function handleResize() {
      if (!container) return;

      const width = container.clientWidth;
      const height = container.clientHeight;

      camera.aspect = width / height;
      camera.updateProjectionMatrix();

      renderer.setSize(width, height);
    }

    window.addEventListener(
      "resize",
      handleResize
    );

    // =========================================================
    // ANIMAÇÃO
    // =========================================================

    let animationId = 0;

    function animate() {
      animationId =
        requestAnimationFrame(animate);

      controls.update();

      renderer.render(
        scene,
        camera
      );
    }

    animate();

    // =========================================================
    // CLEANUP
    // =========================================================

    return () => {
      cancelAnimationFrame(animationId);

      window.removeEventListener(
        "resize",
        handleResize
      );

      controls.dispose();

      scene.traverse((object) => {
        if (
          object instanceof THREE.Mesh ||
          object instanceof THREE.Line
        ) {
          object.geometry.dispose();

          if (Array.isArray(object.material)) {
            object.material.forEach(
              (material) => material.dispose()
            );
          } else {
            object.material.dispose();
          }
        }
      });

      renderer.dispose();

      if (
        container.contains(
          renderer.domElement
        )
      ) {
        container.removeChild(
          renderer.domElement
        );
      }
    };
  }, [circles]);

  return (
    <div className="mb-3">

      <div className="flex items-center justify-between mb-3">
        <p className="text-zinc-400 text-sm">
          Modelo tridimensional das circunferências
        </p>

        <span className="text-zinc-500 text-xs">
          n = {n}
        </span>
      </div>

      <div
        ref={containerRef}
        className="w-full h-100 rounded-lg overflow-hidden select-none bg-[#000422]"
      />

      <div className="mt-4 space-y-2">

        {circles.map((circle, index) => (
          <div
            key={`${circle.r2}-${index}`}
            className="flex items-center gap-5 text-sm"
          >

            {/* Cor */}
            <div
              className="w-3 h-3 rounded-full shrink-0"
              style={{
                backgroundColor:
                  `#${COLORS[index % COLORS.length]
                    .toString(16)
                    .padStart(6, "0")}`,
              }}
            />

            {/* Raio */}
            <span className="text-zinc-300 font-mono">
              r={formatSqrt(circle.r2)}
            </span>

            {/* Diâmetro */}
            <span className="text-zinc-300 font-mono">
              d={formatSqrtMultiple(2, circle.r2)}
            </span>

            {/* Circunferência */}
            <span className="text-zinc-300 font-mono">
              C={formatSqrtMultiple(2, circle.r2)}π
            </span>

            {/* Área */}
            <span className="text-zinc-300 font-mono">
              A={circle.r2}π
            </span>

          </div>
        ))}

      </div>
    </div>
  );
}