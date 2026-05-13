const express = require("express");
const cors = require("cors");
const { ethers } = require("ethers");
require("dotenv").config({ path: ".env.local" });

const app = express();
app.use(cors({ origin: "http://localhost:5173" }));
app.use(express.json());

const PRIVATE_KEY =
  process.env.LOCAL_PLACEMENT_SIGNER_KEY ||
  process.env.PLACEMENT_SIGNER_PRIVATE_KEY ||
  process.env.DEPLOYER_PRIVATE_KEY ||
  process.env.PRIVATE_KEY;

if (!PRIVATE_KEY) {
  console.error("LOCAL_PLACEMENT_SIGNER_KEY not set");
  process.exit(1);
}

const signer = new ethers.Wallet(PRIVATE_KEY);

app.post("/api/placement-sign", async (req, res) => {
  try {
    const { placementData } = req.body ?? {};
    if (!placementData) {
      return res.status(400).json({
        error: "placementData required",
        success: false
      });
    }

    console.log("[signer] Signing placement:", placementData);

    const messageHash = ethers.solidityPackedKeccak256(
      ["uint256", "address", "address", "uint256", "uint256"],
      [
        BigInt(placementData.chainId),
        placementData.contractAddress,
        placementData.account,
        BigInt(placementData.sponsorId),
        BigInt(placementData.nonce)
      ]
    );

    const signature = await signer.signMessage(ethers.getBytes(messageHash));

    console.log("[signer] Signature:", signature);

    return res.json({
      signature,
      success: true
    });
  } catch (error) {
    console.error("[signer] Error:", error);
    return res.status(500).json({
      error: "Signing failed",
      success: false
    });
  }
});

app.listen(3001, () => {
  console.log("[signer] Local placement signer running on port 3001");
});
