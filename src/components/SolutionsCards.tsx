import { FractionVisual } from "./FractionVisual";

interface SolutionsCardsProps {
    pares: [number, number][];
}

export function SolutionsCards({ pares }: SolutionsCardsProps) {
    return (
        <>
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
        </>
    );
}