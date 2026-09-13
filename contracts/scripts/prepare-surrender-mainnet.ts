/**
 * prepare-surrender-mainnet.ts
 *
 * PREPARE-ONLY — MetaGuildX Surrender Upgrade — opBNB MAINNET
 *
 * This script:
 *   1. Verifies mainnet chain, proxy addresses, ownership
 *   2. Deploys required linked libraries (on-chain activity — impl only, no proxy changes)
 *   3. Deploys new implementation contracts via upgrades.prepareUpgrade (on-chain activity)
 *   4. Validates storage layout safety via OpenZeppelin upgrades tooling
 *   5. Prints exact Safe calldata for upgradeToAndCall on each proxy
 *
 * This script NEVER:
 *   - calls upgradeToAndCall / upgradeTo
 *   - executes proxy upgrades
 *   - modifies proxy state, wiring, or ownership
 *   - contains any EXECUTE_UPGRADE mode
 *
 * Run:
 *   npx hardhat run contracts/scripts/prepare-surrender-mainnet.ts --network opbnbMainnet
 *
 * After review, submit the printed Safe calldata through:
 *   https://app.safe.global
 */

import { ethers, upgrades } from "hardhat";

// ── Production proxy addresses ────────────────────────────────────────────────
const CORE_PROXY         = "0xE3cD200609E223c96987c9FEa41C6014e8625c2F";
const TOKEN_ENGINE_PROXY = "0xD3f119B64B72303F3fd3749a314E902D92fc75cd";
const BINARY_TREE_PROXY  = "0x2d06a29321DBee7F22cd2E51c62EC03Af0399087";

// ── Expected Safe owner ───────────────────────────────────────────────────────
const EXPECTED_SAFE = "0x6D01d1E9771193467B5fae47Ce8463d7060098eA";

// ── EIP-1967 storage slots ────────────────────────────────────────────────────
const EIP1967_IMPL_SLOT  = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";
const EIP1967_ADMIN_SLOT = "0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103";

// ── Interface for reading impl address ────────────────────────────────────────
const OWNER_ABI = ["function owner() view returns (address)"];

