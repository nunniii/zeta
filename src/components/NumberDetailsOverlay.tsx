import { getDivisores, getParesDivisores } from "./Divisor";
import { FractionVisual } from "./FractionVisual";
import { CircleDivisorPlot } from "./CircleDivisorPlot";
import { CircleDivisorAtom } from "./CircleDivisorAtom";

import { RealSolutionsTriangle } from "./RealSolutionsTriangle"

import { PrimeFactorTree } from "./PrimeFactorTree"

type NumberDetailsOverlayProps = {
    n: number;
    onClose: () => void;
};

export function NumberDetailsOverlay({
    n,
    onClose,
}: NumberDetailsOverlayProps) {

    const divisores = getDivisores(n);
    const pares = getParesDivisores(n);

    return (

        <div
            className="ld
        NumberDetailsOverlay
        rounded-xl   
        h-fullld
    NumberDetailsOverlay
    h-full
    overflow-hidden
    flex
    flex-col
        overflow-y-auto

        
      "
            onClick={(e) => e.stopPropagation()}
        >

            {/* =====================================================
          CABEÇALHO
          ===================================================== */}

            <h2 className="ttitle text-xl ">
                n = {n}
            </h2>


            {/* =====================================================
          ÁREA PRINCIPAL
          ===================================================== */}

            <div
                className="
          grid
    grid-cols-[minmax(0,1fr)_minmax(400px,0.8fr)]
    gap-6
    items-stretch
    flex-1
    min-h-0
          
        "
            >


                {/* ===================================================
            LADO ESQUERDO
            Informações + gráfico
            =================================================== */}

                <div
                    className="
          "
                >


                    {/* ===============================================
              INFORMAÇÕES
              =============================================== */}




                    {/* ===============================================
              GRÁFICO
              =============================================== */}

                    <div className="w-full">


                        <div
                            className="
                bg-zinc-900/20
                rounded-xl
                p-3
                overflow-hidden
              "
                        >

                            <CircleDivisorPlot
                                n={n}
                            />


                        </div>

                    </div>


                </div>


                {/* ===================================================
            LADO DIREITO
            Cards / Frações
            =================================================== */}

                <div
                    className="
            rounded-xl
            scrollbar-custom
            overflow-y-auto
            min-h-0
            h-full 
          "
                >

                    <CircleDivisorAtom n={n} />
                    <PrimeFactorTree n={n}/>


                    <p className="text-zinc-400 text-sm mb-4">
                        Quadrados relativos do divisor associado à função
                        quadrática
                    </p>


                    {/* Cabeçalho */}

                    <div
                        style={{
                            display: "grid",
                            gridTemplateColumns: "1fr 1fr 1fr 2fr",
                            alignItems: "center",
                            minHeight: 36,
                            padding: "6px 12px",
                            background: "#18181b",
                            borderBottom: "1px solid #3f3f46",
                            color: "#71717a",
                            fontSize: 11,
                            textTransform: "uppercase",
                            letterSpacing: "0.05em",
                        }}

                        className="
              grid
              grid-cols-[130px_150px_150px_1fr]
              items-center
              min-h-9
              px-3
              bg-zinc-900
              rounded-t-lg
              text-zinc-500
              text-[11px]
              uppercase
              tracking-wider
            "
                    >

                        <div className="text-center">
                            Fração
                        </div>

                        <div className="text-center">
                            Irredutível
                        </div>

                        <div className="text-center">
                            Hipotenusa
                        </div>

                        <div>
                            Proporção
                        </div>

                    </div>


                    {/* Cards */}

                    <div
                        className="
              overflow-hidden
              rounded-b-lg
              bg-zinc-800
            "
                    >

                        {pares.map(([a, b]) => (

                            <FractionVisual
                                key={`${a}-${b}`}
                                numerador={a}
                                denominador={b}
                            />

                        ))}

                    </div>
                    






                    <div
                        id="info"
                        className="
              main-info-container
              rounded-lg
              p-4
            "
                    >
                        

                        <p className="text-zinc-400 text-sm mb-3">
                            Resumo
                        </p>
                        <RealSolutionsTriangle x={n} />


                        <div className="info bg-amber-100/50 mb-3">

                            <p>
                                D(n) = {divisores.join(", ")}
                            </p>

                        </div>


                        <div className="info bg-amber-100/50">

                            <p>

                                {"{"}

                                {pares.map(([a, b], index) => (

                                    <span key={`${a}-${b}`}>

                                        ({a}, {b})

                                        {index < pares.length - 1 && ", "}

                                    </span>

                                ))}

                                {"}"}

                            </p>

                        </div>

                    </div>



















                </div>


            </div>


            {/* =====================================================
          BOTÃO
          ===================================================== */}

            <div className="mt-6">

                <button
                    className="
            bg-blue-600
            hover:bg-blue-500
            text-white
            p-2
            px-4
            rounded okay-button
          "
                    onClick={onClose}
                >
                    Okay
                </button>

            </div>


        </div>

    );
}
