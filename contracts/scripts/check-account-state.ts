import { ethers } from "hardhat";

async function main() {
  const CORE = process.env.SYSTEM_PROXY_ADDRESS!;
  const USDT = process.env.USDT_ADDRESS!;

  const core = await ethers.getContractAt(
    [
      "function userIdByAddress(address) view returns (uint256)",
      "function nonces(address) view returns (uint256)",
      "function nextUserId() view returns (uint256)"
    ],
    CORE
  );

  const usdt = await ethers.getContractAt(
    [
      "function balanceOf(address) view returns (uint256)",
      "function allowance(address,address) view returns (uint256)"
    ],
    USDT
  );

  const account = "0x3D1FC4c1b0A84e8e46461308cAcd4c5F489349a7";

  const userId = await core.userIdByAddress(account);
  const nonce = await core.nonces(account);
  const bal = await usdt.balanceOf(account);
  const allowance = await usdt.allowance(account, CORE);
  const bnbBal = await ethers.provider.getBalance(account);

  console.log("account:", account);
  console.log("userId:", userId.toString());
  console.log("Already registered:", userId !== 0n);
  console.log("nonce:", nonce.toString());
  console.log("USDT balance:", ethers.formatUnits(bal, 18));
  console.log("USDT allowance:", ethers.formatUnits(allowance, 18));
  console.log("BNB balance:", ethers.formatEther(bnbBal));

  const nextId = await core.nextUserId();
  console.log("\nnextUserId:", nextId.toString());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
