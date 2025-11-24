import React, { useState, useEffect } from 'react';
import { pondApi, inventoryApi, stockTransactionApi } from '../services/api';

interface InventoryItem {
  id: number;
  name: string;
  category: string;
  currentStock: number;
  unit: string;
  reorderLevel: number;
  costPerUnit: number;
  lastRestocked: string;
  supplier?: string;
}

interface StockTransaction {
  id: number;
  itemId: number;
  type: 'add' | 'use';
  quantity: number;
  date: string;
  pondId?: number;
  notes?: string;
  unitCost?: number;
}

interface Pond {
  id: number;
  name: string;
  color: string;
}

const Inventory: React.FC = () => {
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [stockTransactions, setStockTransactions] = useState<StockTransaction[]>([]);
  const [ponds, setPonds] = useState<Pond[]>([]);
  
  // Load data from API on mount
  useEffect(() => {
    const loadData = async () => {
      await Promise.all([
        loadPonds(),
        loadInventoryItems(),
        loadStockTransactions(),
      ]);
    };
    loadData();
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

  const loadInventoryItems = async () => {
    try {
      const response = await inventoryApi.getAll();
      if (response.success && response.data) {
        setInventoryItems(response.data);
      }
    } catch (error) {
      console.error('Error loading inventory:', error);
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
      alert('Failed to load inventory: ' + errorMessage);
    }
  };

  const loadStockTransactions = async () => {
    try {
      const response = await stockTransactionApi.getAll();
      if (response.success && response.data) {
        // Transform backend data to match frontend interface
        const transactions: StockTransaction[] = response.data.map(t => ({
          id: t.id,
          itemId: t.item.id,
          type: t.type,
          quantity: t.quantity,
          date: t.date,
          pondId: t.pond?.id,
          notes: t.notes,
          unitCost: t.unitCost,
        }));
        setStockTransactions(transactions);
      }
    } catch (error) {
      console.error('Error loading transactions:', error);
    }
  };
  
  const [isStockModalOpen, setIsStockModalOpen] = useState(false);
  const [isAddItemModalOpen, setIsAddItemModalOpen] = useState(false);
  const [stockAction, setStockAction] = useState<'add' | 'use'>('add');
  const [selectedItem, setSelectedItem] = useState<number | ''>('');
  const [stockFormData, setStockFormData] = useState({
    quantity: '',
    pondId: '',
    notes: '',
    unitCost: '',
  });
  const [newItemFormData, setNewItemFormData] = useState({
    name: '',
    category: '',
    initialStock: '',
    unit: '',
    reorderLevel: '',
    costPerUnit: '',
    supplier: '',
  });

  const pondColors: Record<string, { bg: string; text: string; border: string }> = {
    blue: { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-300' },
    green: { bg: 'bg-green-100', text: 'text-green-700', border: 'border-green-300' },
    purple: { bg: 'bg-purple-100', text: 'text-purple-700', border: 'border-purple-300' },
    orange: { bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-300' },
    pink: { bg: 'bg-pink-100', text: 'text-pink-700', border: 'border-pink-300' },
    indigo: { bg: 'bg-indigo-100', text: 'text-indigo-700', border: 'border-indigo-300' },
    red: { bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-300' },
    yellow: { bg: 'bg-yellow-100', text: 'text-yellow-700', border: 'border-yellow-300' },
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-LK', {
      style: 'currency',
      currency: 'LKR',
    }).format(amount);
  };

  const openStockModal = (action: 'add' | 'use') => {
    setStockAction(action);
    setSelectedItem('');
    setStockFormData({
      quantity: '',
      pondId: '',
      notes: '',
      unitCost: '',
    });
    setIsStockModalOpen(true);
  };

  const handleStockTransaction = async () => {
    if (!selectedItem || !stockFormData.quantity) {
      alert('Please select an item and enter quantity');
      return;
    }

    const item = inventoryItems.find(i => i.id === selectedItem);
    if (!item) return;

    const quantity = parseFloat(stockFormData.quantity);

    if (stockAction === 'use' && quantity > item.currentStock) {
      alert(`Not enough stock! Available: ${item.currentStock} ${item.unit}`);
      return;
    }

    if (stockAction === 'use' && !stockFormData.pondId) {
      alert('Please select a pond for stock usage');
      return;
    }

    try {
      const response = await stockTransactionApi.create({
        itemId: selectedItem as number,
        type: stockAction,
        quantity,
        date: new Date().toISOString().split('T')[0],
        pondId: stockFormData.pondId ? parseInt(stockFormData.pondId) : undefined,
        notes: stockFormData.notes || undefined,
        unitCost: stockFormData.unitCost ? parseFloat(stockFormData.unitCost) : undefined,
      });

      if (response.success) {
        // Reload inventory and transactions
        await loadInventoryItems();
        await loadStockTransactions();
        setIsStockModalOpen(false);
        setSelectedItem('');
        setStockFormData({
          quantity: '',
          pondId: '',
          notes: '',
          unitCost: '',
        });
      } else {
        alert(response.message || 'Failed to create stock transaction');
      }
    } catch (error) {
      console.error('Error creating stock transaction:', error);
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
      alert('Failed to create stock transaction: ' + errorMessage);
    }
  };

  const handleAddNewItem = async () => {
    if (!newItemFormData.name || !newItemFormData.category || !newItemFormData.initialStock || !newItemFormData.unit) {
      alert('Please fill all required fields');
      return;
    }

    try {
      const response = await inventoryApi.create({
        name: newItemFormData.name,
        category: newItemFormData.category,
        currentStock: parseFloat(newItemFormData.initialStock),
        unit: newItemFormData.unit,
        reorderLevel: newItemFormData.reorderLevel ? parseFloat(newItemFormData.reorderLevel) : 0,
        costPerUnit: newItemFormData.costPerUnit ? parseFloat(newItemFormData.costPerUnit) : 0,
        lastRestocked: new Date().toISOString().split('T')[0],
        supplier: newItemFormData.supplier || undefined,
      });

      if (response.success) {
        // Reload inventory items
        await loadInventoryItems();
        setIsAddItemModalOpen(false);
        setNewItemFormData({
          name: '',
          category: '',
          initialStock: '',
          unit: '',
          reorderLevel: '',
          costPerUnit: '',
          supplier: '',
        });
      } else {
        alert(response.message || 'Failed to add inventory item');
      }
    } catch (error) {
      console.error('Error adding inventory item:', error);
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
      alert('Failed to add inventory item: ' + errorMessage);
    }
  };

  const getLowStockItems = () => {
    return inventoryItems.filter(item => item.currentStock <= item.reorderLevel);
  };

  const getTotalInventoryValue = () => {
    return inventoryItems.reduce((sum, item) => sum + (item.currentStock * item.costPerUnit), 0);
  };

  const handleDeleteItem = async (id: number, name: string) => {
    if (!window.confirm(`Are you sure you want to delete "${name}"? This action cannot be undone.`)) {
      return;
    }

    try {
      const response = await inventoryApi.delete(id);
      
      if (response.success) {
        // Reload inventory items
        await loadInventoryItems();
        alert('Inventory item deleted successfully');
      } else {
        alert(response.message || 'Failed to delete inventory item');
      }
    } catch (error) {
      console.error('Error deleting inventory item:', error);
      
      // Check if error has a response from the backend (Axios error)
      if (error && typeof error === 'object' && 'response' in error) {
        const axiosError = error as { response?: { data?: { message?: string } } };
        if (axiosError.response?.data?.message) {
          alert(axiosError.response.data.message);
          return;
        }
      }
      
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
      alert('Failed to delete inventory item: ' + errorMessage);
    }
  };

  const handleDeleteTransaction = async (id: number, itemName: string, type: string) => {
    if (!window.confirm(`Are you sure you want to delete this ${type} transaction for "${itemName}"? This will reverse the stock change.`)) {
      return;
    }

    try {
      const response = await stockTransactionApi.delete(id);
      
      if (response.success) {
        // Reload all data to reflect changes
        await loadInventoryItems();
        await loadStockTransactions();
        alert('Transaction deleted successfully. Stock has been adjusted.');
      } else {
        alert(response.message || 'Failed to delete transaction');
      }
    } catch (error) {
      console.error('Error deleting transaction:', error);
      
      // Check if error has a response from the backend (Axios error)
      if (error && typeof error === 'object' && 'response' in error) {
        const axiosError = error as { response?: { data?: { message?: string } } };
        if (axiosError.response?.data?.message) {
          alert(axiosError.response.data.message);
          return;
        }
      }
      
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
      alert('Failed to delete transaction: ' + errorMessage);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl shadow-lg p-8 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold mb-2 flex items-center gap-3">
              <span>📦</span> Inventory Management
            </h2>
            <p className="text-indigo-100">
              Track stock levels and manage inventory with POS-like system
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm text-indigo-200">Total Inventory Value</p>
            <p className="text-4xl font-bold">{formatCurrency(getTotalInventoryValue())}</p>
          </div>
        </div>
      </div>

      {/* Low Stock Alert */}
      {getLowStockItems().length > 0 && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-lg">
          <div className="flex items-center gap-3">
            <span className="text-2xl">⚠️</span>
            <div>
              <h3 className="font-semibold text-red-800">Low Stock Alert!</h3>
              <p className="text-sm text-red-700">
                {getLowStockItems().length} item(s) need reordering: {getLowStockItems().map(i => i.name).join(', ')}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center gap-4">
            <div className="bg-blue-100 text-blue-600 w-12 h-12 rounded-lg flex items-center justify-center text-2xl">
              📦
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Items</p>
              <p className="text-2xl font-bold text-gray-800">{inventoryItems.length}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center gap-4">
            <div className="bg-green-100 text-green-600 w-12 h-12 rounded-lg flex items-center justify-center text-2xl">
              ✅
            </div>
            <div>
              <p className="text-sm text-gray-600">In Stock</p>
              <p className="text-2xl font-bold text-gray-800">
                {inventoryItems.filter(i => i.currentStock > i.reorderLevel).length}
              </p>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center gap-4">
            <div className="bg-red-100 text-red-600 w-12 h-12 rounded-lg flex items-center justify-center text-2xl">
              ⚠️
            </div>
            <div>
              <p className="text-sm text-gray-600">Low Stock</p>
              <p className="text-2xl font-bold text-red-600">{getLowStockItems().length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-4">
        <button
          onClick={() => openStockModal('add')}
          className="flex-1 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white py-4 px-6 rounded-xl font-semibold shadow-lg transition-all flex items-center justify-center gap-2"
        >
          <i className="fas fa-plus-circle text-xl"></i>
          Add Stock
        </button>
        <button
          onClick={() => openStockModal('use')}
          className="flex-1 bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 text-white py-4 px-6 rounded-xl font-semibold shadow-lg transition-all flex items-center justify-center gap-2"
        >
          <i className="fas fa-minus-circle text-xl"></i>
          Use Stock
        </button>
        <button
          onClick={() => setIsAddItemModalOpen(true)}
          className="flex-1 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white py-4 px-6 rounded-xl font-semibold shadow-lg transition-all flex items-center justify-center gap-2"
        >
          <i className="fas fa-box text-xl"></i>
          New Item
        </button>
      </div>

      {/* Inventory Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-6 bg-gradient-to-r from-indigo-50 to-purple-50 border-b border-gray-200">
          <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <span>📋</span> Inventory Stock Levels
          </h3>
          <p className="text-sm text-gray-600 mt-1">Real-time stock tracking with low stock alerts</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b-2 border-gray-200">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Item</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Category</th>
                <th className="px-6 py-4 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">Current Stock</th>
                <th className="px-6 py-4 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">Reorder Level</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Cost/Unit</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Total Value</th>
                <th className="px-6 py-4 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Last Restocked</th>
                <th className="px-6 py-4 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {inventoryItems.map((item) => {
                const isLowStock = item.currentStock <= item.reorderLevel;
                const stockPercentage = (item.currentStock / (item.reorderLevel * 2)) * 100;

                return (
                  <tr key={item.id} className={`hover:bg-gray-50 transition-colors ${isLowStock ? 'bg-red-50' : ''}`}>
                    <td className="px-6 py-4">
                      <div>
                        <div className="font-semibold text-gray-800">{item.name}</div>
                        {item.supplier && (
                          <div className="text-xs text-gray-500">Supplier: {item.supplier}</div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                        item.category === 'Feed' ? 'bg-green-100 text-green-700' :
                        item.category === 'Chemical' ? 'bg-blue-100 text-blue-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {item.category}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="font-bold text-gray-800">{item.currentStock} {item.unit}</div>
                      <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                        <div
                          className={`h-2 rounded-full ${
                            stockPercentage > 50 ? 'bg-green-500' :
                            stockPercentage > 25 ? 'bg-yellow-500' :
                            'bg-red-500'
                          }`}
                          style={{ width: `${Math.min(stockPercentage, 100)}%` }}
                        ></div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center text-gray-600">
                      {item.reorderLevel} {item.unit}
                    </td>
                    <td className="px-6 py-4 text-gray-700 font-medium">
                      {formatCurrency(item.costPerUnit)}
                    </td>
                    <td className="px-6 py-4 text-gray-800 font-bold">
                      {formatCurrency(item.currentStock * item.costPerUnit)}
                    </td>
                    <td className="px-6 py-4 text-center">
                      {isLowStock ? (
                        <span className="inline-flex items-center gap-1 px-3 py-1 bg-red-100 text-red-700 rounded-full text-xs font-semibold">
                          <i className="fas fa-exclamation-triangle"></i>
                          Low Stock
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-semibold">
                          <i className="fas fa-check-circle"></i>
                          In Stock
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {new Date(item.lastRestocked).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <button
                        onClick={() => handleDeleteItem(item.id, item.name)}
                        className="text-red-600 hover:text-red-800 hover:bg-red-50 p-2 rounded-lg transition-colors"
                        title="Delete item"
                      >
                        <i className="fas fa-trash-alt"></i>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent Transactions */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-6 bg-gradient-to-r from-purple-50 to-pink-50 border-b border-gray-200">
          <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <span>🕒</span> Recent Stock Transactions
          </h3>
        </div>

        {stockTransactions.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <i className="fas fa-inbox text-4xl mb-3 opacity-50"></i>
            <p>No transactions yet. Add or use stock to see history.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b-2 border-gray-200">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase">Date</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase">Item</th>
                  <th className="px-6 py-4 text-center text-xs font-semibold text-gray-600 uppercase">Type</th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase">Quantity</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase">Pond</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase">Notes</th>
                  <th className="px-6 py-4 text-center text-xs font-semibold text-gray-600 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {stockTransactions.slice(0, 10).map((transaction) => {
                  const item = inventoryItems.find(i => i.id === transaction.itemId);
                  const pond = ponds.find(p => p.id === transaction.pondId);

                  return (
                    <tr key={transaction.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {new Date(transaction.date).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 font-medium text-gray-800">
                        {item?.name}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                          transaction.type === 'add' 
                            ? 'bg-green-100 text-green-700' 
                            : 'bg-orange-100 text-orange-700'
                        }`}>
                          {transaction.type === 'add' ? '+ Added' : '- Used'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right font-bold text-gray-800">
                        {transaction.quantity} {item?.unit}
                      </td>
                      <td className="px-6 py-4">
                        {pond && (
                          <span className={`px-3 py-1 rounded-full text-xs font-medium border ${pondColors[pond.color].bg} ${pondColors[pond.color].text} ${pondColors[pond.color].border}`}>
                            {pond.name}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {transaction.notes || '-'}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <button
                          onClick={() => handleDeleteTransaction(transaction.id, item?.name || 'Unknown', transaction.type)}
                          className="text-red-600 hover:text-red-800 hover:bg-red-50 p-2 rounded-lg transition-colors"
                          title="Delete transaction"
                        >
                          <i className="fas fa-trash-alt"></i>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Stock Transaction Modal (Add/Use Stock) */}
      {isStockModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full">
            <div className={`sticky top-0 bg-gradient-to-r ${stockAction === 'add' ? 'from-green-600 to-emerald-600' : 'from-orange-600 to-red-600'} text-white p-6 rounded-t-2xl`}>
              <div className="flex items-center justify-between">
                <h3 className="text-2xl font-bold flex items-center gap-2">
                  <i className={`fas ${stockAction === 'add' ? 'fa-plus-circle' : 'fa-minus-circle'}`}></i>
                  {stockAction === 'add' ? 'Add Stock' : 'Use Stock'}
                </h3>
                <button
                  onClick={() => setIsStockModalOpen(false)}
                  className="text-white hover:bg-white/20 rounded-lg p-2 transition-colors"
                >
                  <i className="fas fa-times text-xl"></i>
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              {/* Select Item */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Select Item *
                </label>
                <select
                  value={selectedItem}
                  onChange={(e) => setSelectedItem(e.target.value ? parseInt(e.target.value) : '')}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition"
                  required
                >
                  <option value="">Choose an item...</option>
                  {inventoryItems.map(item => (
                    <option key={item.id} value={item.id}>
                      {item.name} (Current: {item.currentStock} {item.unit})
                    </option>
                  ))}
                </select>
              </div>

              {/* Quantity */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Quantity *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={stockFormData.quantity}
                  onChange={(e) => setStockFormData({ ...stockFormData, quantity: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition"
                  placeholder="Enter quantity"
                  required
                />
              </div>

              {/* Unit Cost (only for adding stock) */}
              {stockAction === 'add' && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Unit Cost (LKR)
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-500 font-bold">
                      Rs
                    </span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={stockFormData.unitCost}
                      onChange={(e) => setStockFormData({ ...stockFormData, unitCost: e.target.value })}
                      className="w-full pl-12 pr-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition"
                      placeholder="Leave blank to use default cost"
                    />
                  </div>
                </div>
              )}

              {/* Pond Selection (required for usage) */}
              {stockAction === 'use' && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Pond * (Where is this being used?)
                  </label>
                  <select
                    value={stockFormData.pondId}
                    onChange={(e) => setStockFormData({ ...stockFormData, pondId: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition"
                    required
                  >
                    <option value="">Select pond...</option>
                    {ponds.map(pond => (
                      <option key={pond.id} value={pond.id}>{pond.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Pond Selection (optional for adding) */}
              {stockAction === 'add' && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Pond (Optional - for tracking)
                  </label>
                  <select
                    value={stockFormData.pondId}
                    onChange={(e) => setStockFormData({ ...stockFormData, pondId: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition"
                  >
                    <option value="">General purchase (not pond-specific)</option>
                    {ponds.map(pond => (
                      <option key={pond.id} value={pond.id}>{pond.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Notes */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Notes (Optional)
                </label>
                <textarea
                  value={stockFormData.notes}
                  onChange={(e) => setStockFormData({ ...stockFormData, notes: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition resize-none"
                  placeholder="Additional notes..."
                  rows={3}
                />
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4">
                <button
                  onClick={handleStockTransaction}
                  className={`flex-1 bg-gradient-to-r ${stockAction === 'add' ? 'from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700' : 'from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700'} text-white py-3 rounded-lg font-semibold shadow-lg transition-all duration-200 flex items-center justify-center gap-2`}
                >
                  <i className="fas fa-check"></i>
                  {stockAction === 'add' ? 'Add to Stock' : 'Record Usage'}
                </button>
                <button
                  onClick={() => setIsStockModalOpen(false)}
                  className="px-6 py-3 border-2 border-gray-300 hover:bg-gray-50 text-gray-700 rounded-lg font-semibold transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add New Item Modal */}
      {isAddItemModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-cyan-600 text-white p-6 rounded-t-2xl">
              <div className="flex items-center justify-between">
                <h3 className="text-2xl font-bold flex items-center gap-2">
                  <i className="fas fa-box"></i>
                  Add New Inventory Item
                </h3>
                <button
                  onClick={() => setIsAddItemModalOpen(false)}
                  className="text-white hover:bg-white/20 rounded-lg p-2 transition-colors"
                >
                  <i className="fas fa-times text-xl"></i>
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                {/* Item Name */}
                <div className="col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Item Name *
                  </label>
                  <input
                    type="text"
                    value={newItemFormData.name}
                    onChange={(e) => setNewItemFormData({ ...newItemFormData, name: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                    placeholder="e.g., Water Filter, Fish Feed"
                    required
                  />
                </div>

                {/* Category */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Category *
                  </label>
                  <select
                    value={newItemFormData.category}
                    onChange={(e) => setNewItemFormData({ ...newItemFormData, category: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                    required
                  >
                    <option value="">Select category...</option>
                    <option value="Equipment">Equipment</option>
                    <option value="Feed">Feed</option>
                    <option value="Chemical">Chemical</option>
                    <option value="Medicine">Medicine</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                {/* Unit */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Unit *
                  </label>
                  <select
                    value={newItemFormData.unit}
                    onChange={(e) => setNewItemFormData({ ...newItemFormData, unit: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                    required
                  >
                    <option value="">Select unit...</option>
                    <option value="pieces">Pieces</option>
                    <option value="kg">Kilograms (kg)</option>
                    <option value="liters">Liters</option>
                    <option value="tablets">Tablets</option>
                    <option value="boxes">Boxes</option>
                    <option value="bags">Bags</option>
                  </select>
                </div>

                {/* Initial Stock */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Initial Stock Quantity *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={newItemFormData.initialStock}
                    onChange={(e) => setNewItemFormData({ ...newItemFormData, initialStock: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                    placeholder="0"
                    required
                  />
                </div>

                {/* Reorder Level */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Reorder Level (Alert Threshold)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={newItemFormData.reorderLevel}
                    onChange={(e) => setNewItemFormData({ ...newItemFormData, reorderLevel: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                    placeholder="Minimum stock level"
                  />
                </div>

                {/* Cost Per Unit */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Cost Per Unit (LKR)
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-500 font-bold">
                      Rs
                    </span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={newItemFormData.costPerUnit}
                      onChange={(e) => setNewItemFormData({ ...newItemFormData, costPerUnit: e.target.value })}
                      className="w-full pl-12 pr-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                      placeholder="0.00"
                    />
                  </div>
                </div>

                {/* Supplier */}
                <div className="col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Supplier (Optional)
                  </label>
                  <input
                    type="text"
                    value={newItemFormData.supplier}
                    onChange={(e) => setNewItemFormData({ ...newItemFormData, supplier: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                    placeholder="e.g., Aqua Supplies Ltd"
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4">
                <button
                  onClick={handleAddNewItem}
                  className="flex-1 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white py-3 rounded-lg font-semibold shadow-lg transition-all duration-200 flex items-center justify-center gap-2"
                >
                  <i className="fas fa-check"></i>
                  Add Item
                </button>
                <button
                  onClick={() => setIsAddItemModalOpen(false)}
                  className="px-6 py-3 border-2 border-gray-300 hover:bg-gray-50 text-gray-700 rounded-lg font-semibold transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Inventory;
