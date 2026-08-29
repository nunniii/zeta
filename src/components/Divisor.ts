
export function getDivisores(n: number): number[] {
  const divisores: number[] = [];

  for (let i = 1; i <= n; i++) {
    if (n % i === 0) {
      divisores.push(i);
    }
  }

  return divisores;
}

export function getParesDivisores(n: number): [number, number][] {
  const pares: [number, number][] = [];

  for (let d = 1; d * d <= n; d++) {
    if (n % d === 0) {
      pares.push([d, n / d]);
    }
  }

  return pares;
}
