# Matrix Figure Counter — Detailed Design

Status: **Proposed; awaiting approval**

This document is the implementation contract for the LucidLink TypeScript home assignment. The repository will contain only this design until it is approved; package scaffolding and source code belong to the implementation phase.

## 1. Objective

Build a production-ready TypeScript library that counts connected figures in a two-dimensional matrix. A figure is one or more marked cells connected through their top, bottom, left, or right sides. Diagonal contact does not connect figures.

The library will:

- expose a small, typed, side-effect-free API;
- run in Node.js and modern browsers;
- be packaged for npm without publishing it;
- handle a 1000 × 1000 matrix comfortably;
- avoid recursion and input mutation;
- include correctness, randomized, stress, browser, packaging, and performance verification;
- have no runtime dependencies.

## 2. Requirement Traceability

| PDF requirement                    | Design response                                                               | Verification                                                                              |
| ---------------------------------- | ----------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Accept a 2D marked/unmarked matrix | Use a readonly boolean matrix                                                 | Type tests and runtime validation tests                                                   |
| Count contiguous marked groups     | Export `countFigures`                                                         | Unit and randomized differential tests                                                    |
| Side connectivity only             | Explore exactly four orthogonal neighbors                                     | Diagonal and mixed-connectivity tests                                                     |
| TypeScript                         | Strict TypeScript source and declarations                                     | `tsc --noEmit` and package type checks                                                    |
| Production-ready library           | Defined contract, validation, errors, docs, quality gates                     | Full verification pipeline                                                                |
| Node.js and browser compatible     | Environment-neutral source; ESM and CJS builds; browser smoke test            | Node 22/24/26 tests and Chromium, Firefox, and WebKit smoke tests                         |
| Prepared for npm publishing        | Metadata, exports map, declarations, source maps, `files`, package validation | Build, `publint`, type-package check, pack inspection, and clean-fixture tarball installs |
| Arbitrarily sized matrices         | No fixed row/column assumptions or recursion; linear algorithm                | Boundary, stress, and large-input tests                                                   |
| Acceptable for 1000 × 1000         | O(rows × columns) time with compact typed buffers                             | Dedicated stress tests and benchmarks                                                     |
| PDF example returns 3              | Reproduce the exact 5 × 5 matrix                                              | Named acceptance test                                                                     |

“Arbitrarily sized” means there is no fixed row or column shape and the algorithm does not rely on recursion. The precise supported range is `rowCount × columnCount <= 4_294_967_295`, with a safe-integer product, and with enough host memory for both the caller’s input and the algorithm’s auxiliary typed buffers. Buffer allocation can fail below that theoretical index limit when the host has less memory.

## 3. Public API

```ts
export type BooleanMatrix = readonly (readonly boolean[])[];

export function countFigures(matrix: BooleanMatrix): number;
```

Only a named export is proposed. There are no configuration options because the assignment defines a single connectivity rule and a single marked representation. A deliberately small API is easier to learn, optimize, test, and maintain.

Example:

```ts
import { countFigures } from "matrix-figure-counter";

const matrix = [
  [true, false, false, false, false],
  [true, false, true, true, false],
  [false, true, false, true, false],
  [false, true, true, true, false],
  [false, false, false, false, true],
] as const;

countFigures(matrix); // 3
```

The package name will be `matrix-figure-counter`. It is intentionally unscoped and does not claim LucidLink’s npm namespace. The package will be packed and installed locally but not published, so registry-name availability is outside this assignment’s scope.

## 4. Input and Behavioral Contract

### Valid input

- The outer value is an array.
- Every row is an array.
- Every row has the same length, including zero-length rows.
- Every cell is exactly `true` or `false`.
- `true` means marked and `false` means unmarked.
- Readonly and frozen arrays are accepted because the algorithm never mutates input.

### Defined results

| Input                                 |                           Result |
| ------------------------------------- | -------------------------------: |
| `[]`                                  |                              `0` |
| `[[]]` or multiple empty rows         |                              `0` |
| All `false`                           |                              `0` |
| One `true`                            |                              `1` |
| All `true` in a non-empty rectangle   |                              `1` |
| Marked cells touching only diagonally | One figure per disconnected cell |

### Invalid input

Runtime validation is included for JavaScript consumers and unsafe TypeScript calls.

