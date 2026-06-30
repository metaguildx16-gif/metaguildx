import { ethers } from "hardhat";
import * as dotenv from "dotenv";
import https from "https";
dotenv.config();

function sendTelegramAlert(message: string): Promise<void> {
  return new Promise((resolve) => {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;
    if (!token || !chatId) {
      console.log("Telegram credentials not configured, skipping alert");
      resolve();
      return;
    }
    const data = JSON.stringify({ chat_id: chatId, text: message });
    const options = {
      hostname: "api.telegram.org",
      path: `/bot${token}/sendMessage`,
      method: "POST",
      headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(data) },
    };
    const req = https.request(options, (res) => {
      res.on("data", () => {});
      res.on("end", () => resolve());
    });
    req.on("error", (e) => {
      console.log("Telegram send error:", e.message);
      resolve();
    });
    req.write(data);
    req.end();
  });
}

async function main() {
  const CORE_PROXY = "0xE3cD200609E223c96987c9FEa41C6014e8625c2F";
  const core = await ethers.getContractAt("MetaGuildXCore", CORE_PROXY);

  const timestamp = new Date().toISOString();
  const failedIds = await core.getFailedUserIds();

  if (failedIds.length === 0) {
    console.log(`[${timestamp}] [OK] No failed distributions. All clear.`);
    return;
  }

  const stillFailed: { userId: string; packageLevel: string }[] = [];
  for (const uid of failedIds) {
    const isFailed = await core.failedDistribution(uid);
    if (isFailed) {
      let pkgLevel = "unknown";
      try {
        const lvl = await core.failedDistributionPackageLevel(uid);
        pkgLevel = lvl.toString();
      } catch {}
      stillFailed.push({ userId: uid.toString(), packageLevel: pkgLevel });
    }
  }

  if (stillFailed.length === 0) {
    console.log(`[${timestamp}] [OK] ${failedIds.length} historical entries, all already cleared.`);
    return;
  }

  console.log(`[${timestamp}] [ALERT] ALERT: ${stillFailed.length} ACTIVE FAILED DISTRIBUTION(S) FOUND!`);

  const usdt = await ethers.getContractAt(
    ["function balanceOf(address) view returns (uint256)"],
    "0x9e5AAC1Ba1a2e6aEd6b32689DFcF62A509Ca96f3"
  );
  const coreBal = await usdt.balanceOf(CORE_PROXY);
  const coreBalFormatted = ethers.formatUnits(coreBal, 18);

  let alertMsg = `[ALERT] MetaGuildX Alert: ${stillFailed.length} stuck distribution(s)\n\n`;
  for (const entry of stillFailed) {
    console.log(`  - User ${entry.userId} (failed at package level ${entry.packageLevel})`);
    alertMsg += `User ${entry.userId} - stuck at package level ${entry.packageLevel}\n`;
  }
  alertMsg += `\nCore USDT balance: ${coreBalFormatted}\n`;
  alertMsg += `\nAction needed: review via admin panel, run adminRetryDistribution() or adminRemainderDistribution()`;

  console.log(`  Core USDT balance: ${coreBalFormatted}`);
  await sendTelegramAlert(alertMsg);
  console.log("  Telegram alert sent.");
}

main().catch(async (e) => {
  console.error("Monitor script error:", e.message);
  process.exitCode = 1;
});
