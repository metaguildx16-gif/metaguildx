import * as fs from "fs";
import * as path from "path";
import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import Redis from "ioredis";
import { RedisStore } from "rate-limit-redis";
import { ethers } from "ethers";

type SupportTicket = {
  id: string;
  userId: number;
  wallet: string;
  category: string;
  subject: string;
  description: string;
  status: "open" | "in_review" | "resolved";
  createdAt: number;
  adminResponse: string | null;
  respondedAt: number | null;
};

type UserProfile = {
  wallet: string;
  displayName: string;
  nickname: string;
  updatedAt: number;
};

// Self-load env file
const envPath = path.resolve("/etc/metaguildx/signer.env");
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, "utf8").split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.substring(0, eqIdx).trim();
    const value = trimmed.substring(eqIdx + 1).trim();
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

const app = express();
app.set("trust proxy", 1);
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",").map((origin) => origin.trim())
  : ["https://metaguildx.net", "https://www.metaguildx.net", "https://admin.metaguildx.net"];
const AUTH_TOKEN = process.env.SIGNER_AUTH_TOKEN;
const ADMIN_TOKEN = process.env.SIGNER_TOKEN ?? AUTH_TOKEN;
const SIGNER_KEY = process.env.SIGNER_PRIVATE_KEY;
const TICKETS_FILE = "/etc/metaguildx/tickets.json";
const PROFILES_FILE = "/etc/metaguildx/profiles.json";
const redisClient = new Redis({
  host: process.env.REDIS_HOST ?? "localhost",
  port: parseInt(process.env.REDIS_PORT ?? "6379", 10),
  lazyConnect: true
});

redisClient.on("error", (err) => {
  console.error("Redis error:", err);
});

function sendRedisCommand(...args: string[]): Promise<any> {
  return (redisClient.call as (...command: string[]) => Promise<any>)(...args);
}

if (!SIGNER_KEY) {
  throw new Error("SIGNER_PRIVATE_KEY is required");
}

if (!AUTH_TOKEN) {
  throw new Error("SIGNER_AUTH_TOKEN is required");
}

function loadTicketsFromFile(): SupportTicket[] {
  try {
    if (!fs.existsSync(TICKETS_FILE)) {
      return [];
    }

    const raw = fs.readFileSync(TICKETS_FILE, "utf-8");
    const parsed = JSON.parse(raw) as SupportTicket[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveTicketsToFile(tickets: SupportTicket[]): void {
  fs.mkdirSync(path.dirname(TICKETS_FILE), { recursive: true });
  fs.writeFileSync(TICKETS_FILE, JSON.stringify(tickets, null, 2));
}

function loadProfilesFromFile(): Record<string, UserProfile> {
  try {
    if (!fs.existsSync(PROFILES_FILE)) {
      return {};
    }

    const raw = fs.readFileSync(PROFILES_FILE, "utf-8");
    const parsed = JSON.parse(raw) as Record<string, UserProfile>;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function saveProfilesToFile(profiles: Record<string, UserProfile>): void {
  fs.mkdirSync(path.dirname(PROFILES_FILE), { recursive: true });
  fs.writeFileSync(PROFILES_FILE, JSON.stringify(profiles, null, 2));
}

const inMemoryGlobalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: "Too many requests"
});

const inMemoryTicketLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 3,
  message: "Too many ticket submissions"
});

let globalLimiter = inMemoryGlobalLimiter;
let ticketSubmissionLimiter = inMemoryTicketLimiter;

redisClient.on("ready", () => {
  globalLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 10,
    message: "Too many requests",
    store: new RedisStore({
      prefix: "mgx:signer:global:",
      sendCommand: sendRedisCommand
    })
  });

  ticketSubmissionLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 3,
    message: "Too many ticket submissions",
    store: new RedisStore({
      prefix: "mgx:signer:tickets:",
      sendCommand: sendRedisCommand
    })
  });
});

redisClient.connect().catch((err) => {
  console.error("Redis connection failed:", err);
});

