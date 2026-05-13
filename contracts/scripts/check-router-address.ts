import { ethers } from "hardhat";

const CORE = "0xcea26779d6C0d80525702a5a7362Aa4d08F9E1Ec";
const EXPECTED_ROUTER = "0x79870332B3959a3e3A2A1D01c4cE497809Bf7B35";
const USER2_WALLET = "0xfAD6D73e144176E77Bbc9B4268648c6aAe81f247";

async function tryGetter(address: string, signature: string) {
  const contract = new ethers.Contract(address, [signature], ethers.provider);
  const fn = signature.match(/function\s+([^(]+)/)?.[1];
  if (!fn) {
    throw new Error(`Unable to parse function name from signature: ${signature}`);
  }

  try {
    const value = await (contract as any)[fn]();
    return { exists: true, value: value?.toString?.() ?? String(value) };
  } catch (error: any) {
    return {
      exists: false,
      error: error?.shortMessage ?? error?.message ?? String(error),
    };
  }
}

async function main() {
  console.log("=== CORE ROUTER VARIABLE NAMES IN SOURCE ===");
  console.log("incomeRouterContract");
  console.log("incomeEngineContract");

  console.log("\n=== ON-CHAIN ROUTER GETTERS ===");
  const incomeRouter = await tryGetter(CORE, "function incomeRouterContract() view returns (address)");
  const routerContract = await tryGetter(CORE, "function routerContract() view returns (address)");
  const router = await tryGetter(CORE, "function router() view returns (address)");

  console.log("core.incomeRouterContract():", incomeRouter.exists ? incomeRouter.value : `NOT AVAILABLE (${incomeRouter.error})`);
  console.log("core.routerContract():", routerContract.exists ? routerContract.value : `NOT AVAILABLE (${routerContract.error})`);
  console.log("core.router():", router.exists ? router.value : `NOT AVAILABLE (${router.error})`);

  const actualRouter = incomeRouter.exists ? incomeRouter.value! : "N/A";
  console.log("\nExpected Router:", EXPECTED_ROUTER);
  console.log("Actual on-chain value:", actualRouter);
  console.log("Match?:", actualRouter.toLowerCase() === EXPECTED_ROUTER.toLowerCase() ? "YES" : "NO");

  const core = await ethers.getContractAt("MetaGuildXCore", CORE);
  const user2Id = await core.userIdByAddress(USER2_WALLET);
  const user2Profile = await core.usersById(user2Id);

  console.log("\n=== USER 2 STATE ===");
  console.log("User 2 wallet:", USER2_WALLET);
  console.log("User 2 id:", user2Id.toString());
  console.log("User 2 sponsorId:", user2Profile.sponsorId.toString());
  console.log("User 2 packageLevel:", user2Profile.packageLevel.toString());

  console.log("\n=== USER 2 REGISTRATION EVENT ===");
  const logs = await core.queryFilter(core.filters.UserRegistered(user2Id, null, USER2_WALLET), 0, "latest");
  if (logs.length === 0) {
    console.log("UserRegistered event for User 2: NOT FOUND");
    return;
  }

  const log = logs[0];
  console.log("Registration tx hash:", log.transactionHash);
  console.log("Registration block number:", log.blockNumber);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
