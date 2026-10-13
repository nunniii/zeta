import { useState } from "react";
import "../styles/for_components/AllNumbersAnalyze.scss";

import { getDivisores } from "./Divisor";
import { NumberDetailsOverlay } from "./NumberDetailsOverlay";

import "../styles/scrollbar.scss";



function isCubic(n: number): boolean {
  return Number.isInteger(Math.cbrt(n));
}


function AllNumbersAnalyze() {

  const limite = 1000;

  const [selectedNumber, setSelectedNumber] =
    useState<number | null>(null);


  return (

    <div>



      <div className="font-mono text-sm for-flex all-info h-screen overflow-hidden " >

        <div className="list scrollbar-custom  overflow-y-auto h-full le">
          {Array.from(
            { length: limite },
            (_, i) => i + 1
          )
            .map((n) => {


              const divisores = getDivisores(n);


              let corQuantidade = "text-white";


              if (divisores.length % 2 === 1) {
                corQuantidade = "text-lime-400";
              }


              if (divisores.length === 2) {
                corQuantidade = "text-rose-600";
              }


              if (isCubic(n)) {
                corQuantidade = "text-purple-500";
              }


              if (
                isCubic(n) &&
                divisores.length % 2 === 1
              ) {
                corQuantidade = "text-yellow-500";
              }


              if (divisores.length === 1) {
                corQuantidade = "text-white";
              }


              return (

                <button
                  key={n}
                  onClick={() => setSelectedNumber(n)}
                  className="w-full  flex items-center gap-2  hover:bg-zinc-800  rounded px-2  "
                >

                  <span className={corQuantidade}>
                    {n} |D| = {divisores.length}
                  </span>

                  <p className="text-white">
                    D(n) = {divisores.join(", ")}
                  </p>

                </button>

              );


            })}

        </div>


        {/* =====================================================
            OVERLAY
            ===================================================== */}

        {selectedNumber !== null && (

          <NumberDetailsOverlay

            n={selectedNumber}

            onClose={() => setSelectedNumber(null)}

          />

        )}


      </div>

    </div>

  );
}


export { AllNumbersAnalyze };