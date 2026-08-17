/** A rectangular, two-dimensional matrix in which `true` marks part of a figure. */
export type BooleanMatrix = readonly (readonly boolean[])[];

const MAX_CELL_COUNT = 0xffff_ffff;

interface MatrixSnapshot {
  readonly cells: Uint8Array;
  readonly rowCount: number;
  readonly columnCount: number;
}

function isUnknownArray(value: unknown): value is readonly unknown[] {
  return Array.isArray(value);
}

function createSnapshot(matrix: BooleanMatrix): MatrixSnapshot {
  const input: unknown = matrix;
  if (!isUnknownArray(input)) {
    throw new TypeError("Matrix must be an array.");
  }

  const rowCount = input.length;
  if (rowCount === 0) {
    return { cells: new Uint8Array(0), rowCount: 0, columnCount: 0 };
  }

  const firstRow = input[0];
  if (!isUnknownArray(firstRow)) {
    throw new TypeError("Matrix row 0 must be an array.");
  }

  const columnCount = firstRow.length;
  const cellCount = rowCount * columnCount;
  if (!Number.isSafeInteger(cellCount) || cellCount > MAX_CELL_COUNT) {
    throw new RangeError(
      `Matrix contains too many cells; the maximum supported count is ${MAX_CELL_COUNT}.`,
    );
  }

  const cells = new Uint8Array(cellCount);
  let index = 0;

  for (let rowIndex = 0; rowIndex < rowCount; rowIndex += 1) {
    const row = input[rowIndex];
    if (!isUnknownArray(row)) {
      throw new TypeError(`Matrix row ${rowIndex} must be an array.`);
    }
    if (row.length !== columnCount) {
      throw new TypeError(
        `Matrix row ${rowIndex} has length ${row.length}; expected ${columnCount}.`,
      );
    }

    for (let columnIndex = 0; columnIndex < columnCount; columnIndex += 1) {
      const cell = row[columnIndex];
      if (typeof cell !== "boolean") {
        throw new TypeError(
          `Matrix cell at row ${rowIndex}, column ${columnIndex} must be boolean.`,
        );
      }
      cells[index] = cell ? 1 : 0;
      index += 1;
    }
  }

  return { cells, rowCount, columnCount };
}

/**
 * Counts groups of marked cells connected through their top, bottom, left, or right sides.
 * Diagonal contact does not connect figures. The input is never mutated.
 *
 * @param matrix - A rectangular boolean matrix. `true` marks part of a figure.
 * @returns The number of orthogonally connected figures.
 * @throws {TypeError} If the matrix is malformed, ragged, sparse, or contains non-booleans.
 * @throws {RangeError} If the flattened cell count is unsafe or exceeds 4,294,967,295.
 *
 * @remarks Time complexity is O(rows × columns), with O(rows × columns) auxiliary memory.
 */
export function countFigures(matrix: BooleanMatrix): number {
  const { cells, rowCount, columnCount } = createSnapshot(matrix);
  const cellCount = cells.length;
  let stack: Uint32Array | undefined;
  let figureCount = 0;

  for (let index = 0; index < cellCount; index += 1) {
    if (cells[index] !== 1) {
      continue;
    }

    figureCount += 1;
    stack ??= new Uint32Array(cellCount);
    let stackSize = 1;
    stack[0] = index;
    cells[index] = 0;

    while (stackSize > 0) {
      stackSize -= 1;
      const current = stack[stackSize]!;
      const row = Math.floor(current / columnCount);
      const column = current - row * columnCount;

      if (column > 0) {
        const left = current - 1;
        if (cells[left] === 1) {
          cells[left] = 0;
          stack[stackSize] = left;
          stackSize += 1;
        }
      }

      if (column + 1 < columnCount) {
        const right = current + 1;
        if (cells[right] === 1) {
          cells[right] = 0;
          stack[stackSize] = right;
          stackSize += 1;
        }
      }

      if (row > 0) {
        const top = current - columnCount;
        if (cells[top] === 1) {
          cells[top] = 0;
          stack[stackSize] = top;
          stackSize += 1;
        }
      }

      if (row + 1 < rowCount) {
        const bottom = current + columnCount;
        if (cells[bottom] === 1) {
          cells[bottom] = 0;
          stack[stackSize] = bottom;
          stackSize += 1;
        }
      }
    }
  }

  return figureCount;
}
