import { describe, expect, it } from "vitest";

import { countFigures, type BooleanMatrix } from "../../src/index";

describe("countFigures", () => {
  it("returns 3 for the assignment example", () => {
    const matrix = [
      [true, false, false, false, false],
      [true, false, true, true, false],
      [false, true, false, true, false],
      [false, true, true, true, false],
      [false, false, false, false, true],
    ] as const;

    expect(countFigures(matrix)).toBe(3);
  });

  it.each([
    { matrix: [] as const, expected: 0, label: "an empty matrix" },
    { matrix: [[]] as const, expected: 0, label: "one empty row" },
    { matrix: [[], []] as const, expected: 0, label: "multiple empty rows" },
    { matrix: [[false]] as const, expected: 0, label: "one unmarked cell" },
    { matrix: [[true]] as const, expected: 1, label: "one marked cell" },
    {
      matrix: [
        [false, false],
        [false, false],
      ] as const,
      expected: 0,
      label: "an all-unmarked matrix",
    },
    {
      matrix: [
        [true, true, true],
        [true, true, true],
      ] as const,
      expected: 1,
      label: "an all-marked rectangle",
    },
  ])("returns $expected for $label", ({ matrix, expected }) => {
    expect(countFigures(matrix)).toBe(expected);
  });

  it("connects cells horizontally and vertically", () => {
    expect(
      countFigures([
        [true, true, false],
        [false, true, false],
        [false, true, true],
      ]),
    ).toBe(1);
  });

  it("does not connect diagonal cells", () => {
    expect(
      countFigures([
        [true, false, true],
        [false, true, false],
        [true, false, true],
      ]),
    ).toBe(5);
  });

  it("handles branches, holes, and boundary-touching figures", () => {
    expect(
      countFigures([
        [true, true, true, true, true],
        [true, false, false, false, true],
        [true, false, true, false, true],
        [true, false, false, false, true],
        [true, true, true, true, true],
      ]),
    ).toBe(2);
  });

  it("handles a late bridge between branches as one figure", () => {
    expect(
      countFigures([
        [true, false, true],
        [true, false, true],
        [true, true, true],
      ]),
    ).toBe(1);
  });

  it("does not mutate input and supports deeply frozen matrices", () => {
    const rows = [Object.freeze([true, false]), Object.freeze([false, true])] as const;
    const matrix = Object.freeze(rows);
    const before = matrix.map((row) => [...row]);

    expect(countFigures(matrix)).toBe(2);
    expect(countFigures(matrix)).toBe(2);
    expect(matrix).toEqual(before);
  });

  it.each([
    { input: null, label: "null" },
    { input: {}, label: "an object" },
    { input: "matrix", label: "a string" },
  ])("rejects $label as the outer matrix", ({ input }) => {
    expect(() => countFigures(input as unknown as BooleanMatrix)).toThrow(TypeError);
  });

  it("rejects non-array and sparse rows", () => {
    expect(() => countFigures([null] as unknown as BooleanMatrix)).toThrow(/row 0/i);
    expect(() => countFigures([[true], null] as unknown as BooleanMatrix)).toThrow(/row 1/i);

    const sparseRows = new Array<readonly boolean[]>(2);
    sparseRows[0] = [false];
    expect(() => countFigures(sparseRows)).toThrow(/row 1/i);
  });

  it("rejects ragged rows", () => {
    expect(() => countFigures([[true], [false, true]])).toThrow(/row 1.*length/i);
  });

  it("rejects non-boolean and sparse cells with coordinates", () => {
    expect(() => countFigures([[true, 1]] as unknown as BooleanMatrix)).toThrow(/row 0, column 1/i);

    const sparseRow = new Array<boolean>(2);
    sparseRow[0] = true;
    expect(() => countFigures([sparseRow])).toThrow(/row 0, column 1/i);
  });

  it("rejects a safe product beyond the unsigned 32-bit index limit", () => {
    const hugeRow = new Array<boolean>(2_147_483_648);
    expect(() => countFigures([hugeRow, hugeRow])).toThrow(RangeError);
  });

  it("rejects an unsafe flattened-size product", () => {
    const hugeRow = new Array<boolean>(2_147_483_648);
    const hugeMatrix = new Array<readonly boolean[]>(2_147_483_648);
    hugeMatrix[0] = hugeRow;
    expect(() => countFigures(hugeMatrix)).toThrow(RangeError);
  });
});
