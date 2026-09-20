/**
 * verify-safe-to-finalize.ts
 * READ-ONLY pre-finalization verifier.
 * Checks all historical users are seeded before allowing finalizeMigration.
 * Output: SAFE_TO_FINALIZE=true/false
 * NEVER calls finalizeMigration itself.
 */
import { ethers } from "hardhat";
import * as fs from "fs";

const CORE_PROXY = "0xE3cD200609E223c96987c9FEa41C6014e8625c2F";
const MIGRATION_FILE = process.env.MIGRATION_FILE ?? "";

async function main(){
  if(!MIGRATION_FILE || !fs.existsSync(MIGRATION_FILE)){
    console.error("MIGRATION_FILE not set or not found");
    console.log("SAFE_TO_FINALIZE=false"); process.exit(1);
  }
  const data=JSON.parse(fs.readFileSync(MIGRATION_FILE,"utf8"));
  const users: {userId:string,historicalQualifyingIncome:string}[] = data.users;
  console.log("Migration file:", MIGRATION_FILE);
  console.log("Expected users:", users.length);

  const abi=[
    "function historicalIncomeInitialized(uint256) view returns (bool)",
    "function totalLifetimeQualifyingIncome(uint256) view returns (uint256)",
    "function migrationFinalized() view returns (bool)",
  ];
  const core=new ethers.Contract(CORE_PROXY,abi,ethers.provider);

  // Check not already finalized
  const finalized=await core.migrationFinalized();
  if(finalized){console.log("ALREADY FINALIZED"); console.log("SAFE_TO_FINALIZE=false"); return;}

  let allInit=true, failed: string[]=[];
  let batchSize=50, i=0;
  while(i<users.length){
    const batch=users.slice(i,i+batchSize);
    await Promise.all(batch.map(async u=>{
      const init=await core.historicalIncomeInitialized(BigInt(u.userId));
      if(!init){allInit=false;failed.push(u.userId);}
    }));
    i+=batchSize;
    if(i%500===0) process.stdout.write(`\r  Checked ${i}/${users.length}`);
  }
  console.log(`\nUsers checked: ${users.length}`);
  console.log(`All initialized: ${allInit}`);
  if(!allInit) console.log(`Not initialized: ${failed.slice(0,20).join(",")}${failed.length>20?"...":""}`);

  // Validate checksums
  const sorted=[...users].sort((a,b)=>BigInt(a.userId)<BigInt(b.userId)?-1:1);
  const idChecksum=ethers.keccak256(ethers.toUtf8Bytes(sorted.map(u=>u.userId).join(",")));
  const idAmtChecksum=ethers.keccak256(ethers.toUtf8Bytes(sorted.map(u=>`${u.userId}:${u.historicalQualifyingIncome}`).join(",")));
  const checksumMatch=
    idChecksum===data.summary.sortedUserIdChecksum &&
    idAmtChecksum===data.summary.idAmountChecksum;
  console.log("Checksum match:", checksumMatch?"✅":"❌");

  const safeToFinalize=allInit&&checksumMatch&&!finalized;
  console.log("\nSAFE_TO_FINALIZE="+safeToFinalize);
  if(!safeToFinalize) process.exit(1);
}
main().catch(e=>{console.error("FATAL:",e.message);console.log("SAFE_TO_FINALIZE=false");process.exit(1);});
