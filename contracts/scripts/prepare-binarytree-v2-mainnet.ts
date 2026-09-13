/**
 * prepare-binarytree-v2-mainnet.ts
 *
 * PREPARE-ONLY — BinaryTree V2 Upgrade — opBNB MAINNET
 *
 * Deploys the patched BinaryTree implementation (iterations > maxDepth fix)
 * and prints the exact Safe calldata for upgradeToAndCall.
 *
 * This script NEVER:
 *   - calls upgradeToAndCall / upgradeTo on any proxy
 *   - executes proxy upgrades
 *   - modifies Core or TokenEngine
 *   - deploys Core or TokenEngine implementations
 *   - transfers ownership
 *   - calls any setter or initializer
 *   - contains any EXECUTE mode
 *
 * BinaryTree has NO linked libraries — zero library deployments required.
 *
 * Run:
 *   npx hardhat run contracts/scripts/prepare-binarytree-v2-mainnet.ts --network opbnbMainnet
 */

import { ethers, upgrades } from "hardhat";

// ── BinaryTree proxy (the ONLY target) ───────────────────────────────────────
const BT_PROXY           = "0x2d06a29321DBee7F22cd2E51c62EC03Af0399087";
const EXPECTED_CURRENT   = "0xc1C330418608C15D0C1A2400CdEc2934077Ce7Bd"; // installed in step 2
const EXPECTED_SAFE      = "0x6D01d1E9771193467B5fae47Ce8463d7060098eA";
const EXPECTED_CHAIN_ID  = 204n;

// ── EIP-1967 slots ────────────────────────────────────────────────────────────
const IMPL_SLOT  = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";
const ADMIN_SLOT = "0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103";

const OWNER_ABI = ["function owner() view returns (address)"];

// ── calldata encoder (for display only — never submitted by this script) ──────
const UPGRADE_IFACE = new ethers.Interface([
  "function upgradeToAndCall(address newImplementation, bytes calldata data) payable",
]);
function encodeUpgradeCalldata(newImpl: string): string {
  return UPGRADE_IFACE.encodeFunctionData("upgradeToAndCall", [newImpl, "0x"]);
}

function banner(msg: string) {
  const line = "=".repeat(70);
  console.log(`\n${line}\n${msg}\n${line}`);
}

function abort(msg: string): never {
  console.error(`\n❌ ABORT: ${msg}`);
  process.exit(1);
}