app.use((req, res, next) => {
  const requestOrigin = req.headers.origin;
  if (requestOrigin && allowedOrigins.includes(requestOrigin)) {
    res.header("Access-Control-Allow-Origin", requestOrigin);
  }
  res.header("Access-Control-Allow-Methods", "GET,POST,PATCH,OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type,x-signer-token,x-admin-token,x-wallet-address");
  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }
  next();
});
app.use(cors({
  origin: allowedOrigins,
  methods: ["GET", "POST", "PATCH"],
  allowedHeaders: ["Content-Type", "x-signer-token", "x-admin-token", "x-wallet-address"],
}));
app.use(express.json());
app.use((req, res, next) => globalLimiter(req, res, next));
app.use((req, res, next) => {
  if (req.path === "/health" || req.path.startsWith("/support/tickets") || req.path.startsWith("/profile")) {
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

function normalizePlacementSide(isLeft: unknown): boolean {
  if (typeof isLeft === "boolean") {
    return isLeft;
  }
  return String(isLeft).toLowerCase() === "true";
}

app.post("/sign", async (req, res) => {
  try {
    const requestOrigin = req.headers.origin;
    if (!requestOrigin || !allowedOrigins.includes(requestOrigin)) {
      return res.status(403).json({ error: "Forbidden origin" });
    }
    const signerToken = req.headers["x-signer-token"];
    if (typeof signerToken !== "string" || signerToken !== AUTH_TOKEN) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const {
      account,
      sponsorId,
      nonce,
      chainId,
      contractAddress,
      placementParentId,
      isLeft,
    } = req.body;

    if (placementParentId === undefined || isLeft === undefined) {
      return res.status(400).json({ error: "Missing placement data" });
    }

    const msgHash = ethers.solidityPackedKeccak256(
      ["uint256", "address", "address", "uint256", "uint256", "bool", "uint256"],
      [
        BigInt(chainId),
        contractAddress,
        account,
        BigInt(sponsorId),
        BigInt(placementParentId),
        normalizePlacementSide(isLeft),
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

app.post("/sign-placement", async (req, res) => {
  try {
    const {
      account,
      sponsorId,
      nonce,
      chainId,
      contractAddress,
      placementParentId,
      isLeft,
    } = req.body;

    if (placementParentId === undefined || isLeft === undefined) {
      return res.status(400).json({ error: "Missing placement data" });
    }

    const msgHash = ethers.solidityPackedKeccak256(
      ["uint256", "address", "address", "uint256", "uint256", "bool", "uint256"],
      [
        BigInt(chainId),
        contractAddress,
        account,
        BigInt(sponsorId),
        BigInt(placementParentId),
        normalizePlacementSide(isLeft),
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

app.post("/support/tickets", (req, res, next) => ticketSubmissionLimiter(req, res, next), (req, res) => {
  try {
    const walletFromHeader = typeof req.headers["x-wallet-address"] === "string"
      ? req.headers["x-wallet-address"].toLowerCase()
      : null;
    const { userId, category, subject, description } = req.body;
    const wallet = walletFromHeader ?? (typeof req.body.wallet === "string" ? req.body.wallet.toLowerCase() : null);
    if (!wallet || !subject || !description) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const tickets = loadTicketsFromFile();
    const nextNumber = tickets.reduce((max, ticket) => {
      const match = ticket.id.match(/(\d+)$/);
      return Math.max(max, match ? Number(match[1]) : 0);
    }, 0) + 1;

    const ticket: SupportTicket = {
      id: `TKT-${String(nextNumber).padStart(3, "0")}`,
      userId: userId ?? 0,
      wallet: String(wallet).toLowerCase(),
      category: String(category ?? "Other"),
      subject: String(subject),
      description: String(description),
      status: "open",
      createdAt: Date.now(),
      adminResponse: null,
      respondedAt: null
    };

    tickets.unshift(ticket);
    saveTicketsToFile(tickets);
    return res.json({ success: true, ticketId: ticket.id });
  } catch {
    return res.status(500).json({ error: "Failed to save ticket" });
  }
});

app.get("/support/tickets", (req, res) => {
  const token = req.headers["x-admin-token"];
  const wallet = typeof req.query.wallet === "string" ? req.query.wallet.toLowerCase() : null;
  const tickets = loadTicketsFromFile();

  if (typeof token === "string" && token === ADMIN_TOKEN) {
    return res.json(tickets);
  }

  if (!wallet) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const walletHeader = typeof req.headers["x-wallet-address"] === "string"
    ? req.headers["x-wallet-address"].toLowerCase()
    : null;

  if (!walletHeader) {
    return res.status(401).json({ error: "Wallet header required" });
  }

  if (walletHeader !== wallet) {
    return res.status(403).json({ error: "Wallet header mismatch" });
  }

  return res.json(tickets.filter((ticket) => ticket.wallet === wallet));
});

app.patch("/support/tickets/:id", (req, res) => {
  const token = req.headers["x-admin-token"];
  if (token !== ADMIN_TOKEN) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { id } = req.params;
  const { adminResponse, status } = req.body as {
    adminResponse?: string | null;
    status?: SupportTicket["status"];
  };
  const tickets = loadTicketsFromFile();
  const index = tickets.findIndex((ticket) => ticket.id === id);

  if (index === -1) {
    return res.status(404).json({ error: "Ticket not found" });
  }

  tickets[index].adminResponse = adminResponse ?? tickets[index].adminResponse;
  tickets[index].status = status ?? tickets[index].status;
  tickets[index].respondedAt = Date.now();
  saveTicketsToFile(tickets);
  return res.json({ success: true });
});

app.get("/profile", (req, res) => {
  const wallet = typeof req.query.wallet === "string" ? req.query.wallet.toLowerCase() : null;
  if (!wallet) {
    return res.status(400).json({ error: "Missing wallet" });
  }

  const profiles = loadProfilesFromFile();
  const profile = profiles[wallet];
  if (!profile) {
    return res.json({ displayName: "", nickname: "" });
  }

  return res.json({
    displayName: profile.displayName,
    nickname: profile.nickname,
  });
});

app.get("/profiles/batch", (req, res) => {
  const walletsParam = typeof req.query.wallets === "string" ? req.query.wallets : "";
  const wallets = walletsParam
    .split(",")
    .map((wallet) => wallet.trim().toLowerCase())
    .filter(Boolean)
    .slice(0, 50);

  const profiles = loadProfilesFromFile();
  return res.json(
    wallets.map((wallet) => ({
      wallet,
      displayName: profiles[wallet]?.displayName ?? "",
      nickname: profiles[wallet]?.nickname ?? "",
    }))
  );
});

app.post("/profile", (req, res) => {
  const wallet = typeof req.headers["x-wallet-address"] === "string"
    ? req.headers["x-wallet-address"].toLowerCase()
    : null;
  if (!wallet) {
    return res.status(401).json({ error: "Wallet header required" });
  }

  const displayName = typeof req.body.displayName === "string" ? req.body.displayName.trim().slice(0, 40) : "";
  const nickname = typeof req.body.nickname === "string" ? req.body.nickname.trim().slice(0, 30) : "";
  const profiles = loadProfilesFromFile();
  profiles[wallet] = {
    wallet,
    displayName,
    nickname,
    updatedAt: Date.now(),
  };
  saveProfilesToFile(profiles);
  return res.json({ success: true });
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