// ── upgradeToAndCall calldata encoder ─────────────────────────────────────────
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
  banner("MetaGuildX — Surrender Upgrade — MAINNET PREPARE ONLY");

  // ── PHASE 1: Network verification ────────────────────────────────────────────
  console.log("\n── Phase 1: Network verification ──");
  const network = await ethers.provider.getNetwork();
  console.log(`chainId:   ${network.chainId}`);
  console.log(`name:      ${network.name}`);

  if (network.chainId !== 204n) {
    abort(
      `Wrong network. This script is MAINNET ONLY (chainId 204). ` +
      `Got chainId ${network.chainId}. ` +
      `Run with --network opbnbMainnet.`
    );
  }
  console.log("✅ Network: opBNB Mainnet (204) confirmed");

  // ── PHASE 2: Deployer info ────────────────────────────────────────────────────
  console.log("\n── Phase 2: Deployer info ──");
  const [deployer] = await ethers.getSigners();
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`Deployer:  ${deployer.address}`);
  console.log(`Balance:   ${ethers.formatEther(balance)} BNB`);
  if (balance === 0n) {
    abort("Deployer has zero BNB balance. Cannot deploy implementations.");
  }
  console.log("✅ Deployer has balance");

  // ── PHASE 3: Proxy verification ───────────────────────────────────────────────
  console.log("\n── Phase 3: Proxy contract verification ──");

  const proxies: Array<[string, string]> = [
    ["Core",        CORE_PROXY],
    ["TokenEngine", TOKEN_ENGINE_PROXY],
    ["BinaryTree",  BINARY_TREE_PROXY],
  ];

  const currentImpls: Record<string, string> = {};

  for (const [name, addr] of proxies) {
    console.log(`\n  [${name}] ${addr}`);

    // Bytecode check
    const code = await ethers.provider.getCode(addr);
    if (code === "0x") abort(`${name} proxy ${addr} has no bytecode on mainnet.`);
    console.log(`  bytecode:  EXISTS (${Math.floor((code.length - 2) / 2)} bytes)`);

    // EIP-1967 impl slot
    const implRaw  = await ethers.provider.getStorage(addr, EIP1967_IMPL_SLOT);
    const implAddr = "0x" + implRaw.slice(-40);
    if (implAddr === "0x0000000000000000000000000000000000000000") {
      abort(`${name} EIP-1967 impl slot is zero. Proxy may not be UUPS.`);
    }
    currentImpls[name] = implAddr;
    const implCode = await ethers.provider.getCode(implAddr);
    if (implCode === "0x") abort(`${name} current implementation ${implAddr} has no bytecode.`);
    console.log(`  EIP-1967 impl:  ${implAddr} (${Math.floor((implCode.length - 2) / 2)} bytes)`);

    // EIP-1967 admin slot (should be zero for UUPS)
    const adminRaw = await ethers.provider.getStorage(addr, EIP1967_ADMIN_SLOT);
    const adminAddr = "0x" + adminRaw.slice(-40);
    console.log(`  EIP-1967 admin: ${adminAddr} ${adminAddr === "0x0000000000000000000000000000000000000000" ? "(zero — UUPS confirmed)" : "⚠️ non-zero"}`);

    // Owner check
    const ownerContract = new ethers.Contract(addr, OWNER_ABI, ethers.provider);
    let owner: string;
    try {
      owner = (await ownerContract.owner()) as string;
    } catch (e: any) {
      abort(`${name} owner() call failed: ${e.message?.slice(0, 100)}`);
    }
    const ownerCode = await ethers.provider.getCode(owner!);
    const ownerType = ownerCode.length > 2 ? "CONTRACT (Safe)" : "EOA";
    console.log(`  owner():        ${owner!} [${ownerType}]`);

    if (owner!.toLowerCase() !== EXPECTED_SAFE.toLowerCase()) {
      abort(
        `${name} owner ${owner!} does NOT match expected Safe ` +
        `${EXPECTED_SAFE}. Refusing to continue.`
      );
    }
    console.log(`  matches Safe:   ✅ YES`);
  }

  // ── PHASE 4: Library deployment ───────────────────────────────────────────────
  // NOTE: These are on-chain deployments. Libraries are deployed to mainnet.
  // This does NOT change any proxy state.
  console.log("\n── Phase 4: Deploying linked libraries (on-chain — impl only) ──");
  console.log("NOTE: Libraries and implementations will be deployed to mainnet.");
  console.log("      No proxy state will be changed.\n");

  // Level 1: leaf libraries (no external link dependencies)
  console.log("  Deploying UpgradeCycleLib...");
  const cycleLib = await (await ethers.getContractFactory("UpgradeCycleLib")).deploy();
  await cycleLib.waitForDeployment();
  console.log(`  UpgradeCycleLib:           ${await cycleLib.getAddress()}`);

  console.log("  Deploying MetaGuildXPaymentLib...");
  const payLib = await (await ethers.getContractFactory("MetaGuildXPaymentLib")).deploy();
  await payLib.waitForDeployment();
  console.log(`  MetaGuildXPaymentLib:      ${await payLib.getAddress()}`);

  console.log("  Deploying MetaGuildXPlacementLib...");
  const placeLib = await (await ethers.getContractFactory("MetaGuildXPlacementLib")).deploy();
  await placeLib.waitForDeployment();
  console.log(`  MetaGuildXPlacementLib:    ${await placeLib.getAddress()}`);

  console.log("  Deploying MetaGuildXAdminLib...");
  const adminLib = await (await ethers.getContractFactory("MetaGuildXAdminLib")).deploy();
  await adminLib.waitForDeployment();
  console.log(`  MetaGuildXAdminLib:        ${await adminLib.getAddress()}`);

  console.log("  Deploying MetaGuildXRebirthLib...");
  const rebirthLib = await (await ethers.getContractFactory("MetaGuildXRebirthLib")).deploy();
  await rebirthLib.waitForDeployment();
  console.log(`  MetaGuildXRebirthLib:      ${await rebirthLib.getAddress()}`);

  // Level 2: MetaGuildXUpgradeFlowLib depends on UpgradeCycleLib + MetaGuildXPaymentLib
  console.log("  Deploying MetaGuildXUpgradeFlowLib (links UpgradeCycleLib + MetaGuildXPaymentLib)...");
  const upgradeFlowLib = await (
    await ethers.getContractFactory("MetaGuildXUpgradeFlowLib", {
      libraries: {
        "src/libraries/UpgradeCycleLib.sol:UpgradeCycleLib":      await cycleLib.getAddress(),
        "src/libs/MetaGuildXPaymentLib.sol:MetaGuildXPaymentLib":  await payLib.getAddress(),
      },
    })
  ).deploy();
  await upgradeFlowLib.waitForDeployment();
  console.log(`  MetaGuildXUpgradeFlowLib:  ${await upgradeFlowLib.getAddress()}`);

  console.log("✅ All libraries deployed");

  // ── PHASE 5: Contract factories ───────────────────────────────────────────────
  console.log("\n── Phase 5: Building contract factories ──");

  const coreLibraries = {
    "src/MetaGuildXAdminLib.sol:MetaGuildXAdminLib":             await adminLib.getAddress(),
    "src/MetaGuildXRebirthLib.sol:MetaGuildXRebirthLib":         await rebirthLib.getAddress(),
    "src/MetaGuildXUpgradeFlowLib.sol:MetaGuildXUpgradeFlowLib": await upgradeFlowLib.getAddress(),
    "src/libs/MetaGuildXPaymentLib.sol:MetaGuildXPaymentLib":     await payLib.getAddress(),
    "src/libs/MetaGuildXPlacementLib.sol:MetaGuildXPlacementLib": await placeLib.getAddress(),
  };

  const CoreFactory = await ethers.getContractFactory("MetaGuildXCore", { libraries: coreLibraries });
  const TEFactory   = await ethers.getContractFactory("MetaGuildXTokenEngine");
  const BTFactory   = await ethers.getContractFactory("BinaryTree");
  console.log("✅ Factories built");

  // ── PHASE 6: forceImport — register live proxies with OZ upgrades plugin ─────
  console.log("\n── Phase 6: Registering live proxies with OZ upgrades plugin ──");
  const coreOpts = { kind: "uups" as const, unsafeAllowLinkedLibraries: true };
  const uupsOpts = { kind: "uups" as const };

  await upgrades.forceImport(CORE_PROXY,         CoreFactory, coreOpts);
  console.log("  Core imported");
  await upgrades.forceImport(TOKEN_ENGINE_PROXY,  TEFactory,  uupsOpts);
  console.log("  TokenEngine imported");
  await upgrades.forceImport(BINARY_TREE_PROXY,   BTFactory,  uupsOpts);
  console.log("  BinaryTree imported");
  console.log("✅ All proxies registered");

  // ── PHASE 7: Storage validation ───────────────────────────────────────────────
  console.log("\n── Phase 7: Storage layout validation (no proxy changes) ──");

  for (const [name, proxy, factory, opts] of [
    ["MetaGuildXCore",        CORE_PROXY,         CoreFactory, { ...coreOpts, redeployImplementation: "always" as const }],
    ["MetaGuildXTokenEngine", TOKEN_ENGINE_PROXY,  TEFactory,  { ...uupsOpts, redeployImplementation: "always" as const }],
    ["BinaryTree",            BINARY_TREE_PROXY,   BTFactory,  { ...uupsOpts, redeployImplementation: "always" as const }],
  ] as const) {
    try {
      await upgrades.validateUpgrade(proxy, factory as any, opts as any);
      console.log(`  ✅ ${name}: storage SAFE`);
    } catch (e: any) {
      abort(`${name} storage validation FAILED: ${e.message?.slice(0, 400)}`);
    }
  }

  // ── PHASE 8: Prepare new implementations ─────────────────────────────────────
  // NOTE: prepareUpgrade deploys new implementation contracts to mainnet.
  // This is on-chain activity. Proxy state is NOT changed.
  console.log("\n── Phase 8: Preparing new implementations (on-chain deployments) ──");
  console.log("NOTE: New implementation contracts are being deployed to mainnet.");
  console.log("      Proxy addresses remain unchanged.\n");

  let newCoreImpl: string;
  let newTEImpl: string;
  let newBTImpl: string;

  try {
    newCoreImpl = await upgrades.prepareUpgrade(
      CORE_PROXY, CoreFactory,
      { ...coreOpts, redeployImplementation: "always" }
    ) as string;
    console.log(`  Core new impl:        ${newCoreImpl}`);
  } catch (e: any) {
    abort(`Core prepareUpgrade failed: ${e.message?.slice(0, 400)}`);
  }

  try {
    newTEImpl = await upgrades.prepareUpgrade(
      TOKEN_ENGINE_PROXY, TEFactory,
      { ...uupsOpts, redeployImplementation: "always" }
    ) as string;
    console.log(`  TokenEngine new impl: ${newTEImpl}`);
  } catch (e: any) {
    abort(`TokenEngine prepareUpgrade failed: ${e.message?.slice(0, 400)}`);
  }

  try {
    newBTImpl = await upgrades.prepareUpgrade(
      BINARY_TREE_PROXY, BTFactory,
      { ...uupsOpts, redeployImplementation: "always" }
    ) as string;
    console.log(`  BinaryTree new impl:  ${newBTImpl}`);
  } catch (e: any) {
    abort(`BinaryTree prepareUpgrade failed: ${e.message?.slice(0, 400)}`);
  }

  // ── PHASE 9: Verify new impl bytecode exists on-chain ────────────────────────
  console.log("\n── Phase 9: Verifying new implementations on-chain ──");
  for (const [name, impl] of [
    ["Core",        newCoreImpl!],
    ["TokenEngine", newTEImpl!],
    ["BinaryTree",  newBTImpl!],
  ]) {
    const code = await ethers.provider.getCode(impl);
    if (code === "0x") abort(`${name} new impl ${impl} has no bytecode after deployment.`);
    console.log(`  ✅ ${name}: ${impl} (${Math.floor((code.length - 2) / 2)} bytes)`);
  }

  // ── PHASE 10: Generate Safe calldata ─────────────────────────────────────────
  console.log("\n── Phase 10: Safe transaction calldata ──");

  const coreCalldata = encodeUpgradeCalldata(newCoreImpl!);
  const teCalldata   = encodeUpgradeCalldata(newTEImpl!);
  const btCalldata   = encodeUpgradeCalldata(newBTImpl!);

  // ── FINAL REPORT ──────────────────────────────────────────────────────────────
  banner("MAINNET PREPARATION COMPLETE");

  console.log("NO PROXY WAS UPGRADED.");
  console.log("NO PROXY STATE WAS CHANGED.");
  console.log("New implementation and library contracts were deployed on mainnet as part of preparation.");
  console.log("");
  console.log("─".repeat(70));
  console.log("SAFE TRANSACTIONS TO SUBMIT THROUGH SAFE");
  console.log("Safe address: " + EXPECTED_SAFE);
  console.log("─".repeat(70));

  console.log(`
[1] UPGRADE CORE
    Contract:           MetaGuildXCore
    Proxy (To):         ${CORE_PROXY}
    Current impl:       ${currentImpls["Core"]}
    New impl:           ${newCoreImpl!}
    Safe Value:         0
    Safe Data:          ${coreCalldata}

[2] UPGRADE TOKEN ENGINE
    Contract:           MetaGuildXTokenEngine
    Proxy (To):         ${TOKEN_ENGINE_PROXY}
    Current impl:       ${currentImpls["TokenEngine"]}
    New impl:           ${newTEImpl!}
    Safe Value:         0
    Safe Data:          ${teCalldata}

[3] UPGRADE BINARY TREE
    Contract:           BinaryTree
    Proxy (To):         ${BINARY_TREE_PROXY}
    Current impl:       ${currentImpls["BinaryTree"]}
    New impl:           ${newBTImpl!}
    Safe Value:         0
    Safe Data:          ${btCalldata}
`);

  console.log("─".repeat(70));
  console.log("IMPORTANT:");
  console.log("  1. Review the calldata independently before submitting.");
  console.log("  2. Submit all 3 transactions through the Gnosis Safe UI.");
  console.log("  3. Verify new implementation addresses on the block explorer");
  console.log("     before approving the Safe transactions.");
  console.log("  4. Recommended order: Core → TokenEngine → BinaryTree");
  console.log("─".repeat(70));
}

main().catch((e) => {
  console.error("\n❌ FATAL ERROR:", e.message ?? e);
  process.exit(1);
});
