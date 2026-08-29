import type { ViewBox } from "./types";

export function drawAxes(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  view: ViewBox
) {

  const x0 =
    ((0 - view.xMin) / (view.xMax - view.xMin)) * width;

  const y0 =
    ((view.yMax - 0) / (view.yMax - view.yMin)) * height;

  ctx.strokeStyle = "rgba(255,255,255,.3)";
  ctx.lineWidth = 2;

  if (y0 >= 0 && y0 <= height) {
    ctx.beginPath();
    ctx.moveTo(0, y0);
    ctx.lineTo(width, y0);
    ctx.stroke();
  }

  if (x0 >= 0 && x0 <= width) {
    ctx.beginPath();
    ctx.moveTo(x0, 0);
    ctx.lineTo(x0, height);
    ctx.stroke();
  }
}