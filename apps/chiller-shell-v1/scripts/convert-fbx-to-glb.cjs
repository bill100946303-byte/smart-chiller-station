const fs = require("fs");
const path = require("path");
const childProcess = require("child_process");
const convert = require("fbx2gltf");

function printUsage() {
  console.log("Usage: npm run model:convert -- <input.fbx> <output.glb>");
}

async function main() {
  const [, , inputArg, outputArg] = process.argv;
  if (!inputArg || !outputArg) {
    printUsage();
    process.exitCode = 1;
    return;
  }

  const inputPath = path.resolve(process.cwd(), inputArg);
  const outputPath = path.resolve(process.cwd(), outputArg);
  const outputDir = path.dirname(outputPath);

  if (!fs.existsSync(inputPath)) {
    throw new Error(`Input FBX not found: ${inputPath}`);
  }

  fs.mkdirSync(outputDir, { recursive: true });

  console.log(`[model:convert] input: ${inputPath}`);
  console.log(`[model:convert] output: ${outputPath}`);

  const shouldSkipFbx2Gltf = process.platform === "darwin" && process.arch === "arm64";

  if (!shouldSkipFbx2Gltf) {
    try {
      const resultPath = await convert(inputPath, outputPath, []);
      console.log(`[model:convert] done via fbx2gltf: ${resultPath}`);
      return;
    } catch (error) {
      console.warn(
        `[model:convert] fbx2gltf failed, falling back to Blender: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  } else {
    console.log("[model:convert] arm64 macOS detected, skipping fbx2gltf and using Blender directly");
  }

  const blenderScriptPath = path.resolve(__dirname, "blender-fbx-to-glb.py");
  const blenderBinary = "/Applications/Blender.app/Contents/MacOS/Blender";
  const shellCommand = [
    "env",
    "BLENDER_SYSTEM_GPU_BACKEND=OPENGL",
    `"${blenderBinary}"`,
    "--background",
    "--python",
    `"${blenderScriptPath}"`,
    "--",
    `"${inputPath}"`,
    `"${outputPath}"`
  ].join(" ");
  const blenderResult = childProcess.spawnSync(
    "/bin/zsh",
    ["-lc", shellCommand],
    {
      cwd: process.cwd(),
      encoding: "utf8"
    }
  );

  if (blenderResult.status !== 0) {
    throw new Error(
      [
        "Blender export failed.",
        blenderResult.stdout?.trim(),
        blenderResult.stderr?.trim()
      ]
        .filter(Boolean)
        .join("\n")
    );
  }

  console.log("[model:convert] done via Blender");
}

main().catch((error) => {
  console.error(`[model:convert] failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
