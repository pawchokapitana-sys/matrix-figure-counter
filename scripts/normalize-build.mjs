import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const outputFiles = ["dist/index.js", "dist/index.cjs"];

for (const relativePath of outputFiles) {
  const outputPath = path.join(projectRoot, relativePath);
  const lines = (await readFile(outputPath, "utf8")).trimEnd().split(/\r?\n/);

  while (
    lines.length >= 2 &&
    lines.at(-1)?.startsWith("//# sourceMappingURL=") === true &&
    lines.at(-1) === lines.at(-2)
  ) {
    lines.splice(-1, 1);
  }

  const sourceMapComments = lines.filter((line) => line.startsWith("//# sourceMappingURL="));
  if (sourceMapComments.length !== 1 || lines.at(-1) !== sourceMapComments[0]) {
    throw new Error(`${relativePath} must end with exactly one source-map reference.`);
  }

  const sourceMapName = sourceMapComments[0].slice("//# sourceMappingURL=".length);
  const sourceMapPath = path.join(path.dirname(outputPath), sourceMapName);
  JSON.parse(await readFile(sourceMapPath, "utf8"));

  await writeFile(outputPath, `${lines.join("\n")}\n`);
}
