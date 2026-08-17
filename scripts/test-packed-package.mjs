import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { chromium, firefox, webkit } from "@playwright/test";

const require = createRequire(import.meta.url);
const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const temporaryPrefix = path.join(tmpdir(), "matrix-figure-counter-consumer-");
const npmCli = process.env.npm_execpath;
const skipBrowserChecks = process.argv.includes("--no-browser");
const browserTypes = [chromium, firefox, webkit];

if (npmCli === undefined) {
  throw new Error("npm_execpath is unavailable; run this check through npm run test:package.");
}

function runNode(arguments_, workingDirectory, captureOutput = false) {
  const result = spawnSync(process.execPath, arguments_, {
    cwd: workingDirectory,
    encoding: "utf8",
    stdio: captureOutput ? "pipe" : "inherit",
  });

  if (result.status !== 0) {
    throw new Error(
      `Command failed (${result.status ?? "no exit code"}): node ${arguments_.join(" ")}\n${result.stdout ?? ""}${result.stderr ?? ""}`,
    );
  }

  return result.stdout ?? "";
}

function runNpm(arguments_, workingDirectory, captureOutput = false) {
  return runNode([npmCli, ...arguments_], workingDirectory, captureOutput);
}

function parsePackResult(output) {
  const jsonStart = output.lastIndexOf("\n[");
  return JSON.parse(jsonStart === -1 ? output : output.slice(jsonStart + 1));
}

