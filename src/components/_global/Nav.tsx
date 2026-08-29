import '../../styles/for_components/Nav.scss';
import { Selector } from './Selector';

import planet from "../../assets/planet.png";


type NavProps = {
  onSelect: (component:  'Progress' | 'Gamma' | "Riemann" | "Prime") => void; // Tipo ajustado para aceitar apenas esses três valores
};


export function Nav({ onSelect }: NavProps) {
  return (
    <nav id="Nav">
        <img
  src={planet}
  alt="Planeta"
  className="w-4 h-4"
/>
        <div id="Controls">
            {/* O seletor recebe a função onSelect para atualizar a seleção */}
            <Selector onSelect={onSelect} />
        </div>
    </nav>
  );
}