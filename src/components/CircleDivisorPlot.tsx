
import { useMemo, useRef, useState } from "react";

type CircleData = {
  a: number;
  b: number;
  r2: number;
  radius: number;
};

type CircleDivisorPlotProps = {
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

function getCircles(n: number): CircleData[] {
  return getParesDivisores(n).map(([a, b]) => {
    const r2 = a * a + b * b;

    return {
      a,
      b,
      r2,
      radius: Math.sqrt(r2),
    };
  });
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

function formatEquation(r2: number): string {
  return `x² + y² = ${r2}`;
}

export function CircleDivisorPlot({
  n,
}: CircleDivisorPlotProps) {
  const circles = useMemo(() => getCircles(n), [n]);

  const width = 700;
  const height = 700;

  /*
   * Escala inicial baseada no maior círculo.
   */
  const maxRadius = Math.max(
    ...circles.map((circle) => circle.radius),
    1
  );

  const initialRange = maxRadius + 2;

  /*
   * Zoom:
   *
   * 1   = visão inicial
   * > 1 = zoom in
   * < 1 = zoom out
   */
  const [zoom, setZoom] = useState(1);

  /*
   * Deslocamento do centro da câmera.
   *
   * panX e panY estão em coordenadas matemáticas.
   */
  const [pan, setPan] = useState({
    x: 0,
    y: 0,
  });

  /*
   * Controle do arraste.
   */
  const dragging = useRef(false);

  const lastMouse = useRef({
    x: 0,
    y: 0,
  });

  /*
   * Escala matemática -> SVG.
   */
  const baseScale =
    Math.min(width, height) /
    (2 * initialRange);

  const scale = baseScale * zoom;

  /*
   * Centro visual do plano.
   */
  const cx = width / 2;
  const cy = height / 2;

  /*
   * Converte coordenadas matemáticas
   * para coordenadas SVG.
   */
  function screenX(x: number) {
    return cx + (x - pan.x) * scale;
  }

  function screenY(y: number) {
    return cy - (y - pan.y) * scale;
  }

  /*
   * Quantos pixels correspondem a uma
   * unidade matemática.
   */
  function handleWheel(
    event: React.WheelEvent<SVGSVGElement>
  ) {
    event.preventDefault();

    const rect =
      event.currentTarget.getBoundingClientRect();

    /*
     * Posição do mouse dentro do SVG.
     */
    const mouseX =
      ((event.clientX - rect.left) / rect.width) *
      width;

    const mouseY =
      ((event.clientY - rect.top) / rect.height) *
      height;

    /*
     * Coordenada matemática que está
     * exatamente sob o mouse.
     */
    const worldX =
      pan.x + (mouseX - cx) / scale;

    const worldY =
      pan.y - (mouseY - cy) / scale;

    /*
     * Zoom.
     */
    const factor =
      event.deltaY < 0 ? 1.15 : 1 / 1.15;

    const newZoom = Math.max(
      0.15,
      Math.min(50, zoom * factor)
    );

    const newScale = baseScale * newZoom;

    /*
     * Ajusta o pan para que o ponto
     * sob o cursor permaneça fixo.
     */
    const newPanX =
      worldX -
      (mouseX - cx) / newScale;

    const newPanY =
      worldY +
      (mouseY - cy) / newScale;

    setZoom(newZoom);

    setPan({
      x: newPanX,
      y: newPanY,
    });
  }

  /*
   * Início do pan.
   */
  function handleMouseDown(
    event: React.MouseEvent<SVGSVGElement>
  ) {
    dragging.current = true;

    lastMouse.current = {
      x: event.clientX,
      y: event.clientY,
    };
  }

  /*
   * Movimento durante o pan.
   */
  function handleMouseMove(
    event: React.MouseEvent<SVGSVGElement>
  ) {
    if (!dragging.current) return;

    const dx =
      event.clientX - lastMouse.current.x;

    const dy =
      event.clientY - lastMouse.current.y;

    /*
     * Converte pixels para coordenadas matemáticas.
     */
    const worldDx = dx / scale;
    const worldDy = dy / scale;

    setPan((previous) => ({
      x: previous.x - worldDx,
      y: previous.y + worldDy,
    }));

    lastMouse.current = {
      x: event.clientX,
      y: event.clientY,
    };
  }

  function handleMouseUp() {
    dragging.current = false;
  }

  /*
   * Retorna para a visão inicial.
   */
  function resetView() {
    setZoom(1);

    setPan({
      x: 0,
      y: 0,
    });
  }

  /*
   * Tamanho do grid.
   *
   * Calculamos dinamicamente quantas unidades
   * matemáticas estão visíveis.
   */
  const visibleRange =
    Math.max(width, height) /
    (2 * scale);

  const gridStartX = Math.floor(
    pan.x - visibleRange
  );

  const gridEndX = Math.ceil(
    pan.x + visibleRange
  );

  const gridStartY = Math.floor(
    pan.y - visibleRange
  );

  const gridEndY = Math.ceil(
    pan.y + visibleRange
  );

  /*
   * Pontos inteiros.
   */
  const circlePoints = circles.map((circle) => ({
    circle,
    points: getIntegerPoints(circle.r2),
  }));

  const colors = [
    "#B6DB00",
    "#E5F0FE",
    "#4B75FF",
    "#FF94DB",
    "#566700",
  ];

  return (
    <div className="mb-3">

      <div className="flex items-center justify-between mb-3">
        <p className="text-zinc-400 text-sm">
          Circunferências associadas aos pares de divisores
        </p>

        <button
          onClick={resetView}
          className="
            px-3 py-1
            rounded-md
            text-xs
            text-zinc-300
            bg-zinc-800
            hover:bg-zinc-700
            transition
          "
        >
          Resetar
        </button>
      </div>

      <div className="relative">

        <svg
          width="100%"
          viewBox={`0 0 ${width} ${height}`}
          className="
            bg-[#000422]/70
            rounded-lg
            select-none
          "
          style={{
            cursor: dragging.current
              ? "grabbing"
              : "grab",
          }}
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >

          {/* ============================= */}
          {/* GRID VERTICAL                  */}
          {/* ============================= */}

          {Array.from(
            {
              length:
                gridEndX -
                gridStartX +
                1,
            },
            (_, i) => gridStartX + i
          ).map((x) => {

            const sx = screenX(x);

            if (sx < -50 || sx > width + 50) {
              return null;
            }

            return (
              <g key={`x-${x}`}>

                <line
                  x1={sx}
                  y1={0}
                  x2={sx}
                  y2={height}
                  stroke={
                    x === 0
                      ? "#71717a"
                      : "#27272a"
                  }
                  strokeWidth={
                    x === 0 ? 1.5 : 0.7
                  }
                />

                {x !== 0 && (
                  <text
                    x={sx + 4}
                    y={cy - 5}
                    fill="#71717a"
                    fontSize="11"
                  >
                    {x}
                  </text>
                )}

              </g>
            );
          })}

          {/* ============================= */}
          {/* GRID HORIZONTAL               */}
          {/* ============================= */}

          {Array.from(
            {
              length:
                gridEndY -
                gridStartY +
                1,
            },
            (_, i) => gridStartY + i
          ).map((y) => {

            const sy = screenY(y);

            if (sy < -50 || sy > height + 50) {
              return null;
            }

            return (
              <g key={`y-${y}`}>

                <line
                  x1={0}
                  y1={sy}
                  x2={width}
                  y2={sy}
                  stroke={
                    y === 0
                      ? "#71717a"
                      : "#27272a"
                  }
                  strokeWidth={
                    y === 0 ? 1.5 : 0.7
                  }
                />

                {y !== 0 && (
                  <text
                    x={cx + 5}
                    y={sy - 5}
                    fill="#71717a"
                    fontSize="11"
                  >
                    {y}
                  </text>
                )}

              </g>
            );
          })}

          {/* ============================= */}
          {/* EIXO X                        */}
          {/* ============================= */}

          <line
            x1={0}
            y1={screenY(0)}
            x2={width}
            y2={screenY(0)}
            stroke="#a1a1aa"
            strokeWidth={1.8}
          />

          {/* ============================= */}
          {/* EIXO Y                        */}
          {/* ============================= */}

          <line
            x1={screenX(0)}
            y1={0}
            x2={screenX(0)}
            y2={height}
            stroke="#a1a1aa"
            strokeWidth={1.8}
          />

          {/* ============================= */}
          {/* CÍRCULOS                      */}
          {/* ============================= */}

          {circles.map((circle, index) => {

            const color =
              colors[index % colors.length];

            return (
              <circle
                key={`${circle.r2}-${index}`}
                cx={screenX(0)}
                cy={screenY(0)}
                r={circle.radius * scale}
                fill="none"
                stroke={color}
                strokeWidth={2}
                opacity={0.9}
              />
            );
          })}

          {/* ============================= */}
          {/* PONTOS INTEIROS               */}
          {/* ============================= */}

          {circlePoints.flatMap(
            ({ circle, points }, circleIndex) => {

              const color =
                colors[
                  circleIndex % colors.length
                ];

              return points.map(([x, y]) => {

                const sx = screenX(x);
                const sy = screenY(y);

                return (
                  <g
                    key={`${circle.r2}-${x}-${y}`}
                  >

                    <circle
                      cx={sx}
                      cy={sy}
                      r={4}
                      fill={color}
                    />

                    <text
                      x={sx + 7}
                      y={sy - 7}
                      fill="#e4e4e7"
                      fontSize="11"
                    >
                      ({x},{y})
                    </text>

                  </g>
                );
              });
            }
          )}

          {/* ============================= */}
          {/* ORIGEM                        */}
          {/* ============================= */}

          <circle
            cx={screenX(0)}
            cy={screenY(0)}
            r={4}
            fill="white"
          />

        </svg>

        {/* Indicador de zoom */}

        <div
          className="
            absolute
            bottom-3
            right-3
            px-2
            py-1
            rounded
            bg-black/50
            text-zinc-400
            text-xs
            pointer-events-none
          "
        >
          Zoom: {zoom.toFixed(2)}×
        </div>

      </div>

     

      <span className="text-white/30 text-sm text-right block">
        n = {n}
      </span>

    </div>
  );
}
