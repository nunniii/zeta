import { useMemo } from "react";



type RealSolutionsTriangleProps = {
  x: number;
};

type IntegerSolution = [number, number];

export function RealSolutionsTriangle({
  x,
}: RealSolutionsTriangleProps) {
  const solutions = useMemo(() => {
    if (x < 0 || !Number.isInteger(x)) {
      return {
        positive: [] as IntegerSolution[],
        negative: [] as IntegerSolution[],
      };
    }

    const result: IntegerSolution[] = [];
    const limit = Math.floor(Math.sqrt(x));

    for (let a = -limit; a <= limit; a++) {
      const bSquared = x - a * a;

      if (bSquared < 0) continue;

      const b = Math.sqrt(bSquared);

      if (Number.isInteger(b)) {
        if (b === 0) {
          result.push([a, 0]);
        } else {
          result.push([a, b]);
          result.push([a, -b]);
        }
      }
    }

    const positive = result.filter(([a, b]) => a >= 0 && b >= 0);
    const negative = result.filter(([a, b]) => a <= 0 && b <= 0);

    return {
      positive,
      negative,
    };
  }, [x]);

  return (
    <div>
      {/* Equação */}
      <div>
        {"{"}
        (a, b) ∈ ℤ² : a² + b² = {x}
        {"}"}
      </div>

      {/* Soluções positivas */}
      <div>
        <div className="text-sm opacity-60 mb-2">
          Soluções em ℤ⁺ 
        </div>

        <div className="font-mono">
          {"{"}
          {solutions.positive.length > 0
            ? solutions.positive.map(([a, b], index) => (
                <span key={`${a},${b}`}>
                  ({a}, {b})
                  {index < solutions.positive.length - 1 && ", "}
                </span>
              ))
            : "∅"}
          {"}"}
        </div>
      </div>

      {/* Soluções negativas */}
      <div className="mt-4">
        <div className="text-sm opacity-60 mb-2">
          Soluções em ℤ⁻
        </div>

        <div className="font-mono">
          {"{"}
          {solutions.negative.length > 0
            ? solutions.negative.map(([a, b], index) => (
                <span key={`${a},${b}`}>
                  ({a}, {b})
                  {index < solutions.negative.length - 1 && ", "}
                </span>
              ))
            : "∅"}
          {"}"}
        </div>
      </div>



    </div>
  );
}