import fs from "fs";
import path from "path";
import { execSync } from "child_process";

type BumpKind = "major" | "minor" | "patch";

function detectBump(msg: string): BumpKind {
  const m = msg.toLowerCase();
  if (/breaking change/.test(m) || /^(feat|refactor|perf)(\([^)]*\))?!:/m.test(m)) return "major";
  if (/^(feat|feature)(\([^)]*\))?:/m.test(m)) return "minor";
  return "patch";
}

function applyBump(version: string, kind: BumpKind): string {
  const [maj, min, pat] = version.split(".").map((n) => parseInt(n, 10) || 0);
  if (kind === "major") return `${maj + 1}.0.0`;
  if (kind === "minor") return `${maj}.${min + 1}.0`;
  return `${maj}.${min}.${pat + 1}`;
}

/**
 * Auto-bump semver based on last commit message (Conventional Commits).
 * - Idempotent: if package.json version already changed vs public/version.json, skip bump.
 * Returns the resolved version to embed in the build.
 */
export function autoBumpVersion(root: string): string {
  const pkgPath = path.resolve(root, "package.json");
  const publicVersionPath = path.resolve(root, "public", "version.json");

  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
  const currentVersion: string = pkg.version || "0.0.0";

  let publishedVersion = currentVersion;
  try {
    publishedVersion = JSON.parse(fs.readFileSync(publicVersionPath, "utf-8")).version || currentVersion;
  } catch {
    // no previous version file
  }

  // Idempotency: manual bump already applied since last publish
  if (publishedVersion !== currentVersion) {
    try {
      fs.writeFileSync(publicVersionPath, JSON.stringify({ version: currentVersion }));
    } catch {}
    return currentVersion;
  }

  let lastMsg = "";
  try {
    lastMsg = execSync("git log -1 --pretty=%B", { cwd: root, stdio: ["ignore", "pipe", "ignore"] })
      .toString()
      .trim();
  } catch {
    // no git available -> patch bump
  }

  const kind = detectBump(lastMsg);
  const next = applyBump(currentVersion, kind);

  try {
    pkg.version = next;
    fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");
    fs.mkdirSync(path.dirname(publicVersionPath), { recursive: true });
    fs.writeFileSync(publicVersionPath, JSON.stringify({ version: next }));
    console.log(`[auto-version] ${currentVersion} -> ${next} (${kind})`);
  } catch (e) {
    console.warn("[auto-version] failed to write version files", e);
    return currentVersion;
  }

  return next;
}