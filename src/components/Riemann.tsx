

import FunctionPlot from "./FunctionPlot";

function Riemann() {
  return (
    <>
      <div style={{ width: '80vw', height: '70vh' }}>
        <FunctionPlot
          f={(x)=>Math.sin(x)}
        />
      </div>

    </>
  );
}

export { Riemann };