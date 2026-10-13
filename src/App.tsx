import { useState } from 'react'

import './styles/App.scss'
import { AppContent } from './components/AppContent' ;
import { Nav } from './components/_global/Nav';




function App() {
  // Para gerenciar o estado do componente selecionado
  const [selectedComponent, setSelectedComponent] = useState<
    'Progress' | 'Gamma' | 'Riemann' | 'Prime'
  >('Progress')

  return (
    <>

    <div id='infinity-void'>
      <div id='Content-Area'>
        <Nav onSelect={setSelectedComponent} />
        <AppContent selectedComponent={selectedComponent} />
      </div>

    </div>

    </>
  )
}

export default App
