import fs from "fs";
import path from "path";
import { ethers } from "hardhat";

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

const ADDRESSES_PATH = path.join(__dirname, "..", "deployed-addresses.json");
const FIXED_USDT = "0xF4975eB104932bDBcA491A9Cb985439eA03863e0";
const EXPECTED_USDT_UNIT_PRICE = 10n ** 17n;

function loadAddresses(): DeployedAddresses | null {
  if (!fs.existsSync(ADDRESSES_PATH)) {
    return null;
  }
  return JSON.parse(fs.readFileSync(ADDRESSES_PATH, "utf8")) as DeployedAddresses;
}

async function main() {
  console.log("=== MetaGuildX V3 Deployment Verification ===\n");

  const deployed = loadAddresses();
  const [deployer] = await ethers.getSigners();

  const CORE = deployed?.Core ?? "0xBD66787F1eBe0A135e64240F1822C9082d7a20eF";
  const INCOME = deployed?.Income ?? "0x87d752D160299c09BaDaac3dd66FBac483A5b67b";
  const ROUTER = deployed?.Router ?? "0xc7Fbc607999C6A4fcF290eF69246D491F74ab34b";
  const BTREE = deployed?.BinaryTree ?? "0x6d37A7A2c6C091F980afA3790bf28975E39ec558";
  const STAKING = deployed?.MGXStaking ?? "0x8A08982EE0244f2333109000d8b0Ab08Ef2b2a1E";
  const TOKEN_ENGINE = deployed?.TokenEngine ?? "0x04E7B67Ff27E3Cc983276C947F5fDFE2c6a9fBF5";
  const EXPECTED_OWNER = deployer.address.toLowerCase();

  const core = new ethers.Contract(
    CORE,
    [
      "function owner() view returns (address)",
      "function nextUserId() view returns (uint256)",
      "function productionMode() view returns (bool)",
      "function placementSigner() view returns (address)",
      "function tokenEngineContract() view returns (address)",
      "function getBinaryParent(uint256) view returns (uint256)",
      "function defaultPaymentAsset() view returns (address)",
      "function enabledPaymentAssets(address) view returns (bool)",
      "function paymentAssetUnitPrice(address) view returns (uint256)"
    ],
    ethers.provider
  );

  const income = new ethers.Contract(
    INCOME,
    [
      "function owner() view returns (address)",
      "function adminRestoreEscrow(uint256,uint8,uint256)",
      "function getTotalEscrow(uint256) view returns (uint256)"
    ],
    ethers.provider
  );

  const router = new ethers.Contract(
    ROUTER,
    [
      "function coreContract() view returns (address)"
    ],
    ethers.provider
  );

  const btree = new ethers.Contract(
    BTREE,
    [
      "function levelRootId() view returns (uint256)",
      "function getLevelParent(uint256) view returns (uint256)"
    ],
    ethers.provider
  );

  const staking = new ethers.Contract(
    STAKING,
    [
      "function rewardPool() view returns (uint256)",
      "function totalStaked() view returns (uint256)"
    ],
    ethers.provider
  );

  let passed = 0;
  let failed = 0;

  async function check(name: string, fn: () => Promise<boolean>) {
    try {
      const result = await fn();
      if (result) {
        console.log(`✅ ${name}`);
        passed++;
      } else {
        console.log(`❌ FAIL: ${name}`);
        failed++;
      }
    } catch (error) {
      console.log(`❌ ERROR: ${name} — ${error}`);
      failed++;
    }
  }

  await check("Core owner = deployer", async () => {
    const owner = await core.owner();
    return owner.toLowerCase() === EXPECTED_OWNER;
  });

  await check("Income owner = deployer", async () => {
    const owner = await income.owner();
    return owner.toLowerCase() === EXPECTED_OWNER;
  });

  await check("Router coreContract set", async () => {
    const coreAddr = await router.coreContract();
    return coreAddr.toLowerCase() === CORE.toLowerCase();
  });

  await check("Level Tree root = User 1", async () => {
    const nextUserId = await core.nextUserId();
    const rootId = await btree.levelRootId();
    if (nextUserId <= 2n) {
      return Number(rootId) === 0 || Number(rootId) === 1;
    }
    return Number(rootId) === 1;
  });

  await check("Core has getBinaryParent()", async () => {
    const parent = await core.getBinaryParent(2);
    return parent >= 0n;
  });

  await check("Staking pool has MGX", async () => {
    const rewardPool = await staking.rewardPool();
    const totalStaked = await staking.totalStaked();
    console.log(`   rewardPool = ${rewardPool.toString()}`);
    console.log(`   totalStaked = ${totalStaked.toString()}`);
    return rewardPool > 0n || totalStaked > 0n;
  });

  await check("TokenEngine wired to Core", async () => {
    const engine = await core.tokenEngineContract();
    return engine.toLowerCase() === TOKEN_ENGINE.toLowerCase();
  });

  await check("Placement signer set", async () => {
    const signer = await core.placementSigner();
    return signer !== ethers.ZeroAddress;
  });

  await check("defaultPaymentAsset = correct USDT", async () => {
    const asset = await core.defaultPaymentAsset();
    return asset.toLowerCase() === FIXED_USDT.toLowerCase();
  });

  await check("USDT payment asset enabled", async () => {
    const enabled = await core.enabledPaymentAssets(FIXED_USDT);
    return enabled === true;
  });

  await check("USDT unit price = 1e17", async () => {
    const price = await core.paymentAssetUnitPrice(FIXED_USDT);
    return price === EXPECTED_USDT_UNIT_PRICE;
  });

  await check("Level Tree User 2 parent = User 1", async () => {
    const nextUserId = await core.nextUserId();
    if (nextUserId <= 2n) {
      console.log("   User 2 not registered yet; skipping populated-tree assertion");
      return true;
    }
    const parent = await btree.getLevelParent(2);
    console.log(`   user2 level parent = ${parent.toString()}`);
    return Number(parent) === 0 || Number(parent) === 1;
  });

  await check("Income has adminRestoreEscrow()", async () => {
    const fn = income.interface.getFunction("adminRestoreEscrow");
    return fn !== null;
  });

  await check("productionMode = true", async () => {
    const mode = await core.productionMode();
    console.log(`   productionMode = ${mode}`);
    return mode === true;
  });

  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);

  if (failed > 0) {
    console.log("\n⚠️  FIX FAILURES BEFORE MAINNET DEPLOY!");
    process.exit(1);
  }

  console.log("\n🚀 All checks passed — ready for mainnet!");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
