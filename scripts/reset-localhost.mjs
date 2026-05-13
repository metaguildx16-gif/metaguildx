import fs from "node:fs";
import path from "node:path";

const workspaceRoot = process.cwd();
const targets = [
  path.join(workspaceRoot, "contracts", "deployments", "localhost.json"),
  path.join(workspaceRoot, "apps", "web", "src", "generated", "MetaGuildXSystem.json"),
  path.join(workspaceRoot, "apps", "web", ".env.local")
];

for (const target of targets) {
  if (fs.existsSync(target)) {
    fs.rmSync(target, { force: true });
    console.log(`Removed ${target}`);
  } else {
    console.log(`Skipped ${target} (not found)`);
  }
}

console.log("");
console.log("Local deployment files were cleared.");
console.log("To fully reset customer data, stop the Hardhat node and start it again before redeploying.");
