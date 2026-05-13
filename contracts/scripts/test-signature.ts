import { ethers } from "hardhat";

async function main() {
  const ROUTER = "0x283Bab36CFDE3fE440f5aCcdcf3c7FA8dd8fD9FC";
  const MOCK_USDT = "0x9FD1B3670693bEDb515305F3e3c1Dbc0c342B502";
  const CHAIN_ID = 5611n;
  const USER = "0x768ABB0cb74DFE05e8B81919595D9366370053a0";
  const SIGNER_KEY = "0xba3b31eaca1d095998ca88f4ef631fc6e5bfff7c34d8910b2ccbd983c2e8b650";
  const SPONSOR_ID = 1n;
  const PLACEMENT_PARENT_ID = 1n;
  const IS_LEFT = true;
  const NONCE = 0n;

  const signer = new ethers.Wallet(SIGNER_KEY);
  console.log("Signer address:", signer.address);

  const hashA = ethers.solidityPackedKeccak256(
    ["uint256", "address", "address", "uint256", "uint256", "bool", "uint256"],
    [CHAIN_ID, ROUTER, USER, SPONSOR_ID, PLACEMENT_PARENT_ID, IS_LEFT, NONCE]
  );
  const sigA = await signer.signMessage(ethers.getBytes(hashA));
  console.log("Format A sig:", sigA);

  const hashB = ethers.solidityPackedKeccak256(
    ["address", "uint256", "uint256", "bool", "uint256"],
    [USER, SPONSOR_ID, PLACEMENT_PARENT_ID, IS_LEFT, NONCE]
  );
  const sigB = await signer.signMessage(ethers.getBytes(hashB));
  console.log("Format B sig:", sigB);

  const router = await ethers.getContractAt("MetaGuildXSystem", ROUTER);
  const usdt = await ethers.getContractAt("MockUSDT", MOCK_USDT);
  const provider = ethers.provider;

  const [
    existingUserId,
    sponsorProfile,
    parentNode,
    nonce,
    defaultPaymentAsset,
    paymentUnitPrice,
    productionMode,
    incomeContract,
    cashbackContract,
    nextUserId,
    balance,
    allowance
  ] = await Promise.all([
    router.userIdByAddress(USER),
    router.usersById(SPONSOR_ID),
    router.treeNodes(PLACEMENT_PARENT_ID),
    router.nonces(USER),
    router.defaultPaymentAsset(),
    router.paymentAssetUnitPrice(MOCK_USDT),
    router.productionMode(),
    router.incomeContract(),
    router.cashbackContract(),
    router.nextUserId(),
    usdt.balanceOf(USER),
    usdt.allowance(USER, ROUTER)
  ]);

  console.log("--- Registration path checks after signature ---");
  console.log("Already registered?           ", existingUserId.toString() !== "0" ? "YES" : "NO");
  console.log("Placement nonce              ", nonce.toString());
  console.log("Expected nonce               ", NONCE.toString());
  console.log("Sponsor exists?              ", sponsorProfile.account !== ethers.ZeroAddress ? "YES" : "NO");
  console.log("Root user path?              ", nextUserId === 1n ? "YES" : "NO");
  console.log("Parent node exists?          ", parentNode.userId.toString() !== "0" ? "YES" : "NO");
  console.log("Parent left occupied?        ", parentNode.leftChildId.toString() !== "0" ? "YES" : "NO");
  console.log("Parent right occupied?       ", parentNode.rightChildId.toString() !== "0" ? "YES" : "NO");
  console.log("Production mode?             ", productionMode);
  console.log("Default payment asset        ", defaultPaymentAsset);
  console.log("Payment unit price           ", paymentUnitPrice.toString());
  console.log("Income contract              ", incomeContract);
  console.log("Cashback contract            ", cashbackContract);
  console.log("User USDT balance            ", ethers.formatUnits(balance, 18));
  console.log("User USDT allowance          ", ethers.formatUnits(allowance, 18));
  console.log("Required USDT                ", "10.0");

  for (const [label, sig] of [
    ["A", sigA],
    ["B", sigB]
  ] as const) {
    try {
      const tx = await router.registerWithPlacement.populateTransaction(
        SPONSOR_ID,
        PLACEMENT_PARENT_ID,
        IS_LEFT,
        sig,
        NONCE
      );
      await provider.call({
        from: USER,
        to: ROUTER,
        data: tx.data ?? "0x"
      });
      console.log(`Format ${label}: SUCCESS ✅`);
    } catch (e: any) {
      const revertData =
        e?.data ??
        e?.info?.error?.data ??
        e?.error?.data ??
        null;
      console.log(`Format ${label}: FAIL - ${e?.message?.slice?.(0, 160) ?? String(e)}`);
      console.log(`Format ${label}: revert data - ${revertData}`);
    }
  }
}

main().catch(console.error);
