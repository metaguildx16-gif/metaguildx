import { ethers } from "hardhat";
import { Wallet, getBytes, solidityPackedKeccak256 } from "ethers";

async function main() {
  const ROUTER = "0x283Bab36CFDE3fE440f5aCcdcf3c7FA8dd8fD9FC";
  const USER2 = "0x768ABB0cb74DFE05e8B81919595D9366370053a0";
  const SIGNER_KEY = "0xba3b31eaca1d095998ca88f4ef631fc6e5bfff7c34d8910b2ccbd983c2e8b650";
  const MOCK_USDT = "0x9FD1B3670693bEDb515305F3e3c1Dbc0c342B502";
  const SPONSOR_ID = 1n;
  const CHAIN_ID = 5611n;

  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);

  const router = await ethers.getContractAt("MetaGuildXSystem", ROUTER);
  const usdt = await ethers.getContractAt("MockUSDT", MOCK_USDT);

  const node = await router.treeNodes(1);
  const placementParentId = Number(node.leftChildId) === 0 ? 1n : 1n;
  const isLeft = Number(node.leftChildId) === 0;
  console.log("Placement parent:", placementParentId.toString(), "isLeft:", isLeft);

  const nonce = await router.nonces(USER2);
  console.log("Nonce:", nonce.toString());

  const signer = new Wallet(SIGNER_KEY);
  const digest = solidityPackedKeccak256(
    ["uint256", "address", "address", "uint256", "uint256", "bool", "uint256"],
    [CHAIN_ID, ROUTER, USER2, SPONSOR_ID, placementParentId, isLeft, nonce]
  );
  const signature = await signer.signMessage(getBytes(digest));
  console.log("Signature:", signature.slice(0, 20), "...");

  const amount = ethers.parseUnits("10", 18);
  void amount;

  const bal = await usdt.balanceOf(deployer.address);
  console.log("Deployer USDT balance:", ethers.formatUnits(bal, 18));

  console.log("\n--- Impersonated static call test ---");
  try {
    await ethers.provider.send("hardhat_impersonateAccount", [USER2]);
    const impersonated = await ethers.getSigner(USER2);

    const routerAsUser2 = router.connect(impersonated);
    await routerAsUser2.registerWithPlacement.staticCall(
      SPONSOR_ID,
      placementParentId,
      isLeft,
      signature,
      nonce
    );
    console.log("Static call: SUCCESS ✅");

    await ethers.provider.send("hardhat_stopImpersonatingAccount", [USER2]);
  } catch (e: any) {
    console.log("Static call FAIL:", e.message.slice(0, 200));
    if (e.data) {
      console.log("Error data:", e.data);
    }

    try {
      const iface = router.interface;
      const calldata = iface.encodeFunctionData("registerWithPlacement", [
        SPONSOR_ID,
        placementParentId,
        isLeft,
        signature,
        nonce
      ]);

      const result = await ethers.provider.send("eth_call", [{
        from: USER2,
        to: ROUTER,
        data: calldata,
        gas: "0x1E8480"
      }, "latest"]);

      console.log("eth_call result:", result);
    } catch (e2: any) {
      console.log("eth_call also failed:", e2.message.slice(0, 200));
      if (e2.data) {
        console.log("eth_call error data:", e2.data);
      }
    }
  }
}

main().catch(console.error);