- Non-array matrix, non-array row, ragged rows, sparse cells, and non-boolean cells throw `TypeError` with the offending row/column where applicable.
- A sparse outer array is an invalid row and throws `TypeError`; a sparse row is an invalid cell and throws `TypeError` with its row and column.
- A matrix with an unsafe flattened-size product or more than `4_294_967_295` cells throws `RangeError` before buffer allocation.
- Host allocation failure below that explicit limit is not translated. Depending on the JavaScript host, allocation may throw a native error or terminate the process; the library cannot normalize unrecoverable out-of-memory behavior.

Standard error classes keep the public surface small and interoperable. Error message wording will be tested only where it adds diagnostic value; callers should rely on the error class rather than parse text.

## 5. Algorithm

### Selected approach: iterative depth-first flood fill over a compact snapshot

1. Validate that the outer value and each row are arrays and that all rows have one width.
2. Compute `cellCount = rowCount × columnCount` using safe-integer checks.
3. Copy and validate the cells into a flat `Uint8Array`:
   - `0` = unmarked or already consumed;
   - `1` = marked and not yet consumed.
4. Scan the flat buffer in row-major order.
5. When a `1` is found:
   - increment the figure count;
   - mark it consumed before adding it to the work stack;
   - iteratively consume every marked top, bottom, left, and right neighbor.
6. Return the figure count.

The work stack is a lazily allocated `Uint32Array` sized for at most all cells. It is used as a LIFO stack with an integer cursor. Marking a cell before pushing it guarantees that every marked cell is pushed at most once and the fixed capacity cannot overflow. The explicit `4_294_967_295`-cell guard ensures every flattened index fits in an unsigned 32-bit stack entry.

### Why snapshot the matrix

The snapshot performs runtime validation and conversion in one pass, keeps the caller’s matrix unchanged, and makes traversal operate over compact contiguous memory rather than nested JavaScript arrays. It also replaces a separate visited bitmap: a consumed cell is changed from `1` to `0` only in the private snapshot.

### Boundary handling

A flattened cell index is converted to its row and column during traversal. Neighbor checks are explicit:

- left only when `column > 0`;
- right only when `column + 1 < columnCount`;
- top only when `row > 0`;
- bottom only when `row + 1 < rowCount`.

No diagonal offsets exist in the implementation, which makes accidental diagonal connectivity structurally difficult.

### Complexity

- Time: **O(rows × columns)**. Validation/copy and traversal are each linear; every marked cell enters the stack once.
- Auxiliary memory: **O(rows × columns)**, represented compactly as roughly one byte per cell for the snapshot plus up to four bytes per cell for the worst-case stack.
- Call stack: **O(1)** because traversal is iterative.

For a 1000 × 1000 matrix, the algorithm’s private typed storage is approximately 5 MB in the worst case, excluding small fixed overhead. For an all-unmarked matrix, the work stack remains unallocated, so private storage is approximately 1 MB. The memory contract is therefore input memory plus up to approximately five bytes per cell; merely fitting the input matrix in memory is not sufficient.

## 6. Alternatives Considered

### Recursive DFS

Rejected. It is short, but a large connected figure can exceed the JavaScript call-stack limit, contradicting the large-input requirement.

### Mutating the caller’s matrix

Rejected. It reduces private memory but creates a surprising side effect, prevents safe reuse of the input, and fails for readonly/frozen matrices.

### `Set<string>` or object-based visited storage

Rejected. String keys and per-entry object/hash overhead are materially slower and larger than typed contiguous storage for a million cells.

### Union-find / connected-component labeling

Rejected for the first version. It also provides near-linear behavior but adds label management and merge complexity without improving the required output. Flood fill is easier to audit and is fast enough for the stated scale.

### Configurable predicates or diagonal mode

Rejected. They are not required, complicate optimization and typing, and broaden the contract before a real use case exists.

## 7. Internal Structure

The proposed repository remains intentionally small:

```text
.
├── src/
│   ├── count-figures.ts       # Public type/function and private validation/traversal helpers
│   └── index.ts               # Explicit public exports only
├── tests/
│   ├── count-figures.spec.ts  # Examples, edges, validation, immutability
│   ├── randomized.spec.ts     # Seeded differential tests against a simple reference
│   ├── stress.spec.ts         # 1000 × 1000 correctness and stack-safety cases
│   └── browser/               # Built-package cross-engine smoke test and fixture
├── benchmarks/
│   └── count-figures.bench.ts # Repeatable large-matrix benchmark scenarios
├── README.md
├── LICENSE
├── package.json
├── tsconfig.json
├── tsup.config.ts
├── vitest.config.ts
├── playwright.config.ts
├── eslint.config.js
├── .prettierrc.json
└── package-lock.json
```

