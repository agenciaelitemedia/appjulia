import fs from "fs";
import path from "path";

/**
 * Auto-bump PATCH on every production build (each publish).
 * MINOR/MAJOR are managed manually by editing public/version.json.
 * Rule: the highest of (package.json.version, public/version.json.version)
 * defines MAJOR.MINOR; PATCH is incremented from public/version.json each build.
 * Returns the resolved version to embed in the build.
 */
export function autoBumpVersion(root: string): string {
  const pkgPath = path.resolve(root, "package.json");
  const publicVersionPath = path.resolve(root, "public", "version.json");

  let pkg: any = {};
  try {
    pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
  } catch {}
  const pkgVersion: string = pkg.version || "0.0.0";

  let publicVersion = pkgVersion;
  try {
    publicVersion = JSON.parse(fs.readFileSync(publicVersionPath, "utf-8")).version || pkgVersion;
  } catch {}

  // Pick the highest MAJOR.MINOR between package.json and public/version.json.
  // This lets the user bump MINOR/MAJOR by editing either file manually.
  const parse = (v: string) => v.split(".").map((n) => parseInt(n, 10) || 0);
  const [pMaj, pMin, pPat] = parse(publicVersion);
  const [kMaj, kMin] = parse(pkgVersion);

  let major = pMaj;
  let minor = pMin;
  let patch = pPat;
  if (kMaj > pMaj || (kMaj === pMaj && kMin > pMin)) {
    major = kMaj;
    minor = kMin;
    patch = 0;
  }

  // Auto-increment PATCH on every build (each publish = new version).
  const next = `${major}.${minor}.${patch + 1}`;

  try {
    pkg.version = next;
    fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");
    fs.mkdirSync(path.dirname(publicVersionPath), { recursive: true });
    fs.writeFileSync(publicVersionPath, JSON.stringify({ version: next }));
    console.log(`[auto-version] ${publicVersion} -> ${next}`);
  } catch (e) {
    console.warn("[auto-version] failed to write version files", e);
    return publicVersion;
  }

  return next;
}