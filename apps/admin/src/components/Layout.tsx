import { NavLink, Outlet, useLocation } from "react-router-dom";
import { NetworkBadge } from "./NetworkBadge";
import { WalletConnect } from "./WalletConnect";

const navigation = [
  { to: "/", label: "Overview", icon: "OV" },
  { to: "/users", label: "Users", icon: "US" },
  { to: "/activity", label: "Activity", icon: "AC" },
  { to: "/income", label: "Income Log", icon: "IL" },
  { to: "/income-monitor", label: "Income Monitor", icon: "IM" },
  { to: "/rebirths", label: "Rebirth", icon: "RB" },
  { to: "/upgrades", label: "Upgrade", icon: "UP" },
  { to: "/staking", label: "Staking", icon: "ST" },
  { to: "/cashback", label: "Cashback", icon: "CB" },
  { to: "/tree", label: "Tree", icon: "TR" },
  { to: "/reports", label: "Reports", icon: "RP" },
  { to: "/transactions", label: "Transactions", icon: "TX" },
  { to: "/control", label: "Settings", icon: "ST" }
] as const;

const titles: Record<string, string> = {
  "/": "Overview",
  "/users": "Users",
  "/activity": "Activity",
  "/income": "Income Log",
  "/income-monitor": "Income Monitor",
  "/rebirths": "Rebirth",
  "/upgrades": "Upgrade",
  "/staking": "Staking",
  "/cashback": "Cashback",
  "/tree": "Tree",
  "/reports": "Reports",
  "/transactions": "Transactions",
  "/control": "Settings"
};

export function Layout() {
  const location = useLocation();
  const pageTitle = titles[location.pathname] ?? "MetaGuildX Admin";

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-gray-800 bg-gray-900/95 px-5 py-6 lg:flex">
        <div className="flex items-center gap-3 border-b border-gray-800 pb-6">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-600/20 text-sm font-semibold shadow-glow">
            MGX
          </div>
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-blue-300">
              MetaGuildX
            </p>
            <p className="mt-1 text-lg font-semibold text-white">Admin</p>
          </div>
        </div>

        <nav className="mt-6 flex-1 space-y-2 overflow-y-auto pr-1">
          {navigation.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) =>
                [
                  "flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition",
                  isActive
                    ? "bg-blue-600 text-white shadow-lg shadow-blue-950/40"
                    : "text-gray-400 hover:bg-gray-800 hover:text-white"
                ].join(" ")
              }
            >
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-gray-950/70 text-xs font-semibold">
                {item.icon}
              </span>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="space-y-3 border-t border-gray-800 pt-5">
          <NetworkBadge compact />
          <div className="rounded-2xl border border-gray-800 bg-gray-950/70 px-4 py-3 text-xs text-gray-400">
            Version 0.1.0
          </div>
        </div>
      </aside>

      <div className="lg:pl-60">
        <header className="sticky top-0 z-20 border-b border-gray-800 bg-gray-900/95 backdrop-blur">
          <div className="flex min-h-20 items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
            <div>
              <p className="text-xs uppercase tracking-[0.28em] text-gray-500">
                Owner Back Office
              </p>
              <h1 className="mt-2 text-2xl font-semibold text-white">
                {pageTitle}
              </h1>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-3">
              <NetworkBadge />
              <WalletConnect />
            </div>
          </div>
          <div className="border-t border-gray-800 px-4 py-3 lg:hidden">
            <nav className="flex gap-2 overflow-x-auto pb-1">
              {navigation.map((item) => (
                <NavLink
                  key={`mobile-${item.to}`}
                  to={item.to}
                  end={item.to === "/"}
                  className={({ isActive }) =>
                    [
                      "whitespace-nowrap rounded-full border px-3 py-2 text-xs font-medium transition",
                      isActive
                        ? "border-blue-500 bg-blue-600 text-white"
                        : "border-gray-700 bg-gray-900 text-gray-300 hover:border-gray-500 hover:text-white"
                    ].join(" ")
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </nav>
          </div>
        </header>

        <main className="min-h-[calc(100vh-5rem)] px-4 py-6 sm:px-6 lg:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
