import { useEffect, useMemo, useState } from "react";

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

const SIGNER_URL = import.meta.env.VITE_PLACEMENT_SIGNER_URL ?? "https://signer.metaguildx.net";
const categories: Array<TicketCategory | "all"> = ["all", "Income Issue", "Tree Issue", "Registration", "Upgrade", "Other"];
const statuses: Array<TicketStatus | "all"> = ["all", "open", "in_review", "resolved"];

async function loadTickets(): Promise<SupportTicket[]> {
  const res = await fetch(`${SIGNER_URL}/support/tickets`, {
  });
  if (!res.ok) {
    throw new Error(`Failed to load tickets: ${res.status}`);
  }
  return res.json();
}

async function respondToTicket(
  id: string,
  adminResponse: string,
  status: string
): Promise<void> {
  const res = await fetch(`${SIGNER_URL}/support/tickets/${id}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ adminResponse, status })
  });
  if (!res.ok) {
    throw new Error(`Failed to update ticket: ${res.status}`);
  }
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

function statusBadgeClass(status: TicketStatus) {
  if (status === "resolved") {
    return "border border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
  }
  if (status === "in_review") {
    return "border border-cyan-500/30 bg-cyan-500/10 text-cyan-300";
  }
  return "border border-amber-500/30 bg-amber-500/10 text-amber-300";
}

function formatDate(value: number | null) {
  if (!value) {
    return "Pending";
  }
  return new Date(value).toLocaleString();
}

export function SupportTicketsPage() {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<TicketStatus | "all">("all");
  const [categoryFilter, setCategoryFilter] = useState<TicketCategory | "all">("all");
  const [responseDraft, setResponseDraft] = useState("");
  const [nextStatus, setNextStatus] = useState<TicketStatus>("open");
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    const syncTickets = async () => {
      try {
        const nextTickets = await loadTickets();
        setTickets(Array.isArray(nextTickets) ? nextTickets : []);
      } catch (error) {
        console.error("SupportTickets load failed:", error);
        setTickets([]);
      }
    };

    void syncTickets();
  }, []);

  const filteredTickets = useMemo(() => {
    return [...tickets]
      .filter((ticket) => (statusFilter === "all" ? true : ticket.status === statusFilter))
      .filter((ticket) => (categoryFilter === "all" ? true : ticket.category === categoryFilter))
      .sort((left, right) => right.createdAt - left.createdAt);
  }, [tickets, statusFilter, categoryFilter]);

  useEffect(() => {
    if (!selectedTicketId && filteredTickets.length > 0) {
      setSelectedTicketId(filteredTickets[0].id);
      return;
    }

    if (selectedTicketId && !filteredTickets.some((ticket) => ticket.id === selectedTicketId)) {
      setSelectedTicketId(filteredTickets[0]?.id ?? null);
    }
  }, [filteredTickets, selectedTicketId]);

  const selectedTicket = filteredTickets.find((ticket) => ticket.id === selectedTicketId) ?? null;

  useEffect(() => {
    setResponseDraft(selectedTicket?.adminResponse ?? "");
    setNextStatus(selectedTicket?.status ?? "open");
  }, [selectedTicketId, selectedTicket?.adminResponse, selectedTicket?.status]);

  async function handleSave() {
    if (!selectedTicket) {
      return;
    }

    await respondToTicket(selectedTicket.id, responseDraft.trim(), nextStatus);
    const nextTickets = tickets.map((ticket) =>
      ticket.id === selectedTicket.id
        ? {
            ...ticket,
            status: nextStatus,
            adminResponse: responseDraft.trim() || null,
            respondedAt: Date.now()
          }
        : ticket
    );
    setTickets(nextTickets);
    setFeedback(`Saved ${selectedTicket.id} with status ${statusLabel(nextStatus)}.`);
  }

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-gray-800 bg-gray-900/80 p-6 shadow-2xl shadow-cyan-950/10 backdrop-blur">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-cyan-300">Support</p>
            <h2 className="mt-3 text-3xl font-semibold text-white">Support Tickets</h2>
            <p className="mt-3 max-w-3xl text-sm text-gray-400">
              Review user issues, respond inline, and move tickets from open to resolved without leaving the admin console.
            </p>
          </div>

          <div className="grid min-w-[260px] grid-cols-2 gap-3">
            <div className="rounded-2xl border border-gray-800 bg-gray-950/70 p-4">
              <div className="text-xs uppercase tracking-[0.18em] text-gray-500">All Tickets</div>
              <div className="mt-3 text-3xl font-semibold text-white">{tickets.length}</div>
            </div>
            <div className="rounded-2xl border border-gray-800 bg-gray-950/70 p-4">
              <div className="text-xs uppercase tracking-[0.18em] text-gray-500">Open Now</div>
              <div className="mt-3 text-3xl font-semibold text-amber-300">
                {tickets.filter((ticket) => ticket.status !== "resolved").length}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-3xl border border-gray-800 bg-gray-900/80 p-6 backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-cyan-300">Inbox</p>
              <h3 className="mt-2 text-xl font-semibold text-white">All Tickets</h3>
            </div>

            <div className="flex flex-wrap gap-3">
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as TicketStatus | "all")}
                className="rounded-2xl border border-gray-700 bg-gray-950 px-4 py-3 text-sm text-white outline-none"
              >
                {statuses.map((status) => (
                  <option key={status} value={status}>
                    {status === "all" ? "All Statuses" : statusLabel(status)}
                  </option>
                ))}
              </select>
              <select
                value={categoryFilter}
                onChange={(event) => setCategoryFilter(event.target.value as TicketCategory | "all")}
                className="rounded-2xl border border-gray-700 bg-gray-950 px-4 py-3 text-sm text-white outline-none"
              >
                {categories.map((category) => (
                  <option key={category} value={category}>
                    {category === "all" ? "All Categories" : category}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-5 overflow-hidden rounded-3xl border border-gray-800">
            <div className="hidden grid-cols-[120px_100px_140px_1fr_140px_180px] gap-4 border-b border-gray-800 bg-gray-950/80 px-5 py-4 text-xs uppercase tracking-[0.16em] text-gray-500 lg:grid">
              <span>Ticket ID</span>
              <span>User ID</span>
              <span>Category</span>
              <span>Subject</span>
              <span>Status</span>
              <span>Date</span>
            </div>

            <div className="max-h-[640px] overflow-y-auto">
              {filteredTickets.length > 0 ? filteredTickets.map((ticket, index) => (
                <button
                  key={ticket.id}
                  type="button"
                  onClick={() => setSelectedTicketId(ticket.id)}
                  className={[
                    "grid w-full gap-3 border-b border-gray-800 px-5 py-4 text-left transition lg:grid-cols-[120px_100px_140px_1fr_140px_180px]",
                    ticket.id === selectedTicketId ? "bg-cyan-500/10" : index % 2 === 0 ? "bg-gray-900/60" : "bg-gray-950/60",
                    "hover:bg-gray-800/70"
                  ].join(" ")}
                >
                  <span className="text-sm font-semibold text-white">{ticket.id}</span>
                  <span className="text-sm text-gray-300">{ticket.userId || "-"}</span>
                  <span className="text-sm text-gray-300">{ticket.category}</span>
                  <span className="text-sm text-white">{ticket.subject}</span>
                  <span className={`inline-flex w-fit rounded-full px-3 py-1 text-xs font-medium ${statusBadgeClass(ticket.status)}`}>
                    {statusLabel(ticket.status)}
                  </span>
                  <span className="text-sm text-gray-400">{formatDate(ticket.createdAt)}</span>
                </button>
              )) : (
                <div className="px-5 py-10 text-center text-sm text-gray-400">
                  No tickets match the current filters yet.
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-gray-800 bg-gray-900/80 p-6 backdrop-blur">
          <p className="text-xs uppercase tracking-[0.24em] text-cyan-300">Ticket Detail</p>
          {selectedTicket ? (
            <div className="mt-5 space-y-5">
              <div className="rounded-2xl border border-gray-800 bg-gray-950/70 p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="text-2xl font-semibold text-white">{selectedTicket.subject}</h3>
                    <div className="mt-2 flex flex-wrap gap-3 text-sm text-gray-400">
                      <span>{selectedTicket.id}</span>
                      <span>User #{selectedTicket.userId || "-"}</span>
                      <span>{selectedTicket.category}</span>
                      <span>{formatDate(selectedTicket.createdAt)}</span>
                    </div>
                  </div>
                  <span className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${statusBadgeClass(selectedTicket.status)}`}>
                    {statusLabel(selectedTicket.status)}
                  </span>
                </div>

                <div className="mt-5 rounded-2xl border border-gray-800 bg-gray-900/70 p-4">
                  <div className="text-xs uppercase tracking-[0.16em] text-gray-500">User Message</div>
                  <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-gray-200">{selectedTicket.description}</p>
                </div>
              </div>

              <div className="rounded-2xl border border-gray-800 bg-gray-950/70 p-5">
                <div className="grid gap-4 sm:grid-cols-[1fr_180px]">
                  <label className="space-y-2">
                    <span className="text-xs uppercase tracking-[0.16em] text-gray-500">Admin Response</span>
                    <textarea
                      value={responseDraft}
                      onChange={(event) => setResponseDraft(event.target.value)}
                      rows={8}
                      placeholder="Write the response that should appear to the user."
                      className="w-full rounded-2xl border border-gray-700 bg-gray-900 px-4 py-3 text-sm text-white outline-none"
                    />
                  </label>

                  <label className="space-y-2">
                    <span className="text-xs uppercase tracking-[0.16em] text-gray-500">Status</span>
                    <select
                      value={nextStatus}
                      onChange={(event) => setNextStatus(event.target.value as TicketStatus)}
                      className="w-full rounded-2xl border border-gray-700 bg-gray-900 px-4 py-3 text-sm text-white outline-none"
                    >
                      <option value="open">Open</option>
                      <option value="in_review">In Review</option>
                      <option value="resolved">Resolved</option>
                    </select>
                  </label>
                </div>

                <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                  <div className="text-sm text-gray-400">
                    {selectedTicket.respondedAt ? `Last response saved ${formatDate(selectedTicket.respondedAt)}.` : "No admin response saved yet."}
                  </div>
                  <button
                    type="button"
                    onClick={handleSave}
                    className="rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-cyan-950/30 transition hover:brightness-110"
                  >
                    Submit Response
                  </button>
                </div>

                {feedback ? <p className="mt-4 text-sm text-emerald-300">{feedback}</p> : null}
              </div>
            </div>
          ) : (
            <div className="mt-5 rounded-2xl border border-dashed border-gray-700 bg-gray-950/50 p-8 text-center text-sm text-gray-400">
              Select a ticket from the list to review it and write a response.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
