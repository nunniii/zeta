import { Listbox, ListboxButton, ListboxOption, ListboxOptions } from '@headlessui/react'
import { CheckIcon, ChevronDownIcon } from '@heroicons/react/20/solid'
import clsx from 'clsx'
import { useState } from 'react'

// Definindo o tipo para as opções
type Option = {
  id: number;
  name: string;
  component:  'Progress' | 'Gamma' | 'Riemann' | 'Prime'; // Mudando o tipo aqui
};

// Atualizando as opções com o tipo 'Option'
const options: Option[] = [
  { id: 1, name: 'Progresso', component: 'Progress' },
  { id: 2, name: 'Gamma', component: 'Gamma' },
  { id: 3, name: 'Riemann', component: 'Riemann' },
  { id: 4, name: 'Prime', component: 'Prime' }
];

// Definindo o tipo da prop 'onSelect' para garantir que o TypeScript o reconheça corretamente
type SelectorProps = {
  onSelect: (component: 'Progress' | 'Gamma' | 'Riemann' | 'Prime') => void; // O tipo aqui deve ser o mesmo
};

export function Selector({ onSelect }: SelectorProps) {
  const [selected, setSelected] = useState<Option>(options[0]);

  const handleChange = (option: Option) => {
    setSelected(option);
    onSelect(option.component);  // Agora isso é seguro
  }

  return (
    <div className="w-10 text-xs">
      <Listbox  value={selected} onChange={handleChange}>
        <ListboxButton
          className={clsx(
            `w-23 h-4 rounded-[0.2rem] bg-white  text-left  text-black gap-1 items-center justify-between flex`
          )}
        >
          <ChevronDownIcon
            className="bg-blue  group pointer-events-none top-2.5  size-4 fill-black/60"
            aria-hidden="true"
          />
          {selected.name} <ChevronDownIcon
            className="bg-blue  group pointer-events-none top-2.5  size-4 fill-black/60"
            aria-hidden="true"
          />
        </ListboxButton>
        <ListboxOptions
          anchor="bottom"
          transition
          className={clsx(
            '  bg-white [--anchor-gap:var(--spacing-1)] focus:outline-none',
            'transition duration-100 ease-in data-[leave]:data-[closed]:opacity-0'
          )}
        >
          {options.map((option) => (
            <ListboxOption
              key={option.id}
              value={option}
              className="group w-23 flex cursor-default items-center gap-2 rounded-lg pl-1.5 px-3 select-none data-[focus]:bg-white"
            >
              <CheckIcon className="invisible size-3 fill-black group-data-[selected]:visible" />
              <div className="text-xs text-black">{option.name}</div>
            </ListboxOption>
          ))}
        </ListboxOptions>
      </Listbox>
    </div>
  )
}