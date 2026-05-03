import React, { useState, useEffect } from 'react';
import { pondApi, revenueApi, fishCountApi, type Revenue, type Pond, type FishCount } from '../services/api';

const ProfitLoss: React.FC = () => {
  const [ponds, setPonds] = useState<Pond[]>([]);
  const [revenues, setRevenues] = useState<Revenue[]>([]);
  const [fishCounts, setFishCounts] = useState<FishCount[]>([]);
  const [selectedPond, setSelectedPond] = useState<number | 'all'>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingRevenue, setEditingRevenue] = useState<Revenue | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState<number | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  

  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    pondId: '',
    source: 'Fish Sales',
    quantitySold: '',
    pricePerUnit: '',
    fishSpecies: '',
    customerName: '',
    notes: '',
    paymentMethod: 'Cash',
    paymentStatus: 'Paid',
  });

  const revenueSources = [
    { value: 'Fish Sales', icon: '🐟', color: 'emerald' },
    { value: 'Consulting', icon: '💼', color: 'blue' },
    { value: 'Tours', icon: '🎫', color: 'purple' },
    { value: 'Other', icon: '📋', color: 'gray' },
  ];

  const paymentMethods = ['Cash', 'Bank Transfer', 'Check', 'Digital'];
  const paymentStatuses = ['Paid', 'Pending', 'Partial'];

  useEffect(() => {
    loadPonds();
    loadRevenues();
    loadFishCounts();
  }, []);

  const loadPonds = async () => {
    try {
      const response = await pondApi.getAll();
      if (response.success && response.data) {
        setPonds(response.data);
      }
    } catch (error) {
      console.error('Error loading ponds:', error);
    }
  };

  const loadRevenues = async () => {
    try {
      const response = await revenueApi.getAll();
      if (response.success && response.data) {
        setRevenues(response.data);
      }
    } catch (error) {
      console.error('Error loading revenues:', error);
      alert('Failed to load revenues');
    }
  };

  const loadFishCounts = async () => {
    try {
      const response = await fishCountApi.getAll();
      if (response.success && response.data) {
        setFishCounts(response.data);
      }
    } catch (error) {
      console.error('Error loading fish counts:', error);
    }
  };

  const getLatestFishCount = (pondId: number): number => {
    const pondCounts = fishCounts
      .filter(fc => fc.pond.id === pondId)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    
    return pondCounts.length > 0 ? pondCounts[0].count : 0;
  };

  const getMaxSellableQuantity = (pondId: number): number => {
    if (!pondId) return 0;
    return getLatestFishCount(pondId);
  };

  const handleAddRevenue = async () => {
    if (isLoading) return;
    
    if (!formData.date || !formData.pondId || !formData.quantitySold || !formData.pricePerUnit) {
      alert('Please fill in all required fields');
      return;
    }

    const pondId = parseInt(formData.pondId);
    const quantitySold = parseFloat(formData.quantitySold);

    // Block revenue for closed ponds
    const pondForRev = ponds.find(p => p.id === pondId);
    if (pondForRev?.status === 'CLOSED') {
      alert('Cannot add revenue to a closed pond.');
      return;
    }

    const maxSellable = getMaxSellableQuantity(pondId);

    if (quantitySold > maxSellable) {
      alert(`Cannot sell ${quantitySold} fish. Only ${maxSellable} fish available in this pond.`);
      return;
    }

    const calculatedAmount = quantitySold * parseFloat(formData.pricePerUnit);

    setIsLoading(true);
    try {
      const response = await revenueApi.create({
        date: formData.date,
        pondId: parseInt(formData.pondId),
        source: formData.source,
        amount: calculatedAmount,
        quantitySold: formData.quantitySold ? parseInt(formData.quantitySold) : undefined,
        pricePerUnit: formData.pricePerUnit ? parseFloat(formData.pricePerUnit) : undefined,
        fishSpecies: formData.fishSpecies || undefined,
        customerName: formData.customerName || undefined,
        notes: formData.notes || undefined,
        paymentMethod: formData.paymentMethod,
        paymentStatus: formData.paymentStatus,
      });

      if (response.success) {
        await loadRevenues();
        setIsModalOpen(false);
        setFormData({
          date: new Date().toISOString().split('T')[0],
          pondId: '',
          source: 'Fish Sales',
          quantitySold: '',
          pricePerUnit: '',
          fishSpecies: '',
          customerName: '',
          notes: '',
          paymentMethod: 'Cash',
          paymentStatus: 'Paid',
        });
      }
    } catch (error) {
      console.error('Error creating revenue:', error);
      alert('Failed to create revenue');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditRevenue = (revenue: Revenue) => {
    setEditingRevenue(revenue);
    setIsEditModalOpen(true);
  };

  const handleUpdatePaymentStatus = async (newStatus: string) => {
    if (!editingRevenue || isUpdating) return;

    setIsUpdating(true);
    try {
      const response = await revenueApi.update(editingRevenue.id, {
        date: editingRevenue.date,
        pondId: editingRevenue.pond.id,
        source: editingRevenue.source,
        amount: editingRevenue.amount,
        quantitySold: editingRevenue.quantitySold,
        pricePerUnit: editingRevenue.pricePerUnit,
        fishSpecies: editingRevenue.fishSpecies,
        customerName: editingRevenue.customerName,
        notes: editingRevenue.notes,
        paymentMethod: editingRevenue.paymentMethod,
        paymentStatus: newStatus,
      });

      if (response.success) {
        await loadRevenues();
        setIsEditModalOpen(false);
        setEditingRevenue(null);
      }
    } catch (error) {
      console.error('Error updating payment status:', error);
      alert('Failed to update payment status');
    } finally {
      setIsUpdating(false);
    }
  };

  

  const handleDeleteRevenue = async (id: number) => {
    if (isDeleting) return;
    
    if (!window.confirm('Are you sure you want to delete this revenue?')) {
      return;
    }

    setIsDeleting(id);
    try {
      const response = await revenueApi.delete(id);
      if (response.success) {
        await loadRevenues();
      }
    } catch (error) {
      console.error('Error deleting revenue:', error);
      alert('Failed to delete revenue');
    } finally {
      setIsDeleting(null);
    }
  };

  const getFilteredRevenues = () => {
    if (selectedPond === 'all') {
      return revenues;
    }
    return revenues.filter(rev => rev.pond.id === selectedPond);
  };

  const getTotalRevenue = () => {
    return getFilteredRevenues().reduce((sum, rev) => sum + rev.amount, 0);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-LK', {
      style: 'currency',
      currency: 'LKR',
    }).format(amount);
  };

  const getSourceColor = (source: string) => {
    const sourceData = revenueSources.find(s => s.value === source);
    return sourceData ? sourceData.color : 'gray';
  };

  const getColorClasses = (color: string) => {
    const colors: Record<string, { bg: string; text: string }> = {
      emerald: { bg: 'bg-emerald-50', text: 'text-emerald-600' },
      blue: { bg: 'bg-blue-50', text: 'text-blue-600' },
      purple: { bg: 'bg-purple-50', text: 'text-purple-600' },
      gray: { bg: 'bg-gray-50', text: 'text-gray-600' },
    };
    return colors[color] || colors.gray;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 p-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-3 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl shadow-lg">
            <i className="fas fa-chart-line text-white text-2xl"></i>
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-800">Profit & Loss Statement</h1>
            <p className="text-gray-600">Track revenue and analyze profitability</p>
          </div>
        </div>
      </div>


      {/* Pond Filter */}
      <div className="bg-white rounded-xl shadow-md p-6 mb-6">
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          <i className="fas fa-filter mr-2"></i>Filter by Pond
        </label>
        <select
          value={selectedPond}
          onChange={(e) => setSelectedPond(e.target.value === 'all' ? 'all' : parseInt(e.target.value))}
          className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
        >
          <option value="all">All Ponds</option>
          {ponds.map((pond) => (
            <option key={pond.id} value={pond.id}>
              {pond.name}
            </option>
          ))}
        </select>
      </div>

      {/* Revenue Management */}

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <div className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl shadow-lg p-6 text-white">
              <div className="flex items-center justify-between mb-2">
                <span className="text-green-100">Total Revenue</span>
                <i className="fas fa-money-bill-wave text-2xl"></i>
              </div>
              <p className="text-3xl font-bold">{formatCurrency(getTotalRevenue())}</p>
            </div>

            <div className="bg-gradient-to-br from-blue-500 to-cyan-600 rounded-xl shadow-lg p-6 text-white">
              <div className="flex items-center justify-between mb-2">
                <span className="text-blue-100">Total Transactions</span>
                <i className="fas fa-receipt text-2xl"></i>
              </div>
              <p className="text-3xl font-bold">{getFilteredRevenues().length}</p>
            </div>

            <div className="bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl shadow-lg p-6 text-white">
              <div className="flex items-center justify-between mb-2">
                <span className="text-purple-100">Avg Per Transaction</span>
                <i className="fas fa-chart-bar text-2xl"></i>
              </div>
              <p className="text-3xl font-bold">
                {formatCurrency(getFilteredRevenues().length > 0 ? getTotalRevenue() / getFilteredRevenues().length : 0)}
              </p>
            </div>
          </div>

          {/* Add Revenue Button */}
          <div className="mb-6">
            <button
              onClick={() => setIsModalOpen(true)}
              className="bg-gradient-to-r from-green-500 to-emerald-600 text-white px-6 py-3 rounded-lg hover:from-green-600 hover:to-emerald-700 transition-all shadow-lg hover:shadow-xl flex items-center gap-2"
            >
              <i className="fas fa-plus"></i>
              Add Revenue
            </button>
          </div>

          {/* Revenue Table */}
          <div className="bg-white rounded-xl shadow-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gradient-to-r from-gray-50 to-gray-100">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase">Date</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase">Pond</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase">Source</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase">Details</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase">Payment</th>
                    <th className="px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase">Amount</th>
                    <th className="px-6 py-4 text-center text-xs font-semibold text-gray-600 uppercase">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {getFilteredRevenues().map((revenue) => {
                    const colorClasses = getColorClasses(getSourceColor(revenue.source));
                    return (
                      <tr key={revenue.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {new Date(revenue.date).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-800">
                          {revenue.pond.name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-3 py-1 rounded-full text-xs font-medium ${colorClasses.bg} ${colorClasses.text}`}>
                            {revenue.source}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          {revenue.quantitySold && revenue.fishSpecies && (
                            <div>{revenue.quantitySold} {revenue.fishSpecies}</div>
                          )}
                          {revenue.customerName && <div className="text-xs text-gray-500">{revenue.customerName}</div>}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          <div>{revenue.paymentMethod}</div>
                          <div className="text-xs">
                            <span className={`${revenue.paymentStatus === 'Paid' ? 'text-green-600' : 'text-orange-600'}`}>
                              {revenue.paymentStatus}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-bold text-green-600">
                          {formatCurrency(revenue.amount)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <button
                            onClick={() => handleEditRevenue(revenue)}
                            disabled={isDeleting !== null}
                            className="text-blue-600 hover:text-blue-800 hover:bg-blue-50 p-2 rounded-lg transition-colors mr-2 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <i className="fas fa-edit"></i>
                          </button>
                          <button
                            onClick={() => handleDeleteRevenue(revenue.id)}
                            disabled={isDeleting !== null}
                            className="text-red-600 hover:text-red-800 hover:bg-red-50 p-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {isDeleting === revenue.id ? (
                              <i className="fas fa-spinner fa-spin"></i>
                            ) : (
                              <i className="fas fa-trash"></i>
                            )}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

      {/* Add Revenue Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="bg-gradient-to-r from-green-500 to-emerald-600 p-6 rounded-t-2xl">
              <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                <i className="fas fa-dollar-sign"></i>
                Add Revenue
              </h2>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Pond <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.pondId}
                    onChange={(e) => setFormData({ ...formData, pondId: e.target.value })}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                  >
                    <option value="">Select Pond</option>
                    {ponds.filter((pond) => pond.status !== 'CLOSED').map((pond) => (
                      <option key={pond.id} value={pond.id}>
                        {pond.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Quantity Sold <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    value={formData.quantitySold}
                    onChange={(e) => setFormData({ ...formData, quantitySold: e.target.value })}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                    placeholder="e.g., 10"
                    max={formData.pondId ? getMaxSellableQuantity(parseInt(formData.pondId)) : undefined}
                  />
                  {formData.pondId && (
                    <p className="text-xs text-gray-500 mt-1">
                      Max available: <span className="font-semibold text-blue-600">{getMaxSellableQuantity(parseInt(formData.pondId))}</span> fish
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Price Per Unit (LKR) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.pricePerUnit}
                    onChange={(e) => setFormData({ ...formData, pricePerUnit: e.target.value })}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Total Amount (LKR)
                  </label>
                  <div className="w-full p-3 border border-gray-300 rounded-lg bg-gray-50 font-bold text-green-600 flex items-center">
                    {formData.quantitySold && formData.pricePerUnit
                      ? formatCurrency(parseFloat(formData.quantitySold) * parseFloat(formData.pricePerUnit))
                      : formatCurrency(0)}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Fish Species</label>
                <input
                  type="text"
                  value={formData.fishSpecies}
                  onChange={(e) => setFormData({ ...formData, fishSpecies: e.target.value })}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                  placeholder="e.g., Koi, Goldfish, etc."
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Customer Name</label>
                <input
                  type="text"
                  value={formData.customerName}
                  onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Payment Method</label>
                  <select
                    value={formData.paymentMethod}
                    onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value })}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                  >
                    {paymentMethods.map((method) => (
                      <option key={method} value={method}>
                        {method}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Payment Status</label>
                  <select
                    value={formData.paymentStatus}
                    onChange={(e) => setFormData({ ...formData, paymentStatus: e.target.value })}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                  >
                    {paymentStatuses.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                  rows={3}
                ></textarea>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={handleAddRevenue}
                  disabled={isLoading}
                  className="flex-1 bg-gradient-to-r from-green-500 to-emerald-600 text-white py-3 rounded-lg hover:from-green-600 hover:to-emerald-700 transition-all font-semibold shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? (
                    <>
                      <i className="fas fa-spinner fa-spin mr-2"></i>
                      Saving...
                    </>
                  ) : (
                    <>
                      <i className="fas fa-check mr-2"></i>
                      Save Revenue
                    </>
                  )}
                </button>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 bg-gray-100 text-gray-700 py-3 rounded-lg hover:bg-gray-200 transition-all font-semibold"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Payment Status Modal */}
      {isEditModalOpen && editingRevenue && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-6 border-b pb-4">
              <h3 className="text-2xl font-bold text-gray-800 flex items-center">
                <i className="fas fa-edit mr-3 text-blue-500"></i>
                Update Payment Status
              </h3>
              <button
                onClick={() => {
                  setIsEditModalOpen(false);
                  setEditingRevenue(null);
                }}
                className="text-gray-500 hover:text-gray-700 text-2xl"
              >
                ×
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Revenue Details</label>
                <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Date:</span>
                    <span className="font-medium">{new Date(editingRevenue.date).toLocaleDateString()}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Pond:</span>
                    <span className="font-medium">{editingRevenue.pond.name}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Source:</span>
                    <span className="font-medium">{editingRevenue.source}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Amount:</span>
                    <span className="font-bold text-green-600">{formatCurrency(editingRevenue.amount)}</span>
                  </div>
                  {editingRevenue.customerName && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Customer:</span>
                      <span className="font-medium">{editingRevenue.customerName}</span>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Current Payment Status</label>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-sm text-gray-600">Payment Method:</span>
                  <span className="font-medium">{editingRevenue.paymentMethod}</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Update Payment Status</label>
                <div className="space-y-2">
                  {paymentStatuses.map((status) => (
                    <button
                      key={status}
                      onClick={() => handleUpdatePaymentStatus(status)}
                      disabled={isUpdating}
                      className={`w-full p-4 rounded-lg border-2 text-left font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                        editingRevenue.paymentStatus === status
                          ? 'border-green-500 bg-green-50 text-green-700'
                          : 'border-gray-200 hover:border-blue-400 hover:bg-blue-50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-semibold">{status}</div>
                          <div className="text-xs text-gray-500 mt-1">
                            {status === 'Paid' && 'Payment has been received in full'}
                            {status === 'Pending' && 'Awaiting payment'}
                            {status === 'Partial' && 'Partial payment received'}
                          </div>
                        </div>
                        {isUpdating ? (
                          <i className="fas fa-spinner fa-spin text-blue-500 text-xl"></i>
                        ) : editingRevenue.paymentStatus === status ? (
                          <i className="fas fa-check-circle text-green-500 text-xl"></i>
                        ) : null}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => {
                    setIsEditModalOpen(false);
                    setEditingRevenue(null);
                  }}
                  className="flex-1 bg-gray-100 text-gray-700 py-3 rounded-lg hover:bg-gray-200 transition-all font-semibold"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProfitLoss;
