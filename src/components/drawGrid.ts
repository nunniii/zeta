import type { ViewBox } from "./types";

export function drawGrid(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  view: ViewBox
) {

  const toX = (x: number) =>
    ((x - view.xMin) / (view.xMax - view.xMin)) * width;

  const toY = (y: number) =>
    ((view.yMax - y) / (view.yMax - view.yMin)) * height;

  const rangeX = view.xMax - view.xMin;
  const rangeY = view.yMax - view.yMin;

  const stepX =
    Math.pow(10, Math.floor(Math.log10(rangeX / 8)));

  const stepY =
    Math.pow(10, Math.floor(Math.log10(rangeY / 8)));

  ctx.strokeStyle = "rgba(255,255,255,.08)";
  ctx.lineWidth = 1;

  ctx.fillStyle = "rgba(255,255,255,.4)";
  ctx.font = "12px monospace";

  // X
  for (
    let x = Math.ceil(view.xMin / stepX) * stepX;
    x <= view.xMax;
    x += stepX
  ) {

    const px = toX(x);

    ctx.beginPath();
    ctx.moveTo(px, 0);
    ctx.lineTo(px, height);
    ctx.stroke();

    ctx.fillText(
      x.toFixed(2).replace(".00", ""),
      px + 4,
      height - 8
    );
  }

  // Y
  for (
    let y = Math.ceil(view.yMin / stepY) * stepY;
    y <= view.yMax;
    y += stepY
  ) {

    const py = toY(y);

    ctx.beginPath();
    ctx.moveTo(0, py);
    ctx.lineTo(width, py);
    ctx.stroke();

    if (py > 15 && py < height - 15) {
      ctx.fillText(
        y.toFixed(2).replace(".00", ""),
        5,
        py - 3
      );
    }
  }

}