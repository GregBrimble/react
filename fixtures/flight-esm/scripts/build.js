import { context } from "esbuild";
import { join, relative } from "path";
import { argv } from "process";
import { fileURLToPath } from "url";
import { parseArgs } from "util";
import chokidar from "chokidar";
import { cpSync, rmSync } from "fs";

const { values } = parseArgs({
  args: argv.slice(2),
  options: {
    watch: { type: "boolean", short: "w" },
  },
});

const watch = !!values.watch;

const teardownFunctions = [];

let tornDown = false;
const teardown = async () => {
  if (tornDown) return;

  console.log("Disposing...");
  await Promise.allSettled(
    teardownFunctions.map((teardownFunction) => teardownFunction()),
  );
  tornDown = true;
  console.log("Done.");
};
process.on("SIGINT", (code) => {
  console.log("\nSIGINT detected. Exiting gracefully...");
  process.exit(code);
});
process.on("beforeExit", async (code) => {
  await teardown();
  process.exit(code);
});

const copyDirectory = (source, destination) => {
  let resolveReadyPromise;
  const readyPromise = new Promise((resolve) => {
    resolveReadyPromise = resolve;
  });

  const watcher = chokidar
    .watch(source, {
      persistent: true,
    })
    .on("all", (event, filePath) => {
      const destinationFilePath = join(destination, relative(source, filePath));

      switch (event) {
        case "add":
        case "addDir":
        case "change":
          cpSync(filePath, destinationFilePath, {
            recursive: true,
          });
          break;
        case "unlink":
        case "unlinkDir":
          rmSync(destinationFilePath, {
            recursive: true,
            force: true,
          });
      }
    })
    .on("ready", () => {
      resolveReadyPromise(watcher);
    });

  teardownFunctions.push(watcher.close.bind(watcher));

  return readyPromise;
};

const cleanCopyDirectory = (source, destination) => {
  rmSync(destination, {
    recursive: true,
    force: true,
  });

  return copyDirectory(source, destination);
};

const buildWithEsbuild = async (...args) => {
  const ctx = await context(...args);

  teardownFunctions.push(ctx.dispose);

  return watch ? ctx.watch() : ctx.rebuild();
};

const compileSourceForGlobalWorker = () =>
  buildWithEsbuild({
    entryPoints: [fileURLToPath(new URL("../src/*", import.meta.url))],
    outdir: fileURLToPath(new URL("../global-worker/src", import.meta.url)),
  });

const compileSourceForRegionWorker = () =>
  buildWithEsbuild({
    entryPoints: [fileURLToPath(new URL("../src/*", import.meta.url))],
    outdir: fileURLToPath(new URL("../region-worker/src", import.meta.url)),
  });

const compileGlobalWorker = () =>
  buildWithEsbuild({
    entryPoints: [
      fileURLToPath(new URL("../global-worker/index.ts", import.meta.url)),
      fileURLToPath(new URL("../global-worker/src/*", import.meta.url)),
    ],
    outdir: fileURLToPath(
      new URL("../dist/global/_worker.js", import.meta.url),
    ),
    platform: "node",
    format: "esm",
    bundle: true,
    splitting: true,
    mainFields: ["workerd", "module", "main", "browser"],
    define: {
      "process.env.NODE_ENV": JSON.stringify(
        process.env.NODE_ENV || "production",
      ),
    },
  });

const compileRegionWorker = () =>
  buildWithEsbuild({
    entryPoints: [
      fileURLToPath(new URL("../region-worker/index.ts", import.meta.url)),
      fileURLToPath(new URL("../region-worker/src/*", import.meta.url)),
    ],
    outdir: fileURLToPath(
      new URL("../dist/region/_worker.js", import.meta.url),
    ),
    platform: "node",
    format: "esm",
    bundle: true,
    splitting: true,
    mainFields: ["workerd", "module", "main", "browser"],
    define: {
      "process.env.NODE_ENV": JSON.stringify(
        process.env.NODE_ENV || "production",
      ),
    },
  });

const copyPublicDirectoryToGlobalDist = () =>
  cleanCopyDirectory(
    fileURLToPath(new URL("../public", import.meta.url)),
    fileURLToPath(new URL("../dist/global", import.meta.url)),
  );

const copyReactBuildToNodeModules = () =>
  copyDirectory(
    fileURLToPath(new URL("../../../build/oss-experimental", import.meta.url)),
    fileURLToPath(new URL("../node_modules", import.meta.url)),
  );

const copyNodeModulesToGlobalDist = () =>
  cleanCopyDirectory(
    fileURLToPath(
      new URL("../node_modules/react-server-dom-esm/esm", import.meta.url),
    ),
    fileURLToPath(
      new URL("../dist/global/nm/react-server-dom-esm/esm", import.meta.url),
    ),
  );

const copyGlobalWorkerSourceToGlobalDist = () =>
  cleanCopyDirectory(
    fileURLToPath(new URL("../global-worker/src", import.meta.url)),
    fileURLToPath(new URL("../dist/global/src", import.meta.url)),
  );

console.log(`Building for ${process.env.NODE_ENV || "production"}...`);

await Promise.all([
  copyPublicDirectoryToGlobalDist(),
  copyReactBuildToNodeModules().then(
    Promise.all([
      Promise.all([
        compileSourceForGlobalWorker().then(copyGlobalWorkerSourceToGlobalDist),
        copyNodeModulesToGlobalDist(),
      ]).then(compileGlobalWorker()),

      compileSourceForRegionWorker().then(compileRegionWorker),
    ]),
  ),
]);

if (watch) {
  console.log("Watching...");
} else {
  await teardown();
}
