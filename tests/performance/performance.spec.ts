import { performance } from "node:perf_hooks";

import { describe, expect, it } from "vitest";

import { countFigures } from "../../src/index";

function allMarked(size: number): boolean[][] {
  return Array.from({ length: size }, () => Array<boolean>(size).fill(true));
}

function medianDuration(matrix: readonly (readonly boolean[])[]): number {
  countFigures(matrix);
  countFigures(matrix);

  const durations = Array.from({ length: 7 }, () => {
    const start = performance.now();
    countFigures(matrix);
    return performance.now() - start;
  }).sort((left, right) => left - right);

  const median = durations[3];
  if (median === undefined) {
    throw new Error("Unable to calculate a median duration.");
  }
  return median;
}

describe("performance guard", () => {
  it("scales linearly and processes one million connected cells within the broad ceiling", () => {
    const smallMedian = medianDuration(allMarked(500));
    const largeMedian = medianDuration(allMarked(1_000));

    console.info(
      `all-marked median: 500x500=${smallMedian.toFixed(2)}ms, 1000x1000=${largeMedian.toFixed(2)}ms, ratio=${(largeMedian / smallMedian).toFixed(2)}`,
    );

    expect(largeMedian).toBeLessThan(5_000);
    expect(largeMedian / smallMedian).toBeLessThanOrEqual(12);
  });

  it("processes a million-cell checkerboard within the broad ceiling", () => {
    const matrix = Array.from({ length: 1_000 }, (_, row) =>
      Array.from({ length: 1_000 }, (_, column) => (row + column) % 2 === 0),
    );
    const start = performance.now();
    const result = countFigures(matrix);
    const duration = performance.now() - start;

    console.info(`checkerboard: ${duration.toFixed(2)}ms`);
    expect(result).toBe(500_000);
    expect(duration).toBeLessThan(5_000);
  });
});
