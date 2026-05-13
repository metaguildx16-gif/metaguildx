import fs from "fs";
import path from "path";

type DeployedAddresses = {
  Core: string;
  Income: string;
  Router: string;
  BinaryTree: string;
  Upgrade: string;
  CashbackPool: string;
  MGXStaking: string;
  MGXToken: string;
  TokenEngine: string;
  USDT: string;
  deployBlock: number;
};

const ROOT = path.join(__dirname, "..", "..");
const ADDRESSES_PATH = path.join(__dirname, "..", "deployed-addresses.json");
const WEB_ENV_PATH = path.join(ROOT, "apps", "web", ".env.local");
const ADMIN_CONFIG_PATH = path.join(ROOT, "apps", "admin", "src", "config", "contracts.ts");
const CHECKLIST_PATH = path.join(__dirname, "..", "DEPLOYMENT_CHECKLIST.md");

function loadAddresses(): DeployedAddresses {
  return JSON.parse(fs.readFileSync(ADDRESSES_PATH, "utf8")) as DeployedAddresses;
}

function upsertEnvValue(source: string, key: string, value: string | number) {
  const regex = new RegExp(`^${key}=.*$`, "m");
  const nextLine = `${key}=${value}`;
  if (regex.test(source)) {
    return source.replace(regex, nextLine);
  }
  return `${source.trimEnd()}\n${nextLine}\n`;
}

function main() {
  const addresses = loadAddresses();

  let webEnv = fs.readFileSync(WEB_ENV_PATH, "utf8");
  webEnv = upsertEnvValue(webEnv, "VITE_SYSTEM_ADDRESS", addresses.Core);
  webEnv = upsertEnvValue(webEnv, "VITE_SYSTEM_PROXY_ADDRESS", addresses.Core);
  webEnv = upsertEnvValue(webEnv, "VITE_CONTRACT_ADDRESS", addresses.Core);
  webEnv = upsertEnvValue(webEnv, "VITE_ROUTER_ADDRESS", addresses.Core);
  webEnv = upsertEnvValue(webEnv, "VITE_INCOME_ROUTER_ADDRESS", addresses.Router);
  webEnv = upsertEnvValue(webEnv, "VITE_INCOME_ENGINE_ADDRESS", addresses.Income);
  webEnv = upsertEnvValue(webEnv, "VITE_UPGRADE_ENGINE_ADDRESS", addresses.Upgrade);
  webEnv = upsertEnvValue(webEnv, "VITE_BINARY_TREE_ADDRESS", addresses.BinaryTree);
  webEnv = upsertEnvValue(webEnv, "VITE_CASHBACK_POOL_ADDRESS", addresses.CashbackPool);
  webEnv = upsertEnvValue(webEnv, "VITE_MGX_STAKING_ADDRESS", addresses.MGXStaking);
  webEnv = upsertEnvValue(webEnv, "VITE_MGX_TOKEN_ADDRESS", addresses.MGXToken);
  webEnv = upsertEnvValue(webEnv, "VITE_USDT_ADDRESS", addresses.USDT);
  webEnv = upsertEnvValue(webEnv, "VITE_DEPLOY_BLOCK", addresses.deployBlock);
  fs.writeFileSync(WEB_ENV_PATH, webEnv);
  console.log("Web .env.local updated ✅");

  let adminConfig = fs.readFileSync(ADMIN_CONFIG_PATH, "utf8");
  adminConfig = adminConfig.replace(/MetaGuildXCore:\s*ENV_CORE_ADDRESS\s*\|\|\s*"0x[a-fA-F0-9]{40}"/, `MetaGuildXCore: ENV_CORE_ADDRESS || "${addresses.Core}"`);
  adminConfig = adminConfig.replace(/MetaGuildXIncome:\s*"0x[a-fA-F0-9]{40}"/, `MetaGuildXIncome: "${addresses.Income}"`);
  adminConfig = adminConfig.replace(/MetaGuildXUpgrade:\s*"0x[a-fA-F0-9]{40}"/, `MetaGuildXUpgrade: "${addresses.Upgrade}"`);
  adminConfig = adminConfig.replace(/IncomeRouter:\s*"0x[a-fA-F0-9]{40}"/, `IncomeRouter: "${addresses.Router}"`);
  adminConfig = adminConfig.replace(/BinaryTree:\s*"0x[a-fA-F0-9]{40}"/, `BinaryTree: "${addresses.BinaryTree}"`);
  adminConfig = adminConfig.replace(/CashbackPool:\s*"0x[a-fA-F0-9]{40}"/, `CashbackPool: "${addresses.CashbackPool}"`);
  adminConfig = adminConfig.replace(/MGXStaking:\s*"0x[a-fA-F0-9]{40}"/, `MGXStaking: "${addresses.MGXStaking}"`);
  adminConfig = adminConfig.replace(/MGXToken:\s*"0x[a-fA-F0-9]{40}"/, `MGXToken: "${addresses.MGXToken}"`);
  adminConfig = adminConfig.replace(/USDT:\s*ENV_USDT_ADDRESS\s*\|\|\s*"0x[a-fA-F0-9]{40}"/, `USDT: ENV_USDT_ADDRESS || "${addresses.USDT}"`);
  adminConfig = adminConfig.replace(/startBlock:\s*\d+/, `startBlock: ${addresses.deployBlock}`);
  fs.writeFileSync(ADMIN_CONFIG_PATH, adminConfig);
  console.log("Admin contracts.ts updated ✅");

  let checklist = fs.readFileSync(CHECKLIST_PATH, "utf8");
  checklist = checklist.replace(
    /## Contract Addresses \(opBNB Testnet\)[\s\S]*?## Critical Bug Fixes Applied/,
    `## Contract Addresses (opBNB Testnet)
Core:         ${addresses.Core}
Income:       ${addresses.Income}
Upgrade:      ${addresses.Upgrade}
Router:       ${addresses.Router}
BinaryTree:   ${addresses.BinaryTree}
CashbackPool: ${addresses.CashbackPool}
MGXStaking:   ${addresses.MGXStaking}
MGXToken:     ${addresses.MGXToken}
TokenEngine:  ${addresses.TokenEngine}
USDT:         ${addresses.USDT}
Deploy Block: ${addresses.deployBlock}

## Critical Bug Fixes Applied`
  );
  fs.writeFileSync(CHECKLIST_PATH, checklist);
  console.log("DEPLOYMENT_CHECKLIST.md updated ✅");

  console.log("New addresses:");
  console.log(JSON.stringify(addresses, null, 2));
}

try {
  main();
} catch (error) {
  console.error(error);
  process.exit(1);
}
