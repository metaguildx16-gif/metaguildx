import { ethers } from "hardhat";

async function main() {
  const UPGRADE = process.env.UPGRADE_ENGINE_ADDRESS!;
  const CORE = process.env.SYSTEM_PROXY_ADDRESS!;
  const USDT = process.env.USDT_ADDRESS!;
  const [deployer] = await ethers.getSigners();
  const provider = ethers.provider;

  const freshUser = ethers.Wallet.createRandom().connect(provider);

  await (
    await deployer.sendTransaction({
      to: freshUser.address,
      value: ethers.parseEther("0.01")
    })
  ).wait();

  const usdt = await ethers.getContractAt(
    [
      "function mint(address,uint256) external",
      "function approve(address,uint256) external"
    ],
    USDT,
    deployer
  );

  await (await usdt.mint(freshUser.address, ethers.parseUnits("50", 18))).wait();
  await (await usdt.connect(freshUser).approve(CORE, ethers.parseUnits("50", 18))).wait();

  const SIGNER_KEY = process.env.DEPLOYER_PRIVATE_KEY!;
  const signerWallet = new ethers.Wallet(SIGNER_KEY);
  const nonce = 0n;
  const sponsorId = 4n;

  const msgHash = ethers.solidityPackedKeccak256(
    ["uint256", "address", "address", "uint256", "uint256"],
    [5611n, CORE, freshUser.address, sponsorId, nonce]
  );
  const sig = await signerWallet.signMessage(ethers.getBytes(msgHash));

  const core = await ethers.getContractAt(
    [
      "function registerWithPlacement(uint256,uint256,bool,bytes,uint256) external payable",
      "function nextUserId() view returns (uint256)"
    ],
    CORE
  );

  const beforeId = await core.nextUserId();
  console.log("Before registration nextUserId:", beforeId.toString());
  console.log("Registering fresh user under User 4...");
  console.log("This should trigger User 4 rebirth!");

  try {
    const tx = await core.connect(freshUser).registerWithPlacement(sponsorId, 0n, false, sig, nonce, {
      gasLimit: 8_000_000n
    });
    const receipt = await tx.wait();
    console.log("SUCCESS ✅");
    console.log("gasUsed:", receipt?.gasUsed.toString());
    console.log("logs:", receipt?.logs.length);
    console.log("txHash:", receipt?.hash);

    const afterId = await core.nextUserId();
    console.log("After nextUserId:", afterId.toString());
    console.log("New users created:", Number(afterId) - Number(beforeId));

    const upgrade = await ethers.getContractAt(
      [
        "function getRebirthIds(uint256) view returns (uint256[] memory)"
      ],
      UPGRADE
    );

    const rebirthIds = await upgrade.getRebirthIds(4n);
    console.log("\nUser 4 rebirthIds after:", rebirthIds.map((r: bigint) => r.toString()));
  } catch (err: any) {
    console.log("REVERT ❌");
    console.log("reason:", err.reason ?? "none");
    console.log("gasUsed:", err.receipt?.gasUsed?.toString() ?? "unknown");
    console.log("logs:", err.receipt?.logs?.length ?? 0);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
