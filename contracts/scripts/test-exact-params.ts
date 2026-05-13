import { ethers } from "hardhat";

async function main() {
  const CORE = process.env.SYSTEM_PROXY_ADDRESS!;
  const USDT = process.env.USDT_ADDRESS!;
  const SIGNER_KEY = process.env.DEPLOYER_PRIVATE_KEY!;
  const [deployer] = await ethers.getSigners();
  const provider = ethers.provider;

  const account = "0x3D1FC4c1b0A84e8e46461308cAcd4c5F489349a7";
  const sponsorId = 2n;
  const placementParentId = 5n;
  const isLeft = false;
  const nonce = 0n;

  const core = await ethers.getContractAt(
    [
      "function userIdByAddress(address) view returns (uint256)",
      "function nonces(address) view returns (uint256)",
      "function usersById(uint256) view returns (tuple(uint256 id, address account, uint256 sponsorId, uint8 packageLevel, uint8 originalPackageLevel, uint256 totalContribution, uint256 totalEarnings, uint256 directReferrals, uint256 totalTeamBusiness, uint256 rebirthCount, uint256 xCount, uint256 joinedAt, bool surrendered))",
      "function isRebirthUser(uint256) view returns (bool)",
    ],
    CORE
  );

  console.log("=== ACCOUNT STATE ===");
  const existingId = await core.userIdByAddress(account);
  console.log("account:", account);
  console.log("userIdByAddress:", existingId.toString());
  console.log("Already registered:", existingId !== 0n);

  const onChainNonce = await core.nonces(account);
  console.log("on-chain nonce:", onChainNonce.toString());
  console.log("using nonce:", nonce.toString());
  console.log("nonce match:", onChainNonce === nonce);

  const sponsor = await core.usersById(sponsorId);
  console.log("\nsponsor id:", sponsorId.toString());
  console.log("sponsor exists:", sponsor.id !== 0n);
  console.log("sponsor isRebirth:", await core.isRebirthUser(sponsorId));

  const usdt = await ethers.getContractAt(
    [
      "function balanceOf(address) view returns (uint256)",
      "function allowance(address,address) view returns (uint256)",
    ],
    USDT
  );

  const bal = await usdt.balanceOf(account);
  const allowance = await usdt.allowance(account, CORE);
  console.log("\nUSDT balance:", ethers.formatUnits(bal, 18));
  console.log("USDT allowance:", ethers.formatUnits(allowance, 18));

  const signerWallet = new ethers.Wallet(SIGNER_KEY);
  const msgHash = ethers.solidityPackedKeccak256(
    ["uint256", "address", "address", "uint256", "uint256"],
    [5611n, CORE, account, sponsorId, nonce]
  );
  const sig = await signerWallet.signMessage(ethers.getBytes(msgHash));

  const frontendSig =
    "0x0e13bcd88f0a2e28b8bef2446c3c9545321fc5557c6b872f7fb7cc14981bb1824ea4a05d213f231d193568b9301f5968b42438030f085c45e0b39db8b7dcb1d41b";

  console.log("\n=== SIGNATURE CHECK ===");
  console.log("Script sig:", sig);
  console.log("Frontend sig:", frontendSig);
  console.log("Match:", sig.toLowerCase() === frontendSig.toLowerCase());

  const gasBal = await provider.getBalance(account);
  console.log("\nAccount BNB:", ethers.formatEther(gasBal));

  if (bal < ethers.parseUnits("10", 18)) {
    console.log("Minting USDT...");
    const usdtMint = await ethers.getContractAt(
      ["function mint(address,uint256) external"],
      USDT,
      deployer
    );
    await (await usdtMint.mint(account, ethers.parseUnits("50", 18))).wait();
    console.log("Minted ✅");
  }

  const coreIface = await ethers.getContractAt(
    ["function registerWithPlacement(uint256,uint256,bool,bytes,uint256) external payable"],
    CORE
  );

  console.log("\n=== STATIC CALL (frontend params) ===");
  try {
    await coreIface.registerWithPlacement.staticCall(
      sponsorId,
      placementParentId,
      isLeft,
      frontendSig,
      nonce,
      { from: account }
    );
    console.log("PASS ✅");
  } catch (err: any) {
    console.log("REVERT:", err.reason ?? "no reason");
    console.log("data:", err.data ?? "no data");
    console.log("msg:", String(err.message).substring(0, 200));
  }

  console.log("\n=== STATIC CALL (script sig) ===");
  try {
    await coreIface.registerWithPlacement.staticCall(
      sponsorId,
      placementParentId,
      isLeft,
      sig,
      nonce,
      { from: account }
    );
    console.log("PASS ✅");
  } catch (err: any) {
    console.log("REVERT:", err.reason ?? "no reason");
    console.log("data:", err.data ?? "no data");
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