async function main() {
  banner("MetaGuildX — BinaryTree V2 — MAINNET PREPARE ONLY");

  // ── 1. Network guard ─────────────────────────────────────────────────────────
  console.log("\n── 1. Network verification ──");
  const network = await ethers.provider.getNetwork();
  console.log(`chainId: ${network.chainId}`);
  if (network.chainId !== EXPECTED_CHAIN_ID) {
    abort(`Wrong network. Expected 204 (opBNB Mainnet), got ${network.chainId}.`);
  }
  console.log("✅ opBNB Mainnet (204) confirmed");

  // ── 2. Deployer ───────────────────────────────────────────────────────────────
  console.log("\n── 2. Deployer ──");
  const [deployer] = await ethers.getSigners();
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`Deployer: ${deployer.address}`);
  console.log(`Balance:  ${ethers.formatEther(balance)} BNB`);
  if (balance === 0n) abort("Deployer has zero BNB balance.");
  console.log("✅ Deployer has balance");

  // ── 3. Proxy verification ─────────────────────────────────────────────────────
  console.log("\n── 3. BinaryTree proxy verification ──");

  // 3a. Bytecode exists
  const proxyCode = await ethers.provider.getCode(BT_PROXY);
  if (proxyCode === "0x") abort(`BinaryTree proxy ${BT_PROXY} has no bytecode.`);
  console.log(`proxy bytecode: EXISTS (${Math.floor((proxyCode.length-2)/2)} bytes) ✅`);

  // 3b. EIP-1967 impl slot == expected current impl
  const implRaw  = await ethers.provider.getStorage(BT_PROXY, IMPL_SLOT);
  const implAddr = "0x" + implRaw.slice(-40);
  if (implAddr === "0x0000000000000000000000000000000000000000") {
    abort(`BinaryTree EIP-1967 impl slot is zero. Not a UUPS proxy.`);
  }
  console.log(`EIP-1967 impl:  ${implAddr}`);
  if (implAddr.toLowerCase() !== EXPECTED_CURRENT.toLowerCase()) {
    abort(
      `EIP-1967 impl mismatch.\n` +
      `  Expected: ${EXPECTED_CURRENT}\n` +
      `  Got:      ${implAddr}\n` +
      `  Current on-chain state does not match expected. STOPPING.`
    );
  }
  console.log(`matches expected current impl: ✅`);

  // 3c. Current impl bytecode exists
  const currentImplCode = await ethers.provider.getCode(implAddr);
  if (currentImplCode === "0x") abort(`Current impl ${implAddr} has no bytecode.`);
  console.log(`current impl bytecode: EXISTS (${Math.floor((currentImplCode.length-2)/2)} bytes) ✅`);

  // 3d. EIP-1967 admin slot (must be zero for UUPS — hard abort if non-zero)
  const adminRaw  = await ethers.provider.getStorage(BT_PROXY, ADMIN_SLOT);
  const adminAddr = "0x" + adminRaw.slice(-40);
  console.log(`EIP-1967 admin: ${adminAddr}`);
  if (adminAddr !== "0x0000000000000000000000000000000000000000") {
    abort(`EIP-1967 admin slot is non-zero (${adminAddr}). ` +
          `This proxy may be Transparent, not UUPS. STOPPING before any deployment.`);
  }
  console.log(`EIP-1967 admin slot is zero — UUPS confirmed ✅`);

  // 3e. owner() == expected Safe
  const ownerContract = new ethers.Contract(BT_PROXY, OWNER_ABI, ethers.provider);
  let owner: string;
  try {
    owner = (await ownerContract.owner()) as string;
  } catch(e: any) {
    abort(`owner() call failed: ${e.message?.slice(0,100)}`);
  }
  const ownerCode = await ethers.provider.getCode(owner!);
  const ownerType = ownerCode.length > 2 ? "CONTRACT (Safe)" : "EOA";
  console.log(`owner():  ${owner!} [${ownerType}]`);
  if (owner!.toLowerCase() !== EXPECTED_SAFE.toLowerCase()) {
    abort(`owner ${owner!} does NOT match expected Safe ${EXPECTED_SAFE}. STOPPING.`);
  }
  console.log(`matches expected Safe: ✅`);

  // ── 4. Library check (informational — BinaryTree has NONE) ───────────────────
  console.log("\n── 4. Library dependencies ──");
  console.log("BinaryTree linkReferences: NONE");
  console.log("✅ Zero library deployments required.");

  // ── 5. Build BinaryTree factory ───────────────────────────────────────────────
  console.log("\n── 5. Building BinaryTree factory ──");
  const BTFactory = await ethers.getContractFactory("BinaryTree");
  console.log("✅ BinaryTree factory built (no linked libraries)");

  // ── 6. forceImport — register proxy with OZ upgrades plugin ─────────────────
  console.log("\n── 6. Registering BinaryTree proxy with OZ upgrades plugin ──");
  const uupsOpts = { kind: "uups" as const };
  await upgrades.forceImport(BT_PROXY, BTFactory, uupsOpts);
  console.log("✅ BinaryTree proxy registered");

  // ── 7. Storage validation ────────────────────────────────────────────────────
  console.log("\n── 7. Storage layout validation (no proxy changes) ──");
  try {
    await upgrades.validateUpgrade(BT_PROXY, BTFactory, uupsOpts);
    console.log("✅ BinaryTree: storage SAFE");
  } catch(e: any) {
    abort(`BinaryTree storage validation FAILED: ${e.message?.slice(0,400)}`);
  }

  // ── 8. prepareUpgrade — deploys ONE new BinaryTree implementation ─────────────
  // NOTE: This is the ONLY on-chain transaction in this script.
  // It deploys a new implementation contract. The proxy is NOT changed.
  console.log("\n── 8. Preparing new BinaryTree implementation (on-chain deployment) ──");
  console.log("NOTE: ONE implementation contract will be deployed to mainnet.");
  console.log("      The BinaryTree proxy state will NOT be changed.\n");

  let newBTImpl: string;
  try {
    newBTImpl = await upgrades.prepareUpgrade(
      BT_PROXY, BTFactory,
      { ...uupsOpts, redeployImplementation: "always" }
    ) as string;
    console.log(`✅ New BinaryTree implementation: ${newBTImpl}`);
  } catch(e: any) {
    abort(`BinaryTree prepareUpgrade failed: ${e.message?.slice(0,400)}`);
  }

  // ── 9. Verify new implementation bytecode on-chain ───────────────────────────
  console.log("\n── 9. Verifying new implementation on-chain ──");
  const newImplCode = await ethers.provider.getCode(newBTImpl!);
  if (newImplCode === "0x") abort(`New impl ${newBTImpl!} has no bytecode after deployment.`);
  console.log(`✅ ${newBTImpl!} (${Math.floor((newImplCode.length-2)/2)} bytes) — EXISTS`);

  // Verify key selectors present in new impl
  const hex = newImplCode.toLowerCase();
  const checks: Array<[string, string]> = [
    ["handleSurrender(uint256)",  ethers.id("handleSurrender(uint256)").slice(2,10)],
    ["isLevelEligible(uint256)",  ethers.id("isLevelEligible(uint256)").slice(2,10)],
    ["levelParent(uint256)",      ethers.id("levelParent(uint256)").slice(2,10)],
    ["levelEligibleAt(uint256)",  ethers.id("levelEligibleAt(uint256)").slice(2,10)],
  ];
  for (const [fn, sel] of checks) {
    const present = hex.includes(sel);
    console.log(`  0x${sel} ${fn}: ${present ? "PRESENT ✅" : "ABSENT ❌"}`);
    if (!present) abort(`Required function ${fn} absent from new implementation.`);
  }

  // ── 10. Generate Safe calldata ───────────────────────────────────────────────
  const calldata = encodeUpgradeCalldata(newBTImpl!);

  // ── FINAL OUTPUT ─────────────────────────────────────────────────────────────
  banner("BINARYTREE V2 PREPARATION COMPLETE");

  console.log("NO PROXY WAS UPGRADED.");
  console.log("NO PROXY STATE WAS CHANGED.");
  console.log("ONE new BinaryTree implementation was deployed to mainnet.");
  console.log("");
  console.log("─".repeat(70));
  console.log("SAFE TRANSACTION TO SUBMIT THROUGH SAFE");
  console.log(`Safe address: ${EXPECTED_SAFE}`);
  console.log("─".repeat(70));
  console.log(`
[1] UPGRADE BINARYTREE (V2 — depth fix)
    Contract:           BinaryTree
    Proxy (To):         ${BT_PROXY}
    Current impl:       ${EXPECTED_CURRENT}
    New impl:           ${newBTImpl!}
    Safe Value:         0
    Safe Data:          ${calldata}
`);
  console.log("─".repeat(70));
  console.log("IMPORTANT:");
  console.log("  1. Verify new implementation on opBNB explorer before submitting.");
  console.log("  2. Confirm selector 0x404dd908 (handleSurrender) is present.");
  console.log("  3. Submit through Gnosis Safe UI — do NOT send directly.");
  console.log("  4. After BinaryTree V2 upgrade is verified, THEN proceed to Core upgrade.");
  console.log("─".repeat(70));
}

main().catch((e) => {
  console.error("\n❌ FATAL:", e.message ?? e);
  process.exit(1);
});
