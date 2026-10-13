// Relacionado a operações de formações de pares e encontrar soluções em certas equações 








import { RealSolutionsTriangle } from "./RealSolutionsTriangle"





interface NumbersDetailsOverlayResumeProps {
    n: number
    divisores: number[]
    pares: [number, number][]
}

export function NumbersDetailsOverlayResume({
    n,
    divisores,
    pares,
}: NumbersDetailsOverlayResumeProps) {

    return (
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
    )
}