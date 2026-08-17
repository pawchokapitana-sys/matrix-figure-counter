# Matrix Figure Counter

A small, production-ready TypeScript library that counts figures in a boolean matrix. A figure is a group of `true` cells connected through their top, bottom, left, or right sides. Diagonal contact does not connect figures.

The package has no runtime dependencies, does not mutate input, and ships ESM, CommonJS, and TypeScript declarations for Node.js and browser consumers.

## Installation

This assignment is prepared for npm publishing but is intentionally not published. Install a locally generated tarball with:

```sh
npm run build
npm pack
npm install ./matrix-figure-counter-1.0.0.tgz
```

If published under this package name in the future, normal installation would be:

```sh
npm install matrix-figure-counter
```

## Usage

```ts
import { countFigures } from "matrix-figure-counter";

const matrix = [
  [true, false, false, false, false],
  [true, false, true, true, false],
  [false, true, false, true, false],
  [false, true, true, true, false],
  [false, false, false, false, true],
] as const;

console.log(countFigures(matrix)); // 3
```

CommonJS is supported as well:

```js
const { countFigures } = require("matrix-figure-counter");
```

### Browser usage

With a bundler such as Vite, use the same bare package import shown above. Native browsers do not resolve npm package names by themselves, so direct browser usage needs an import map/CDN that maps the package name to `dist/index.js`, or a copied/hosted ESM artifact:

```html
<script type="module">
  import { countFigures } from "/vendor/matrix-figure-counter/index.js";

  console.log(
    countFigures([
      [true, false],
      [false, true],
    ]),
  ); // 2
</script>
```

The published ESM file is environment-neutral and can be served directly; no Node.js globals or browser polyfills are required.

## API

### `countFigures(matrix)`

```ts
type BooleanMatrix = readonly (readonly boolean[])[];

function countFigures(matrix: BooleanMatrix): number;
```

Returns the number of orthogonally connected groups of marked cells.

The matrix contract is deliberately strict:

- `true` is marked and `false` is unmarked;
- every row must have the same length;
- sparse rows, sparse cells, and non-boolean cells are invalid;
- `[]`, `[[]]`, and other rectangular zero-width matrices return `0`;
- readonly and frozen arrays are supported;
- the input is never mutated;
- numeric `0`/`1` matrices and diagonal connectivity are not supported.

Malformed matrices throw `TypeError`. An unsafe flattened size or more than 4,294,967,295 cells throws `RangeError`. Actual usable size is normally much lower because the input and auxiliary typed buffers must fit in host memory.

## Algorithm

The implementation validates and copies the matrix into a compact flat `Uint8Array`, then performs iterative depth-first flood fill with a lazily allocated `Uint32Array` stack. A marked cell is cleared in the private snapshot before it is pushed, so it enters the stack at most once.

- Time: **O(rows × columns)**, which is optimal because an exact solution must inspect every cell in the worst case.
- Auxiliary memory: **O(rows × columns)**—approximately one byte per cell for an all-unmarked matrix and at most about five bytes per cell when the traversal stack is needed.
- Call stack: **O(1)**; traversal is iterative and cannot overflow through recursion.

The private snapshot trades linear memory for input immutability, predictable performance, cache-friendly traversal, and runtime validation for JavaScript consumers.

See [DESIGN.md](./DESIGN.md) for the complete decisions and alternatives.

## Runtime and package support

- Node.js 22 or newer
- Chromium, Firefox, and WebKit releases with native ES modules, typed arrays, and ES2020 syntax
- ESM: `dist/index.js`
- CommonJS: `dist/index.cjs`
- Types: `dist/index.d.ts` and `dist/index.d.cts`
- License: MIT

The package export map is checked with Publint and Are the Types Wrong. A generated tarball is installed into clean ESM, CommonJS, TypeScript, and Vite consumer fixtures; Chromium, Firefox, and WebKit execute both the bundled import and the raw ESM artifact.

## Development

Requirements:

- Node.js 22+
- npm 10+
- Chromium, Firefox, and WebKit installed for Playwright tests

Set up a clean checkout:

```sh
npm ci
npx playwright install chromium firefox webkit
```

Useful commands:

| Command                     | Purpose                                                              |
| --------------------------- | -------------------------------------------------------------------- |
| `npm test`                  | Fast deterministic and seeded randomized tests                       |
| `npm run test:coverage`     | Tests with 100% line, branch, statement, and function thresholds     |
| `npm run test:stress`       | Five 1000×1000 correctness and stack-safety scenarios                |
| `npm run test:performance`  | Performance guards and repeatable benchmarks                         |
| `npm run build`             | ESM, CommonJS, source maps, and declarations                         |
| `npm run test:package`      | Pack, install, and test clean Node/TypeScript/browser consumers      |
| `npm run test:package:node` | Pack, install, and test Node/TypeScript consumers without browsers   |
| `npm run verify:fast`       | Formatting, lint, types, and coverage for the edit loop              |
| `npm run verify`            | Every quality, stress, build, package, browser, and performance gate |

`npm run test:package` builds automatically through the npm `prepack` lifecycle, creates its own temporary consumer directory, and removes both it and the generated tarball after the checks.

## Test coverage

The suite covers:

- the exact 5×5 assignment example;
- empty, all-marked, and all-unmarked matrices;
- orthogonal, diagonal-only, branched, bridged, holed, and boundary-touching figures;
- readonly input, immutability, and repeat calls;
- malformed, ragged, sparse, non-boolean, and over-limit inputs;
- 500 deterministically seeded differential cases against an independent reference implementation;
- five million-cell stress shapes;
- ESM, CommonJS, TypeScript, Vite-bundled, and raw-ESM consumption from the packed tarball in Chromium, Firefox, and WebKit.

The production source is held to 100% statements, branches, functions, and lines.

## Performance

Measured on Windows with Node.js 22.22.3. Each benchmark processes a 1000×1000 matrix and includes validation, snapshot creation, and counting.

| Matrix                    |     Mean |    Throughput |
| ------------------------- | -------: | ------------: |
| All unmarked              |  5.35 ms | 186.79 runs/s |
| All marked                | 14.72 ms |  67.92 runs/s |
| Checkerboard              | 10.13 ms |  98.68 runs/s |
| Vertical stripes          |  9.79 ms | 102.15 runs/s |
| Seeded random, 38% marked | 15.14 ms |  66.04 runs/s |

Results vary by hardware and runtime. The automated guard uses a deliberately broad five-second ceiling and a relative scaling check to detect catastrophic or cell-count-quadratic regressions without relying on fragile tight timing thresholds.

## Packaging without publishing

Inspect exactly what npm would include:

```sh
npm run build
npm run pack:check
npm run lint:package
```

Create the local tarball when needed:

```sh
npm pack
```

Do not run `npm publish` for this assignment.

The npm name `matrix-figure-counter` was previously unpublished. Before any future public release, the publisher must confirm registry ownership and choose a version that has never been published.

## License

MIT
