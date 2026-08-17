import { describe, expect, it } from "vitest";

import { countFigures } from "../../src/index";
import { referenceCountFigures } from "../support/reference-counter";

function createRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
    return state / 0x1_0000_0000;
  };
}

describe("randomized differential behavior", () => {
  it("matches an independent reference across seeded shapes and densities", () => {
    const random = createRandom(0x5eed_c0de);

    for (let sample = 0; sample < 500; sample += 1) {
      const rowCount = Math.floor(random() * 21);
      const columnCount = Math.floor(random() * 21);
      const density = random();
      const matrix = Array.from({ length: rowCount }, () =>
        Array.from({ length: columnCount }, () => random() < density),
      );

      expect(countFigures(matrix), `sample ${sample}: ${rowCount}x${columnCount}`).toBe(
        referenceCountFigures(matrix),
      );
    }
  });
});
