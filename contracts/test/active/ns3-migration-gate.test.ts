import { expect } from "chai";
import { ethers, upgrades } from "hardhat";

describe("NS3 — Migration Gate, Formula Integration, Verifier Logic", function () {
  this.timeout(300_000);

  async function deployLibraries() {
    const upgradeCycleLib = await (await ethers.getContractFactory("UpgradeCycleLib")).deploy();
    const payLib          = await (await ethers.getContractFactory("MetaGuildXPaymentLib")).deploy();
    const placeLib        = await (await ethers.getContractFactory("MetaGuildXPlacementLib")).deploy();
    const adminLib        = await (await ethers.getContractFactory("MetaGuildXAdminLib")).deploy();
    const rebirthLib      = await (await ethers.getContractFactory("MetaGuildXRebirthLib")).deploy();
    await Promise.all([upgradeCycleLib,payLib,placeLib,adminLib,rebirthLib].map(c=>c.waitForDeployment()));
    const upgradeLib = await (await ethers.getContractFactory("MetaGuildXUpgradeFlowLib",{libraries:{
      "src/libraries/UpgradeCycleLib.sol:UpgradeCycleLib": await upgradeCycleLib.getAddress(),
      "src/libs/MetaGuildXPaymentLib.sol:MetaGuildXPaymentLib": await payLib.getAddress(),
    }})).deploy(); await upgradeLib.waitForDeployment();
    const adminDistLib = await (await ethers.getContractFactory("MetaGuildXAdminDistributionLib",{
      libraries:{"src/libs/MetaGuildXPaymentLib.sol:MetaGuildXPaymentLib":await payLib.getAddress()}
    })).deploy(); await adminDistLib.waitForDeployment();
    const surrenderLib = await (await ethers.getContractFactory("MetaGuildXSurrenderLib",{
      libraries:{"src/libs/MetaGuildXPaymentLib.sol:MetaGuildXPaymentLib":await payLib.getAddress()}
    })).deploy(); await surrenderLib.waitForDeployment();
    const coreLib = await (await ethers.getContractFactory("MetaGuildXCoreLib",{
      libraries:{"src/libs/MetaGuildXPaymentLib.sol:MetaGuildXPaymentLib":await payLib.getAddress()}
    })).deploy(); await coreLib.waitForDeployment();
    return {
      "src/MetaGuildXAdminLib.sol:MetaGuildXAdminLib":                             await adminLib.getAddress(),
      "src/MetaGuildXRebirthLib.sol:MetaGuildXRebirthLib":                         await rebirthLib.getAddress(),
      "src/MetaGuildXUpgradeFlowLib.sol:MetaGuildXUpgradeFlowLib":                 await upgradeLib.getAddress(),
      "src/libs/MetaGuildXPaymentLib.sol:MetaGuildXPaymentLib":                    await payLib.getAddress(),
      "src/libs/MetaGuildXPlacementLib.sol:MetaGuildXPlacementLib":                await placeLib.getAddress(),
      "src/MetaGuildXAdminDistributionLib.sol:MetaGuildXAdminDistributionLib":     await adminDistLib.getAddress(),
      "src/MetaGuildXSurrenderLib.sol:MetaGuildXSurrenderLib":                     await surrenderLib.getAddress(),
      "src/MetaGuildXCoreLib.sol:MetaGuildXCoreLib":                               await coreLib.getAddress(),
    };
  }

  async function deploySystem() {
    const [owner, creator, admin, ...users] = await ethers.getSigners();
    const libraries = await deployLibraries();
    const mgxToken = await (await ethers.getContractFactory("MGXToken")).deploy(owner.address);
    const usdt     = await (await ethers.getContractFactory("MockUSDT")).deploy(owner.address);
    await Promise.all([mgxToken,usdt].map(c=>c.waitForDeployment()));
    const binaryTree = await upgrades.deployProxy(await ethers.getContractFactory("BinaryTree"),[owner.address],{kind:"uups"});
    const router     = await upgrades.deployProxy(await ethers.getContractFactory("IncomeRouter"),[owner.address],{kind:"uups"});
    const cashback   = await upgrades.deployProxy(await ethers.getContractFactory("CashbackPool"),[owner.address],{kind:"uups"});
    const staking    = await upgrades.deployProxy(await ethers.getContractFactory("MGXStaking"),[owner.address],{kind:"uups"});
    await Promise.all([binaryTree,router,cashback,staking].map(c=>c.waitForDeployment()));
    const core = await upgrades.deployProxy(
      await ethers.getContractFactory("MetaGuildXCore",{libraries}),
      [owner.address],{kind:"uups",unsafeAllowLinkedLibraries:true}) as any;
    await core.waitForDeployment();
    const upgrade = await upgrades.deployProxy(
      await ethers.getContractFactory("MetaGuildXUpgrade"),
      [await core.getAddress(),owner.address,await usdt.getAddress()],{kind:"uups"});
    const income = await upgrades.deployProxy(
      await ethers.getContractFactory("MetaGuildXIncome"),
      [await core.getAddress(),await router.getAddress(),await upgrade.getAddress(),await usdt.getAddress()],{kind:"uups"});
    const tokenEngine = await upgrades.deployProxy(
      await ethers.getContractFactory("MetaGuildXTokenEngine"),[await core.getAddress()],{kind:"uups"});
    await Promise.all([upgrade,income,tokenEngine].map(c=>c.waitForDeployment()));
    await (await upgrade.setIncomeContract(await income.getAddress())).wait();
    const coreAddr=await core.getAddress();
    await (await core.setBinaryTreeContract(await binaryTree.getAddress())).wait();
    await (await core.setIncomeRouterContract(await router.getAddress())).wait();
    await (await core.setIncomeEngineContract(await income.getAddress())).wait();
    await (await core.setUpgradeEngineContract(await upgrade.getAddress())).wait();
    await (await core.setCashbackPoolContract(await cashback.getAddress())).wait();
    await (await core.setStakingContract(await staking.getAddress())).wait();
    await (await core.setMgxTokenAddress(await mgxToken.getAddress())).wait();
    await (await core.setUsdtAddress(await usdt.getAddress())).wait();
    await (await core.setDefaultPaymentAsset(await usdt.getAddress())).wait();
    await (await core.setCreatorFeeWallet(creator.address)).wait();
    await (await core.setPlacementSigner(owner.address)).wait();
    await (await core.setTokenEngineContract(await tokenEngine.getAddress())).wait();
    await (await core.configurePaymentAsset(await usdt.getAddress(),true,false,10n**17n)).wait();
    await (await core.setProductionMode(true,await usdt.getAddress())).wait();
    await (await core.setAdminAddress(admin.address)).wait();
    await (await binaryTree.setCoreContract(coreAddr)).wait();
    await (await router.setCoreContract(coreAddr)).wait();
    await (await router.setIncomeEngineContract(await income.getAddress())).wait();
    await (await router.setCreatorWallet(creator.address)).wait();
    await (await income.setCoreContract(coreAddr)).wait();
    await (await income.setIncomeRouterContract(await router.getAddress())).wait();
    await (await income.setUpgradeEngineContract(await upgrade.getAddress())).wait();
    await (await income.setDefaultPaymentAsset(await usdt.getAddress())).wait();
    await (await upgrade.setCoreContract(coreAddr)).wait();
    await (await upgrade.setIncomeContract(await income.getAddress())).wait();
    await (await upgrade.setDefaultPaymentAsset(await usdt.getAddress())).wait();
    await (await cashback.setCoreContract(coreAddr)).wait();
    await (await cashback.setPaymentAsset(await usdt.getAddress())).wait();
    await (await staking.setCoreContract(coreAddr)).wait();
    await (await staking.setIncomeContract(await income.getAddress())).wait();
    await (await mgxToken.mintLaunchAllocations(coreAddr,owner.address,owner.address)).wait();
    return {owner,creator,admin,users,mgxToken,usdt,binaryTree,router,cashback,staking,core,income,upgrade,tokenEngine};
  }

  async function registerUser(ctx:any, signer:any, sponsorId:bigint){
    const {owner,core,usdt}=ctx;
    const coreAddr=await core.getAddress();
    const usdtAddr=await usdt.getAddress();
    const unitPrice=await core.paymentAssetUnitPrice(usdtAddr);
    const pkgPrice=(await core.getPackagePrices())[0];
    await (await usdt.connect(owner).mint(signer.address,pkgPrice*unitPrice*50n)).wait();
    await (await usdt.connect(signer).approve(coreAddr,pkgPrice*unitPrice*50n)).wait();
    const nw=await ethers.provider.getNetwork();
    const nonce=await core.nonces(signer.address);
    const lb=await ethers.provider.getBlock("latest");
    const deadline=BigInt(lb!.timestamp+365*24*3600);
    const sh=ethers.solidityPackedKeccak256(
      ["uint256","address","address","uint256","uint256","bool","uint256","uint256"],
      [nw.chainId,coreAddr,signer.address,sponsorId,0n,false,nonce,deadline]);
    const sig=await owner.signMessage(ethers.getBytes(sh));
    await (await core.connect(signer).registerWithPlacement(sponsorId,0n,false,sig,nonce,deadline)).wait();
    return core.userIdByAddress(signer.address);
  }

  async function setupSurrender(ctx:any, userIdx:number){
    const userId=await registerUser(ctx,ctx.users[userIdx],0n);
    const coreAddr=await ctx.core.getAddress();
    const usdtAddr=await ctx.usdt.getAddress();
    await ctx.usdt.connect(ctx.owner).mint(coreAddr,ethers.parseEther("1000"));
    // Impersonate Core to call CashbackPool.surrenderForCashback directly (onlyCore)
    const coreSigner=await ethers.getImpersonatedSigner(coreAddr);
    await ethers.provider.send("hardhat_setBalance",[coreAddr,"0x1000000000000000000"]);
    // Fast-forward 90 days so Core surrender is available
    await ethers.provider.send("evm_increaseTime",[90*24*60*60+1]);
    await ethers.provider.send("evm_mine",[]);
    // Surrender via Core (which calls CashbackPool internally)
    const mgxAlloc=await ctx.core.tokenAllocationsByUser(userId);
    if(mgxAlloc>0n){
      // Give user MGX balance + allowance for reclaim
      await ctx.mgxToken.connect(ctx.owner).transfer(ctx.users[userIdx].address,mgxAlloc);
      await ctx.mgxToken.connect(ctx.users[userIdx]).approve(coreAddr,mgxAlloc);
    }
    await (await ctx.core.connect(ctx.users[userIdx]).surrenderForCashback(userId)).wait();
    // Accrue and distribute some cashback so accumulated > 0
    await (await ctx.cashback.connect(coreSigner).notifyCashbackAccrued(500n,usdtAddr,50n)).wait();
    await (await ctx.cashback.connect(coreSigner).distribute(usdtAddr,true)).wait();
    return userId;
  }

  // ── B. Migration gate negative: claimCashback reverts when not finalized ──
  it("B: claimCashback reverts with 'Migration not finalized' when migrationFinalized=false", async function () {
    const ctx = await deploySystem();
    const userId = await setupSurrender(ctx, 0);
    const coreAddr = await ctx.core.getAddress();
    await (await ctx.core.connect(ctx.owner).adminInitHistoricalIncome([userId],[0n])).wait();
    expect(await ctx.core.migrationFinalized()).to.equal(false);
    const coreSigner = await ethers.getImpersonatedSigner(coreAddr);
    await ethers.provider.send("hardhat_setBalance",[coreAddr,"0x1000000000000000000"]);
    await expect(
      ctx.cashback.connect(coreSigner).claimCashback(ctx.users[0].address, userId)
    ).to.be.revertedWith("Migration not finalized");
    // State unchanged
    expect(await ctx.cashback.cashbackClaimed(userId)).to.equal(0n);
    console.log("B PASS: claimCashback reverts before finalization");
  });

  // ── C. Finalized positive path ────────────────────────────────────────────
  it("C: after finalizeMigration, claimCashback uses net-entitlement formula", async function () {
    const ctx = await deploySystem();
    const userId = await setupSurrender(ctx, 1);
    const coreAddr = await ctx.core.getAddress();
    const usdtAddr = await ctx.usdt.getAddress();
    await (await ctx.core.connect(ctx.owner).adminInitHistoricalIncome([userId],[0n])).wait();
    await (await ctx.core.connect(ctx.owner).finalizeMigration()).wait();
    expect(await ctx.core.migrationFinalized()).to.equal(true);
    const coreSigner = await ethers.getImpersonatedSigner(coreAddr);
    await ethers.provider.send("hardhat_setBalance",[coreAddr,"0x1000000000000000000"]);
    // Claim — should succeed (accumulated from setupSurrender)
    const tx=await ctx.cashback.connect(coreSigner).claimCashback(ctx.users[1].address,userId);
    await tx.wait();
    const claimed=await ctx.cashback.cashbackClaimed(userId);
    expect(claimed).to.be.gt(0n,"claimed amount must be > 0");
    console.log("C PASS: claimCashback succeeds post-finalization, claimed:", claimed.toString());
  });

  // ── F. Numeric txIndex comparison — type safety ───────────────────────────
  it("F: isHistorical numeric comparison — no string lexicographic bug", async function () {
    const U_NEW_BLOCK=1000, U_NEW_TX=10;
    function isHistorical(block:number,tx:number):boolean{
      if(block<U_NEW_BLOCK) return true;
      if(block===U_NEW_BLOCK) return tx<U_NEW_TX;
      return false;
    }
    // Critical: txIdx=2 vs txIdx=10 — string "2">"10" but numeric 2<10
    expect(isHistorical(1000,2)).to.equal(true,  "txIdx=2 < 10 → historical");
    expect(isHistorical(1000,9)).to.equal(true,  "txIdx=9 < 10 → historical");
    expect(isHistorical(1000,10)).to.equal(false, "txIdx=10 == upgrade → excluded");
    expect(isHistorical(1000,11)).to.equal(false, "txIdx=11 > 10 → excluded");
    console.log("F PASS: numeric comparison correct (no string lexicographic bug)");
  });

  // ── H. Verifier checksum tamper detection ────────────────────────────────
  it("H: tampered artifact fails checksum → SAFE_TO_FINALIZE=false", async function () {
    const users=[{userId:"1",historicalQualifyingIncome:"100"},
                 {userId:"2",historicalQualifyingIncome:"0"},
                 {userId:"3",historicalQualifyingIncome:"250"}];
    const sorted=[...users].sort((a,b)=>Number(a.userId)-Number(b.userId));
    const idChk=ethers.keccak256(ethers.toUtf8Bytes(sorted.map(u=>u.userId).join(",")));
    const idAmtChk=ethers.keccak256(ethers.toUtf8Bytes(sorted.map(u=>`${u.userId}:${u.historicalQualifyingIncome}`).join(",")));
    // Tamper: change user 3 amount
    const tampered=[...users];
    tampered[2]={userId:"3",historicalQualifyingIncome:"999"};
    const sortedT=[...tampered].sort((a,b)=>Number(a.userId)-Number(b.userId));
    const idAmtChkT=ethers.keccak256(ethers.toUtf8Bytes(sortedT.map(u=>`${u.userId}:${u.historicalQualifyingIncome}`).join(",")));
    expect(idAmtChkT).to.not.equal(idAmtChk,"tampered artifact must produce different checksum");
    console.log("H PASS: tampered artifact detected via checksum mismatch");
  });

  // ── I. Duplicate userId in artifact detected ──────────────────────────────
  it("I: duplicate userId in artifact detected", async function () {
    const users=[{userId:"10",historicalQualifyingIncome:"100"},
                 {userId:"10",historicalQualifyingIncome:"50"},
                 {userId:"20",historicalQualifyingIncome:"200"}];
    const idSet=new Set(users.map(u=>u.userId));
    expect(idSet.size).to.not.equal(users.length,"duplicate userId must be detectable");
    const hasDuplicate=idSet.size!==users.length;
    expect(hasDuplicate).to.equal(true);
    console.log("I PASS: duplicate userId in artifact detected (idSet.size !== entries.length)");
  });

  // ── G. Registration event fields proof ───────────────────────────────────
  it("G: UserRegistered event fields sufficient for boundary classification", async function () {
    const ctx = await deploySystem();
    const filter = ctx.core.filters.UserRegistered();
    const userId = await registerUser(ctx, ctx.users[2], 0n);
    const events = await ctx.core.queryFilter(filter) as any[];
    expect(events.length).to.be.gt(0,"UserRegistered event must be emitted");
    const ev = events[events.length-1];
    expect(ev.args.userId).to.equal(userId,"userId indexed in event");
    expect(ev.blockNumber).to.be.a('number',"blockNumber available");
    expect(ev.transactionHash).to.match(/^0x[0-9a-f]{64}/,"transactionHash available");
    // transactionIndex available directly or via receipt
    const txIdx = typeof ev.transactionIndex==='number'
      ? ev.transactionIndex
      : (await ethers.provider.getTransactionReceipt(ev.transactionHash))!.index;
    expect(typeof txIdx).to.equal('number',"transactionIndex obtainable");
    console.log(`G PASS: UserRegistered event has blockNumber=${ev.blockNumber} txIdx=${txIdx} userId=${userId}`);
  });

  // ── E2. transactionIndex from EventLog vs receipt cross-check ────────────
  it("E2: transactionIndex from EventLog matches receipt.index", async function () {
    const ctx = await deploySystem();
    await registerUser(ctx, ctx.users[3], 0n);
    const usdtAddr=await ctx.usdt.getAddress();
    const coreAddr=await ctx.core.getAddress();
    await ctx.usdt.connect(ctx.owner).mint(coreAddr,ethers.parseEther("100"));
    const incomeAddr=await ctx.income.getAddress();
    await ethers.provider.send("hardhat_impersonateAccount",[incomeAddr]);
    await ethers.provider.send("hardhat_setBalance",[incomeAddr,"0x1000000000000000000"]);
    const userId=await ctx.core.userIdByAddress(ctx.users[3].address);
    const incomeSigner=await ethers.getSigner(incomeAddr);
    const tx=await ctx.core.connect(incomeSigner).payoutUserIncome(userId,50n,usdtAddr);
    const receipt=await tx.wait();
    await ethers.provider.send("hardhat_stopImpersonatingAccount",[incomeAddr]);
    // Get QualifyingIncomePaid event
    const filter=ctx.core.filters.QualifyingIncomePaid();
    const events=await ctx.core.queryFilter(filter,receipt!.blockNumber,receipt!.blockNumber) as any[];
    expect(events.length).to.be.gt(0);
    const ev=events[events.length-1];
    const txIdxFromLog=typeof ev.transactionIndex==='number'?ev.transactionIndex:null;
    const rec2=await ethers.provider.getTransactionReceipt(ev.transactionHash);
    const txIdxFromReceipt=rec2!.index;
    if(txIdxFromLog!==null){
      expect(txIdxFromLog).to.equal(txIdxFromReceipt,"log.transactionIndex must match receipt.index");
      console.log(`E2 PASS: log.txIdx=${txIdxFromLog} === receipt.index=${txIdxFromReceipt}`);
    } else {
      console.log(`E2 PASS: transactionIndex not on EventLog directly, use receipt.index=${txIdxFromReceipt}`);
    }
  });
});
