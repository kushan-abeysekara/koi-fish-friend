import React, { useState, useEffect, useCallback } from 'react';
import { pondApi, expenditureApi, sensorDataApi } from '../services/api';
import type { SensorData } from '../services/api';

interface Expenditure {
  id: number;
  date: string;
  category: string;
  subcategory: string;
  description: string;
  amount: number;
  pondId?: number;
  pond?: {
    id: number;
    name: string;
    color: string;
  };
}

interface Pond {
  id: number;
  name: string;
  color: string;
}

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

const Expenditures: React.FC = () => {
  const [expenditures, setExpenditures] = useState<Expenditure[]>([]);
  const [ponds, setPonds] = useState<Pond[]>([]);
  const [sensorData, setSensorData] = useState<Record<number, SensorData | null>>({});

  const loadPonds = async () => {
    try {
      const response = await pondApi.getAll();
      if (response.success && response.data) {
        setPonds(response.data);
      }
    } catch (error) {
      console.error('Error loading ponds:', error);
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
      alert('Failed to load ponds: ' + errorMessage);
    }
  };

  const loadExpenditures = async () => {
    try {
      const response = await expenditureApi.getAll();
      if (response.success && response.data) {
        // Transform API response to match local interface
        const transformedData = response.data.map((exp) => ({
          id: exp.id,
          date: exp.date,
          category: exp.category,
          subcategory: exp.subcategory,
          description: exp.description || '',
          amount: exp.amount,
          pondId: exp.pond?.id || 0,
          pond: exp.pond,
        }));
        setExpenditures(transformedData);
      }
    } catch (error) {
      console.error('Error loading expenditures:', error);
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
      alert('Failed to load expenditures: ' + errorMessage);
    }
  };

  const loadSensorData = useCallback(async () => {
    const newSensorData: Record<number, SensorData | null> = {};
    
    for (const pond of ponds) {
      try {
        const response = await sensorDataApi.getLatestEnergyByPond(pond.id);
        if (response.success && response.data) {
          newSensorData[pond.id] = response.data;
        } else {
          newSensorData[pond.id] = null;
        }
      } catch (error) {
        console.error(`Error loading sensor data for pond ${pond.id}:`, error);
        newSensorData[pond.id] = null;
      }
    }
    
    setSensorData(newSensorData);
  }, [ponds]);

  // Load ponds and expenditures from API on mount
  useEffect(() => {
    loadPonds();
    loadExpenditures();
  }, []);

  // Load sensor data for all ponds
  useEffect(() => {
    if (ponds.length > 0) {
      loadSensorData();
    }
  }, [ponds, loadSensorData]);
  
  // Inventory Management State
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([
    { id: 1, name: 'Water Filter', category: 'Equipment', currentStock: 15, unit: 'pieces', reorderLevel: 5, costPerUnit: 2500, lastRestocked: '2024-11-20', supplier: 'Aqua Supplies Ltd' },
    { id: 2, name: 'Fish Feed (Premium)', category: 'Feed', currentStock: 50, unit: 'kg', reorderLevel: 20, costPerUnit: 350, lastRestocked: '2024-11-22', supplier: 'Koi Feed Co' },
    { id: 3, name: 'pH Stabilizer', category: 'Chemical', currentStock: 8, unit: 'liters', reorderLevel: 10, costPerUnit: 1200, lastRestocked: '2024-11-15', supplier: 'Aqua Supplies Ltd' },
    { id: 4, name: 'Oxygen Tablets', category: 'Chemical', currentStock: 100, unit: 'tablets', reorderLevel: 50, costPerUnit: 15, lastRestocked: '2024-11-18', supplier: 'Fish Health Pro' },
    { id: 5, name: 'Net (Large)', category: 'Equipment', currentStock: 3, unit: 'pieces', reorderLevel: 2, costPerUnit: 1800, lastRestocked: '2024-11-10', supplier: 'Aqua Tools' },
  ]);
  const [stockTransactions, setStockTransactions] = useState<StockTransaction[]>([]);
  const [activeTab, setActiveTab] = useState<'expenditures' | 'inventory'>('expenditures');
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
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPondModalOpen, setIsPondModalOpen] = useState(false);
  const [isDeletePondModalOpen, setIsDeletePondModalOpen] = useState(false);
  const [pondToDelete, setPondToDelete] = useState<Pond | null>(null);
  const [deleteConfirmationText, setDeleteConfirmationText] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedPond, setSelectedPond] = useState<number | 'all'>('all');
  const [newPondName, setNewPondName] = useState('');
  const [newPondColor, setNewPondColor] = useState('blue');
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    subcategory: '',
    description: '',
    amount: '',
    pondId: '',
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

  // Categories for manual entry (shown in Add Expenditure modal)
  const categories = {
    'Maintenance and Repairs': {
      icon: '🔧',
      color: 'amber',
      subcategories: [
        'Equipment repair (pumps, motors, feeders, sensors)',
        'Plumbing repairs',
        'Electrical repairs',
        'Pond cleaning and desilting',
        'Boat or floating device repairs',
        'Building/structure maintenance',
      ],
    },
    'Fish Stocking': {
      icon: '🐠',
      color: 'cyan',
      subcategories: [
        'Purchase of fingerlings or juvenile fish',
        'Koi breeding stock',
        'Fish transportation',
      ],
    },
    'Infrastructure': {
      icon: '🏗️',
      color: 'purple',
      subcategories: [
        'Pond construction or renovation',
        'Equipment installation',
        'New infrastructure development',
        'Land improvement',
      ],
    },
  };

  // All categories for display purposes (includes inventory purchases)
  const allCategories = {
    ...categories,
    'Inventory Purchases': {
      icon: '📦',
      color: 'emerald',
      subcategories: ['Equipment', 'Feed', 'Chemical', 'Medicine', 'Other'],
    },
  };

  const getColorClasses = (color: string) => {
    const colors: Record<string, { bg: string; text: string; border: string; hover: string }> = {
      emerald: { bg: 'bg-emerald-50', text: 'text-emerald-600', border: 'border-emerald-200', hover: 'hover:bg-emerald-100' },
      blue: { bg: 'bg-blue-50', text: 'text-blue-600', border: 'border-blue-200', hover: 'hover:bg-blue-100' },
      cyan: { bg: 'bg-cyan-50', text: 'text-cyan-600', border: 'border-cyan-200', hover: 'hover:bg-cyan-100' },
      amber: { bg: 'bg-amber-50', text: 'text-amber-600', border: 'border-amber-200', hover: 'hover:bg-amber-100' },
      purple: { bg: 'bg-purple-50', text: 'text-purple-600', border: 'border-purple-200', hover: 'hover:bg-purple-100' },
      indigo: { bg: 'bg-indigo-50', text: 'text-indigo-600', border: 'border-indigo-200', hover: 'hover:bg-indigo-100' },
      gray: { bg: 'bg-gray-50', text: 'text-gray-600', border: 'border-gray-200', hover: 'hover:bg-gray-100' },
    };
    return colors[color] || colors.emerald;
  };

  const handleAddPond = async () => {
    if (!newPondName.trim()) {
      alert('Please enter a pond name');
      return;
    }

    try {
      const response = await pondApi.create({
        name: newPondName.trim(),
        color: newPondColor,
      });

      if (response.success) {
        // Reload ponds from database
        await loadPonds();
        setIsPondModalOpen(false);
        setNewPondName('');
        setNewPondColor('blue');
      } else {
        alert(response.message || 'Failed to create pond');
      }
    } catch (error) {
      console.error('Error creating pond:', error);
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
      alert('Failed to create pond: ' + errorMessage);
    }
  };

  const openDeletePondModal = (pond: Pond) => {
    const hasExpenditures = expenditures.some(exp => exp.pondId === pond.id);
    if (hasExpenditures) {
      alert('Cannot delete pond with existing expenditures. Please delete associated expenditures first.');
      return;
    }
    setPondToDelete(pond);
    setDeleteConfirmationText('');
    setIsDeletePondModalOpen(true);
  };

  const handleDeletePond = async () => {
    if (!pondToDelete) return;

    if (deleteConfirmationText === pondToDelete.name) {
      try {
        const response = await pondApi.delete(pondToDelete.id);
        
        if (response.success) {
          // Reload ponds from database
          await loadPonds();
          if (selectedPond === pondToDelete.id) {
            setSelectedPond('all');
          }
          setIsDeletePondModalOpen(false);
          setPondToDelete(null);
          setDeleteConfirmationText('');
        } else {
          alert(response.message || 'Failed to delete pond');
        }
      } catch (error) {
        console.error('Error deleting pond:', error);
        const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
        alert('Failed to delete pond: ' + errorMessage);
      }
    } else {
      alert('Pond name does not match. Please type the exact pond name to confirm deletion.');
    }
  };

  const openModal = () => {
    setSelectedCategory('');
    setFormData({
      date: new Date().toISOString().split('T')[0],
      subcategory: '',
      description: '',
      amount: '',
      pondId: selectedPond === 'all' ? '' : selectedPond.toString(),
    });
    setIsModalOpen(true);
  };

  const handleAddExpenditure = async () => {
    if (!selectedCategory || !formData.subcategory || !formData.amount || !formData.pondId) {
      alert('Please fill all required fields including pond selection');
      return;
    }

    try {
      const response = await expenditureApi.create({
        date: formData.date,
        category: selectedCategory,
        subcategory: formData.subcategory,
        description: formData.description,
        amount: parseFloat(formData.amount),
        pondId: parseInt(formData.pondId),
      });

      if (response.success) {
        // Reload expenditures from database
        await loadExpenditures();
        setIsModalOpen(false);
        setSelectedCategory('');
        setFormData({
          date: new Date().toISOString().split('T')[0],
          subcategory: '',
          description: '',
          amount: '',
          pondId: '',
        });
      } else {
        alert(response.message || 'Failed to create expenditure');
      }
    } catch (error) {
      console.error('Error creating expenditure:', error);
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
      alert('Failed to create expenditure: ' + errorMessage);
    }
  };

  const handleDeleteExpenditure = async (id: number) => {
    if (window.confirm('Are you sure you want to delete this expenditure?')) {
      try {
        const response = await expenditureApi.delete(id);
        if (response.success) {
          // Reload expenditures from database
          await loadExpenditures();
        } else {
          alert(response.message || 'Failed to delete expenditure');
        }
      } catch (error) {
        console.error('Error deleting expenditure:', error);
        const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
        alert('Failed to delete expenditure: ' + errorMessage);
      }
    }
  };

  const getFilteredExpenditures = () => {
    if (selectedPond === 'all') {
      return expenditures;
    }
    return expenditures.filter(exp => exp.pondId === selectedPond);
  };

  const getTotalByCategory = (category: string) => {
    return getFilteredExpenditures()
      .filter(exp => exp.category === category)
      .reduce((sum, exp) => sum + exp.amount, 0);
  };

  const getTotalByPond = (pondId: number) => {
    return expenditures
      .filter(exp => exp.pondId === pondId)
      .reduce((sum, exp) => sum + exp.amount, 0);
  };

  const getTotalExpenditure = () => {
    return getFilteredExpenditures().reduce((sum, exp) => sum + exp.amount, 0);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-LK', {
      style: 'currency',
      currency: 'LKR',
    }).format(amount);
  };

  // Inventory Management Functions
  const openStockModal = (action: 'add' | 'use') => {
    setStockAction(action);
    setSelectedItem('');
    setStockFormData({
      quantity: '',
      pondId: selectedPond === 'all' ? '' : String(selectedPond),
      notes: '',
      unitCost: '',
    });
    setIsStockModalOpen(true);
  };

  const handleStockTransaction = () => {
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

    // Create transaction record
    const transaction: StockTransaction = {
      id: Date.now(),
      itemId: selectedItem as number,
      type: stockAction,
      quantity,
      date: new Date().toISOString().split('T')[0],
      pondId: stockFormData.pondId ? parseInt(stockFormData.pondId) : undefined,
      notes: stockFormData.notes || undefined,
      unitCost: stockFormData.unitCost ? parseFloat(stockFormData.unitCost) : item.costPerUnit,
    };

    setStockTransactions([transaction, ...stockTransactions]);

    // Update inventory
    setInventoryItems(inventoryItems.map(i => {
      if (i.id === selectedItem) {
        return {
          ...i,
          currentStock: stockAction === 'add' 
            ? i.currentStock + quantity 
            : i.currentStock - quantity,
          lastRestocked: stockAction === 'add' 
            ? new Date().toISOString().split('T')[0] 
            : i.lastRestocked,
          costPerUnit: stockFormData.unitCost ? parseFloat(stockFormData.unitCost) : i.costPerUnit,
        };
      }
      return i;
    }));

    // If adding stock (purchasing), also add to expenditures
    if (stockAction === 'add') {
      const totalCost = quantity * (stockFormData.unitCost ? parseFloat(stockFormData.unitCost) : item.costPerUnit);
      const newExpenditure: Expenditure = {
        id: Date.now(),
        date: new Date().toISOString().split('T')[0],
        category: 'Inventory Purchases',
        subcategory: `${item.category}: ${item.name}`,
        description: `Purchased ${quantity} ${item.unit} at ${formatCurrency(stockFormData.unitCost ? parseFloat(stockFormData.unitCost) : item.costPerUnit)} per ${item.unit}${stockFormData.notes ? ` - ${stockFormData.notes}` : ''}`,
        amount: totalCost,
        pondId: stockFormData.pondId ? parseInt(stockFormData.pondId) : (ponds[0]?.id || 1),
      };
      setExpenditures([newExpenditure, ...expenditures]);
    }

    setIsStockModalOpen(false);
  };

  const handleAddNewItem = () => {
    if (!newItemFormData.name || !newItemFormData.category || !newItemFormData.initialStock || !newItemFormData.unit) {
      alert('Please fill all required fields');
      return;
    }

    const newItem: InventoryItem = {
      id: Date.now(),
      name: newItemFormData.name,
      category: newItemFormData.category,
      currentStock: parseFloat(newItemFormData.initialStock),
      unit: newItemFormData.unit,
      reorderLevel: newItemFormData.reorderLevel ? parseFloat(newItemFormData.reorderLevel) : 0,
      costPerUnit: newItemFormData.costPerUnit ? parseFloat(newItemFormData.costPerUnit) : 0,
      lastRestocked: new Date().toISOString().split('T')[0],
      supplier: newItemFormData.supplier || undefined,
    };

    setInventoryItems([...inventoryItems, newItem]);
    
    // Add to expenditures if there's a cost
    if (newItemFormData.costPerUnit && parseFloat(newItemFormData.costPerUnit) > 0) {
      const totalCost = parseFloat(newItemFormData.initialStock) * parseFloat(newItemFormData.costPerUnit);
      const newExpenditure: Expenditure = {
        id: Date.now(),
        date: new Date().toISOString().split('T')[0],
        category: 'Inventory Purchases',
        subcategory: `${newItemFormData.category}: ${newItemFormData.name}`,
        description: `Initial stock - Added ${newItemFormData.initialStock} ${newItemFormData.unit} to inventory`,
        amount: totalCost,
        pondId: ponds[0]?.id || 1,
      };
      setExpenditures([newExpenditure, ...expenditures]);
    }

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
  };

  const getLowStockItems = () => {
    return inventoryItems.filter(item => item.currentStock <= item.reorderLevel);
  };

  const getTotalInventoryValue = () => {
    return inventoryItems.reduce((sum, item) => sum + (item.currentStock * item.costPerUnit), 0);
  };

  return (
    <div className="space-y-6">
      {/* Header Section with Tab Navigation */}
      <div className="bg-gradient-to-r from-purple-500 to-pink-600 rounded-xl shadow-lg p-8 text-white">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-3xl font-bold mb-2 flex items-center gap-3">
              <span>💰</span> {activeTab === 'expenditures' ? 'Expenditure Tracking' : 'Inventory Management'}
            </h2>
            <p className="text-purple-100">
              {activeTab === 'expenditures' 
                ? 'Monitor and manage your koi fish farm expenses' 
                : 'Track stock levels and manage inventory with POS-like system'}
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm text-purple-200">
              {activeTab === 'expenditures' 
                ? (selectedPond === 'all' ? 'Total Expenditure' : `${ponds.find(p => p.id === selectedPond)?.name} Total`)
                : 'Total Inventory Value'}
            </p>
            <p className="text-4xl font-bold">
              {activeTab === 'expenditures' ? formatCurrency(getTotalExpenditure()) : formatCurrency(getTotalInventoryValue())}
            </p>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('expenditures')}
            className={`px-6 py-2 rounded-lg font-medium transition-all ${
              activeTab === 'expenditures'
                ? 'bg-white text-purple-600 shadow-lg'
                : 'bg-purple-400/30 text-white hover:bg-purple-400/50'
            }`}
          >
            📊 Expenditures
          </button>
          <button
            onClick={() => setActiveTab('inventory')}
            className={`px-6 py-2 rounded-lg font-medium transition-all ${
              activeTab === 'inventory'
                ? 'bg-white text-purple-600 shadow-lg'
                : 'bg-purple-400/30 text-white hover:bg-purple-400/50'
            }`}
          >
            📦 Inventory & Stock
          </button>
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

      {activeTab === 'expenditures' ? (
        <div className="space-y-6">
      {/* Header Section */}
      <div className="bg-gradient-to-r from-purple-500 to-pink-600 rounded-xl shadow-lg p-8 text-white" style={{ display: 'none' }}>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold mb-2 flex items-center gap-3">
              <span>💰</span> Expenditure Tracking
            </h2>
            <p className="text-purple-100">Monitor and manage your koi fish farm expenses</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-purple-200">
              {selectedPond === 'all' ? 'Total Expenditure' : `${ponds.find(p => p.id === selectedPond)?.name} Total`}
            </p>
            <p className="text-4xl font-bold">{formatCurrency(getTotalExpenditure())}</p>
          </div>
        </div>
      </div>

      {/* Pond Management Section */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🏞️</span>
            <h3 className="text-xl font-bold text-gray-800">Pond Management</h3>
          </div>
          <button
            onClick={() => setIsPondModalOpen(true)}
            className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white px-4 py-2 rounded-lg font-semibold shadow-md transform hover:scale-105 transition-all duration-200 flex items-center gap-2 text-sm"
          >
            <i className="fas fa-plus"></i>
            Add Pond
          </button>
        </div>

        {/* Pond Filter Buttons */}
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => setSelectedPond('all')}
            className={`px-4 py-2 rounded-lg font-semibold transition-all duration-200 ${selectedPond === 'all'
                ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
          >
            <i className="fas fa-globe mr-2"></i>
            All Ponds ({expenditures.length})
          </button>

          {ponds.map((pond) => {
            const pondColorClasses = pondColors[pond.color];
            const pondTotal = getTotalByPond(pond.id);
            const pondExpCount = expenditures.filter(exp => exp.pondId === pond.id).length;

            return (
              <div key={pond.id} className="relative group">
                <button
                  onClick={() => setSelectedPond(pond.id)}
                  className={`px-4 py-2 rounded-lg font-semibold transition-all duration-200 flex items-center gap-2 ${selectedPond === pond.id
                      ? `${pondColorClasses.bg} ${pondColorClasses.text} border-2 ${pondColorClasses.border} shadow-lg`
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                >
                  <i className="fas fa-water"></i>
                  {pond.name} ({pondExpCount})
                  <span className="text-xs ml-1">• {formatCurrency(pondTotal)}</span>
                </button>
                {ponds.length > 1 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      openDeletePondModal(pond);
                    }}
                    className="absolute -top-2 -right-2 bg-red-500 hover:bg-red-600 text-white rounded-full w-6 h-6 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 text-xs"
                    title="Delete pond"
                  >
                    <i className="fas fa-times"></i>
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Add New Expenditure Button */}
      <div className="flex justify-between items-center">
        <div className="text-sm text-gray-600">
          Showing {getFilteredExpenditures().length} of {expenditures.length} expenditures
        </div>
        <button
          onClick={openModal}
          className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white px-6 py-3 rounded-lg font-semibold shadow-lg transform hover:scale-105 transition-all duration-200 flex items-center gap-2"
        >
          <i className="fas fa-plus-circle"></i>
          Add New Expenditure
        </button>
      </div>

      {/* Category Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {Object.entries(allCategories).map(([categoryName, categoryData]) => {
          const colorClasses = getColorClasses(categoryData.color);
          const total = getTotalByCategory(categoryName);
          const filteredCount = getFilteredExpenditures().filter(exp => exp.category === categoryName).length;

          return (
            <div
              key={categoryName}
              className={`${colorClasses.bg} border-2 ${colorClasses.border} rounded-xl p-6 hover:shadow-lg transition-all duration-200`}
            >
              <div className="flex items-center justify-between mb-4">
                <span className="text-4xl">{categoryData.icon}</span>
                <div className={`px-3 py-1 ${colorClasses.bg} border ${colorClasses.border} rounded-full`}>
                  <span className={`text-sm font-bold ${colorClasses.text}`}>
                    {filteredCount}
                  </span>
                </div>
              </div>
              <h3 className={`text-lg font-bold ${colorClasses.text} mb-2`}>{categoryName}</h3>
              <p className="text-2xl font-bold text-gray-800">{formatCurrency(total)}</p>
            </div>
          );
        })}
      </div>

      {/* Sensor Data Cards - Realtime Current & Calculate Kwh - Only for Selected Pond */}
      {selectedPond !== 'all' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
            <i className="fas fa-bolt text-yellow-500"></i>
            Sensor Monitoring - {ponds.find(p => p.id === selectedPond)?.name}
          </h3>

          {sensorData[selectedPond] ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Realtime Current Card */}
              <div className="bg-gradient-to-br from-indigo-50 to-purple-50 border-2 border-indigo-200 rounded-xl p-6 hover:shadow-lg transition-all duration-200">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-4xl">⚡</span>
                  <div className="px-3 py-1 bg-indigo-100 border border-indigo-300 rounded-full">
                    <span className="text-xs font-semibold text-indigo-700">LIVE</span>
                  </div>
                </div>
                <h3 className="text-lg font-bold text-indigo-600 mb-2">Realtime Current</h3>
                <p className="text-sm text-gray-600 mb-4">Live electrical current monitoring</p>

                <div className="bg-white rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-600">Current</span>
                    <span className="text-2xl font-bold text-indigo-600">
                      {sensorData[selectedPond].current.toFixed(2)} A
                    </span>
                  </div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-600">Voltage</span>
                    <span className="text-lg font-semibold text-gray-700">
                      {sensorData[selectedPond].voltage.toFixed(1)} V
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Power</span>
                    <span className="text-lg font-semibold text-gray-700">
                      {sensorData[selectedPond].power.toFixed(1)} W
                    </span>
                  </div>
                  <div className="mt-3 pt-3 border-t border-gray-200">
                    <span className="text-xs text-gray-500">
                      Last updated: {new Date(sensorData[selectedPond].timestamp).toLocaleString()}
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => window.location.href = '/dashboard/realtime-current'}
                  className="mt-4 w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white py-2 rounded-lg font-semibold transition-all duration-200 flex items-center justify-center gap-2"
                >
                  <i className="fas fa-arrow-right"></i>
                  View Details
                </button>
              </div>

              {/* Calculate Kwh Card */}
              <div className="bg-gradient-to-br from-green-50 to-teal-50 border-2 border-green-200 rounded-xl p-6 hover:shadow-lg transition-all duration-200">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-4xl">📊</span>
                  <div className="px-3 py-1 bg-green-100 border border-green-300 rounded-full">
                    <span className="text-xs font-semibold text-green-700">ENERGY</span>
                  </div>
                </div>
                <h3 className="text-lg font-bold text-green-600 mb-2">Energy Consumption</h3>
                <p className="text-sm text-gray-600 mb-4">Power consumption and cost calculations</p>

                <div className="bg-white rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-600">Energy</span>
                    <span className="text-2xl font-bold text-green-600">
                      {(sensorData[selectedPond].energyWh / 1000).toFixed(2)} kWh
                    </span>
                  </div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-600">Cost (LKR 25/kWh)</span>
                    <span className="text-lg font-semibold text-gray-700">
                      {formatCurrency((sensorData[selectedPond].energyWh / 1000) * 25)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Current Power</span>
                    <span className="text-lg font-semibold text-gray-700">
                      {sensorData[selectedPond].power.toFixed(1)} W
                    </span>
                  </div>
                  <div className="mt-3 pt-3 border-t border-gray-200">
                    <span className="text-xs text-gray-500">
                      Last updated: {new Date(sensorData[selectedPond].timestamp).toLocaleString()}
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => window.location.href = '/dashboard/calculate-kwh'}
                  className="mt-4 w-full bg-gradient-to-r from-green-600 to-teal-600 hover:from-green-700 hover:to-teal-700 text-white py-2 rounded-lg font-semibold transition-all duration-200 flex items-center justify-center gap-2"
                >
                  <i className="fas fa-arrow-right"></i>
                  View Details
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-yellow-50 border-l-4 border-yellow-500 p-4 rounded">
              <div className="flex items-start gap-3">
                <i className="fas fa-exclamation-triangle text-yellow-500 text-lg mt-0.5"></i>
                <div className="text-sm text-yellow-800">
                  <p className="font-semibold mb-1">No Sensor Data Available</p>
                  <p>
                    No sensor data is available for this pond. Make sure a sensor device is assigned and sending data.
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="mt-4 bg-blue-50 border-l-4 border-blue-500 p-4 rounded">
            <div className="flex items-start gap-3">
              <i className="fas fa-info-circle text-blue-500 text-lg mt-0.5"></i>
              <div className="text-sm text-blue-800">
                <p className="font-semibold mb-1">Real-time Sensor Data</p>
                <p>
                  This section displays live sensor data for the selected pond. Click "View Details" to see comprehensive analytics and historical trends.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Expenditures List */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-6 bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200">
          <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <i className="fas fa-list-ul text-purple-600"></i>
            Recent Expenditures
          </h3>
        </div>

        <div className="overflow-x-auto">
          {getFilteredExpenditures().length === 0 ? (
            <div className="p-12 text-center">
              <div className="text-6xl mb-4">📊</div>
              <p className="text-gray-500 text-lg mb-2">
                {selectedPond === 'all'
                  ? 'No expenditures recorded yet'
                  : `No expenditures for ${ponds.find(p => p.id === selectedPond)?.name}`}
              </p>
              <p className="text-gray-400">Click "Add New Expenditure" to get started</p>
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Date</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Pond</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Category</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Item</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Description</th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Amount</th>
                  <th className="px-6 py-4 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {getFilteredExpenditures().map((exp) => {
                  const categoryData = allCategories[exp.category as keyof typeof allCategories];
                  const colorClasses = categoryData ? getColorClasses(categoryData.color) : getColorClasses('gray');
                  const pond = ponds.find(p => p.id === exp.pondId);
                  const pondColorClasses = pond ? pondColors[pond.color] : pondColors.blue;

                  return (
                    <tr key={exp.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {new Date(exp.date).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium ${pondColorClasses.bg} ${pondColorClasses.text}`}>
                          <i className="fas fa-water"></i>
                          {pond?.name || 'Unknown'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium ${colorClasses.bg} ${colorClasses.text}`}>
                          <span>{categoryData?.icon || '📋'}</span>
                          {exp.category}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-800 font-medium">{exp.subcategory}</td>
                      <td className="px-6 py-4 text-sm text-gray-600 max-w-xs truncate">
                        {exp.description || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-bold text-gray-800">
                        {formatCurrency(exp.amount)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <button
                          onClick={() => handleDeleteExpenditure(exp.id)}
                          className="text-red-600 hover:text-red-800 hover:bg-red-50 p-2 rounded-lg transition-colors"
                          title="Delete"
                        >
                          <i className="fas fa-trash-alt"></i>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
        </div>
      ) : (
        /* Inventory Management Tab */
        <div className="space-y-6">
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
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add Expenditure Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-gradient-to-r from-purple-600 to-pink-600 text-white p-6 rounded-t-2xl">
              <div className="flex items-center justify-between">
                <h3 className="text-2xl font-bold flex items-center gap-2">
                  <i className="fas fa-plus-circle"></i>
                  Add New Expenditure
                </h3>
                <button
                  onClick={() => {
                    setIsModalOpen(false);
                    setSelectedCategory('');
                  }}
                  className="text-white hover:bg-white hover:bg-opacity-20 p-2 rounded-lg transition-colors"
                >
                  <i className="fas fa-times text-xl"></i>
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Category Selection */}
              {!selectedCategory ? (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-3">
                    Select Category *
                  </label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {Object.entries(categories).map(([categoryName, categoryData]) => {
                      const colorClasses = getColorClasses(categoryData.color);

                      return (
                        <button
                          key={categoryName}
                          onClick={() => setSelectedCategory(categoryName)}
                          className={`${colorClasses.bg} ${colorClasses.hover} border-2 ${colorClasses.border} rounded-xl p-6 text-left transition-all duration-200 transform hover:scale-105`}
                        >
                          <div className="flex items-center gap-3 mb-2">
                            <span className="text-3xl">{categoryData.icon}</span>
                            <h4 className={`font-bold ${colorClasses.text}`}>{categoryName}</h4>
                          </div>
                          <p className="text-xs text-gray-600">
                            {categoryData.subcategories.length} subcategories
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Selected Category Display */}
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <span className="text-3xl">{categories[selectedCategory as keyof typeof categories].icon}</span>
                      <div>
                        <p className="text-xs text-gray-500">Category</p>
                        <p className="font-bold text-gray-800">{selectedCategory}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setSelectedCategory('')}
                      className="text-gray-500 hover:text-gray-700 text-sm underline"
                    >
                      Change
                    </button>
                  </div>

                  {/* Date */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Date *
                    </label>
                    <input
                      type="date"
                      value={formData.date}
                      onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                      className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition"
                      required
                    />
                  </div>

                  {/* Subcategory */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Item / Subcategory *
                    </label>
                    <select
                      value={formData.subcategory}
                      onChange={(e) => setFormData({ ...formData, subcategory: e.target.value })}
                      className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition"
                      required
                    >
                      <option value="">-- Select Item --</option>
                      {categories[selectedCategory as keyof typeof categories].subcategories.map((sub) => (
                        <option key={sub} value={sub}>{sub}</option>
                      ))}
                    </select>
                  </div>

                  {/* Description */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Description (Optional)
                    </label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition resize-none"
                      rows={3}
                      placeholder="Add any additional notes..."
                    />
                  </div>

                  {/* Pond Selection */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                      <i className="fas fa-water text-blue-500"></i>
                      Select Pond *
                      {formData.pondId && selectedPond !== 'all' && (
                        <span className="text-xs text-green-600 font-normal">
                          (Auto-selected from filter)
                        </span>
                      )}
                    </label>
                    <select
                      value={formData.pondId}
                      onChange={(e) => setFormData({ ...formData, pondId: e.target.value })}
                      className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition"
                      required
                    >
                      <option value="">-- Select Pond --</option>
                      {ponds.map((pond) => (
                        <option key={pond.id} value={pond.id}>
                          {pond.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Amount */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Amount (LKR) *
                    </label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-500 font-bold">
                        Rs
                      </span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={formData.amount}
                        onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                        className="w-full pl-12 pr-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition"
                        placeholder="0.00"
                        required
                      />
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-3 pt-4">
                    <button
                      onClick={handleAddExpenditure}
                      className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white py-3 rounded-lg font-semibold shadow-lg transition-all duration-200 flex items-center justify-center gap-2"
                    >
                      <i className="fas fa-check"></i>
                      Add Expenditure
                    </button>
                    <button
                      onClick={() => {
                        setIsModalOpen(false);
                        setSelectedCategory('');
                      }}
                      className="px-6 py-3 border-2 border-gray-300 hover:bg-gray-50 text-gray-700 rounded-lg font-semibold transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Delete Pond Confirmation Modal */}
      {isDeletePondModalOpen && pondToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full">
            <div className="bg-gradient-to-r from-red-600 to-red-700 text-white p-6 rounded-t-2xl">
              <div className="flex items-center justify-between">
                <h3 className="text-2xl font-bold flex items-center gap-2">
                  <i className="fas fa-exclamation-triangle"></i>
                  Delete Pond
                </h3>
                <button
                  onClick={() => {
                    setIsDeletePondModalOpen(false);
                    setPondToDelete(null);
                    setDeleteConfirmationText('');
                  }}
                  className="text-white hover:bg-white hover:bg-opacity-20 p-2 rounded-lg transition-colors"
                >
                  <i className="fas fa-times text-xl"></i>
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              {/* Warning Message */}
              <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded">
                <div className="flex items-start gap-3">
                  <i className="fas fa-exclamation-circle text-red-500 text-xl mt-0.5"></i>
                  <div>
                    <h4 className="font-bold text-red-800 mb-1">Warning: This action cannot be undone!</h4>
                    <p className="text-sm text-red-700">
                      You are about to permanently delete <strong className="font-bold">"{pondToDelete.name}"</strong>.
                    </p>
                  </div>
                </div>
              </div>

              {/* Pond Info */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-gray-700">Pond to delete:</span>
                  <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium ${pondColors[pondToDelete.color]?.bg || 'bg-gray-100'
                    } ${pondColors[pondToDelete.color]?.text || 'text-gray-700'}`}>
                    <i className="fas fa-water"></i>
                    {pondToDelete.name}
                  </span>
                </div>
              </div>

              {/* Confirmation Input */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Type <span className="text-red-600 font-bold">"{pondToDelete.name}"</span> to confirm:
                </label>
                <input
                  type="text"
                  value={deleteConfirmationText}
                  onChange={(e) => setDeleteConfirmationText(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none transition"
                  placeholder={`Type "${pondToDelete.name}" exactly`}
                  autoFocus
                />
                <p className="mt-2 text-xs text-gray-500">
                  <i className="fas fa-info-circle mr-1"></i>
                  The pond name must match exactly (case-sensitive)
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4">
                <button
                  onClick={handleDeletePond}
                  disabled={deleteConfirmationText !== pondToDelete.name}
                  className={`flex-1 py-3 rounded-lg font-semibold shadow-lg transition-all duration-200 flex items-center justify-center gap-2 ${deleteConfirmationText === pondToDelete.name
                      ? 'bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white cursor-pointer'
                      : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    }`}
                >
                  <i className="fas fa-trash-alt"></i>
                  Delete Pond Permanently
                </button>
                <button
                  onClick={() => {
                    setIsDeletePondModalOpen(false);
                    setPondToDelete(null);
                    setDeleteConfirmationText('');
                  }}
                  className="px-6 py-3 border-2 border-gray-300 hover:bg-gray-50 text-gray-700 rounded-lg font-semibold transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Pond Modal */}
      {isPondModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full">
            <div className="bg-gradient-to-r from-blue-600 to-cyan-600 text-white p-6 rounded-t-2xl">
              <div className="flex items-center justify-between">
                <h3 className="text-2xl font-bold flex items-center gap-2">
                  <i className="fas fa-water"></i>
                  Add New Pond
                </h3>
                <button
                  onClick={() => setIsPondModalOpen(false)}
                  className="text-white hover:bg-white hover:bg-opacity-20 p-2 rounded-lg transition-colors"
                >
                  <i className="fas fa-times text-xl"></i>
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              {/* Pond Name */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Pond Name *
                </label>
                <input
                  type="text"
                  value={newPondName}
                  onChange={(e) => setNewPondName(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                  placeholder="e.g., Pond 3, Main Pond, Breeding Pond"
                  required
                />
              </div>

              {/* Pond Color */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Choose Color *
                </label>
                <div className="grid grid-cols-4 gap-3">
                  {Object.entries(pondColors).map(([colorName, colorClasses]) => (
                    <button
                      key={colorName}
                      type="button"
                      onClick={() => setNewPondColor(colorName)}
                      className={`p-4 rounded-lg border-2 transition-all ${newPondColor === colorName
                          ? `${colorClasses.border} ${colorClasses.bg} ring-2 ring-offset-2 ring-${colorName}-500`
                          : 'border-gray-200 bg-gray-50 hover:bg-gray-100'
                        }`}
                    >
                      <div className={`w-full h-8 rounded ${colorClasses.bg} ${colorClasses.border} border-2`}></div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4">
                <button
                  onClick={handleAddPond}
                  className="flex-1 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white py-3 rounded-lg font-semibold shadow-lg transition-all duration-200 flex items-center justify-center gap-2"
                >
                  <i className="fas fa-check"></i>
                  Add Pond
                </button>
                <button
                  onClick={() => setIsPondModalOpen(false)}
                  className="px-6 py-3 border-2 border-gray-300 hover:bg-gray-50 text-gray-700 rounded-lg font-semibold transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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
                    Pond (Optional - for expense tracking)
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

export default Expenditures;

