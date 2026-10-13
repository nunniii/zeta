import { useEffect, useRef, useState } from "react";
import { drawGrid } from "./drawGrid";
import { drawAxes } from "./drawAxes";
import type { ViewBox } from "./types";

interface Props{
  f:(x:number)=>number;
  color?:string;
}

export default function FunctionPlot({
  f,
  color="#ef4444"
}:Props){

  const canvasRef=useRef<HTMLCanvasElement>(null);

  const dragRef = useRef<{
  x0: number;
  y0: number;
  v0: ViewBox;
} | null>(null);

const [view, setView] = useState<ViewBox>({
  xMin: -10,
  xMax: 10,
  yMin: -3,
  yMax: 3
});

const onWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {

  e.preventDefault();

  const rect = e.currentTarget.getBoundingClientRect();

  const px = (e.clientX - rect.left) / rect.width;
  const py = (e.clientY - rect.top) / rect.height;

  const x =
    view.xMin + px * (view.xMax - view.xMin);

  const y =
    view.yMax - py * (view.yMax - view.yMin);

  const scale = e.deltaY > 0 ? 1.2 : 1 / 1.2;

  setView({
    xMin: x + (view.xMin - x) * scale,
    xMax: x + (view.xMax - x) * scale,
    yMin: y + (view.yMin - y) * scale,
    yMax: y + (view.yMax - y) * scale,
  });
};

const onMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {

  if (dragRef.current) {

    const dx = e.clientX - dragRef.current.x0;
    const dy = e.clientY - dragRef.current.y0;

    const rect = e.currentTarget.getBoundingClientRect();

    const v0 = dragRef.current.v0;

    const dxCoord = -(dx / rect.width) * (v0.xMax - v0.xMin);
    const dyCoord = (dy / rect.height) * (v0.yMax - v0.yMin);

    setView({
      xMin: v0.xMin + dxCoord,
      xMax: v0.xMax + dxCoord,
      yMin: v0.yMin + dyCoord,
      yMax: v0.yMax + dyCoord
    });

    return;
  }

  const rect = e.currentTarget.getBoundingClientRect();

  const px = e.clientX - rect.left;

  const x =
    view.xMin +
    (px / rect.width) * (view.xMax - view.xMin);

  const y = f(x);

  setInfo(
    `x = ${x.toFixed(5)} | f(x) = ${y.toFixed(8)}`
  );
};

const onMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {

  dragRef.current = {
    x0: e.clientX,
    y0: e.clientY,
    v0: { ...view }
  };

};

const onMouseUp = () => {
  dragRef.current = null;
};













const [info, setInfo] = useState("");
  useEffect(()=>{

    const canvas=canvasRef.current;
    if(!canvas) return;

    const ctx=canvas.getContext("2d")!;

    const width=canvas.width;
    const height=canvas.height;

    ctx.fillStyle="#0b0f19";
    ctx.fillRect(0,0,width,height);

    drawGrid(ctx,width,height,view);
    drawAxes(ctx,width,height,view);

    const toY=(y:number)=>
      ((view.yMax-y)/(view.yMax-view.yMin))*height;

    ctx.strokeStyle=color;
    ctx.lineWidth=3;

    ctx.beginPath();

    for(let px=0;px<width;px++){

      const x=view.xMin+(px/width)*(view.xMax-view.xMin);
      const y=f(x);

      if(px===0)
        ctx.moveTo(px,toY(y));
      else
        ctx.lineTo(px,toY(y));
    }

    ctx.stroke();

  },[f,color,view]);

  return(

     <div className="w-full h-full flex flex-col bg-[#0b0f19] rounded-xl overflow-hidden">

    <div className="flex-1">
   <canvas
  ref={canvasRef}
  width={1200}
  height={700}
  className="w-full h-full"
  onWheel={onWheel}
  onMouseMove={onMouseMove}
  onMouseDown={onMouseDown}
  onMouseUp={onMouseUp}
  onMouseLeave={onMouseUp}
/>


    </div>

    <div
      className="
      px-4 py-2
      border-t border-slate-800
      bg-[#0b0f19]
      text-slate-400
      font-mono
      text-xs
      "
    >
      {info || "Scroll: Zoom"}
    </div>

  </div>


  );
}