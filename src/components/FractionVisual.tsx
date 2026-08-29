type FractionVisualProps = {
  numerador: number;
  denominador: number;
};

function mdc(a: number, b: number): number {
  a = Math.abs(a);
  b = Math.abs(b);

  while (b !== 0) {
    [a, b] = [b, a % b];
  }

  return a;
}


// Simplifica √n para a forma a√b
function simplificarRadical(n: number) {
  if (n === 0) {
    return {
      coeficiente: 0,
      radicando: 1,
    };
  }

  let coeficiente = 1;
  let radicando = n;

  for (let i = 2; i * i <= radicando; i++) {
    while (radicando % (i * i) === 0) {
      coeficiente *= i;
      radicando /= i * i;
    }
  }

  return {
    coeficiente,
    radicando,
  };
}


function Hipotenusa({
  numerador,
  denominador,
}: {
  numerador: number;
  denominador: number;
}) {

  const quadrado =
    numerador ** 2 + denominador ** 2;

  const raiz = Math.sqrt(quadrado);


  // Caso seja uma raiz inteira
  if (Number.isInteger(raiz)) {
    return <span>{raiz}</span>;
  }


  const {
    coeficiente,
    radicando,
  } = simplificarRadical(quadrado);


  if (coeficiente === 1) {
    return (
      <span>
        √{radicando}
      </span>
    );
  }


  return (
    <span>
      {coeficiente}√{radicando}
    </span>
  );
}


export function FractionVisual({
  numerador,
  denominador,
}: FractionVisualProps) {

  const fator =
    mdc(numerador, denominador);

  const rn =
    numerador / fator;

  const rd =
    denominador / fator;

  const porcentagem =
    (numerador / denominador) * 100;


  return (

    <div
      style={{
        display: "grid",

        /*
         * As colunas da tabela.
         */
        gridTemplateColumns:
          "1fr 1fr 1fr 2fr",

        alignItems: "center",

        minHeight: 44,

        padding: "6px 12px",

        borderBottom:
          "1px solid #27272a",

        background: "#27272a",

        color: "#fafafa",

        fontSize: 14,
      }}
    >

      {/* =====================================================
          FRAÇÃO ORIGINAL
          ===================================================== */}

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",

            // lineHeight: 1,

            minWidth: 45,
          }}
        >

          <span>
            {numerador}
          </span>

          <div
            style={{
              width: 32,

              borderTop:
                "1px solid #a1a1aa",

              margin: "3px 0",
            }}
          />

          <span>
            {denominador}
          </span>

        </div>

      </div>


      {/* =====================================================
          FRAÇÃO IRREDUTÍVEL
          ===================================================== */}

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",

          color:
            fator !== 1
              ? "#a1a1aa"
              : "#52525b",
        }}
      >

        {fator !== 1 ? (

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",

              lineHeight: 1,
            }}
          >

            <span>
              {rn}
            </span>

            <div
              style={{
                width: 32,

                borderTop:
                  "1px solid #71717a",

                margin: "3px 0",
              }}
            />

            <span>
              {rd}
            </span>

          </div>

        ) : (

          <span>
            —
          </span>

        )}

      </div>


      {/* =====================================================
          HIPOTENUSA
          ===================================================== */}

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",

          color: "#18181b",

          fontSize: 16,

          background: "#d4d4d8",

          borderRadius: 6,

          padding: "3px 8px",

          width: "fit-content",

          margin: "auto",
        }}
      >

        <Hipotenusa
          numerador={numerador}
          denominador={denominador}
        />

      </div>


      {/* =====================================================
          PORCENTAGEM
          ===================================================== */}

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >

        <div
          style={{
            flex: 1,

            height: 8,

            background: "#18181b",

            borderRadius: 999,

            overflow: "hidden",
          }}
        >

          <div
            style={{
              width: `${Math.min(
                porcentagem,
                100
              )}%`,

              height: "100%",

              background: "#099c90",
            }}
          />

        </div>




      </div>

    </div>

  );
}