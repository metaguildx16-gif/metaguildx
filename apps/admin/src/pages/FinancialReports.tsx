import { useEffect, useState } from "react";
import {
  getFinancialReportsData,
  type FinancialReportsData
} from "../hooks/useContractData";

function formatUsdt(amount: number) {
  return `${amount.toFixed(2)} USDT`;
}

export function FinancialReports() {
  const [data, setData] = useState<FinancialReportsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        setData(await getFinancialReportsData());
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Failed to load financial reports");
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  return (
    <div className="space-y-6">
      {error ? <div className="rounded-3xl border border-red-500/20 bg-red-500/10 px-5 py-4 text-sm text-red-100">{error}</div> : null}
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {[
          ["Total Business Volume", data?.totalCollected ?? 0],
          ["Registration Volume", data?.registrationVolume ?? 0],
          ["Upgrade Volume", data?.upgradeVolume ?? 0],
          ["Creator Fee Earned", data?.creatorFeeEarned ?? 0],
          ["Total Income Distributed", data?.totalIncomeDistributed ?? 0],
          ["Cashback Pool Balance", data?.cashbackPoolBalance ?? 0],
          ["Total Escrow Frozen", data?.totalEscrowFrozen ?? 0],
          ["Contract USDT Balance", data?.contractUsdtBalance ?? 0]
        ].map(([label, value]) => (
          <article key={String(label)} className="rounded-3xl border border-gray-800 bg-gray-900/90 p-5">
            <p className="text-sm text-gray-400">{label}</p>
            {loading ? <div className="mt-4 h-10 w-28 animate-pulse rounded-2xl bg-gray-800" /> : <h3 className="mt-4 text-3xl font-bold text-white">{formatUsdt(Number(value))}</h3>}
          </article>
        ))}
      </section>

      <section className="rounded-3xl border border-gray-800 bg-gray-900/90 p-6">
        <h2 className="text-xl font-semibold text-white">Income Breakdown</h2>
        <div className="mt-6 overflow-hidden rounded-3xl border border-gray-800">
          <table className="min-w-full divide-y divide-gray-800 text-left text-sm">
            <thead className="bg-gray-950/70 text-gray-400">
              <tr>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800 bg-gray-900/70">
              {[
                ["Direct", data?.directIncomeDistributed ?? 0],
                ["Level", data?.levelIncomeDistributed ?? 0],
                ["Creator", data?.creatorFeeEarned ?? 0],
                ["Total", data?.totalIncomeDistributed ?? 0]
              ].map(([label, value]) => (
                <tr key={String(label)}>
                  <td className="px-4 py-4 text-white">{label}</td>
                  <td className="px-4 py-4 text-blue-300">{loading ? "Loading..." : formatUsdt(Number(value))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-3xl border border-gray-800 bg-gray-900/90 p-6">
        <h2 className="text-xl font-semibold text-white">Monthly Activity</h2>
        <div className="mt-6 overflow-hidden rounded-3xl border border-gray-800">
          <table className="min-w-full divide-y divide-gray-800 text-left text-sm">
            <thead className="bg-gray-950/70 text-gray-400">
              <tr>
                <th className="px-4 py-3 font-medium">Month</th>
                <th className="px-4 py-3 font-medium">Registrations</th>
                <th className="px-4 py-3 font-medium">Business Volume</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800 bg-gray-900/70">
              {(data?.monthly ?? []).map((row) => (
                <tr key={row.month}>
                  <td className="px-4 py-4 text-white">{row.month}</td>
                  <td className="px-4 py-4 text-gray-300">{row.registrations}</td>
                  <td className="px-4 py-4 text-blue-300">{formatUsdt(row.income)}</td>
                </tr>
              ))}
              {!loading && (data?.monthly.length ?? 0) === 0 ? (
                <tr>
                  <td colSpan={3} className="px-4 py-12 text-center text-gray-500">No monthly data available yet</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
