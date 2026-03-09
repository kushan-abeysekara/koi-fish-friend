import React, { useState, useEffect, useCallback } from 'react';
import {
  pondApi, revenueApi, expenditureApi, profitLossApi, fishCountApi,
  type Pond, type Revenue, type Expenditure, type ProfitLossReport, type FishCount,
} from '../services/api';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts';

// ─── helpers ─────────────────────────────────────────────────────────────────
const fmt = (n: number) =>
  new Intl.NumberFormat('en-LK', { style: 'currency', currency: 'LKR', maximumFractionDigits: 0 }).format(n);

const pct = (n: number) => (isNaN(n) ? '0.00' : n.toFixed(2));

const today = () => new Date().toISOString().split('T')[0];
const monthsAgo = (m: number) => {
  const d = new Date();
  d.setMonth(d.getMonth() - m);
  return d.toISOString().split('T')[0];
};

const POND_COLORS = ['#06b6d4', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#3b82f6'];
const PIE_COLORS = ['#10b981', '#ef4444', '#f59e0b', '#8b5cf6', '#06b6d4'];

// ─── types ────────────────────────────────────────────────────────────────────
interface PondSummary {
  pond: Pond;
  report: ProfitLossReport | null;
  totalFish: number;
  costPerFish: number;
  fishSales: Revenue[];
}

// ─── main component ───────────────────────────────────────────────────────────
const PondProfitLoss: React.FC = () => {
  const [ponds, setPonds] = useState<Pond[]>([]);
  const [summaries, setSummaries] = useState<PondSummary[]>([]);
  const [revenues, setRevenues] = useState<Revenue[]>([]);
  const [expenditures, setExpenditures] = useState<Expenditure[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'fishsales' | 'cost'>('overview');
  const [selectedPond, setSelectedPond] = useState<number | 'all'>('all');
  const [startDate, setStartDate] = useState(monthsAgo(3));
  const [endDate, setEndDate] = useState(today());

  // Fish sale modal state
  const [showSaleModal, setShowSaleModal] = useState(false);
  const [editingSale, setEditingSale] = useState<Revenue | null>(null);
  const [saleForm, setSaleForm] = useState({
    date: today(),
    pondId: 0,
    quantitySold: '',
    pricePerUnit: '',
    fishSpecies: '',
    customerName: '',
    notes: '',
    paymentMethod: 'Cash',
    paymentStatus: 'Paid',
  });

  // ── load all data ────────────────────────────────────────────────────────
  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [pondsRes, revsRes, expsRes, fishRes] = await Promise.all([
        pondApi.getAll(),
        revenueApi.getAll(),
        expenditureApi.getAll(),
        fishCountApi.getAll(),
      ]);

      const pondList: Pond[] = (pondsRes.success && pondsRes.data) ? pondsRes.data : [];
      const revList: Revenue[] = (revsRes.success && revsRes.data) ? revsRes.data : [];
      const expList: Expenditure[] = (expsRes.success && expsRes.data) ? expsRes.data : [];
      const fishList: FishCount[] = (fishRes.success && fishRes.data) ? fishRes.data : [];

      setPonds(pondList);
      setRevenues(revList);
      setExpenditures(expList);

      // Build per-pond summaries
      const summaryList: PondSummary[] = await Promise.all(
        pondList.map(async (pond) => {
          let report: ProfitLossReport | null = null;
          try {
            const r = await profitLossApi.getReportByPond(pond.id, startDate, endDate);
            if (r.success && r.data) report = r.data;
          } catch { /* report stays null */ }

          // Latest fish count for this pond
          const pondFishCounts = fishList.filter(fc => fc.pond?.id === pond.id);
          const latestCount = pondFishCounts.length > 0
            ? pondFishCounts.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0].count
            : 0;

          const pondExpenses = expList
            .filter(e => e.pond?.id === pond.id)
            .reduce((sum, e) => sum + Number(e.amount), 0);

          const costPerFish = latestCount > 0 ? pondExpenses / latestCount : 0;

          const fishSales = revList.filter(r => r.pond?.id === pond.id && r.source === 'Fish Sales');

          return { pond, report, totalFish: latestCount, costPerFish, fishSales };
        })
      );

      setSummaries(summaryList);
    } catch (err) {
      console.error('PondProfitLoss load error:', err);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => { loadAll(); }, [loadAll]);

  // ── fish sale CRUD ────────────────────────────────────────────────────────
  const openAddSale = (pondId?: number) => {
    setEditingSale(null);
    setSaleForm({
      date: today(),
      pondId: pondId ?? (ponds[0]?.id ?? 0),
      quantitySold: '',
      pricePerUnit: '',
      fishSpecies: '',
      customerName: '',
      notes: '',
      paymentMethod: 'Cash',
      paymentStatus: 'Paid',
    });
    setShowSaleModal(true);
  };

  const openEditSale = (rev: Revenue) => {
    setEditingSale(rev);
    setSaleForm({
      date: rev.date,
      pondId: rev.pond.id,
      quantitySold: String(rev.quantitySold ?? ''),
      pricePerUnit: String(rev.pricePerUnit ?? ''),
      fishSpecies: rev.fishSpecies ?? '',
      customerName: rev.customerName ?? '',
      notes: rev.notes ?? '',
      paymentMethod: rev.paymentMethod ?? 'Cash',
      paymentStatus: rev.paymentStatus ?? 'Paid',
    });
    setShowSaleModal(true);
  };

  const saveSale = async () => {
    const qty = Number(saleForm.quantitySold);
    const price = Number(saleForm.pricePerUnit);
    if (!saleForm.pondId || !qty || !price) {
      alert('Pond, quantity, and price per fish are required.');
      return;
    }

    // Block new sales for closed ponds
    if (!editingSale) {
      const pondForSale = ponds.find(p => p.id === Number(saleForm.pondId));
      if (pondForSale?.status === 'CLOSED') {
        alert('Cannot add revenue to a closed pond.');
        return;
      }
    }
    const payload = {
      date: saleForm.date,
      pondId: Number(saleForm.pondId),
      source: 'Fish Sales',
      amount: qty * price,
      quantitySold: qty,
      pricePerUnit: price,
      fishSpecies: saleForm.fishSpecies || undefined,
      customerName: saleForm.customerName || undefined,
      notes: saleForm.notes || undefined,
      paymentMethod: saleForm.paymentMethod,
      paymentStatus: saleForm.paymentStatus,
    };
    try {
      if (editingSale) {
        await revenueApi.update(editingSale.id, payload);
      } else {
        await revenueApi.create(payload);
      }
      setShowSaleModal(false);
      await loadAll();
    } catch (err) {
      alert('Failed to save fish sale: ' + (err instanceof Error ? err.message : err));
    }
  };

  const deleteSale = async (id: number) => {
    if (!confirm('Delete this fish sale record?')) return;
    try {
      await revenueApi.delete(id);
      await loadAll();
    } catch (err) {
      alert('Failed to delete: ' + (err instanceof Error ? err.message : err));
    }
  };

  // ── filtered data helpers ─────────────────────────────────────────────────
  const filteredRevenues = revenues.filter(r =>
    (selectedPond === 'all' || r.pond?.id === selectedPond) &&
    r.date >= startDate && r.date <= endDate
  );

  const filteredExpenses = expenditures.filter(e =>
    (selectedPond === 'all' || e.pond?.id === selectedPond) &&
    e.date >= startDate && e.date <= endDate
  );

  const filteredFishSales = filteredRevenues.filter(r => r.source === 'Fish Sales');

  const totalRevenue = filteredRevenues.reduce((s, r) => s + Number(r.amount), 0);
  const totalExpenses = filteredExpenses.reduce((s, e) => s + Number(e.amount), 0);
  const netProfit = totalRevenue - totalExpenses;
  const roi = totalExpenses > 0 ? (netProfit / totalExpenses) * 100 : 0;
  const totalFishSold = filteredFishSales.reduce((s, r) => s + (r.quantitySold ?? 0), 0);
  const fishSaleRevenue = filteredFishSales.reduce((s, r) => s + Number(r.amount), 0);

  // Chart data
  const pondChartData = summaries.map(s => ({
    name: s.pond.name,
    Revenue: s.report ? Number(s.report.totalRevenue) : 0,
    Expenses: s.report ? Number(s.report.totalExpenses) : 0,
    'Net Profit': s.report ? Number(s.report.netProfit) : 0,
  }));

  const expCategories = filteredExpenses.reduce<Record<string, number>>((acc, e) => {
    acc[e.category] = (acc[e.category] ?? 0) + Number(e.amount);
    return acc;
  }, {});
  const expPieData = Object.entries(expCategories).map(([name, value]) => ({ name, value }));

  const revSources = filteredRevenues.reduce<Record<string, number>>((acc, r) => {
    acc[r.source] = (acc[r.source] ?? 0) + Number(r.amount);
    return acc;
  }, {});
  const revPieData = Object.entries(revSources).map(([name, value]) => ({ name, value }));

  // ── render ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto mb-4" />
          <p className="text-gray-500">Loading pond data…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div className="bg-gradient-to-r from-emerald-700 via-emerald-600 to-teal-600 text-white px-6 py-5 shadow-lg rounded-xl mb-6">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <span>🏞️</span> Pond-wise Profit & Loss
            </h1>
            <p className="text-emerald-100 text-sm mt-0.5">
              Per-pond revenue, expenses, fish sales, cost per fish &amp; ROI
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 text-sm">
              <label className="text-emerald-200">From</label>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                className="text-gray-800 rounded px-2 py-1 text-sm" />
              <label className="text-emerald-200">To</label>
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
                className="text-gray-800 rounded px-2 py-1 text-sm" />
            </div>
            <button onClick={loadAll}
              className="bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-lg text-sm font-medium transition">
              🔄 Refresh
            </button>
          </div>
        </div>
      </div>

      {/* ── KPI strip ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total Revenue', value: fmt(totalRevenue), color: 'text-emerald-600', icon: '💰', bg: 'bg-emerald-50' },
          { label: 'Total Expenses', value: fmt(totalExpenses), color: 'text-red-600', icon: '💸', bg: 'bg-red-50' },
          { label: 'Net Profit', value: fmt(netProfit), color: netProfit >= 0 ? 'text-emerald-600' : 'text-red-600', icon: '📊', bg: netProfit >= 0 ? 'bg-emerald-50' : 'bg-red-50' },
          { label: 'Total ROI', value: `${pct(roi)}%`, color: roi >= 0 ? 'text-emerald-600' : 'text-red-600', icon: '📈', bg: roi >= 0 ? 'bg-emerald-50' : 'bg-red-50' },
        ].map(k => (
          <div key={k.label} className={`${k.bg} rounded-xl shadow-sm p-4 border border-gray-100`}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xl">{k.icon}</span>
              <span className="text-xs text-gray-400">Selected Period</span>
            </div>
            <p className={`text-xl font-bold ${k.color}`}>{k.value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{k.label}</p>
          </div>
        ))}
      </div>

      {/* ── Filters ──────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <button
          onClick={() => setSelectedPond('all')}
          className={`px-4 py-1.5 rounded-full text-sm font-medium transition ${selectedPond === 'all' ? 'bg-emerald-600 text-white shadow' : 'bg-white text-gray-600 border hover:bg-gray-50'}`}>
          All Ponds
        </button>
        {ponds.map((p, i) => (
          <button key={p.id}
            onClick={() => setSelectedPond(p.id)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition flex items-center gap-1.5 ${selectedPond === p.id ? 'text-white shadow' : 'bg-white text-gray-600 border hover:bg-gray-50'}`}
            style={selectedPond === p.id ? { backgroundColor: POND_COLORS[i % POND_COLORS.length] } : {}}>
            {p.name}
            {p.status === 'CLOSED' && (
              <span className="bg-gray-500 text-white text-xs px-1.5 py-0.5 rounded font-bold">CLOSED</span>
            )}
          </button>
        ))}
      </div>

      {/* ── Tabs ─────────────────────────────────────────────────────────── */}
      <div className="flex gap-1 mb-6 bg-white rounded-xl shadow-sm p-1.5 border w-fit">
        {([
          ['overview', '📊 P&L Overview'],
          ['fishsales', '🐟 Fish Sales'],
          ['cost', '🔬 Cost Analysis'],
        ] as const).map(([tab, label]) => (
          <button key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-5 py-2 rounded-lg text-sm font-semibold transition ${activeTab === tab ? 'bg-emerald-600 text-white shadow' : 'text-gray-500 hover:text-gray-800'}`}>
            {label}
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* TAB: P&L Overview                                                 */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'overview' && (
        <div className="space-y-6">

          {/* Pond P&L cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {summaries
              .filter(s => selectedPond === 'all' || s.pond.id === selectedPond)
              .map((s, i) => {
                const r = s.report;
                const rev = r ? Number(r.totalRevenue) : 0;
                const exp = r ? Number(r.totalExpenses) : 0;
                const net = r ? Number(r.netProfit) : 0;
                const roi = r ? Number(r.roi) : 0;
                const margin = r ? Number(r.profitMargin) : 0;
                const accent = POND_COLORS[i % POND_COLORS.length];
                return (
                  <div key={s.pond.id}
                    className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition">
                    {/* Colour strip */}
                    <div className="h-1.5" style={{ backgroundColor: accent }} />
                    <div className="p-5">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-gray-800 text-lg">{s.pond.name}</h3>
                          {s.pond.status === 'CLOSED' && (
                            <span className="text-xs bg-gray-600 text-white px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                              🔒 CLOSED
                            </span>
                          )}
                        </div>
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${net >= 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                          {net >= 0 ? '✅ Profit' : '❌ Loss'}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-3 mb-4">
                        <div>
                          <p className="text-xs text-gray-400">Revenue</p>
                          <p className="font-bold text-emerald-600">{fmt(rev)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-400">Expenses</p>
                          <p className="font-bold text-red-500">{fmt(exp)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-400">Net Profit</p>
                          <p className={`font-bold ${net >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>{fmt(net)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-400">ROI</p>
                          <p className={`font-bold ${roi >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>{pct(roi)}%</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-400">Profit Margin</p>
                          <p className="font-bold text-purple-600">{pct(margin)}%</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-400">Fish Count</p>
                          <p className="font-bold text-gray-700">{s.totalFish.toLocaleString()}</p>
                        </div>
                      </div>
                      {/* Cost per fish */}
                      {s.totalFish > 0 && (
                        <div className="bg-amber-50 rounded-lg p-2.5 flex items-center justify-between">
                          <span className="text-xs text-amber-700 font-medium">💰 Cost per Fish</span>
                          <span className="font-bold text-amber-700">{fmt(s.costPerFish)}</span>
                        </div>
                      )}
                      {/* Break-even bar */}
                      {r && rev > 0 && (
                        <div className="mt-3">
                          <div className="flex justify-between text-xs text-gray-400 mb-1">
                            <span>Break-even Progress</span>
                            <span>{Math.min(100, Math.round((rev / exp) * 100))}%</span>
                          </div>
                          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${net >= 0 ? 'bg-emerald-500' : 'bg-red-400'}`}
                              style={{ width: `${Math.min(100, (rev / (exp || 1)) * 100)}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
          </div>

          {/* Revenue vs Expenses Bar Chart */}
          {pondChartData.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <h3 className="font-bold text-gray-800 mb-4">Revenue vs Expenses per Pond</h3>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={pondChartData} margin={{ left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v: number | undefined) => v != null ? fmt(v) : '—'} />
                  <Legend />
                  <Bar dataKey="Revenue" fill="#10b981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Expenses" fill="#ef4444" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Net Profit" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Pie charts row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {[
              { title: 'Revenue Breakdown', data: revPieData },
              { title: 'Expense Breakdown', data: expPieData },
            ].map(({ title, data }) => (
              <div key={title} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                <h3 className="font-bold text-gray-800 mb-4">{title}</h3>
                {data.length === 0 ? (
                  <p className="text-gray-400 text-sm text-center py-10">No data for selected period</p>
                ) : (
                  <div className="flex items-center gap-4">
                    <ResponsiveContainer width="55%" height={180}>
                      <PieChart>
                        <Pie data={data} cx="50%" cy="50%" innerRadius={50} outerRadius={80}
                          dataKey="value" label={false}>
                          {data.map((_, idx) => (
                            <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(v: number | undefined) => v != null ? fmt(v) : '—'} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="flex-1 space-y-1.5">
                      {data.map((d, idx) => (
                        <div key={d.name} className="flex items-center justify-between gap-2 text-xs">
                          <div className="flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full inline-block"
                              style={{ backgroundColor: PIE_COLORS[idx % PIE_COLORS.length] }} />
                            <span className="text-gray-600">{d.name}</span>
                          </div>
                          <span className="font-semibold text-gray-800">{fmt(d.value)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* TAB: Fish Sales                                                    */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'fishsales' && (
        <div className="space-y-5">
          {/* Summary strip */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { label: 'Fish Sale Revenue', value: fmt(fishSaleRevenue), icon: '💰', color: 'text-emerald-600' },
              { label: 'Total Fish Sold', value: `${totalFishSold.toLocaleString()} fish`, icon: '🐟', color: 'text-blue-600' },
              { label: 'Avg. Price / Fish', value: totalFishSold > 0 ? fmt(fishSaleRevenue / totalFishSold) : '—', icon: '🏷️', color: 'text-purple-600' },
            ].map(k => (
              <div key={k.label} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                <div className="text-2xl mb-1">{k.icon}</div>
                <p className={`text-xl font-bold ${k.color}`}>{k.value}</p>
                <p className="text-xs text-gray-400">{k.label}</p>
              </div>
            ))}
          </div>

          {/* Table */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="flex items-center justify-between p-5 border-b">
              <h3 className="font-bold text-gray-800">🐟 Fish Sale Records</h3>
              <button onClick={() => {
                const selPond = ponds.find(p => p.id === selectedPond);
                if (selPond?.status === 'CLOSED') {
                  alert('Cannot add revenue to a closed pond.');
                  return;
                }
                openAddSale(selectedPond !== 'all' ? selectedPond : undefined);
              }}
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition flex items-center gap-2">
                <span>+</span> Add Fish Sale
              </button>
            </div>
            {filteredFishSales.length === 0 ? (
              <div className="text-center py-16 text-gray-400">
                <p className="text-4xl mb-3">🐟</p>
                <p className="font-medium">No fish sales yet for this period</p>
                <p className="text-sm mt-1">Click "Add Fish Sale" to record your first sale</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-600 text-xs">
                    <tr>
                      {['Date', 'Pond', 'Species', 'Qty Sold', 'Price/Fish', 'Total', 'Customer', 'Status', 'Actions'].map(h => (
                        <th key={h} className="px-4 py-3 text-left font-semibold">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {filteredFishSales
                      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                      .map(sale => (
                        <tr key={sale.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3">{new Date(sale.date).toLocaleDateString()}</td>
                          <td className="px-4 py-3 font-medium">{sale.pond.name}</td>
                          <td className="px-4 py-3 text-gray-600">{sale.fishSpecies ?? '—'}</td>
                          <td className="px-4 py-3 font-semibold text-blue-600">
                            {(sale.quantitySold ?? 0).toLocaleString()}
                          </td>
                          <td className="px-4 py-3">{sale.pricePerUnit ? fmt(Number(sale.pricePerUnit)) : '—'}</td>
                          <td className="px-4 py-3 font-bold text-emerald-600">{fmt(Number(sale.amount))}</td>
                          <td className="px-4 py-3 text-gray-500">{sale.customerName ?? '—'}</td>
                          <td className="px-4 py-3">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                              sale.paymentStatus === 'Paid' ? 'bg-emerald-100 text-emerald-700' :
                              sale.paymentStatus === 'Pending' ? 'bg-amber-100 text-amber-700' :
                              'bg-blue-100 text-blue-700'
                            }`}>{sale.paymentStatus}</span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex gap-2">
                              <button onClick={() => openEditSale(sale)}
                                className="text-blue-600 hover:text-blue-800 text-xs font-medium">Edit</button>
                              <button onClick={() => deleteSale(sale.id)}
                                className="text-red-500 hover:text-red-700 text-xs font-medium">Delete</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* TAB: Cost Analysis                                                 */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'cost' && (
        <div className="space-y-5">
          {/* Per-pond cost metrics table */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-5 border-b">
              <h3 className="font-bold text-gray-800">🔬 Per-Pond Cost & ROI Analysis</h3>
              <p className="text-xs text-gray-400 mt-0.5">Based on all expenditure records vs fish count & revenue</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs text-gray-500">
                  <tr>
                    {['Pond', 'Total Revenue', 'Total Expenses', 'Net Profit', 'Fish Count', 'Cost/Fish', 'ROI %', 'Profit Margin', 'Status'].map(h => (
                      <th key={h} className="px-4 py-3 text-left font-semibold">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {summaries
                    .filter(s => selectedPond === 'all' || s.pond.id === selectedPond)
                    .map((s, i) => {
                      const r = s.report;
                      const rev = r ? Number(r.totalRevenue) : 0;
                      const exp = r ? Number(r.totalExpenses) : 0;
                      const net = r ? Number(r.netProfit) : 0;
                      const roi = r ? Number(r.roi) : 0;
                      const margin = r ? Number(r.profitMargin) : 0;
                      return (
                        <tr key={s.pond.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 font-semibold" style={{ color: POND_COLORS[i % POND_COLORS.length] }}>
                            {s.pond.name}
                          </td>
                          <td className="px-4 py-3 text-emerald-600 font-medium">{fmt(rev)}</td>
                          <td className="px-4 py-3 text-red-500 font-medium">{fmt(exp)}</td>
                          <td className={`px-4 py-3 font-bold ${net >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>{fmt(net)}</td>
                          <td className="px-4 py-3 text-gray-700">{s.totalFish.toLocaleString()}</td>
                          <td className="px-4 py-3 text-amber-600 font-semibold">
                            {s.totalFish > 0 ? fmt(s.costPerFish) : '—'}
                          </td>
                          <td className={`px-4 py-3 font-bold ${roi >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                            {pct(roi)}%
                          </td>
                          <td className="px-4 py-3 text-purple-600 font-semibold">{pct(margin)}%</td>
                          <td className="px-4 py-3">
                            {s.pond.status === 'CLOSED' ? (
                              <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-gray-200 text-gray-600">
                                🔒 Closed
                              </span>
                            ) : (
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                net >= 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                              }`}>
                                {net >= 0 ? '✅ Profitable' : '❌ Loss'}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Break-even analysis cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {summaries
              .filter(s => selectedPond === 'all' || s.pond.id === selectedPond)
              .map((s, i) => {
                const r = s.report;
                if (!r) return null;
                const rev = Number(r.totalRevenue);
                const exp = Number(r.totalExpenses);
                const remaining = Number(r.remainingToBreakEven);
                const progress = exp > 0 ? Math.min(100, (rev / exp) * 100) : 0;
                return (
                  <div key={s.pond.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-bold text-gray-700">{s.pond.name}</h4>
                      <span className="text-xs text-gray-400">Break-even Analysis</span>
                    </div>
                    <div className="space-y-2 text-sm mb-4">
                      <div className="flex justify-between">
                        <span className="text-gray-500">Break-even Target</span>
                        <span className="font-semibold">{fmt(exp)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Revenue Achieved</span>
                        <span className="font-semibold text-emerald-600">{fmt(rev)}</span>
                      </div>
                      {remaining > 0 && (
                        <div className="flex justify-between">
                          <span className="text-gray-500">Still Needed</span>
                          <span className="font-semibold text-red-500">{fmt(remaining)}</span>
                        </div>
                      )}
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${progress}%`,
                          backgroundColor: POND_COLORS[i % POND_COLORS.length],
                        }}
                      />
                    </div>
                    <p className="text-xs text-gray-400 mt-1 text-right">{pct(progress)}% to break-even</p>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* ── Fish Sale Modal ───────────────────────────────────────────────── */}
      {showSaleModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
            <div className="flex items-center justify-between p-5 border-b">
              <h3 className="font-bold text-lg text-gray-800">
                {editingSale ? '✏️ Edit Fish Sale' : '🐟 Record Fish Sale'}
              </h3>
              <button onClick={() => setShowSaleModal(false)} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-gray-500 font-medium block mb-1">Date *</label>
                  <input type="date" value={saleForm.date}
                    onChange={e => setSaleForm(f => ({ ...f, date: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 font-medium block mb-1">Pond *</label>
                  <select value={saleForm.pondId}
                    onChange={e => setSaleForm(f => ({ ...f, pondId: Number(e.target.value) }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500">
                    <option value={0}>Select pond…</option>
                    {ponds.filter(p => p.status !== 'CLOSED').map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 font-medium block mb-1">Quantity Sold *</label>
                  <input type="number" min="1" value={saleForm.quantitySold}
                    onChange={e => setSaleForm(f => ({ ...f, quantitySold: e.target.value }))}
                    placeholder="e.g. 50"
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 font-medium block mb-1">Price per Fish (LKR) *</label>
                  <input type="number" min="0" step="0.01" value={saleForm.pricePerUnit}
                    onChange={e => setSaleForm(f => ({ ...f, pricePerUnit: e.target.value }))}
                    placeholder="e.g. 2500"
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500" />
                </div>
              </div>
              {/* Auto-calculated total */}
              {saleForm.quantitySold && saleForm.pricePerUnit && (
                <div className="bg-emerald-50 rounded-lg p-3 flex justify-between items-center">
                  <span className="text-sm text-emerald-700 font-medium">Total Sale Value</span>
                  <span className="text-lg font-bold text-emerald-700">
                    {fmt(Number(saleForm.quantitySold) * Number(saleForm.pricePerUnit))}
                  </span>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-gray-500 font-medium block mb-1">Fish Species</label>
                  <input value={saleForm.fishSpecies}
                    onChange={e => setSaleForm(f => ({ ...f, fishSpecies: e.target.value }))}
                    placeholder="e.g. Koi, Goldfish"
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 font-medium block mb-1">Customer Name</label>
                  <input value={saleForm.customerName}
                    onChange={e => setSaleForm(f => ({ ...f, customerName: e.target.value }))}
                    placeholder="Optional"
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 font-medium block mb-1">Payment Method</label>
                  <select value={saleForm.paymentMethod}
                    onChange={e => setSaleForm(f => ({ ...f, paymentMethod: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500">
                    {['Cash', 'Bank Transfer', 'Check', 'Digital'].map(m => <option key={m}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 font-medium block mb-1">Payment Status</label>
                  <select value={saleForm.paymentStatus}
                    onChange={e => setSaleForm(f => ({ ...f, paymentStatus: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500">
                    {['Paid', 'Pending', 'Partial'].map(m => <option key={m}>{m}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-500 font-medium block mb-1">Notes</label>
                <textarea value={saleForm.notes}
                  onChange={e => setSaleForm(f => ({ ...f, notes: e.target.value }))}
                  rows={2} placeholder="Optional notes…"
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 resize-none" />
              </div>
            </div>
            <div className="flex justify-end gap-3 p-5 border-t">
              <button onClick={() => setShowSaleModal(false)}
                className="px-4 py-2 rounded-lg border text-sm text-gray-600 hover:bg-gray-50 transition">
                Cancel
              </button>
              <button onClick={saveSale}
                className="px-6 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold transition">
                {editingSale ? 'Update Sale' : 'Save Sale'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PondProfitLoss;
