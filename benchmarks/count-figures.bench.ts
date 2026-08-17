import { bench, describe } from "vitest";

import { countFigures } from "../src/index";

const SIZE = 1_000;
const allUnmarked = Array.from({ length: SIZE }, () => Array<boolean>(SIZE).fill(false));
const allMarked = Array.from({ length: SIZE }, () => Array<boolean>(SIZE).fill(true));
const checkerboard = Array.from({ length: SIZE }, (_, row) =>
  Array.from({ length: SIZE }, (_, column) => (row + column) % 2 === 0),
);
const stripes = Array.from({ length: SIZE }, () =>
  Array.from({ length: SIZE }, (_, column) => column % 2 === 0),
);

let randomState = 0xc001_d00d;
const random = Array.from({ length: SIZE }, () =>
  Array.from({ length: SIZE }, () => {
    randomState = (Math.imul(randomState, 1_664_525) + 1_013_904_223) >>> 0;
    return randomState % 100 < 38;
  }),
);

const cases = [
  ["all unmarked", allUnmarked, 0],
  ["all marked", allMarked, 1],
  ["checkerboard", checkerboard, 500_000],
  ["vertical stripes", stripes, 500],
  ["seeded random", random, undefined],
] as const;

for (const [name, matrix, expected] of cases) {
  if (expected !== undefined && countFigures(matrix) !== expected) {
    throw new Error(`Benchmark precondition failed for ${name}`);
  }
}

describe("countFigures on 1000x1000 matrices", () => {
  for (const [name, matrix] of cases) {
    bench(
      name,
      () => {
        countFigures(matrix);
      },
      { time: 500, warmupTime: 100 },
    );
  }
});
