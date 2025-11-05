import React, { useState } from 'react';

interface Expenditure {
  id: string;
  date: string;
  category: string;
  subcategory: string;
  description: string;
  amount: number;
  pondId: string;
}

interface Pond {
  id: string;
  name: string;
  color: string;
}

const Expenditures: React.FC = () => {
  const [expenditures, setExpenditures] = useState<Expenditure[]>([]);
  const [ponds, setPonds] = useState<Pond[]>([
    { id: '1', name: 'Pond 1', color: 'blue' },
    { id: '2', name: 'Pond 2', color: 'green' },
  ]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPondModalOpen, setIsPondModalOpen] = useState(false);
  const [isDeletePondModalOpen, setIsDeletePondModalOpen] = useState(false);
  const [pondToDelete, setPondToDelete] = useState<Pond | null>(null);
  const [deleteConfirmationText, setDeleteConfirmationText] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedPond, setSelectedPond] = useState<string>('all');
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

  const categories = {
    'Feed and Nutrition': {
      icon: '🍱',
      color: 'emerald',
      subcategories: [
        'Feed transport or delivery charges',
        'Fish feed (pellets, flakes, supplements)',
        'Additives or probiotics for water and feed quality',
      ],
    },
    'Fingerlings and Stocking': {
      icon: '🐠',
      color: 'blue',
      subcategories: [
        'Purchase of fingerlings or juvenile fish',
      ],
    },
    'Chemicals and Water Quality': {
      icon: '💧',
      color: 'cyan',
      subcategories: [
        'pH stabilizers (lime, soda, etc.)',
        'Water conditioners and salt treatments',
        'Oxygen tablets or aeration additives',
        'Disinfectants and anti-algal agents',
      ],
    },
    'Maintenance and Repairs': {
      icon: '🔧',
      color: 'amber',
      subcategories: [
        'Equipment repair (pumps, motors, feeders, sensors)',
        'Plumbing or net replacement',
        'Cleaning and desilting ponds',
        'Boat or floating device repairs',
      ],
    },
  };

  const getColorClasses = (color: string) => {
    const colors: Record<string, { bg: string; text: string; border: string; hover: string }> = {
      emerald: { bg: 'bg-emerald-50', text: 'text-emerald-600', border: 'border-emerald-200', hover: 'hover:bg-emerald-100' },
      blue: { bg: 'bg-blue-50', text: 'text-blue-600', border: 'border-blue-200', hover: 'hover:bg-blue-100' },
      cyan: { bg: 'bg-cyan-50', text: 'text-cyan-600', border: 'border-cyan-200', hover: 'hover:bg-cyan-100' },
      amber: { bg: 'bg-amber-50', text: 'text-amber-600', border: 'border-amber-200', hover: 'hover:bg-amber-100' },
    };
    return colors[color] || colors.emerald;
  };

  const handleAddPond = () => {
    if (!newPondName.trim()) {
      alert('Please enter a pond name');
      return;
    }

    const newPond: Pond = {
      id: Date.now().toString(),
      name: newPondName.trim(),
      color: newPondColor,
    };

    setPonds([...ponds, newPond]);
    setIsPondModalOpen(false);
    setNewPondName('');
    setNewPondColor('blue');
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

  const handleDeletePond = () => {
    if (!pondToDelete) return;
    
    if (deleteConfirmationText === pondToDelete.name) {
      setPonds(ponds.filter(p => p.id !== pondToDelete.id));
      if (selectedPond === pondToDelete.id) {
        setSelectedPond('all');
      }
      setIsDeletePondModalOpen(false);
      setPondToDelete(null);
      setDeleteConfirmationText('');
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
      pondId: selectedPond === 'all' ? '' : selectedPond, // Auto-select pond if filtered
    });
    setIsModalOpen(true);
  };

  const handleAddExpenditure = () => {
    if (!selectedCategory || !formData.subcategory || !formData.amount || !formData.pondId) {
      alert('Please fill all required fields including pond selection');
      return;
    }

    const newExpenditure: Expenditure = {
      id: Date.now().toString(),
      date: formData.date,
      category: selectedCategory,
      subcategory: formData.subcategory,
      description: formData.description,
      amount: parseFloat(formData.amount),
      pondId: formData.pondId,
    };

    setExpenditures([newExpenditure, ...expenditures]);
    setIsModalOpen(false);
    setSelectedCategory('');
    setFormData({
      date: new Date().toISOString().split('T')[0],
      subcategory: '',
      description: '',
      amount: '',
      pondId: '',
    });
  };

  const handleDeleteExpenditure = (id: string) => {
    if (window.confirm('Are you sure you want to delete this expenditure?')) {
      setExpenditures(expenditures.filter(exp => exp.id !== id));
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

  const getTotalByPond = (pondId: string) => {
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

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="bg-gradient-to-r from-purple-500 to-pink-600 rounded-xl shadow-lg p-8 text-white">
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
            className={`px-4 py-2 rounded-lg font-semibold transition-all duration-200 ${
              selectedPond === 'all'
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
                  className={`px-4 py-2 rounded-lg font-semibold transition-all duration-200 flex items-center gap-2 ${
                    selectedPond === pond.id
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
        {Object.entries(categories).map(([categoryName, categoryData]) => {
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

      {/* Sensor Data Cards - Realtime Current & Calculate Kwh */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
          <i className="fas fa-bolt text-yellow-500"></i>
          Sensor Monitoring - Pond-wise Data
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Realtime Current Card */}
          <div className="bg-gradient-to-br from-indigo-50 to-purple-50 border-2 border-indigo-200 rounded-xl p-6 hover:shadow-lg transition-all duration-200">
            <div className="flex items-center justify-between mb-4">
              <span className="text-4xl">⚡</span>
              <div className="px-3 py-1 bg-indigo-100 border border-indigo-300 rounded-full">
                <span className="text-sm font-bold text-indigo-700">
                  {selectedPond === 'all' ? ponds.length : 1} Pond{selectedPond === 'all' && ponds.length > 1 ? 's' : ''}
                </span>
              </div>
            </div>
            <h3 className="text-lg font-bold text-indigo-600 mb-2">Realtime Current</h3>
            <p className="text-sm text-gray-600 mb-4">Live electrical current monitoring from sensors</p>
            
            {selectedPond === 'all' ? (
              <div className="space-y-2">
                {ponds.map((pond) => {
                  const pondColorClasses = pondColors[pond.color];
                  const mockCurrent = (Math.random() * 15 + 5).toFixed(2); // Mock data
                  const mockPower = (parseFloat(mockCurrent) * 230 / 1000).toFixed(2);
                  
                  return (
                    <div key={pond.id} className="bg-white rounded-lg p-3 flex items-center justify-between">
                      <span className={`px-3 py-1 rounded-full text-xs font-bold ${pondColorClasses.bg} ${pondColorClasses.text}`}>
                        <i className="fas fa-water mr-1"></i>
                        {pond.name}
                      </span>
                      <div className="text-right">
                        <p className="text-lg font-bold text-gray-800">{mockCurrent} A</p>
                        <p className="text-xs text-gray-500">{mockPower} kW</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="bg-white rounded-lg p-4">
                {(() => {
                  const mockCurrent = (Math.random() * 15 + 5).toFixed(2);
                  const mockVoltage = (230 + Math.random() * 10 - 5).toFixed(2);
                  const mockPower = (parseFloat(mockCurrent) * parseFloat(mockVoltage) / 1000).toFixed(2);
                  
                  return (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-gray-600">Current:</span>
                        <span className="text-2xl font-bold text-indigo-600">{mockCurrent} A</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-gray-600">Voltage:</span>
                        <span className="text-xl font-bold text-gray-700">{mockVoltage} V</span>
                      </div>
                      <div className="flex items-center justify-between border-t pt-2">
                        <span className="text-sm font-semibold text-gray-600">Power:</span>
                        <span className="text-2xl font-bold text-green-600">{mockPower} kW</span>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}
            
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
                <span className="text-sm font-bold text-green-700">
                  {selectedPond === 'all' ? ponds.length : 1} Pond{selectedPond === 'all' && ponds.length > 1 ? 's' : ''}
                </span>
              </div>
            </div>
            <h3 className="text-lg font-bold text-green-600 mb-2">Calculate Kwh</h3>
            <p className="text-sm text-gray-600 mb-4">Power consumption and cost calculations</p>
            
            {selectedPond === 'all' ? (
              <div className="space-y-2">
                {ponds.map((pond) => {
                  const pondColorClasses = pondColors[pond.color];
                  const mockTodayKwh = (Math.random() * 20 + 40).toFixed(2); // Mock data
                  const mockCost = (parseFloat(mockTodayKwh) * 25).toFixed(2); // 25 LKR per kWh
                  
                  return (
                    <div key={pond.id} className="bg-white rounded-lg p-3 flex items-center justify-between">
                      <span className={`px-3 py-1 rounded-full text-xs font-bold ${pondColorClasses.bg} ${pondColorClasses.text}`}>
                        <i className="fas fa-water mr-1"></i>
                        {pond.name}
                      </span>
                      <div className="text-right">
                        <p className="text-lg font-bold text-gray-800">{mockTodayKwh} kWh</p>
                        <p className="text-xs text-green-600">Rs {mockCost} today</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="bg-white rounded-lg p-4">
                {(() => {
                  const mockTodayKwh = (Math.random() * 20 + 40).toFixed(2);
                  const mockWeekKwh = (parseFloat(mockTodayKwh) * 7).toFixed(2);
                  const mockMonthKwh = (parseFloat(mockTodayKwh) * 30).toFixed(2);
                  const mockMonthlyCost = (parseFloat(mockMonthKwh) * 25).toFixed(2);
                  
                  return (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-gray-600">Today:</span>
                        <span className="text-xl font-bold text-gray-700">{mockTodayKwh} kWh</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-gray-600">This Week:</span>
                        <span className="text-xl font-bold text-gray-700">{mockWeekKwh} kWh</span>
                      </div>
                      <div className="flex items-center justify-between border-t pt-2">
                        <span className="text-sm font-semibold text-gray-600">Monthly Cost:</span>
                        <span className="text-2xl font-bold text-green-600">{formatCurrency(parseFloat(mockMonthlyCost))}</span>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}
            
            <button
              onClick={() => window.location.href = '/dashboard/calculate-kwh'}
              className="mt-4 w-full bg-gradient-to-r from-green-600 to-teal-600 hover:from-green-700 hover:to-teal-700 text-white py-2 rounded-lg font-semibold transition-all duration-200 flex items-center justify-center gap-2"
            >
              <i className="fas fa-arrow-right"></i>
              View Details
            </button>
          </div>
        </div>

        <div className="mt-4 bg-blue-50 border-l-4 border-blue-500 p-4 rounded">
          <div className="flex items-start gap-3">
            <i className="fas fa-info-circle text-blue-500 text-lg mt-0.5"></i>
            <div className="text-sm text-blue-800">
              <p className="font-semibold mb-1">Sensor Data Preview</p>
              <p>
                This section shows real-time sensor data for electrical monitoring. Click "View Details" to see comprehensive analytics and historical trends.
                {selectedPond !== 'all' && ` Currently showing data for ${ponds.find(p => p.id === selectedPond)?.name}.`}
              </p>
            </div>
          </div>
        </div>
      </div>

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
                  const categoryData = categories[exp.category as keyof typeof categories];
                  const colorClasses = getColorClasses(categoryData.color);
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
                          <span>{categoryData.icon}</span>
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
                  <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium ${
                    pondColors[pondToDelete.color]?.bg || 'bg-gray-100'
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
                  className={`flex-1 py-3 rounded-lg font-semibold shadow-lg transition-all duration-200 flex items-center justify-center gap-2 ${
                    deleteConfirmationText === pondToDelete.name
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
                      className={`p-4 rounded-lg border-2 transition-all ${
                        newPondColor === colorName
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
    </div>
  );
};

export default Expenditures;
