import type { BooleanMatrix } from "../../src/index";

export function referenceCountFigures(matrix: BooleanMatrix): number {
  const rowCount = matrix.length;
  const columnCount = matrix[0]?.length ?? 0;
  const visited = new Uint8Array(rowCount * columnCount);
  let figureCount = 0;

  for (let row = 0; row < rowCount; row += 1) {
    for (let column = 0; column < columnCount; column += 1) {
      const index = row * columnCount + column;
      if (matrix[row]?.[column] !== true || visited[index] === 1) {
        continue;
      }

      figureCount += 1;
      const stack: number[] = [index];
      visited[index] = 1;

      while (stack.length > 0) {
        const current = stack.pop();
        if (current === undefined) {
          break;
        }
        const currentRow = Math.floor(current / columnCount);
        const currentColumn = current - currentRow * columnCount;
        const neighbors: readonly (readonly [number, number])[] = [
          [currentRow - 1, currentColumn],
          [currentRow + 1, currentColumn],
          [currentRow, currentColumn - 1],
          [currentRow, currentColumn + 1],
        ];

        for (const [neighborRow, neighborColumn] of neighbors) {
          if (
            neighborRow >= 0 &&
            neighborRow < rowCount &&
            neighborColumn >= 0 &&
            neighborColumn < columnCount &&
            matrix[neighborRow]?.[neighborColumn] === true &&
            visited[neighborRow * columnCount + neighborColumn] === 0
          ) {
            const neighborIndex = neighborRow * columnCount + neighborColumn;
            visited[neighborIndex] = 1;
            stack.push(neighborIndex);
          }
        }
      }
    }
  }

  return figureCount;
}
