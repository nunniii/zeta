import '../styles/for_components/AppContent.scss'

// Importar todos os componentes possíveis
import { Progress } from './Progress';
import { Gamma } from './Gamma';
import ZetaDomainColoring  from './ZetaDomainColoring';
import { Prime } from './Prime';
// Definir o tipo da propriedade
type AppContentProps = {
  selectedComponent?: 'Progress' | 'Gamma' | 'Riemann' | 'Prime';
};

export function AppContent({ selectedComponent }: AppContentProps) {
  const renderComponent = () => {
    switch (selectedComponent) {
      case 'Progress':
        return <Progress />;
      case 'Gamma':
        return <Gamma />;
      case 'Riemann':
        return <ZetaDomainColoring />;
      case 'Prime':
        return <Prime />;
      default:
        return null;
    }
  };

  return (
    <main id="AppContent">
      <div id='bg_div_AppContent' >
        {renderComponent()}
      </div>
    </main>
  );
}