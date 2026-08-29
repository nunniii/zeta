import { useMemo, useState } from "react";

interface SetNode {
  value: number;
  children: SetNode[];
}

const COLORS = [
  "border-sky-500 text-sky-300",
  "border-emerald-500 text-emerald-300",
  "border-yellow-500 text-yellow-300",
  "border-pink-500 text-pink-300",
  "border-violet-500 text-violet-300",
  "border-orange-500 text-orange-300",
];

function buildVonNeumann(n: number): SetNode {
  return {
    value: n,
    children: Array.from({ length: n }, (_, i) => buildVonNeumann(i)),
  };
}

function TreeNode({
  node,
  depth,
}: {
  node: SetNode;
  depth: number;
}) {
  const [open, setOpen] = useState(true);

  const color = COLORS[depth % COLORS.length];

  if (node.children.length === 0) {
    return (
      <div className="ml-6 flex items-center gap-2">
        <span className="text-slate-500">└─</span>
        <span className="rounded bg-slate-800 px-2 py-1 font-mono text-green-300">
          ∅
        </span>
      </div>
    );
  }

  return (
    <div className="ml-5 border-l border-slate-700 pl-4">

      <div className="flex items-center gap-2">

        <button
          onClick={() => setOpen(!open)}
          className="w-6 select-none rounded bg-slate-800 hover:bg-slate-700"
        >
          {open ? "−" : "+"}
        </button>

        <span
          className={`rounded border px-2 py-1 font-mono text-sm ${color}`}
        >
          {node.value}
        </span>

        <span className="font-mono text-slate-400">
          {open
            ? `{ ... } (${node.children.length} elementos)`
            : "{ ... }"}
        </span>

      </div>

      {open && (
        <div className="mt-2 space-y-2">

          {node.children.map((child) => (
            <TreeNode
              key={child.value}
              node={child}
              depth={depth + 1}
            />
          ))}

        </div>
      )}

    </div>
  );
}

function InlineSet({
  node,
}: {
  node: SetNode;
}) {
  if (node.children.length === 0)
    return <span className="text-green-400">∅</span>;

  return (
    <>
      {"{"}
      {node.children.map((child, i) => (
        <span key={child.value}>
          <InlineSet node={child} />
          {i !== node.children.length - 1 && ", "}
        </span>
      ))}
      {"}"}
    </>
  );
}

export default function VonNeumannViewer() {
  const [value, setValue] = useState(4);

  const tree = useMemo(() => buildVonNeumann(value), [value]);

  return (
    <div className="rounded-2xl border border-slate-700 bg-slate-900 p-6 text-slate-100">

      <div className="mb-6 flex items-center gap-4">

        <h2 className="text-xl font-bold">
          Número de Von Neumann
        </h2>

        <input
          type="range"
          min={0}
          max={8}
          value={value}
          onChange={(e) => setValue(Number(e.target.value))}
          className="flex-1"
        />

        <div className="w-10 rounded bg-slate-800 py-1 text-center font-bold">
          {value}
        </div>

      </div>

      <div className="mb-6 rounded-lg border border-slate-700 bg-slate-950 p-4">

        <div className="mb-2 text-sm text-slate-400">
          Representação completa
        </div>

        <div className="overflow-auto whitespace-pre-wrap break-all font-mono text-lg leading-8">
          <InlineSet node={tree} />
        </div>

      </div>

      <div className="rounded-lg border border-slate-700 bg-slate-950 p-4">

        <div className="mb-3 text-sm text-slate-400">
          Estrutura em árvore
        </div>

        <TreeNode
          node={tree}
          depth={0}
        />

      </div>

    </div>
  );
}