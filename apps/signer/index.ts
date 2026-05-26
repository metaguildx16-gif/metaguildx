import * as fs from "fs";
import * as path from "path";
import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
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
  res.header("Access-Control-Allow-Methods", "GET,POST,PATCH,OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type,x-signer-token,x-admin-token");
  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }
  next();
});
app.use(cors({
  origin: allowedOrigins,
  methods: ["GET", "POST", "PATCH"],
  allowedHeaders: ["Content-Type", "x-signer-token", "x-admin-token"],
}));
app.use(express.json());
app.use(limiter);
app.use((req, res, next) => {
  if (req.path === "/health" || req.path.startsWith("/support/tickets")) {
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

app.post("/support/tickets", (req, res) => {
  try {
    const { userId, wallet, category, subject, description } = req.body;
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
