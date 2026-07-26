import * as esbuild from "esbuild";

const watch = process.argv.includes("--watch");
const options = {
  entryPoints: ["src/extension.ts"],
  bundle: true,
  external: ["vscode"],
  format: "cjs",
  platform: "node",
  target: "node20",
  outfile: "dist/extension.js",
  sourcemap: true,
  sourcesContent: false,
  logLevel: "info",
};

if (watch) {
  const context = await esbuild.context(options);
  await context.watch();
  console.log("Watching Reticle sources...");
} else {
  await esbuild.build(options);
}
