import { ethers } from "hardhat";

async function main() {
  const ROUTER = "0x283Bab36CFDE3fE440f5aCcdcf3c7FA8dd8fD9FC";
  const USER2 = "0x768ABB0cb74DFE05e8B81919595D9366370053a0";

  const router = await ethers.getContractAt("MetaGuildXSystem", ROUTER);
  const nonce = await router.nonces(USER2);
  const userId = await router.userIdByAddress(USER2);

  console.log("User2 nonce    :", nonce.toString());
  console.log("User2 userId   :", userId.toString());
  console.log("Already registered:", userId.toString() !== "0");
}

main().catch(console.error);
