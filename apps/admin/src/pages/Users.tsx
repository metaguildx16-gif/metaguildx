import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  getAllUsers,
  getUserDetail,
  type UserDetail,
  type UserSummary
} from "../hooks/useContractData";
import {
  formatDate,
  getPackagePrice,
  PACKAGE_PRICES,
  shortAddress
} from "../utils/packageUtils";
import { NETWORK } from "../config/contracts";

const PAGE_SIZE = 20;

function levelTone(level: number) {
  if (level === 10) {
    return "bg-amber-500/15 text-amber-200 border-amber-500/20";
  }
  if (level >= 7) {
    return "bg-fuchsia-500/15 text-fuchsia-200 border-fuchsia-500/20";
  }
  if (level >= 4) {
    return "bg-blue-500/15 text-blue-200 border-blue-500/20";
  }
  return "bg-slate-500/15 text-slate-200 border-slate-500/20";
}

function downloadCsv(users: UserSummary[]) {
  const header = "UserID,Wallet,Level,USDT,ReferrerID,JoinDate,Status";
  const rows = users.map((user) =>
    [
      user.userId,
      user.wallet,
      user.packageLevel,
      getPackagePrice(user.packageLevel),
      user.sponsorId,
      formatDate(user.joinedAt),
      user.surrendered ? "Surrendered" : "Active"
    ].join(",")
  );

  const blob = new Blob([[header, ...rows].join("\n")], {
    type: "text/csv;charset=utf-8;"
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "metaguildx-users.csv";
  link.click();
  URL.revokeObjectURL(url);
}

function UsersDetailPanel({
  user,
  loading,
  onClose
}: {
  user: UserDetail | null;
  loading: boolean;
  onClose: () => void;
}) {
  const navigate = useNavigate();

  if (!user && !loading) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/50 backdrop-blur-sm">
      <div className="h-full w-full max-w-xl overflow-y-auto border-l border-gray-800 bg-gray-900 p-6 shadow-2xl shadow-black/50">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-blue-300">
              User Detail
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-white">
              {loading ? "Loading..." : `User #${user?.userId ?? "-"}`}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-gray-700 px-3 py-2 text-sm text-gray-300 transition hover:border-gray-500 hover:text-white"
          >
            Close
          </button>
        </div>

        {loading ? (
          <div className="mt-6 space-y-4">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="h-20 animate-pulse rounded-3xl bg-gray-800" />
            ))}
          </div>
        ) : user ? (
          <div className="mt-6 space-y-6">
            <section className="rounded-3xl border border-gray-800 bg-gray-950/60 p-5">
              <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-gray-400">
                Basic Info
              </h3>
              <div className="mt-4 grid gap-3 text-sm text-gray-300">
                <div>User ID: {user.userId}</div>
                <div className="flex items-center gap-2">
                  Wallet: <span className="font-mono text-xs">{user.wallet}</span>
                  <button
                    type="button"
                    onClick={() => void navigator.clipboard.writeText(user.wallet)}
                    className="rounded-full border border-gray-700 px-2 py-1 text-xs text-gray-300"
                  >
                    Copy
                  </button>
                </div>
                <div>
                  Package: Level {user.packageLevel} ({getPackagePrice(user.packageLevel)} USDT)
                </div>
                <div>Join Date: {formatDate(user.joinedAt)}</div>
                <div>Status: {user.surrendered ? "Surrendered" : "Active"}</div>
              </div>
            </section>

            <section className="rounded-3xl border border-gray-800 bg-gray-950/60 p-5">
              <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-gray-400">
                Referral Info
              </h3>
              <div className="mt-4 grid gap-3 text-sm text-gray-300">
                <div>
                  Referrer: #{user.sponsorId}{" "}
                  {user.referrerWallet ? `(${shortAddress(user.referrerWallet)})` : ""}
                </div>
                <div>Direct Referrals: {user.directReferrals}</div>
                <div>
                  Team Size: {user.treePosition.leftCount} left / {user.treePosition.rightCount} right
                </div>
              </div>
            </section>

            <section className="rounded-3xl border border-gray-800 bg-gray-950/60 p-5">
              <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-gray-400">
                Income Info
              </h3>
              <div className="mt-4 grid gap-3 text-sm text-gray-300">
                <div>Total Income Received: {user.totalIncomeReceived.toFixed(1)} USDT</div>
                <div>Current Package Level: {user.currentPackageLevel}</div>
                <div>Reactivation Count: {user.reactivationCount}</div>
              </div>
            </section>

            <section className="rounded-3xl border border-gray-800 bg-gray-950/60 p-5">
              <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-gray-400">
                Binary Tree Position
              </h3>
              <div className="mt-4 grid gap-3 text-sm text-gray-300">
                <div>Parent Node ID: {user.treePosition.parentId}</div>
                <div>Left Child ID: {user.treePosition.leftChildId}</div>
                <div>Right Child ID: {user.treePosition.rightChildId}</div>
                <div>Tree Depth: {user.treePosition.depth}</div>
                <div>Position: {user.treePosition.position}</div>
              </div>
            </section>

            <section className="rounded-3xl border border-gray-800 bg-gray-950/60 p-5">
              <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-gray-400">
                Links
              </h3>
              <div className="mt-4 flex flex-wrap gap-3">
                <a
                  href={`${NETWORK.explorer}/address/${user.wallet}`}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-full bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-500"
                >
                  View on BSCScan
                </a>
                <button
                  type="button"
                  onClick={() => navigate(`/tree?userId=${user.userId}`)}
                  className="rounded-full border border-gray-700 px-4 py-2 text-sm font-medium text-gray-200 transition hover:border-gray-500 hover:text-white"
                >
                  View in Binary Tree
                </button>
              </div>
            </section>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function Users() {
  const [searchParams] = useSearchParams();
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserDetail | null>(null);
  const [search, setSearch] = useState(searchParams.get("search") ?? "");
  const [levelFilter, setLevelFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const allUsers = await getAllUsers();
      setUsers(allUsers);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load users");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadUsers();
  }, []);

  useEffect(() => {
    const searchValue = searchParams.get("search");
    if (searchValue !== null) {
      setSearch(searchValue);
    }
  }, [searchParams]);

  const filteredUsers = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return users.filter((user) => {
      const matchesSearch =
        normalizedSearch.length === 0 ||
        user.wallet.toLowerCase().includes(normalizedSearch) ||
        String(user.userId).includes(normalizedSearch);
      const matchesLevel =
        levelFilter === "all" || user.packageLevel === Number(levelFilter);
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && !user.surrendered) ||
        (statusFilter === "surrendered" && user.surrendered);
      return matchesSearch && matchesLevel && matchesStatus;
    });
  }, [levelFilter, search, statusFilter, users]);

  useEffect(() => {
    setPage(1);
  }, [search, levelFilter, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / PAGE_SIZE));
  const visibleUsers = filteredUsers.slice(
    (page - 1) * PAGE_SIZE,
    page * PAGE_SIZE
  );

  const openUser = async (userId: number) => {
    setDetailLoading(true);
    setSelectedUser(null);
    try {
      const detail = await getUserDetail(userId);
      const summary = users.find((item) => item.userId === userId);
      setSelectedUser({
        ...detail,
        txHash: summary?.txHash ?? "",
        blockNumber: summary?.blockNumber ?? 0
      });
    } finally {
      setDetailLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-gray-800 bg-gray-900/90 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-white">User Management</h2>
            <p className="mt-2 text-sm text-gray-400">
              Search registrations, filter by package and status, and inspect full user details.
            </p>
          </div>
          <button
            type="button"
            onClick={() => downloadCsv(filteredUsers)}
            className="rounded-full bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-500"
          >
            Export CSV
          </button>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-[1.2fr_0.6fr_0.6fr_auto]">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by wallet address or user ID"
            className="rounded-2xl border border-gray-800 bg-gray-950 px-4 py-3 text-sm text-white outline-none transition focus:border-blue-500"
          />
          <select
            value={levelFilter}
            onChange={(event) => setLevelFilter(event.target.value)}
            className="rounded-2xl border border-gray-800 bg-gray-950 px-4 py-3 text-sm text-white outline-none transition focus:border-blue-500"
          >
            <option value="all">All Levels</option>
            {Object.entries(PACKAGE_PRICES).map(([level, price]) => (
              <option key={level} value={level}>
                Level {level} (${price})
              </option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="rounded-2xl border border-gray-800 bg-gray-950 px-4 py-3 text-sm text-white outline-none transition focus:border-blue-500"
          >
            <option value="all">All Status</option>
            <option value="active">Active only</option>
            <option value="surrendered">Surrendered only</option>
          </select>
          <div className="flex items-center rounded-2xl border border-gray-800 bg-gray-950 px-4 py-3 text-sm text-gray-400">
            Showing {visibleUsers.length} of {filteredUsers.length} users
          </div>
        </div>

        {error ? (
          <div className="mt-6 flex items-center justify-between gap-4 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-4 text-sm text-red-100">
            <span>Failed to load users: {error}</span>
            <button
              type="button"
              onClick={() => void loadUsers()}
              className="rounded-full bg-red-500 px-4 py-2 font-medium text-white"
            >
              Retry
            </button>
          </div>
        ) : null}

        <div className="mt-6 overflow-hidden rounded-3xl border border-gray-800">
          <table className="min-w-full divide-y divide-gray-800 text-left text-sm">
            <thead className="bg-gray-950/70 text-gray-400">
              <tr>
                <th className="px-4 py-3 font-medium">#</th>
                <th className="px-4 py-3 font-medium">User ID</th>
                <th className="px-4 py-3 font-medium">Wallet</th>
                <th className="px-4 py-3 font-medium">Package</th>
                <th className="px-4 py-3 font-medium">Income</th>
                <th className="px-4 py-3 font-medium">Referrer ID</th>
                <th className="px-4 py-3 font-medium">Join Date</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800 bg-gray-900/70">
              {loading
                ? Array.from({ length: 5 }).map((_, index) => (
                    <tr key={index}>
                      <td colSpan={8} className="px-4 py-4">
                        <div className="h-5 animate-pulse rounded-xl bg-gray-800" />
                      </td>
                    </tr>
                  ))
                : visibleUsers.map((user, index) => (
                    <tr
                      key={user.userId}
                      onClick={() => void openUser(user.userId)}
                      className="cursor-pointer hover:bg-gray-800/60"
                    >
                      <td className="px-4 py-4 text-gray-500">
                        {(page - 1) * PAGE_SIZE + index + 1}
                      </td>
                      <td className="px-4 py-4 font-medium text-white">{user.userId}</td>
                      <td className="px-4 py-4 text-gray-300">
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            void navigator.clipboard.writeText(user.wallet);
                          }}
                          className="transition hover:text-white"
                        >
                          {shortAddress(user.wallet)}
                        </button>
                      </td>
                      <td className="px-4 py-4">
                        <span
                          className={`inline-flex rounded-full border px-3 py-1 text-xs font-medium ${levelTone(
                            user.packageLevel
                          )}`}
                        >
                          Level {user.packageLevel}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-gray-300">
                        ${user.directIncomeReceived.toFixed(1)}
                      </td>
                      <td className="px-4 py-4 text-gray-300">{user.sponsorId}</td>
                      <td className="px-4 py-4 text-gray-400">
                        {formatDate(user.joinedAt)}
                      </td>
                      <td className="px-4 py-4">
                        <span
                          className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${
                            user.surrendered
                              ? "bg-red-500/15 text-red-200"
                              : "bg-emerald-500/15 text-emerald-200"
                          }`}
                        >
                          {user.surrendered ? "Surrendered" : "Active"}
                        </span>
                      </td>
                    </tr>
                  ))}
              {!loading && filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-gray-500">
                    No users registered yet
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <div className="mt-5 flex items-center justify-between gap-4">
          <div className="text-sm text-gray-400">
            Page {page} of {totalPages}
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              disabled={page === 1}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              className="rounded-full border border-gray-700 px-4 py-2 text-sm text-gray-200 transition hover:border-gray-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
              className="rounded-full border border-gray-700 px-4 py-2 text-sm text-gray-200 transition hover:border-gray-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      </section>

      <UsersDetailPanel
        user={selectedUser}
        loading={detailLoading}
        onClose={() => {
          setSelectedUser(null);
          setDetailLoading(false);
        }}
      />
    </div>
  );
}
