import { ethers, upgrades } from "hardhat";

async function main() {
  const network = await ethers.provider.getNetwork();
  console.log("chainId:", network.chainId.toString());

  const CORE_PROXY         = "0xE3cD200609E223c96987c9FEa41C6014e8625c2F";
  const TOKEN_ENGINE_PROXY = "0xD3f119B64B72303F3fd3749a314E902D92fc75cd";
  const BINARY_TREE_PROXY  = "0x2d06a29321DBee7F22cd2E51c62EC03Af0399087";

  console.log("\n=== Building Core factory with libraries ===");
  console.log("Libraries deployed on local node (for ABI only).");

  const cycleLib    = await (await ethers.getContractFactory("UpgradeCycleLib")).deploy();
  const payLib      = await (await ethers.getContractFactory("MetaGuildXPaymentLib")).deploy();
  const placeLib    = await (await ethers.getContractFactory("MetaGuildXPlacementLib")).deploy();
  const adminLib    = await (await ethers.getContractFactory("MetaGuildXAdminLib")).deploy();
  const rebirthLib  = await (await ethers.getContractFactory("MetaGuildXRebirthLib")).deploy();
  await Promise.all([cycleLib,payLib,placeLib,adminLib,rebirthLib].map(c=>c.waitForDeployment()));
  const adminDistLib = await (await ethers.getContractFactory("MetaGuildXAdminDistributionLib",{
    libraries:{"src/libs/MetaGuildXPaymentLib.sol:MetaGuildXPaymentLib":await payLib.getAddress()}
  })).deploy();
  const surrenderLib = await (await ethers.getContractFactory("MetaGuildXSurrenderLib",{
    libraries:{"src/libs/MetaGuildXPaymentLib.sol:MetaGuildXPaymentLib":await payLib.getAddress()}
  })).deploy();
  const coreLib = await (await ethers.getContractFactory("MetaGuildXCoreLib",{
    libraries:{"src/libs/MetaGuildXPaymentLib.sol:MetaGuildXPaymentLib":await payLib.getAddress()}
  })).deploy();
  await Promise.all([adminDistLib,surrenderLib,coreLib].map(c=>c.waitForDeployment()));

  const upgradeFlowLib = await (await ethers.getContractFactory("MetaGuildXUpgradeFlowLib",{
    libraries:{
      "src/libraries/UpgradeCycleLib.sol:UpgradeCycleLib":     await cycleLib.getAddress(),
      "src/libs/MetaGuildXPaymentLib.sol:MetaGuildXPaymentLib": await payLib.getAddress(),
    }
  })).deploy();
  await upgradeFlowLib.waitForDeployment();

  const CoreFactory = await ethers.getContractFactory("MetaGuildXCore", {
    libraries: {
      "src/MetaGuildXAdminLib.sol:MetaGuildXAdminLib":             await adminLib.getAddress(),
      "src/MetaGuildXRebirthLib.sol:MetaGuildXRebirthLib":         await rebirthLib.getAddress(),
      "src/MetaGuildXUpgradeFlowLib.sol:MetaGuildXUpgradeFlowLib": await upgradeFlowLib.getAddress(),
      "src/libs/MetaGuildXPaymentLib.sol:MetaGuildXPaymentLib":    await payLib.getAddress(),
      "src/libs/MetaGuildXPlacementLib.sol:MetaGuildXPlacementLib":await placeLib.getAddress(),
      "src/MetaGuildXAdminDistributionLib.sol:MetaGuildXAdminDistributionLib":await adminDistLib.getAddress(),
      "src/MetaGuildXSurrenderLib.sol:MetaGuildXSurrenderLib":await surrenderLib.getAddress(),
      "src/MetaGuildXCoreLib.sol:MetaGuildXCoreLib":await coreLib.getAddress(),
    }
  });

  const TEFactory = await ethers.getContractFactory("MetaGuildXTokenEngine");
  const BTFactory = await ethers.getContractFactory("BinaryTree");

  const coreOpts = { kind: "uups" as const, unsafeAllowLinkedLibraries: true };
  const uupsOpts = { kind: "uups" as const };

  console.log("\n=== forceImport (registers current on-chain proxies) ===");
  await upgrades.forceImport(CORE_PROXY,         CoreFactory, coreOpts);
  console.log("Core imported");
  await upgrades.forceImport(TOKEN_ENGINE_PROXY,  TEFactory,  uupsOpts);
  console.log("TokenEngine imported");
  await upgrades.forceImport(BINARY_TREE_PROXY,   BTFactory,  uupsOpts);
  console.log("BinaryTree imported");

  console.log("\n=== OpenZeppelin Storage Layout Validation ===\n");
  const checks: Array<[string, string, any, any]> = [
    ["MetaGuildXCore",        CORE_PROXY,         CoreFactory, coreOpts],
    ["MetaGuildXTokenEngine", TOKEN_ENGINE_PROXY,  TEFactory,  uupsOpts],
    ["BinaryTree",            BINARY_TREE_PROXY,   BTFactory,  uupsOpts],
  ];
  for (const [name, proxy, factory, opts] of checks) {
    try {
      await upgrades.validateUpgrade(proxy, factory, opts);
      console.log(`\u2705 ${name}: storage SAFE`);
    } catch(e: any) {
      console.log(`\u274c ${name}: storage FAILED\n  ${e.message?.slice(0,200)}`);
    }
  }

  console.log("\nDone. No proxy state was changed.");
}

main().catch(e => { console.error("FATAL:", e.message ?? e); process.exit(1); });
