import { ethers } from "hardhat";

async function main() {
  const CORE = process.env.SYSTEM_PROXY_ADDRESS!;
  const USDT = process.env.USDT_ADDRESS!;
  const SIGNER_KEY = process.env.DEPLOYER_PRIVATE_KEY!;
  const [deployer] = await ethers.getSigners();
  const provider = ethers.provider;

  const fresh1 = ethers.Wallet.createRandom().connect(provider);
  await (await deployer.sendTransaction({
    to: fresh1.address,
    value: ethers.parseEther("0.01")
  })).wait();

  const usdt = await ethers.getContractAt(
    [
      "function mint(address,uint256) external",
      "function approve(address,uint256) external"
    ],
    USDT,
    deployer
  );
  await (await usdt.mint(fresh1.address, ethers.parseUnits("50", 18))).wait();
  await (await usdt.connect(fresh1).approve(CORE, ethers.parseUnits("50", 18))).wait();

  const signerWallet = new ethers.Wallet(SIGNER_KEY);

  const sign = async (account: string, sponsorId: bigint, nonce: bigint) => {
    const msgHash = ethers.solidityPackedKeccak256(
      ["uint256", "address", "address", "uint256", "uint256"],
      [5611n, CORE, account, sponsorId, nonce]
    );
    return signerWallet.signMessage(ethers.getBytes(msgHash));
  };

  const coreIface = await ethers.getContractAt(
    [
      "function registerWithPlacement(uint256,uint256,bool,bytes,uint256) external payable",
      "function nextUserId() view returns (uint256)"
    ],
    CORE
  );

  const upgrade = await ethers.getContractAt(
    [
      "function getRebirthIds(uint256) view returns (uint256[] memory)"
    ],
    process.env.UPGRADE_ENGINE_ADDRESS!
  );
  const u4Rebirths = await upgrade.getRebirthIds(4n);
  const income = await ethers.getContractAt(
    [
      "function rebirthEscrow(uint256) view returns (uint256)"
    ],
    process.env.INCOME_ENGINE_ADDRESS!
  );
  const u4Escrow = await income.rebirthEscrow(4n);

  console.log("=== GAS ESTIMATION ===");
  console.log("User 4 rebirthIds:", u4Rebirths.map((r: bigint) => r.toString()));
  console.log("User 4 rebirthEscrow:", u4Escrow.toString(), `= $${Number(u4Escrow) / 10}`);

  const sig1 = await sign(fresh1.address, 2n, 0n);
  const gasNormal = await coreIface.connect(fresh1).registerWithPlacement.estimateGas(
    2n,
    0n,
    false,
    sig1,
    0n
  );
  console.log("\nNormal registration gas estimate:", gasNormal.toString());
  console.log("= ~", Math.ceil(Number(gasNormal) / 100000) * 100000, "gas");

  if (u4Rebirths.length === 0 && u4Escrow >= 50n) {
    const fresh2 = ethers.Wallet.createRandom().connect(provider);
    await (await deployer.sendTransaction({
      to: fresh2.address,
      value: ethers.parseEther("0.01")
    })).wait();
    await (await usdt.mint(fresh2.address, ethers.parseUnits("50", 18))).wait();
    await (await usdt.connect(fresh2).approve(CORE, ethers.parseUnits("50", 18))).wait();

    const sig2 = await sign(fresh2.address, 4n, 0n);

    try {
      const gasRebirth = await coreIface.connect(fresh2).registerWithPlacement.estimateGas(
        4n,
        0n,
        false,
        sig2,
        0n
      );
      console.log("\nRebirth registration gas estimate:", gasRebirth.toString());
      console.log("= ~", Math.ceil(Number(gasRebirth) / 100000) * 100000, "gas");
      console.log("Current browser gasLimit: 2,000,000");
      console.log("Sufficient:", gasRebirth <= 2_000_000n ? "YES ✅" : "NO ❌ - need more!");
    } catch (e: any) {
      console.log("Gas estimate failed:", e.message.substring(0, 100));
    }
  } else {
    console.log("\nUser 4 already rebirthed OR no more escrow");
    console.log("Cannot estimate rebirth gas now");
    console.log("But previous script showed: 2,396,194 gas for rebirth");
    console.log("Current browser gasLimit: 2,000,000");
    console.log("2,396,194 > 2,000,000 → NOT ENOUGH! ❌");
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
