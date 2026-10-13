import { useState } from "react";

import { getDivisores, getParesDivisores } from "./Divisor";
import { CircleDivisorPlot } from "./CircleDivisorPlot";
import { CircleDivisorAtom } from "./CircleDivisorAtom";
import { SolutionsCards } from "./SolutionsCards";
import { NumbersDetailsOverlayResume } from "./NumberDetailsOverlayResume";
import { PrimeFactorTree } from "./PrimeFactorTree";

type NumberDetailsOverlayProps = {
    n: number;
    onClose: () => void;
};

export function NumberDetailsOverlay({
    n,
    onClose,
}: NumberDetailsOverlayProps) {

    const [showPrimeFactorTree, setShowPrimeFactorTree] =
        useState(false);

    const divisores = getDivisores(n);
    const pares = getParesDivisores(n);

    return (
        <div
            className="
                ld
                NumberDetailsOverlay
                rounded-xl
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

            <h2 className="ttitle text-xl">
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
                    =================================================== */}

                <div>

                    <div className="w-full">

                        <div className="bg-zinc-900/20 rounded-xl p-3 overflow-hidden">

                            <CircleDivisorPlot
                                n={n}
                            />

                        </div>

                    </div>

                </div>


                {/* ===================================================
                    LADO DIREITO
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

                    <NumbersDetailsOverlayResume
                        n={n}
                        divisores={divisores}
                        pares={pares}
                    />

                    <SolutionsCards
                        pares={pares}
                    />

                    <br/>


                    {/* =================================================
                        ÁRVORE DE FATORAÇÃO
                        ================================================= */}

                    <div className="mt-4">

                        <button
                            type="button"
                            onClick={() =>
                                setShowPrimeFactorTree(
                                    !showPrimeFactorTree
                                )
                            }
                            className="
                                w-full
                                flex
                                items-center
                                justify-between
                                px-3
                                py-2
                                rounded-lg
                                bg-zinc-800
                                hover:bg-zinc-700
                                text-zinc-200
                                text-sm
                                transition
                            "
                        >
                            <span>
                                Fatoração prima
                            </span>

                            <span>
                                {showPrimeFactorTree
                                    ? "▲"
                                    : "▼"}
                            </span>
                        </button>


                        {showPrimeFactorTree && (
                            <div className="mt-3">
                                <PrimeFactorTree n={n} />
                            </div>
                        )}

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
                        rounded
                        okay-button
                    "
                    onClick={onClose}
                >
                    Okay
                </button>

            </div>

        </div>
    );
}