import { useEffect, useRef } from "react";

export default function DomainColoring() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;

    const width = canvas.width;
    const height = canvas.height;

    const image = ctx.createImageData(width, height);

    const scale = 3;

    for (let py = 0; py < height; py++) {
      for (let px = 0; px < width; px++) {

        //--------------------------------------
        // Pixel -> Complexo
        //--------------------------------------

        const x = (px / width - 0.5) * 2 * scale;
        const y = -(py / height - 0.5) * 2 * scale;

        //--------------------------------------
        // z²
        //--------------------------------------

        const re = x * x - y * y;
        const im = 2 * x * y;

        //--------------------------------------
        // módulo
        //--------------------------------------

        const modulus = Math.sqrt(re * re + im * im);

        //--------------------------------------
        // argumento
        //--------------------------------------

        let angle = Math.atan2(im, re);

        if (angle < 0)
          angle += Math.PI * 2;

        //--------------------------------------
        // HSV
        //--------------------------------------

        const H = angle * 180 / Math.PI;
        const S = 1;
        const V = modulus / (1 + modulus);

        //--------------------------------------
        // HSV -> RGB
        //--------------------------------------

        const C = V * S;
        const X = C * (1 - Math.abs((H / 60) % 2 - 1));
        const m = V - C;

        let r = 0;
        let g = 0;
        let b = 0;

        if (H < 60) {
          r = C; g = X;
        } else if (H < 120) {
          r = X; g = C;
        } else if (H < 180) {
          g = C; b = X;
        } else if (H < 240) {
          g = X; b = C;
        } else if (H < 300) {
          r = X; b = C;
        } else {
          r = C; b = X;
        }

        const index = (py * width + px) * 4;

        image.data[index] = (r + m) * 255;
        image.data[index + 1] = (g + m) * 255;
        image.data[index + 2] = (b + m) * 255;
        image.data[index + 3] = 255;
      }
    }

    ctx.putImageData(image, 0, 0);

  }, []);

  return (
    <div className="flex justify-center items-center h-screen bg-black">
      <canvas
        ref={canvasRef}
        width={700}
        height={700}
        className="border border-gray-500"
      />
    </div>
  );
}