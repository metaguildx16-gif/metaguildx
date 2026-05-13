import { ethers } from "hardhat";

async function main() {
  const CORE = process.env.SYSTEM_PROXY_ADDRESS!;
  const USDT = process.env.USDT_ADDRESS!;

  const [deployer] = await ethers.getSigners();

  const testUser = ethers.Wallet.createRandom().connect(ethers.provider);
  const testAddr = testUser.address;

  const core = await ethers.getContractAt(
    [
      "function userIdByAddress(address) view returns (uint256)",
      "function placementSigner() view returns (address)",
      "function nonces(address) view returns (uint256)",
      "function usersById(uint256) view returns (tuple(uint256 id, address account, uint256 sponsorId, uint8 packageLevel, uint8 originalPackageLevel, uint256 totalContribution, uint256 totalEarnings, uint256 directReferrals, uint256 totalTeamBusiness, uint256 rebirthCount, uint256 xCount, uint256 joinedAt, bool surrendered))",
      "function isRebirthUser(uint256) view returns (bool)",
      "function productionMode() view returns (bool)",
      "function defaultPaymentAsset() view returns (address)",
      "function packagePricesArray(uint256) view returns (uint256)",
      "function nativePaymentAssets(address) view returns (bool)",
      "function isPaymentAssetEnabled(address) view returns (bool)",
    ],
    CORE
  );

  console.log("=== PRE-REGISTRATION CHECKS ===");
  console.log("Test user:", testAddr);

  const existingId = await core.userIdByAddress(testAddr);
  console.log("\n1. Already registered:", existingId.toString() !== "0");
  console.log("   userIdByAddress:", existingId.toString());

  const signer = await core.placementSigner();
  console.log("\n2. Placement signer:", signer);
  console.log("   Is zero:", signer === ethers.ZeroAddress);

  const nonce = await core.nonces(testAddr);
  console.log("\n3. Nonce:", nonce.toString());

  const sponsorId = 4n;
  const sponsor = await core.usersById(sponsorId);
  console.log("\n4. Sponsor (User 4):");
  console.log("   id:", sponsor.id.toString());
  console.log("   exists:", sponsor.id !== 0n);

  const sponsorIsRebirth = await core.isRebirthUser(sponsorId);
  console.log("\n5. Sponsor isRebirthUser:", sponsorIsRebirth);
  console.log("   Would fail: require(!isRebirthUser(sponsorId))");

  const prodMode = await core.productionMode();
  console.log("\n6. productionMode:", prodMode);

  const defAsset = await core.defaultPaymentAsset();
  console.log("\n7. defaultPaymentAsset:", defAsset);

  const isNative = await core.nativePaymentAssets(defAsset);
  console.log("   isNativePayment:", isNative);

  const pkgPrice = await core.packagePricesArray(0n);
  console.log("\n8. Package 1 price:", pkgPrice.toString());

  const isEnabled = await core.isPaymentAssetEnabled(defAsset);
  console.log("\n9. Payment asset enabled:", isEnabled);

  const usdt = await ethers.getContractAt(
    [
      "function balanceOf(address) view returns (uint256)",
      "function allowance(address,address) view returns (uint256)",
    ],
    USDT
  );

  await (await deployer.sendTransaction({
    to: testAddr,
    value: ethers.parseEther("0.01"),
  })).wait();

  const usdtContract = await ethers.getContractAt(
    [
      "function mint(address,uint256) external",
      "function approve(address,uint256) external returns (bool)",
    ],
    USDT,
    deployer
  );

  await (await usdtContract.mint(testAddr, ethers.parseUnits("50", 18))).wait();

  const usdtAsUser = usdtContract.connect(testUser);
  await (await usdtAsUser.approve(CORE, ethers.parseUnits("50", 18))).wait();

  const balance = await usdt.balanceOf(testAddr);
  const allowance = await usdt.allowance(testAddr, CORE);

  console.log("\n10. USDT balance:", ethers.formatUnits(balance, 18));
  console.log("    USDT allowance:", ethers.formatUnits(allowance, 18));

  const unitPrice = await core.packagePricesArray(0n);
  console.log("\n11. Platform price (raw units):", unitPrice.toString());
  console.log("    = $", Number(unitPrice) / 10);

  console.log("\n12. All checks summary:");
  console.log("   Already registered:", existingId !== 0n, "→", existingId !== 0n ? "FAIL" : "PASS");
  console.log("   Signer set:", signer !== ethers.ZeroAddress, "→", signer === ethers.ZeroAddress ? "FAIL" : "PASS");
  console.log("   Sponsor exists:", sponsor.id !== 0n, "→", sponsor.id === 0n ? "FAIL" : "PASS");
  console.log("   Sponsor not rebirth:", !sponsorIsRebirth, "→", sponsorIsRebirth ? "FAIL" : "PASS");
  console.log("   USDT balance > 0:", balance > 0n, "→", balance === 0n ? "FAIL" : "PASS");
  console.log("   USDT allowance > 0:", allowance > 0n, "→", allowance === 0n ? "FAIL" : "PASS");

  const SIGNER_KEY = process.env.DEPLOYER_PRIVATE_KEY!;
  const signerWallet = new ethers.Wallet(SIGNER_KEY);
  const msgHash = ethers.solidityPackedKeccak256(
    ["uint256", "address", "address", "uint256", "uint256"],
    [5611n, CORE, testAddr, sponsorId, nonce]
  );
  const signature = await signerWallet.signMessage(ethers.getBytes(msgHash));

  console.log("\n=== STATIC CALL TEST ===");
  const coreAsUser = (
    await ethers.getContractAt(
      ["function registerWithPlacement(uint256,uint256,bool,bytes,uint256) external payable"],
      CORE
    )
  ).connect(testUser);

  try {
    await coreAsUser.registerWithPlacement.staticCall(sponsorId, 4n, false, signature, nonce);
    console.log("PASS ✅");
  } catch (err: any) {
    console.log("REVERT:", err.reason ?? err.message.substring(0, 200));
    console.log("Data:", err.data ?? "none");
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
