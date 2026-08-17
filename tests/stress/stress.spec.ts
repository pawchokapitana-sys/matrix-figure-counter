import { describe, expect, it } from "vitest";

import { countFigures } from "../../src/index";
import { referenceCountFigures } from "../support/reference-counter";

const SIZE = 1_000;

describe("million-cell stress behavior", () => {
  it("scans an all-unmarked matrix", () => {
    const matrix = Array.from({ length: SIZE }, () => Array<boolean>(SIZE).fill(false));
    expect(countFigures(matrix)).toBe(0);
  });

  it("traverses one million connected cells without recursion", () => {
    const matrix = Array.from({ length: SIZE }, () => Array<boolean>(SIZE).fill(true));
    expect(countFigures(matrix)).toBe(1);
  });

  it("counts 500,000 isolated checkerboard cells", () => {
    const matrix = Array.from({ length: SIZE }, (_, row) =>
      Array.from({ length: SIZE }, (_, column) => (row + column) % 2 === 0),
    );
    expect(countFigures(matrix)).toBe(500_000);
  });

  it("counts long alternating vertical stripes", () => {
    const matrix = Array.from({ length: SIZE }, () =>
      Array.from({ length: SIZE }, (_, column) => column % 2 === 0),
    );
    expect(countFigures(matrix)).toBe(500);
  });

  it("matches the reference for a deterministic mixed-density matrix", () => {
    let state = 0x1bad_b002;
    const matrix = Array.from({ length: SIZE }, () =>
      Array.from({ length: SIZE }, () => {
        state = (Math.imul(state, 1_103_515_245) + 12_345) >>> 0;
        return state % 100 < 38;
      }),
    );

    expect(countFigures(matrix)).toBe(referenceCountFigures(matrix));
  });
});
