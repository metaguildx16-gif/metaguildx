import { ethers } from "hardhat";

async function main() {
  const CORE = process.env.SYSTEM_PROXY_ADDRESS!;
  const provider = ethers.provider;

  const status = await provider.getStorage(CORE, 0);
  console.log("Storage slot 0:", status);

  const status1 = await provider.getStorage(CORE, 1);
  console.log("Storage slot 1:", status1);

  const core = await ethers.getContractAt(
    [
      "function nextUserId() view returns (uint256)",
      "function productionMode() view returns (bool)",
      "function userIdByAddress(address) view returns (uint256)",
    ],
    CORE
  );

  console.log("\nnextUserId:", (await core.nextUserId()).toString());
  console.log("productionMode:", await core.productionMode());

  for (let i = 0; i <= 5; i += 1) {
    const val = await provider.getStorage(CORE, i);
    console.log(`Slot ${i}:`, val);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
