import { useEffect, useMemo, useState } from "react";

type PrimeFactorTreeProps = {
  n: number;
};

type FactorPair = {
  a: number;
  b: number;
};

type FactorTreeNode = {
  id: string;
  value: number;
  prime: boolean;
  children: FactorPairGroup[];
};

type FactorPairGroup = {
  id: string;
  pair: FactorPair;
  left: FactorTreeNode;
  right: FactorTreeNode;
};

/* ========================================================= */
/* Matemática                                                 */
/* ========================================================= */

function isPrime(n: number): boolean {
  if (n < 2) return false;

  for (let i = 2; i * i <= n; i++) {
    if (n % i === 0) return false;
  }

  return true;
}

function getFactorPairs(n: number): FactorPair[] {
  const pairs: FactorPair[] = [];

  for (let i = 2; i * i <= n; i++) {
    if (n % i === 0) {
      pairs.push({
        a: i,
        b: n / i,
      });
    }
  }

  return pairs;
}

/* ========================================================= */
/* Construção da árvore                                      */
/* ========================================================= */

function buildFactorTree(n: number): FactorTreeNode {
  let counter = 0;

  function build(value: number): FactorTreeNode {
    const node: FactorTreeNode = {
      id: `node-${counter++}`,
      value,
      prime: isPrime(value),
      children: [],
    };

    if (node.prime) {
      return node;
    }

    const pairs = getFactorPairs(value);

    for (const pair of pairs) {
      const left = build(pair.a);
      const right = build(pair.b);

      node.children.push({
        id: `pair-${counter++}`,
        pair,
        left,
        right,
      });
    }

    return node;
  }

  return build(n);
}

/* ========================================================= */
/* Botão de expansão                                         */
/* ========================================================= */

type TreeToggleProps = {
  expanded: boolean;
  hasChildren: boolean;
  onClick: () => void;
};

