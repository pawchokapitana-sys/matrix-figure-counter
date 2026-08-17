import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  tsconfig: "tsconfig.lib.json",
  format: ["esm", "cjs"],
  target: "es2020",
  platform: "neutral",
  dts: true,
  sourcemap: true,
  splitting: false,
  treeshake: true,
  clean: true,
  outExtension({ format }) {
    return { js: format === "cjs" ? ".cjs" : ".js" };
  },
});