async function reservePort() {
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  assert(address !== null && typeof address !== "string");
  const { port } = address;
  await new Promise((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
  return port;
}

async function waitForServer(url, process_) {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    if (process_.exitCode !== null) {
      throw new Error(`Vite exited before becoming ready (code ${process_.exitCode}).`);
    }
    try {
      const response = await fetch(url);
      if (response.ok) {
        return;
      }
    } catch {
      // The server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("Timed out waiting for the browser consumer fixture.");
}

async function stopProcess(process_) {
  if (process_ === undefined || process_.exitCode !== null) {
    return;
  }

  const exited = once(process_, "exit");
  process_.kill();
  await Promise.race([exited, new Promise((resolve) => setTimeout(resolve, 5_000))]);
}

const assignmentMatrix = `[
  [true, false, false, false, false],
  [true, false, true, true, false],
  [false, true, false, true, false],
  [false, true, true, true, false],
  [false, false, false, false, true],
]`;

let temporaryDirectory;
let tarballPath;
let viteProcess;
let browser;

try {
  const packOutput = runNpm(["pack", "--json", "--silent"], projectRoot, true);
  const packResult = parsePackResult(packOutput);
  assert(Array.isArray(packResult) && typeof packResult[0]?.filename === "string");
  tarballPath = path.resolve(projectRoot, packResult[0].filename);

  temporaryDirectory = await mkdtemp(temporaryPrefix);
  await writeFile(
    path.join(temporaryDirectory, "package.json"),
    `${JSON.stringify({ name: "packed-consumer", private: true, type: "module" }, null, 2)}\n`,
  );
  runNpm(
    ["install", "--ignore-scripts", "--no-audit", "--no-fund", tarballPath],
    temporaryDirectory,
  );

  await writeFile(
    path.join(temporaryDirectory, "esm.mjs"),
    `import { countFigures } from "matrix-figure-counter";\nif (countFigures(${assignmentMatrix}) !== 3) throw new Error("ESM result mismatch");\n`,
  );
  await writeFile(
    path.join(temporaryDirectory, "commonjs.cjs"),
    `const { countFigures } = require("matrix-figure-counter");\nif (countFigures(${assignmentMatrix}) !== 3) throw new Error("CommonJS result mismatch");\n`,
  );
  await writeFile(
    path.join(temporaryDirectory, "consumer.ts"),
    `import { countFigures, type BooleanMatrix } from "matrix-figure-counter";\nconst matrix: BooleanMatrix = ${assignmentMatrix};\nconst result: number = countFigures(matrix);\nvoid result;\n`,
  );

  runNode([path.join(temporaryDirectory, "esm.mjs")], temporaryDirectory);
  runNode([path.join(temporaryDirectory, "commonjs.cjs")], temporaryDirectory);
  const typescriptCli = require.resolve("typescript/bin/tsc");
  runNode(
    [
      typescriptCli,
      "--noEmit",
      "--strict",
      "--skipLibCheck",
      "--target",
      "ES2020",
      "--module",
      "NodeNext",
      "--moduleResolution",
      "NodeNext",
      path.join(temporaryDirectory, "consumer.ts"),
    ],
    temporaryDirectory,
  );

  await writeFile(
    path.join(temporaryDirectory, "index.html"),
    '<!doctype html><html><body><output id="result"></output><script type="module" src="/main.js"></script></body></html>\n',
  );
  await writeFile(
    path.join(temporaryDirectory, "main.js"),
    `import { countFigures } from "matrix-figure-counter";\nconst result = countFigures(${assignmentMatrix});\ndocument.querySelector("#result").textContent = String(result);\n`,
  );

  if (!skipBrowserChecks) {
    const port = await reservePort();
    const url = `http://127.0.0.1:${port}`;
    const viteEntry = require.resolve("vite");
    const viteCli = path.resolve(path.dirname(viteEntry), "../../bin/vite.js");
    let viteErrors = "";
    viteProcess = spawn(
      process.execPath,
      [viteCli, "--host", "127.0.0.1", "--port", String(port), "--strictPort"],
      { cwd: temporaryDirectory, stdio: ["ignore", "ignore", "pipe"] },
    );
    viteProcess.stderr?.on("data", (chunk) => {
      viteErrors += String(chunk);
    });
    await waitForServer(url, viteProcess).catch((error) => {
      throw new Error(`${error instanceof Error ? error.message : String(error)}\n${viteErrors}`);
    });

    const packedEsmSource = await readFile(
      path.join(temporaryDirectory, "node_modules/matrix-figure-counter/dist/index.js"),
      "utf8",
    );

    for (const browserType of browserTypes) {
      browser = await browserType.launch();
      try {
        const bundledPage = await browser.newPage();
        await bundledPage.goto(url);
        await bundledPage.waitForFunction(
          () => document.querySelector("#result")?.textContent === "3",
        );
        assert.equal(await bundledPage.textContent("#result"), "3");

        const nativeEsmPage = await browser.newPage();
        await nativeEsmPage.setContent(
          `<output id="result"></output><script type="module">${packedEsmSource}\ndocument.querySelector("#result").textContent = String(countFigures(${assignmentMatrix}));</script>`,
        );
        await nativeEsmPage.waitForFunction(
          () => document.querySelector("#result")?.textContent === "3",
        );
        assert.equal(await nativeEsmPage.textContent("#result"), "3");
        console.info(`${browserType.name()} passed bundled and native ESM checks.`);
      } finally {
        await browser.close();
        browser = undefined;
      }
    }
  }

  const packedPackage = JSON.parse(
    await readFile(
      path.join(temporaryDirectory, "node_modules/matrix-figure-counter/package.json"),
      "utf8",
    ),
  );
  assert.equal(packedPackage.name, "matrix-figure-counter");
  console.info(
    skipBrowserChecks
      ? "Packed package passed ESM, CommonJS, and TypeScript consumer checks."
      : "Packed package passed ESM, CommonJS, TypeScript, Chromium, Firefox, and WebKit consumer checks.",
  );
} finally {
  await browser?.close();
  await stopProcess(viteProcess);

  if (
    temporaryDirectory !== undefined &&
    path.dirname(temporaryDirectory) === path.resolve(tmpdir()) &&
    path.basename(temporaryDirectory).startsWith("matrix-figure-counter-consumer-")
  ) {
    await rm(temporaryDirectory, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  }

  if (
    tarballPath !== undefined &&
    path.dirname(tarballPath) === path.resolve(projectRoot) &&
    tarballPath.endsWith(".tgz")
  ) {
    await rm(tarballPath, { force: true });
  }
}
