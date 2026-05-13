import { useEffect, useMemo, useState, type CSSProperties, type FormEvent } from "react";

type TicketStatus = "open" | "in_review" | "resolved";
type TicketCategory = "Income Issue" | "Tree Issue" | "Registration" | "Upgrade" | "Other";

type SupportTicket = {
  id: string;
  userId: number;
  wallet: string;
  category: TicketCategory;
  subject: string;
  description: string;
  status: TicketStatus;
  createdAt: number;
  adminResponse: string | null;
  respondedAt: number | null;
};

type SupportPageProps = {
  userId: number | null;
  walletAddress: string | null;
};

const MGX_TICKETS_KEY = "mgx_tickets";
const categories: TicketCategory[] = ["Income Issue", "Tree Issue", "Registration", "Upgrade", "Other"];

function loadTickets() {
  if (typeof window === "undefined") {
    return [] as SupportTicket[];
  }

  try {
    const raw = window.localStorage.getItem(MGX_TICKETS_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw) as SupportTicket[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveTickets(tickets: SupportTicket[]) {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(MGX_TICKETS_KEY, JSON.stringify(tickets));
}

function generateTicketId(tickets: SupportTicket[]) {
  const nextNumber =
    tickets.reduce((highest, ticket) => {
      const match = ticket.id.match(/(\d+)$/);
      return Math.max(highest, match ? Number(match[1]) : 0);
    }, 0) + 1;

  return `TKT-${String(nextNumber).padStart(3, "0")}`;
}

function statusLabel(status: TicketStatus) {
  if (status === "in_review") {
    return "In Review";
  }
  if (status === "resolved") {
    return "Resolved";
  }
  return "Open";
}

function statusStyles(status: TicketStatus) {
  if (status === "resolved") {
    return {
      background: "rgba(0,255,136,0.12)",
      color: "#00ff88",
      border: "1px solid rgba(0,255,136,0.25)"
    };
  }
  if (status === "in_review") {
    return {
      background: "rgba(0,212,255,0.12)",
      color: "#00d4ff",
      border: "1px solid rgba(0,212,255,0.25)"
    };
  }
  return {
    background: "rgba(245,158,11,0.12)",
    color: "#f59e0b",
    border: "1px solid rgba(245,158,11,0.25)"
  };
}

function formatDate(value: number | null) {
  if (!value) {
    return "Pending";
  }
  return new Date(value).toLocaleString();
}

const shellCardStyle = {
  background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 16,
  padding: 20,
  backdropFilter: "blur(16px)"
} satisfies CSSProperties;

const inputStyle = {
  width: "100%",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(10,15,26,0.9)",
  color: "#ffffff",
  padding: "12px 14px",
  outline: "none"
} satisfies CSSProperties;

export function SupportPage({ userId, walletAddress }: SupportPageProps) {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [category, setCategory] = useState<TicketCategory>("Income Issue");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    const syncTickets = () => setTickets(loadTickets());
    syncTickets();
    window.addEventListener("storage", syncTickets);
    return () => window.removeEventListener("storage", syncTickets);
  }, []);

  const myTickets = useMemo(() => {
    return tickets
      .filter((ticket) => {
        if (userId && ticket.userId === userId) {
          return true;
        }
        if (walletAddress && ticket.wallet.toLowerCase() === walletAddress.toLowerCase()) {
          return true;
        }
        return false;
      })
      .sort((left, right) => right.createdAt - left.createdAt);
  }, [tickets, userId, walletAddress]);

  useEffect(() => {
    if (!selectedTicketId && myTickets.length > 0) {
      setSelectedTicketId(myTickets[0].id);
      return;
    }

    if (selectedTicketId && !myTickets.some((ticket) => ticket.id === selectedTicketId)) {
      setSelectedTicketId(myTickets[0]?.id ?? null);
    }
  }, [myTickets, selectedTicketId]);

  const selectedTicket = myTickets.find((ticket) => ticket.id === selectedTicketId) ?? null;
  const canSubmit = Boolean(walletAddress) && subject.trim().length > 0 && description.trim().length > 0;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit || !walletAddress) {
      return;
    }

    const existingTickets = loadTickets();
    const nextTicket: SupportTicket = {
      id: generateTicketId(existingTickets),
      userId: userId ?? 0,
      wallet: walletAddress.toLowerCase(),
      category,
      subject: subject.trim(),
      description: description.trim(),
      status: "open",
      createdAt: Date.now(),
      adminResponse: null,
      respondedAt: null
    };

    const nextTickets = [nextTicket, ...existingTickets];
    saveTickets(nextTickets);
    setTickets(nextTickets);
    setSelectedTicketId(nextTicket.id);
    setSubject("");
    setDescription("");
    setCategory("Income Issue");
    setFeedback(`Ticket ${nextTicket.id} submitted. We can now track it inside the dashboard.`);
  }

  return (
    <section className="panel dashboard-view w-full max-w-full">
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <div style={shellCardStyle}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap", alignItems: "center" }}>
            <div>
              <p className="section-label" style={{ marginBottom: 10 }}>Support</p>
              <h2 style={{ margin: 0, fontSize: 28, color: "#ffffff" }}>In-app Support Center</h2>
              <p style={{ marginTop: 8, color: "#8892a4", maxWidth: 760 }}>
                Raise income, tree, registration, or upgrade issues without leaving the dashboard. Tickets stay saved on this device for testnet review.
              </p>
            </div>
            <div style={{ minWidth: 220, padding: 16, borderRadius: 14, background: "rgba(0,212,255,0.08)", border: "1px solid rgba(0,212,255,0.18)" }}>
              <div style={{ color: "#8892a4", fontSize: 12, textTransform: "uppercase", letterSpacing: "0.12em" }}>Support Identity</div>
              <div style={{ color: "#ffffff", fontSize: 22, fontWeight: 700, marginTop: 10 }}>
                {userId ? `User #${userId}` : "Wallet only"}
              </div>
              <div style={{ color: "#00d4ff", fontSize: 13, marginTop: 6 }}>
                {walletAddress ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}` : "Connect wallet to open tickets"}
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "minmax(300px, 1.05fr) minmax(320px, 1fr)", gap: 20 }}>
          <div style={shellCardStyle}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", marginBottom: 18 }}>
              <div>
                <div style={{ color: "#00d4ff", fontSize: 12, letterSpacing: "0.12em", textTransform: "uppercase" }}>New Ticket</div>
                <h3 style={{ margin: "8px 0 0", color: "#ffffff", fontSize: 22 }}>Tell us what needs attention</h3>
              </div>
              <span style={{ ...statusStyles("in_review"), borderRadius: 999, padding: "6px 12px", fontSize: 12 }}>
                Testnet local inbox
              </span>
            </div>

            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <label style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <span style={{ color: "#8892a4", fontSize: 13 }}>Category</span>
                <select value={category} onChange={(event) => setCategory(event.target.value as TicketCategory)} style={inputStyle}>
                  {categories.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </label>

              <label style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <span style={{ color: "#8892a4", fontSize: 13 }}>Subject</span>
                <input value={subject} onChange={(event) => setSubject(event.target.value)} placeholder="Short summary of the issue" style={inputStyle} />
              </label>

              <label style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <span style={{ color: "#8892a4", fontSize: 13 }}>Description</span>
                <textarea
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="Describe what happened, the user id involved, and the exact mismatch you noticed."
                  rows={6}
                  style={{ ...inputStyle, resize: "vertical" }}
                />
              </label>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
                <div style={{ borderRadius: 12, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(10,15,26,0.72)", padding: 14 }}>
                  <div style={{ color: "#8892a4", fontSize: 12, textTransform: "uppercase", letterSpacing: "0.08em" }}>User ID</div>
                  <div style={{ color: "#ffffff", fontWeight: 700, marginTop: 8 }}>{userId ?? "Not linked yet"}</div>
                </div>
                <div style={{ borderRadius: 12, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(10,15,26,0.72)", padding: 14 }}>
                  <div style={{ color: "#8892a4", fontSize: 12, textTransform: "uppercase", letterSpacing: "0.08em" }}>Wallet</div>
                  <div style={{ color: "#ffffff", fontWeight: 700, marginTop: 8 }}>{walletAddress ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}` : "Connect wallet"}</div>
                </div>
              </div>

              <button
                type="submit"
                disabled={!canSubmit}
                style={{
                  border: "none",
                  borderRadius: 14,
                  padding: "14px 18px",
                  color: "#ffffff",
                  fontWeight: 700,
                  cursor: canSubmit ? "pointer" : "not-allowed",
                  opacity: canSubmit ? 1 : 0.55,
                  background: "linear-gradient(135deg, #00d4ff, #0066ff)",
                  boxShadow: "0 14px 30px rgba(0,102,255,0.24)"
                }}
              >
                Submit Ticket
              </button>
              {feedback ? <p style={{ margin: 0, color: "#00ff88", fontSize: 13 }}>{feedback}</p> : null}
            </form>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div style={shellCardStyle}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", marginBottom: 18 }}>
                <div>
                  <div style={{ color: "#00d4ff", fontSize: 12, letterSpacing: "0.12em", textTransform: "uppercase" }}>My Tickets</div>
                  <h3 style={{ margin: "8px 0 0", color: "#ffffff", fontSize: 22 }}>Track your conversations</h3>
                </div>
                <div style={{ color: "#8892a4", fontSize: 13 }}>{myTickets.length} saved</div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {myTickets.length > 0 ? myTickets.map((ticket) => (
                  <button
                    key={ticket.id}
                    type="button"
                    onClick={() => setSelectedTicketId(ticket.id)}
                    style={{
                      textAlign: "left",
                      padding: 16,
                      borderRadius: 14,
                      border: ticket.id === selectedTicketId ? "1px solid rgba(0,212,255,0.35)" : "1px solid rgba(255,255,255,0.08)",
                      background: ticket.id === selectedTicketId ? "rgba(0,212,255,0.08)" : "rgba(255,255,255,0.03)",
                      color: "#ffffff",
                      cursor: "pointer"
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                      <strong>{ticket.id}</strong>
                      <span style={{ ...statusStyles(ticket.status), borderRadius: 999, padding: "5px 10px", fontSize: 12 }}>
                        {statusLabel(ticket.status)}
                      </span>
                    </div>
                    <div style={{ marginTop: 8, color: "#ffffff", fontWeight: 600 }}>{ticket.subject}</div>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginTop: 8, color: "#8892a4", fontSize: 13, flexWrap: "wrap" }}>
                      <span>{ticket.category}</span>
                      <span>{formatDate(ticket.createdAt)}</span>
                    </div>
                  </button>
                )) : (
                  <div style={{ borderRadius: 14, border: "1px dashed rgba(255,255,255,0.14)", padding: 24, color: "#8892a4", textAlign: "center" }}>
                    No tickets yet. Submit the first one and it will appear here right away.
                  </div>
                )}
              </div>
            </div>

            <div style={shellCardStyle}>
              <div style={{ color: "#00d4ff", fontSize: 12, letterSpacing: "0.12em", textTransform: "uppercase" }}>Ticket Detail</div>
              {selectedTicket ? (
                <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 16 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
                    <div>
                      <h3 style={{ margin: 0, color: "#ffffff", fontSize: 22 }}>{selectedTicket.subject}</h3>
                      <p style={{ margin: "8px 0 0", color: "#8892a4" }}>
                        {selectedTicket.id} • {selectedTicket.category} • {formatDate(selectedTicket.createdAt)}
                      </p>
                    </div>
                    <span style={{ ...statusStyles(selectedTicket.status), borderRadius: 999, padding: "6px 12px", fontSize: 12 }}>
                      {statusLabel(selectedTicket.status)}
                    </span>
                  </div>

                  <div style={{ borderRadius: 14, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.03)", padding: 16 }}>
                    <div style={{ color: "#8892a4", fontSize: 12, letterSpacing: "0.08em", textTransform: "uppercase" }}>Original Message</div>
                    <p style={{ margin: "10px 0 0", color: "#ffffff", lineHeight: 1.7 }}>{selectedTicket.description}</p>
                  </div>

                  <div style={{ borderRadius: 14, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(10,15,26,0.72)", padding: 16 }}>
                    <div style={{ color: "#8892a4", fontSize: 12, letterSpacing: "0.08em", textTransform: "uppercase" }}>Admin Response</div>
                    <p style={{ margin: "10px 0 0", color: selectedTicket.adminResponse ? "#ffffff" : "#8892a4", lineHeight: 1.7 }}>
                      {selectedTicket.adminResponse ?? "No response yet. Once an admin replies, it will show here automatically."}
                    </p>
                    {selectedTicket.respondedAt ? (
                      <div style={{ marginTop: 10, color: "#00d4ff", fontSize: 12 }}>Updated {formatDate(selectedTicket.respondedAt)}</div>
                    ) : null}
                  </div>
                </div>
              ) : (
                <div style={{ marginTop: 14, borderRadius: 14, border: "1px dashed rgba(255,255,255,0.14)", padding: 24, color: "#8892a4", textAlign: "center" }}>
                  Pick a ticket from the list to view the full thread.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
