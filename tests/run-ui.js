import { build } from "esbuild";
import { spawnSync } from "node:child_process";
import { mkdir, rm } from "node:fs/promises";
await mkdir(".test-temp", { recursive: true });
try {
  await build({
    entryPoints: ["tests/ui.jsx"],
    outdir: ".test-temp",
    outExtension: { ".js": ".mjs" },
    splitting: true,
    bundle: true,
    platform: "node",
    format: "esm",
    packages: "external",
    jsx: "automatic",
    plugins: [
      {
        name: "motion-dom-test",
        setup(b) {
          b.onResolve({ filter: /^framer-motion$/ }, () => ({
            path: process.cwd() + "/tests/motion-mock.jsx",
          }));
        },
      },
    ],
  });
  const result = spawnSync(process.execPath, [".test-temp/ui.mjs"], {
    stdio: "inherit",
    timeout: 60000,
  });
  process.exitCode = result.status ?? 1;
} finally {
  await rm(".test-temp", { recursive: true, force: true });
}
