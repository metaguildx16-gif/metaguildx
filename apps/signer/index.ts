import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { ethers } from "ethers";
import * as dotenv from "dotenv";

dotenv.config();

const app = express();
app.set("trust proxy", 1);
const allowedOrigins = ["https://metaguildx.net", "https://www.metaguildx.net"];
const AUTH_TOKEN = process.env.SIGNER_AUTH_TOKEN;
const SIGNER_KEY = process.env.SIGNER_PRIVATE_KEY;

if (!SIGNER_KEY) {
  throw new Error("SIGNER_PRIVATE_KEY is required");
}

if (!AUTH_TOKEN) {
  throw new Error("SIGNER_AUTH_TOKEN is required");
}

const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: "Too many requests"
});

app.use((req, res, next) => {
  const requestOrigin = req.headers.origin;
  if (requestOrigin && allowedOrigins.includes(requestOrigin)) {
    res.header("Access-Control-Allow-Origin", requestOrigin);
  }
  res.header("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type,x-signer-token");
  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }
  next();
});
app.use(cors({
  origin: allowedOrigins,
  methods: ["GET", "POST"],
  allowedHeaders: ["Content-Type", "x-signer-token"],
}));
app.use(express.json());
app.use(limiter);
app.use((req, res, next) => {
  if (req.path === "/health") {
    return next();
  }

  const token = req.headers["x-signer-token"];
  if (typeof token !== "string" || token !== AUTH_TOKEN) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  next();
});

const signer = new ethers.Wallet(SIGNER_KEY);

console.log("Placement signer:", signer.address);

app.post("/sign-placement", async (req, res) => {
  try {
    const {
      account,
      sponsorId,
      nonce,
      chainId,
      contractAddress,
    } = req.body;

    const msgHash = ethers.solidityPackedKeccak256(
      ["uint256", "address", "address", "uint256", "uint256"],
      [
        BigInt(chainId),
        contractAddress,
        account,
        BigInt(sponsorId),
        BigInt(nonce),
      ]
    );

    const signature = await signer.signMessage(ethers.getBytes(msgHash));

    res.json({ signature, signer: signer.address });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ error: message });
  }
});

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    signer: signer.address,
  });
});

const PORT = process.env.PORT ?? 3001;
app.listen(PORT, () => {
  console.log(`Signer service on port ${PORT}`);
});
