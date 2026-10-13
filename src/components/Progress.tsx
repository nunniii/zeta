// import ZetaDomainColoring from "./ZetaDomainColoring";
// import Test from "./Test";
// import DomainColoring from "./DomainColoring";

import VonNeumannViewer from "./TrigonometricCircle";

function Progress() {
  return (
    <>

        <div style={{ padding: '1rem', width: '100%', minHeight: '80vh' }} className="m-main">
      {/* <Test /> */}
      {/* <DomainColoring /> */}
      {/* <ZetaDomainColoring /> */}
      <VonNeumannViewer />
    </div>
   

      <small className="text-gray-500">
        Zeta de Riemann
      </small>
    </>
  );
}

export { Progress };