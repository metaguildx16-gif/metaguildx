import { ethers } from "hardhat";

async function main() {
  const provider = ethers.provider;
  const IMPL_SLOT = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";

  const contractAddresses = {
    MetaGuildXCore: "0x9490E2C603c5a6D3c0E66af8494E766470dA1E4B",
    MetaGuildXIncome: "0xcD4a223ac91E551BF0e278dF1bE9eb29901A4FeB",
    IncomeRouter: "0xd496eC1Cf0E66a7beECe21b8Bd908F335aBbDfe8",
    MetaGuildXUpgrade: "0x8CF75a78641a0e390C0101a1541Bed82E3214A9A",
    BinaryTree_NEW: "0x93ceF78C90ED74f243123B51f153B601eF47010e",
    BinaryTree_OLD: "0x3eac85Aa39084Bd016D84638926c45C5Bc71cB82",
    BinaryTree_OTHER: "0x59f18c8A55e441EE86f92b76e506bac8D08E7365",
    CashbackPool: "0x1F207B70812652b9fd9b9CC0FCfcef35CeeEe755",
    MGXStaking: "0x442f802836D42316544E64643dE177f5C466B3Aa"
  } as const;

  console.log("=== PROXY AUDIT ===\n");

  for (const [name, addr] of Object.entries(contractAddresses)) {
    const implRaw = await provider.getStorage(addr, IMPL_SLOT);
    const implAddr = "0x" + implRaw.slice(26);
    const isProxy = implAddr !== "0x0000000000000000000000000000000000000000";

    console.log(`${name}: ${addr}`);
    console.log(`  Is UUPS Proxy: ${isProxy}`);
    if (isProxy) {
      console.log(`  Implementation: ${implAddr}`);
    }
    console.log("");
  }

  console.log("=== BINARY TREE ALGORITHMS ===\n");

  const trees = [
    { name: "BinaryTree_OLD", addr: "0x3eac85Aa39084Bd016D84638926c45C5Bc71cB82" },
    { name: "BinaryTree_NEW", addr: "0x93ceF78C90ED74f243123B51f153B601eF47010e" },
    { name: "BinaryTree_OTHER", addr: "0x59f18c8A55e441EE86f92b76e506bac8D08E7365" }
  ];

  for (const t of trees) {
    const implRaw = await provider.getStorage(t.addr, IMPL_SLOT);
    const implAddr = "0x" + implRaw.slice(26);
    const isProxy = implAddr !== "0x0000000000000000000000000000000000000000";

    console.log(`${t.name}: ${t.addr}`);
    console.log(`  Is Proxy: ${isProxy}`);
    if (isProxy) console.log(`  Impl: ${implAddr}`);

    const tree = await ethers.getContractAt(
      [
        "function rootUserId() view returns (uint256)",
        "function coreContract() view returns (address)",
        "function nodes(uint256) view returns (tuple(uint256 id, uint256 parentId, uint256 leftChildId, uint256 rightChildId))"
      ],
      t.addr
    );

    try {
      const root = await tree.rootUserId();
      const core = await tree.coreContract();
      console.log(`  rootUserId: ${root}`);
      console.log(`  coreContract: ${core}`);

      const n2 = await tree.nodes(2n);
      const n3 = await tree.nodes(3n);
      console.log(`  User2: left=${n2.leftChildId} right=${n2.rightChildId}`);
      console.log(`  User3: left=${n3.leftChildId} right=${n3.rightChildId}`);
    } catch (e: any) {
      console.log(`  ERROR: ${e.message.substring(0, 50)}`);
    }
    console.log("");
  }

  const core = await ethers.getContractAt(
    [
      "function binaryTreeContract() view returns (address)",
      "function incomeRouterContract() view returns (address)",
      "function incomeEngineContract() view returns (address)",
      "function upgradeEngineContract() view returns (address)"
    ],
    "0x9490E2C603c5a6D3c0E66af8494E766470dA1E4B"
  );

  console.log("=== CORE WIRING ===");
  console.log("binaryTree:", await core.binaryTreeContract());
  console.log("router:", await core.incomeRouterContract());
  console.log("income:", await core.incomeEngineContract());
  console.log("upgrade:", await core.upgradeEngineContract());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
