const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const rootDir = path.resolve(__dirname, "..");
const distDir = path.join(rootDir, "dist");
const releaseDir = path.join(distDir, ".chrome-webstore-release");
const zipPath = path.join(distDir, "youtube-looper-extension-chrome-webstore.zip");
const envLocalPath = path.join(rootDir, "env.local");

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return {};
  }

  const parsed = {};
  const source = fs.readFileSync(filePath, "utf8");

  for (const rawLine of source.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const separatorIndex = line.indexOf("=");
    if (separatorIndex === -1) continue;

    const key = line.slice(0, separatorIndex).trim();
    let value = line.slice(separatorIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    parsed[key] = value;
  }

  return parsed;
}

const fileEnv = parseEnvFile(envLocalPath);
const requiredEnv = {
  measurementId:
    fileEnv.GA_MEASUREMENT_ID?.trim() || process.env.GA_MEASUREMENT_ID?.trim(),
  apiSecret:
    fileEnv.GA_API_SECRET?.trim() || process.env.GA_API_SECRET?.trim(),
};

if (!requiredEnv.measurementId || !requiredEnv.apiSecret) {
  console.error(
    "Missing GA release config. Add GA_MEASUREMENT_ID and GA_API_SECRET to env.local."
  );
  process.exit(1);
}

const copyTargets = [
  "background.js",
  "content.js",
  "content.css",
  "manifest.json",
  "popup.html",
  "popup.js",
  "icons",
];

function ensureCleanDir(dirPath) {
  fs.rmSync(dirPath, { recursive: true, force: true });
  fs.mkdirSync(dirPath, { recursive: true });
}

function copyRecursive(sourcePath, targetPath) {
  const stat = fs.statSync(sourcePath);

  if (stat.isDirectory()) {
    fs.mkdirSync(targetPath, { recursive: true });
    for (const childName of fs.readdirSync(sourcePath)) {
      copyRecursive(
        path.join(sourcePath, childName),
        path.join(targetPath, childName)
      );
    }
    return;
  }

  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.copyFileSync(sourcePath, targetPath);
}

function injectReleaseAnalyticsConfig(filePath) {
  const source = fs.readFileSync(filePath, "utf8");
  const next = source.replace(
    /const ANALYTICS_CONFIG = \{[\s\S]*?\n\};/,
    `const ANALYTICS_CONFIG = {
  measurementId: ${JSON.stringify(requiredEnv.measurementId)},
  apiSecret: ${JSON.stringify(requiredEnv.apiSecret)},
  debug: false,
};`
  );

  if (source === next) {
    throw new Error("Failed to inject ANALYTICS_CONFIG into background.js");
  }

  fs.writeFileSync(filePath, next);
}

function createZipArchive(sourceDir, targetZipPath) {
  fs.rmSync(targetZipPath, { force: true });
  execFileSync(
    "zip",
    ["-r", "-X", targetZipPath, "."],
    {
      cwd: sourceDir,
      stdio: "ignore",
      env: {
        ...process.env,
        COPYFILE_DISABLE: "1",
      },
    }
  );
}

ensureCleanDir(releaseDir);

for (const target of copyTargets) {
  copyRecursive(path.join(rootDir, target), path.join(releaseDir, target));
}

injectReleaseAnalyticsConfig(path.join(releaseDir, "background.js"));
createZipArchive(releaseDir, zipPath);
fs.rmSync(releaseDir, { recursive: true, force: true });

console.log(`Release zip created at ${zipPath}`);