There will be no classes, service layer, dependency-injection container, or generic matrix abstraction. Private helpers will exist only when they make validation and traversal easier to understand or test through the public behavior.

## 8. TypeScript and Code-Quality Rules

- Strict compiler mode.
- `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `useUnknownInCatchVariables`, and switch/override safety flags where applicable.
- Public inputs are readonly; no type assertions at the public boundary that bypass validation.
- Named exports and explicit return types on exported symbols.
- TSDoc on the public type and function, including complexity, errors, immutability, and connectivity semantics.
- No `any`, non-null assertions only after a local invariant is established, and no environment-specific globals in source.
- ESLint with type-aware TypeScript rules plus Prettier for deterministic formatting.
- Zero runtime dependencies.
- Source maps and declaration maps in published output for consumer debugging.

## 9. Packaging Design

The package will be named `matrix-figure-counter`, versioned `1.0.0`, and licensed under MIT. The supported runtime contract is Node.js 22 or newer and browsers with native ES modules, typed arrays, and ES2020 syntax support. The build target is ES2020.

The build will produce these exact public files:

- `dist/index.js`: ESM for browsers and Node.js;
- `dist/index.cjs`: CommonJS for Node.js;
- `dist/index.d.ts`: TypeScript declarations;
- matching JavaScript source maps and `dist/index.d.ts.map`.

With `"type": "module"`, the public entry metadata will be:

```json
{
  "main": "./dist/index.cjs",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js",
      "require": "./dist/index.cjs",
      "default": "./dist/index.js"
    }
  }
}
```

`package.json` will include:

- the concrete identity and entry metadata above plus description, keywords, and repository-neutral authoring metadata;
- `files: ["dist", "README.md", "LICENSE"]` or the equivalent minimal publish set;
- `sideEffects: false` for tree shaking;
- `engines.node: ">=22"` and an ES2020 build target;
- scripts for build, type checking, linting, formatting, unit tests, coverage, stress tests, browser tests, benchmarks, packing, and the complete verification pipeline.

The implementation phase will run package validation, `npm pack --dry-run` for content inspection, and a real `npm pack`. The generated tarball will be installed into clean consumer fixtures for Node ESM, Node CommonJS, TypeScript, and browser-bundler tests. It will not run `npm publish`.

## 10. Test Strategy

### Deterministic unit tests

- empty outer matrix and zero-width matrices;
- single marked/unmarked cells;
- all-marked and all-unmarked rectangles;
- horizontal and vertical connections;
- diagonal-only cells remain separate;
- a late orthogonal bridge merges what initially looks like separate branches;
- figures with holes and figures touching every boundary;
- the PDF’s exact 5 × 5 example returns `3`;
- input remains deeply unchanged and frozen input works;
- repeated calls on the same matrix return the same result;
- each invalid-input category throws the correct error class.

### Randomized differential tests

A small, intentionally simple reference counter in test-only code will be compared with the production implementation across hundreds of deterministically seeded matrices with varied dimensions and densities. A fixed seed makes failures reproducible. This catches connectivity combinations that hand-written examples may miss without introducing a runtime dependency.

### Stress tests

The correctness suite will include 1000 × 1000 matrices for these worst-shape behaviors:

- all unmarked: full scan, zero traversal;
- all marked: one million-cell connected component and no recursion overflow;
- checkerboard: approximately 500,000 single-cell figures;
- stripes: many long components;
- deterministic pseudo-random density: mixed branches and boundaries.

Expected counts will be computed analytically where possible, not by duplicating the production algorithm.

### Browser compatibility

After a real `npm pack`, a clean browser fixture installs the tarball. Vite resolves and bundles the bare `matrix-figure-counter` import exactly as a consumer would, and headless Chromium, Firefox, and WebKit run representative examples including the PDF matrix. The same engines also execute the packed raw ESM artifact. Separate clean Node fixtures install the same tarball and exercise both ESM and CommonJS entry points. This verifies the packed consumer artifact rather than importing an internal relative build path.

### Coverage

The compact core is expected to reach 100% statements, branches, functions, and lines. Coverage is a guard against missed behavior, not a replacement for the scenario and randomized tests.

## 11. Performance Verification

Performance is verified in two complementary ways:

1. **Stress assertions** prove completion, correctness, and absence of call-stack failure at 1000 × 1000.
2. **Benchmarks** report warm-up-adjusted timings for all-unmarked, all-marked, checkerboard, striped, and seeded-random matrices.

The deterministic performance guard will run serially in one Node process after two warm-up executions. It will record the median of seven measured runs for 500 × 500 and 1000 × 1000 all-marked matrices. It must satisfy both:

- the 1000 × 1000 median is below 5 seconds; and
- its median is no more than 12 times the 500 × 500 median (linear work predicts approximately 4 times; the generous limit tolerates noisy machines while still detecting cell-count-quadratic behavior, which trends toward 16 times).

The guard also runs one correctness-checked 1000 × 1000 checkerboard case under the same five-second ceiling. Fine-grained timings for all scenarios are reported rather than tightly asserted. Benchmark output will record runtime version, operating system, matrix shape/density, iterations, mean/median, and throughput in cells per second.

The implementation handoff will include the actual benchmark results from this machine; this document intentionally does not invent numbers before code exists.

## 12. Verification Pipeline

`npm test` and `npm run verify:fast` will provide the short edit-time loop (type check, lint, unit, randomized, and coverage tests). As explicitly requested for the final handoff, one documented command (`npm run verify`) will run the complete suite in a deterministic order:

1. formatting check;
2. type-aware lint;
3. strict TypeScript type check;
4. unit, validation, randomized, and stress tests with coverage;
5. production build;
6. Node ESM/CommonJS package smoke tests;
7. real-browser ESM smoke test;
8. package metadata/export validation;
9. package tarball dry run, real pack, and clean-fixture installs;
10. performance guard and benchmark suite.

During implementation, each underlying command will also be run separately when diagnosing failures. Completion requires every gate to pass; skipped tests or unpublished benchmark output will be called out rather than treated as success.

## 13. README Plan

The README will contain:

- what the library does and the orthogonal-connectivity rule;
- installation from a local tarball/package and normal npm-style usage;
- the public API and the exact PDF example;
- input constraints, empty-input behavior, error behavior, and non-mutation guarantee;
- algorithm overview plus time and memory complexity;
- Node/browser and ESM/CommonJS usage;
- development commands and complete verification instructions;
- benchmark methodology and measured results;
- npm packaging instructions ending at `npm pack`/dry-run, explicitly stating that the package was not published;
- design trade-offs and current non-goals.

## 14. Implementation Sequence After Approval

1. Create package and strict toolchain configuration.
2. Write failing contract/unit tests for the API and PDF example.
3. Implement validation and compact snapshot creation.
4. Write failing connectivity, immutability, and invalid-input tests; implement iterative flood fill.
5. Add seeded differential and million-cell stress tests.
6. Configure ESM/CJS/declaration builds and package exports.
7. Add built-package Node and real-browser smoke tests.
8. Add lint, formatting, coverage, package validation, dry-run inspection, real packing, and clean-fixture installation gates.
9. Add performance guard/benchmarks and record results.
10. Write and verify the README against the finished package.
11. Run the complete verification pipeline from a clean install and report all results.

## 15. Approval Decisions

Unless changed during review, approval of this document approves these concrete choices:

1. The input representation is strictly `boolean[][]` (readonly-compatible); numeric `0/1` matrices are not accepted.
2. The public API is one named function, `countFigures`, plus the `BooleanMatrix` type.
3. Ragged and invalid matrices throw standard JavaScript error classes rather than returning a sentinel value.
4. The input is never mutated; private linear memory is accepted to guarantee that behavior and stack safety.
5. The first release supports only four-direction connectivity.
6. The concrete package is `matrix-figure-counter@1.0.0` under MIT, targets ES2020 and Node.js 22+, and ships `dist/index.js`, `dist/index.cjs`, and `dist/index.d.ts` through the stated exports map.
7. Packaging is validated with both dry-run inspection and a real tarball installed into clean consumer fixtures; it is never published.
8. Browser compatibility is demonstrated when Vite consumes the installed tarball by its bare package name and Chromium, Firefox, and WebKit execute both bundled and raw-ESM results.
9. The supported cell count is at most `4_294_967_295`, subject to safe multiplication and enough host memory for the input plus auxiliary buffers.

Any requested change to these decisions should be made in this design before implementation begins.

## 16. Definition of Done

Implementation is complete only when:

- the public behavior matches this approved document and every PDF requirement;
- all quality, correctness, stress, browser, packaging, and performance gates pass;
- the exact PDF example returns `3`;
- the package can be installed from its generated tarball in clean Node ESM, Node CommonJS, TypeScript, and browser-bundler consumer fixtures;
- the README is sufficient to install, use, test, benchmark, build, and pack the library;
- no publish action has occurred;
- the final handoff reports commands run, test counts/coverage, package contents, and measured performance.