function TreeToggle({
  expanded,
  hasChildren,
  onClick,
}: TreeToggleProps) {
  if (!hasChildren) {
    return (
      <span className="inline-flex h-6 w-6 shrink-0" />
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={expanded ? "Recolher" : "Expandir"}
      className="
        flex
        h-6
        w-6
        shrink-0
        items-center
        justify-center
        rounded-md
        border
        border-zinc-600
        bg-zinc-800
        text-sm
        font-bold
        leading-none
        text-zinc-200
        shadow-sm
        transition-all
        hover:border-zinc-400
        hover:bg-zinc-700
        hover:text-white
        active:scale-95
      "
    >
      {expanded ? "−" : "+"}
    </button>
  );
}

/* ========================================================= */
/* Número                                                   */
/* ========================================================= */

type NumberBadgeProps = {
  value: number;
  prime: boolean;
};

function NumberBadge({
  value,
  prime,
}: NumberBadgeProps) {
  return (
    <span
      className={[
        "inline-flex",
        "min-w-10",
        "items-center",
        "justify-center",
        "rounded-md",
        "border",
        "px-2.5",
        "py-1",
        "font-mono",
        "text-xs",
        "font-semibold",
        "transition",
        prime
          ? [
              "border-blue-500/50",
              "bg-blue-500/10",
              "text-blue-400",
              "shadow-[0_0_10px_rgba(59,130,246,0.08)]",
            ].join(" ")
          : [
              "border-zinc-700",
              "bg-zinc-900",
              "text-zinc-200",
            ].join(" "),
      ].join(" ")}
    >
      {value}
    </span>
  );
}

/* ========================================================= */
/* Uma linha de número                                      */
/* ========================================================= */

type NumberRowProps = {
  node: FactorTreeNode;
  depth: number;
  expanded: Set<string>;
  toggle: (id: string) => void;
};

function NumberRow({
  node,
  depth,
  expanded,
  toggle,
}: NumberRowProps) {
  const isExpanded = expanded.has(node.id);
  const hasChildren = node.children.length > 0;

  return (
    <div className="relative">
      {/* Linhas verticais */}

      {Array.from({ length: depth }).map((_, index) => (
        <span
          key={index}
          className="
            absolute
            top-0
            bottom-0
            w-px
            bg-zinc-800
          "
          style={{
            left: `${index * 24 + 11}px`,
          }}
        />
      ))}

      {/* Linha horizontal do ramo */}

      {depth > 0 && (
        <span
          className="
            absolute
            top-1/2
            h-px
            bg-zinc-700
          "
          style={{
            left: `${(depth - 1) * 24 + 11}px`,
            width: "15px",
          }}
        />
      )}

      <div
        className="
          group
          relative
          flex
          min-h-10
          items-center
          gap-2
          rounded-md
          px-1
          py-1
          transition-colors
          hover:bg-zinc-900/80
        "
        style={{
          paddingLeft: `${depth * 24 + 4}px`,
        }}
      >
        <TreeToggle
          expanded={isExpanded}
          hasChildren={hasChildren}
          onClick={() => toggle(node.id)}
        />

        <NumberBadge
          value={node.value}
          prime={node.prime}
        />

        {node.prime && (
          <span
            className="
              text-[10px]
              font-medium
              uppercase
              tracking-wider
              text-blue-500/70
            "
          >
            primo
          </span>
        )}
      </div>
    </div>
  );
}

/* ========================================================= */
/* Grupo de um par                                          */
/* ========================================================= */

type PairGroupProps = {
  group: FactorPairGroup;
  depth: number;
  expanded: Set<string>;
  toggle: (id: string) => void;
  first: boolean;
};

function PairGroup({
  group,
  depth,
  expanded,
  toggle,
  first,
}: PairGroupProps) {
  const pairExpanded = expanded.has(group.id);

  /*
   * Espaçamento adicional entre pares.
   *
   * O primeiro par não recebe margem.
   * Os seguintes ficam visualmente separados.
   */

  return (
    <div
      className={[
        "relative",
        !first ? "mt-5" : "",
      ].join(" ")}
    >
      {/* Linha que identifica o par */}

      <div
        className="
          relative
          flex
          min-h-8
          items-center
        "
        style={{
          paddingLeft: `${depth * 24 + 4}px`,
        }}
      >
        {/* Linhas verticais */}

        {Array.from({ length: depth }).map((_, index) => (
          <span
            key={index}
            className="
              absolute
              top-0
              bottom-0
              w-px
              bg-zinc-800
            "
            style={{
              left: `${index * 24 + 11}px`,
            }}
          />
        ))}

        {/* Conector */}

        {depth > 0 && (
          <span
            className="
              absolute
              top-1/2
              h-px
              bg-zinc-700
            "
            style={{
              left: `${(depth - 1) * 24 + 11}px`,
              width: "15px",
            }}
          />
        )}

        <button
          type="button"
          onClick={() => toggle(group.id)}
          className="
            group
            relative
            flex
            items-center
            gap-2
            rounded-md
            border
            border-transparent
            px-2
            py-1.5
            text-xs
            transition
            hover:border-zinc-800
            hover:bg-zinc-900
          "
        >
          <span
            className="
              flex
              h-5
              w-5
              items-center
              justify-center
              rounded
              bg-zinc-800
              text-[10px]
              font-bold
              text-zinc-400
              transition
              group-hover:bg-zinc-700
              group-hover:text-zinc-200
            "
          >
            {pairExpanded ? "−" : "+"}
          </span>

          <span className="font-mono text-zinc-500">
            {group.pair.a}
          </span>

          <span className="font-mono text-zinc-600">
            ×
          </span>

          <span className="font-mono text-zinc-300">
            {group.pair.b}
          </span>

          <span className="ml-1 text-[10px] text-zinc-700">
            fator
          </span>
        </button>
      </div>

      {/* Fatores do par */}

      {pairExpanded && (
        <div className="relative">
          <NumberRow
            node={group.left}
            depth={depth + 1}
            expanded={expanded}
            toggle={toggle}
          />

          <NumberRow
            node={group.right}
            depth={depth + 1}
            expanded={expanded}
            toggle={toggle}
          />

          {/* Continuação recursiva do fator esquerdo */}

          {expanded.has(group.left.id) &&
            group.left.children.map(
              (child, index) => (
                <PairGroup
                  key={child.id}
                  group={child}
                  depth={depth + 2}
                  expanded={expanded}
                  toggle={toggle}
                  first={index === 0}
                />
              ),
            )}

          {/* Continuação recursiva do fator direito */}

          {expanded.has(group.right.id) &&
            group.right.children.map(
              (child, index) => (
                <PairGroup
                  key={child.id}
                  group={child}
                  depth={depth + 2}
                  expanded={expanded}
                  toggle={toggle}
                  first={index === 0}
                />
              ),
            )}
        </div>
      )}
    </div>
  );
}

/* ========================================================= */
/* Árvore da raiz                                           */
/* ========================================================= */

type RootTreeProps = {
  tree: FactorTreeNode;
  expanded: Set<string>;
  toggle: (id: string) => void;
};

function RootTree({
  tree,
  expanded,
  toggle,
}: RootTreeProps) {
  const isExpanded = expanded.has(tree.id);

  return (
    <div>
      <NumberRow
        node={tree}
        depth={0}
        expanded={expanded}
        toggle={toggle}
      />

      {isExpanded && (
        <div>
          {tree.children.map((group, index) => (
            <PairGroup
              key={group.id}
              group={group}
              depth={1}
              expanded={expanded}
              toggle={toggle}
              first={index === 0}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ========================================================= */
/* Componente principal                                      */
/* ========================================================= */

export function PrimeFactorTree({
  n,
}: PrimeFactorTreeProps) {
  const validNumber = useMemo(() => {
    return Number.isInteger(n) && n > 1;
  }, [n]);

  const tree = useMemo(() => {
    if (!validNumber) {
      return null;
    }

    return buildFactorTree(n);
  }, [n, validNumber]);

  const [expanded, setExpanded] = useState<Set<string>>(
    new Set(),
  );

  /*
   * Quando n muda, a raiz volta expandida.
   */

  useEffect(() => {
    if (tree) {
      setExpanded(new Set([tree.id]));
    }
  }, [tree]);

  function toggle(id: string) {
    setExpanded((current) => {
      const next = new Set(current);

      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }

      return next;
    });
  }

  function expandAll() {
    if (!tree) return;

    const ids = new Set<string>();

    function collect(node: FactorTreeNode) {
      if (node.children.length > 0) {
        ids.add(node.id);

        for (const child of node.children) {
          ids.add(child.id);
          collect(child.left);
          collect(child.right);
        }
      }
    }

    collect(tree);

    setExpanded(ids);
  }

  function collapseAll() {
    setExpanded(new Set());
  }

  if (!validNumber || !tree) {
    return (
      <div
        className="
          rounded-xl
          border
          border-red-900/50
          bg-red-950/20
          p-4
          text-sm
          text-red-400
        "
      >
        Informe um número inteiro maior que 1.
      </div>
    );
  }

  return (
    <div
      className="
        flex
        h-[700px]
        w-full
        flex-col
        overflow-hidden
        rounded-xl
        border
        border-zinc-800
        bg-[#050505]
        font-mono
      "
    >
      {/* ================================================= */}
      {/* Barra superior                                    */}
      {/* ================================================= */}

      <div
        className="
          flex
          h-11
          shrink-0
          items-center
          justify-between
          border-b
          border-zinc-800
          bg-[#0a0a0a]
          px-3
        "
      >
        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-500">
            Árvore de fatoração
          </span>

          <span className="text-zinc-700">
            /
          </span>

          <span className="text-xs font-semibold text-zinc-300">
            {n}
          </span>
        </div>

        {/* ============================================= */}
        {/* Controles maiores e mais visíveis             */}
        {/* ============================================= */}

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={expandAll}
            className="
              rounded-md
              border
              border-zinc-600
              bg-zinc-800
              px-3
              py-1.5
              text-[11px]
              font-semibold
              text-zinc-200
              shadow-sm
              transition-all
              hover:border-zinc-400
              hover:bg-zinc-700
              hover:text-white
              active:scale-95
            "
          >
            + Expandir
          </button>

          <button
            type="button"
            onClick={collapseAll}
            className="
              rounded-md
              border
              border-zinc-600
              bg-zinc-800
              px-3
              py-1.5
              text-[11px]
              font-semibold
              text-zinc-200
              shadow-sm
              transition-all
              hover:border-zinc-400
              hover:bg-zinc-700
              hover:text-white
              active:scale-95
            "
          >
            − Recolher
          </button>
        </div>
      </div>

      {/* ================================================= */}
      {/* Cabeçalho                                         */}
      {/* ================================================= */}

      <div
        className="
          flex
          h-8
          shrink-0
          items-center
          border-b
          border-zinc-900
          bg-[#080808]
          px-3
          text-[10px]
          uppercase
          tracking-wider
          text-zinc-600
        "
      >
        <span>Estrutura</span>
      </div>

      {/* ================================================= */}
      {/* Árvore                                            */}
      {/* ================================================= */}

      <div
        className="
          flex-1
          overflow-auto
          p-3
          scrollbar-thin
          scrollbar-track-transparent
          scrollbar-thumb-zinc-800
        "
      >
        <RootTree
          tree={tree}
          expanded={expanded}
          toggle={toggle}
        />
      </div>

      {/* ================================================= */}
      {/* Barra inferior                                    */}
      {/* ================================================= */}

      <div
        className="
          flex
          h-7
          shrink-0
          items-center
          justify-between
          border-t
          border-zinc-800
          bg-[#080808]
          px-3
          text-[10px]
          text-zinc-600
        "
      >
        <span>
          {isPrime(n)
            ? "n é primo"
            : "n é composto"}
        </span>

        <span>
          fatoração de {n}
        </span>
      </div>
    </div>
  );
}