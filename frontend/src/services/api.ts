import axios, { type AxiosInstance } from 'axios';

// Use environment variable or fallback to localhost
const API_URL: string = import.meta.env.VITE_API_URL || 'http://localhost:8081';

// Create a pre-configured Axios instance
const api: AxiosInstance = axios.create({
  baseURL: `${API_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Define types for API responses
export interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
}

// ==================== Authentication ====================
export const login = async (
  username: string,
  password: string
): Promise<ApiResponse> => {
  const response = await api.post<ApiResponse>('/login', { username, password });
  return response.data;
};

export const updateCredentials = async (
  currentUsername: string,
  newUsername: string,
  newPassword: string
): Promise<ApiResponse> => {
  const response = await api.post<ApiResponse>('/auth/update-credentials', {
    currentUsername,
    newUsername,
    newPassword,
  });
  return response.data;
};

// ==================== Pond Management ====================
export interface Pond {
  id: number;
  name: string;
  color: string;
  createdAt?: string;
  updatedAt?: string;
}

export const pondApi = {
  getAll: async (): Promise<ApiResponse<Pond[]>> => {
    const response = await api.get<ApiResponse<Pond[]>>('/ponds');
    return response.data;
  },

  getById: async (id: number): Promise<ApiResponse<Pond>> => {
    const response = await api.get<ApiResponse<Pond>>(`/ponds/${id}`);
    return response.data;
  },

  create: async (data: { name: string; color: string }): Promise<ApiResponse<Pond>> => {
    const response = await api.post<ApiResponse<Pond>>('/ponds', data);
    return response.data;
  },

  update: async (id: number, data: { name: string; color: string }): Promise<ApiResponse<Pond>> => {
    const response = await api.put<ApiResponse<Pond>>(`/ponds/${id}`, data);
    return response.data;
  },

  delete: async (id: number): Promise<ApiResponse> => {
    const response = await api.delete<ApiResponse>(`/ponds/${id}`);
    return response.data;
  },
};

// ==================== Fish Count Management ====================
export interface FishCount {
  id: number;
  date: string;
  pond: Pond;
  count: number;
  notes?: string;
  countMethod?: string;
  countedBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

export const fishCountApi = {
  getAll: async (): Promise<ApiResponse<FishCount[]>> => {
    const response = await api.get<ApiResponse<FishCount[]>>('/fish-counts');
    return response.data;
  },

  getByPond: async (pondId: number): Promise<ApiResponse<FishCount[]>> => {
    const response = await api.get<ApiResponse<FishCount[]>>(`/fish-counts/pond/${pondId}`);
    return response.data;
  },

  getByDateRange: async (
    pondId: number,
    startDate: string,
    endDate: string
  ): Promise<ApiResponse<FishCount[]>> => {
    const response = await api.get<ApiResponse<FishCount[]>>(
      `/fish-counts/pond/${pondId}/date-range`,
      { params: { startDate, endDate } }
    );
    return response.data;
  },

  getById: async (id: number): Promise<ApiResponse<FishCount>> => {
    const response = await api.get<ApiResponse<FishCount>>(`/fish-counts/${id}`);
    return response.data;
  },

  create: async (data: {
    date: string;
    pondId: number;
    count: number;
    notes?: string;
    countMethod?: string;
    countedBy?: string;
  }): Promise<ApiResponse<FishCount>> => {
    const response = await api.post<ApiResponse<FishCount>>('/fish-counts', data);
    return response.data;
  },

  update: async (
    id: number,
    data: { date: string; pondId: number; count: number; notes?: string; countMethod?: string; countedBy?: string }
  ): Promise<ApiResponse<FishCount>> => {
    const response = await api.put<ApiResponse<FishCount>>(`/fish-counts/${id}`, data);
    return response.data;
  },

  delete: async (id: number): Promise<ApiResponse> => {
    const response = await api.delete<ApiResponse>(`/fish-counts/${id}`);
    return response.data;
  },
};

// ==================== Expenditure Management ====================
export interface Expenditure {
  id: number;
  date: string;
  category: string;
  subcategory: string;
  description?: string;
  amount: number;
  pond: Pond;
  createdAt?: string;
  updatedAt?: string;
}

export const expenditureApi = {
  getAll: async (): Promise<ApiResponse<Expenditure[]>> => {
    const response = await api.get<ApiResponse<Expenditure[]>>('/expenditures');
    return response.data;
  },

  getByPond: async (pondId: number): Promise<ApiResponse<Expenditure[]>> => {
    const response = await api.get<ApiResponse<Expenditure[]>>(`/expenditures/pond/${pondId}`);
    return response.data;
  },

  getByCategory: async (category: string): Promise<ApiResponse<Expenditure[]>> => {
    const response = await api.get<ApiResponse<Expenditure[]>>(`/expenditures/category/${category}`);
    return response.data;
  },

  getByDateRange: async (
    pondId: number,
    startDate: string,
    endDate: string
  ): Promise<ApiResponse<Expenditure[]>> => {
    const response = await api.get<ApiResponse<Expenditure[]>>(
      `/expenditures/pond/${pondId}/date-range`,
      { params: { startDate, endDate } }
    );
    return response.data;
  },

  getTotals: async (): Promise<ApiResponse<{ totalAmount: number }>> => {
    const response = await api.get<ApiResponse<{ totalAmount: number }>>('/expenditures/totals');
    return response.data;
  },

  getTotalByPond: async (pondId: number): Promise<ApiResponse<{ totalAmount: number }>> => {
    const response = await api.get<ApiResponse<{ totalAmount: number }>>(
      `/expenditures/totals/pond/${pondId}`
    );
    return response.data;
  },

  getTotalByCategory: async (category: string): Promise<ApiResponse<{ totalAmount: number }>> => {
    const response = await api.get<ApiResponse<{ totalAmount: number }>>(
      `/expenditures/totals/category/${category}`
    );
    return response.data;
  },

  getById: async (id: number): Promise<ApiResponse<Expenditure>> => {
    const response = await api.get<ApiResponse<Expenditure>>(`/expenditures/${id}`);
    return response.data;
  },

  create: async (data: {
    date: string;
    category: string;
    subcategory: string;
    description?: string;
    amount: number;
    pondId: number;
  }): Promise<ApiResponse<Expenditure>> => {
    const response = await api.post<ApiResponse<Expenditure>>('/expenditures', data);
    return response.data;
  },

  update: async (
    id: number,
    data: {
      date: string;
      category: string;
      subcategory: string;
      description?: string;
      amount: number;
      pondId: number;
    }
  ): Promise<ApiResponse<Expenditure>> => {
    const response = await api.put<ApiResponse<Expenditure>>(`/expenditures/${id}`, data);
    return response.data;
  },

  delete: async (id: number): Promise<ApiResponse> => {
    const response = await api.delete<ApiResponse>(`/expenditures/${id}`);
    return response.data;
  },
};

// ==================== Revenue Management ====================
export interface Revenue {
  id: number;
  date: string;
  pond: Pond;
  source: string;
  amount: number;
  quantitySold?: number;
  pricePerUnit?: number;
  fishSpecies?: string;
  customerName?: string;
  notes?: string;
  paymentMethod?: string;
  paymentStatus?: string;
  createdAt?: string;
  updatedAt?: string;
}

export const revenueApi = {
  getAll: async (): Promise<ApiResponse<Revenue[]>> => {
    const response = await api.get<ApiResponse<Revenue[]>>('/revenues');
    return response.data;
  },

  getByPond: async (pondId: number): Promise<ApiResponse<Revenue[]>> => {
    const response = await api.get<ApiResponse<Revenue[]>>(`/revenues/pond/${pondId}`);
    return response.data;
  },

  getBySource: async (source: string): Promise<ApiResponse<Revenue[]>> => {
    const response = await api.get<ApiResponse<Revenue[]>>(`/revenues/source/${source}`);
    return response.data;
  },

  getByDateRange: async (
    pondId: number,
    startDate: string,
    endDate: string
  ): Promise<ApiResponse<Revenue[]>> => {
    const response = await api.get<ApiResponse<Revenue[]>>(
      `/revenues/pond/${pondId}/date-range`,
      { params: { startDate, endDate } }
    );
    return response.data;
  },

  getTotals: async (): Promise<ApiResponse<{ totalAmount: number }>> => {
    const response = await api.get<ApiResponse<{ totalAmount: number }>>('/revenues/totals');
    return response.data;
  },

  getTotalByPond: async (pondId: number): Promise<ApiResponse<{ totalAmount: number }>> => {
    const response = await api.get<ApiResponse<{ totalAmount: number }>>(
      `/revenues/totals/pond/${pondId}`
    );
    return response.data;
  },

  getTotalBySource: async (source: string): Promise<ApiResponse<{ totalAmount: number }>> => {
    const response = await api.get<ApiResponse<{ totalAmount: number }>>(
      `/revenues/totals/source/${source}`
    );
    return response.data;
  },

  getById: async (id: number): Promise<ApiResponse<Revenue>> => {
    const response = await api.get<ApiResponse<Revenue>>(`/revenues/${id}`);
    return response.data;
  },

  create: async (data: {
    date: string;
    pondId: number;
    source: string;
    amount: number;
    quantitySold?: number;
    pricePerUnit?: number;
    fishSpecies?: string;
    customerName?: string;
    notes?: string;
    paymentMethod?: string;
    paymentStatus?: string;
  }): Promise<ApiResponse<Revenue>> => {
    const response = await api.post<ApiResponse<Revenue>>('/revenues', data);
    return response.data;
  },

  update: async (
    id: number,
    data: {
      date: string;
      pondId: number;
      source: string;
      amount: number;
      quantitySold?: number;
      pricePerUnit?: number;
      fishSpecies?: string;
      customerName?: string;
      notes?: string;
      paymentMethod?: string;
      paymentStatus?: string;
    }
  ): Promise<ApiResponse<Revenue>> => {
    const response = await api.put<ApiResponse<Revenue>>(`/revenues/${id}`, data);
    return response.data;
  },

  delete: async (id: number): Promise<ApiResponse> => {
    const response = await api.delete<ApiResponse>(`/revenues/${id}`);
    return response.data;
  },
};

// ==================== Profit & Loss ====================
export interface ProfitLossReport {
  pondId?: number;
  pondName: string;
  startDate: string;
  endDate: string;
  totalRevenue: number;
  revenueBySource: Record<string, number>;
  totalExpenses: number;
  expensesByCategory: Record<string, number>;
  grossProfit: number;
  netProfit: number;
  profitMargin: number;
  totalInvestment: number;
  roi: number;
  roiPeriodDays: number;
  breakEvenRevenue: number;
  remainingToBreakEven: number;
  isBreakEven: boolean;
  averageRevenuePerDay: number;
  averageExpensePerDay: number;
  totalTransactions: number;
}

export const profitLossApi = {
  getReportByPond: async (
    pondId: number,
    startDate: string,
    endDate: string
  ): Promise<ApiResponse<ProfitLossReport>> => {
    const response = await api.get<ApiResponse<ProfitLossReport>>(
      `/profit-loss/pond/${pondId}`,
      { params: { startDate, endDate } }
    );
    return response.data;
  },

  getOverallReport: async (
    startDate: string,
    endDate: string
  ): Promise<ApiResponse<ProfitLossReport>> => {
    const response = await api.get<ApiResponse<ProfitLossReport>>(
      '/profit-loss/overall',
      { params: { startDate, endDate } }
    );
    return response.data;
  },
};

// ==================== Inventory Management ====================
export interface InventoryItem {
  id: number;
  name: string;
  category: string;
  currentStock: number;
  unit: string;
  reorderLevel: number;
  costPerUnit: number;
  lastRestocked: string;
  supplier?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface StockBatch {
  unitCost: number;
  quantity: number;
}

export const inventoryApi = {
  getAll: async (): Promise<ApiResponse<InventoryItem[]>> => {
    const response = await api.get<ApiResponse<InventoryItem[]>>('/inventory');
    return response.data;
  },

  getByCategory: async (category: string): Promise<ApiResponse<InventoryItem[]>> => {
    const response = await api.get<ApiResponse<InventoryItem[]>>(`/inventory/category/${category}`);
    return response.data;
  },

  getLowStock: async (): Promise<ApiResponse<InventoryItem[]>> => {
    const response = await api.get<ApiResponse<InventoryItem[]>>('/inventory/low-stock');
    return response.data;
  },

  getTotalValue: async (): Promise<ApiResponse<{ totalValue: number }>> => {
    const response = await api.get<ApiResponse<{ totalValue: number }>>('/inventory/total-value');
    return response.data;
  },

  getById: async (id: number): Promise<ApiResponse<InventoryItem>> => {
    const response = await api.get<ApiResponse<InventoryItem>>(`/inventory/${id}`);
    return response.data;
  },

  getStockBatches: async (id: number): Promise<ApiResponse<StockBatch[]>> => {
    const response = await api.get<ApiResponse<StockBatch[]>>(`/inventory/${id}/stock-batches`);
    return response.data;
  },

  create: async (data: {
    name: string;
    category: string;
    currentStock: number;
    unit: string;
    reorderLevel: number;
    costPerUnit: number;
    lastRestocked: string;
    supplier?: string;
  }): Promise<ApiResponse<InventoryItem>> => {
    const response = await api.post<ApiResponse<InventoryItem>>('/inventory', data);
    return response.data;
  },

  update: async (
    id: number,
    data: {
      name: string;
      category: string;
      currentStock: number;
      unit: string;
      reorderLevel: number;
      costPerUnit: number;
      lastRestocked: string;
      supplier?: string;
    }
  ): Promise<ApiResponse<InventoryItem>> => {
    const response = await api.put<ApiResponse<InventoryItem>>(`/inventory/${id}`, data);
    return response.data;
  },

  delete: async (id: number): Promise<ApiResponse> => {
    const response = await api.delete<ApiResponse>(`/inventory/${id}`);
    return response.data;
  },
};

// ==================== Stock Transaction Management ====================
export interface StockTransaction {
  id: number;
  item: InventoryItem;
  type: 'add' | 'use';
  quantity: number;
  date: string;
  pond?: Pond;
  notes?: string;
  unitCost?: number;
  createdAt?: string;
  updatedAt?: string;
}

export const stockTransactionApi = {
  getAll: async (): Promise<ApiResponse<StockTransaction[]>> => {
    const response = await api.get<ApiResponse<StockTransaction[]>>('/stock-transactions');
    return response.data;
  },

  getByItem: async (itemId: number): Promise<ApiResponse<StockTransaction[]>> => {
    const response = await api.get<ApiResponse<StockTransaction[]>>(
      `/stock-transactions/item/${itemId}`
    );
    return response.data;
  },

  getByType: async (type: 'add' | 'use'): Promise<ApiResponse<StockTransaction[]>> => {
    const response = await api.get<ApiResponse<StockTransaction[]>>(
      `/stock-transactions/type/${type}`
    );
    return response.data;
  },

  getByDateRange: async (
    itemId: number,
    startDate: string,
    endDate: string
  ): Promise<ApiResponse<StockTransaction[]>> => {
    const response = await api.get<ApiResponse<StockTransaction[]>>(
      `/stock-transactions/item/${itemId}/date-range`,
      { params: { startDate, endDate } }
    );
    return response.data;
  },

  getById: async (id: number): Promise<ApiResponse<StockTransaction>> => {
    const response = await api.get<ApiResponse<StockTransaction>>(`/stock-transactions/${id}`);
    return response.data;
  },

  create: async (data: {
    itemId: number;
    type: 'add' | 'use';
    quantity: number;
    date: string;
    pondId?: number;
    notes?: string;
    unitCost?: number;
  }): Promise<ApiResponse<StockTransaction>> => {
    const response = await api.post<ApiResponse<StockTransaction>>('/stock-transactions', data);
    return response.data;
  },

  delete: async (id: number): Promise<ApiResponse> => {
    const response = await api.delete<ApiResponse>(`/stock-transactions/${id}`);
    return response.data;
  },
};

// ==================== Sensor Device Management ====================
export type DeviceType = 'WATER_QUALITY' | 'BUDGET_MANAGEMENT' | 'FEEDING_MANAGEMENT' | 'FISH_ANOMALY_DETECTION';

export interface SensorDevice {
  id: number;
  deviceId: string;
  deviceType: DeviceType;
  pond: Pond | null;
  status: string;
  ipAddress: string;
  rssi: number;
  energyWh: number;
  lastSeen: string;
  createdAt: string;
}

export const sensorDeviceApi = {
  getAll: async (): Promise<ApiResponse<SensorDevice[]>> => {
    const response = await api.get<ApiResponse<SensorDevice[]>>('/sensors');
    return response.data;
  },

  getById: async (id: number): Promise<ApiResponse<SensorDevice>> => {
    const response = await api.get<ApiResponse<SensorDevice>>(`/sensors/${id}`);
    return response.data;
  },

  getByPond: async (pondId: number): Promise<ApiResponse<SensorDevice[]>> => {
    const response = await api.get<ApiResponse<SensorDevice[]>>(`/sensors/pond/${pondId}`);
    return response.data;
  },

  assignToPond: async (deviceId: string, pondId: number): Promise<ApiResponse<SensorDevice>> => {
    const response = await api.post<ApiResponse<SensorDevice>>(`/sensors/${deviceId}/assign`, { pondId });
    return response.data;
  },

  unassignFromPond: async (deviceId: string): Promise<ApiResponse<SensorDevice>> => {
    const response = await api.post<ApiResponse<SensorDevice>>(`/sensors/${deviceId}/unassign`, {});
    return response.data;
  },

  resetEnergy: async (deviceId: string): Promise<ApiResponse> => {
    const response = await api.post<ApiResponse>(`/sensors/${deviceId}/reset-energy`, {});
    return response.data;
  },

  powerOn: async (deviceId: string): Promise<ApiResponse> => {
    const response = await api.post<ApiResponse>(`/sensors/${deviceId}/power-on`, {});
    return response.data;
  },

  powerOff: async (deviceId: string): Promise<ApiResponse> => {
    const response = await api.post<ApiResponse>(`/sensors/${deviceId}/power-off`, {});
    return response.data;
  },

  setAutoMode: async (deviceId: string): Promise<ApiResponse> => {
    const response = await api.post<ApiResponse>(`/sensors/${deviceId}/auto-mode`, {});
    return response.data;
  },

  setScheduleMode: async (deviceId: string): Promise<ApiResponse> => {
    const response = await api.post<ApiResponse>(`/sensors/${deviceId}/schedule-mode`, {});
    return response.data;
  },
};

// ==================== Sensor Data ====================
export interface SensorData {
  id: number;
  device: SensorDevice;
  pond: Pond | null;
  voltage: number;
  current: number;
  power: number;
  energyWh: number;
  // Water quality parameters
  phValue?: number;
  turbidity?: number;
  dissolvedOxygen?: number;  // Dissolved Oxygen in mg/L
  ammonia?: number;  // Keep for backward compatibility
  airQuality?: number;
  waterQualityStatus?: string;
  status: string;
  timestamp: string;
}

export const sensorDataApi = {
  getByPond: async (pondId: number): Promise<ApiResponse<SensorData[]>> => {
    const response = await api.get<ApiResponse<SensorData[]>>(`/sensor-data/pond/${pondId}`);
    return response.data;
  },

  getLatestByPond: async (pondId: number): Promise<ApiResponse<SensorData>> => {
    const response = await api.get<ApiResponse<SensorData>>(`/sensor-data/pond/${pondId}/latest`);
    return response.data;
  },

  getHistoricalData: async (pondId: number, hours: number = 24): Promise<ApiResponse<SensorData[]>> => {
    const response = await api.get<ApiResponse<SensorData[]>>(`/sensor-data/pond/${pondId}/history`, {
      params: { hours }
    });
    return response.data;
  },

  getLatestEnergyByPond: async (pondId: number): Promise<ApiResponse<SensorData>> => {
    const response = await api.get<ApiResponse<SensorData>>(`/sensor-data/pond/${pondId}/latest/energy`);
    return response.data;
  },

  getHistoricalEnergyData: async (pondId: number, hours: number = 24): Promise<ApiResponse<SensorData[]>> => {
    const response = await api.get<ApiResponse<SensorData[]>>(`/sensor-data/pond/${pondId}/history/energy`, {
      params: { hours }
    });
    return response.data;
  },

  // Save sensor data from WebSocket (bypass MQTT)
  saveFromWebSocket: async (data: {
    deviceId: string;
    pondId: number;
    phValue: number;
    turbidity: number;
    dissolvedOxygen: number;
    waterQualityStatus: string;
  }): Promise<ApiResponse<SensorData>> => {
    const response = await api.post<ApiResponse<SensorData>>('/sensor-data/websocket', data);
    return response.data;
  },
};

// ==================== Camera & Detection Management ====================
export interface CameraPond {
  id: number;
  name: string;
  status: 'normal' | 'warning' | 'critical';
  lastDetectionTime: string | null;
  lastAlertSummary: string | null;
  cameraStatus: 'online' | 'offline';
  streamUrl?: string;
}

export interface DetectionEvent {
  id: number;
  pondId: number;
  pondName: string;
  eventType: 'mortality' | 'abnormal_behavior' | 'rain_detected';
  confidence: number;
  timestamp: string;
  imageUrl?: string;
  contextTags: string[];
  acknowledged: boolean;
  falseAlarm: boolean;
  notes?: string;
}

export interface EventDetails extends DetectionEvent {
  environmentalContext: {
    temperature?: number;
    humidity?: number;
    rainfall?: boolean;
    timeOfDay: 'morning' | 'afternoon' | 'evening' | 'night';
  };
}

export interface Alert {
  id: number;
  pondId: number;
  pondName: string;
  alertType: 'mortality_suspected' | 'abnormal_behavior_detected' | 'rain_detected';
  message: string;
  status: 'sent' | 'acknowledged' | 'resolved';
  timestamp: string;
  relatedEventIds: number[];
}

export const cameraApi = {
  // Get all ponds with camera status
  getAllPonds: async (): Promise<ApiResponse<CameraPond[]>> => {
    const response = await api.get<ApiResponse<CameraPond[]>>('/camera/ponds');
    return response.data;
  },

  // Get stream URL for a specific pond
  getStreamUrl: (pondId: number): string => {
    return `http://localhost:5000/api/camera/stream/${pondId}`;
  },

  // Capture snapshot from camera
  captureSnapshot: async (pondId: number): Promise<ApiResponse<{ imageUrl: string }>> => {
    const response = await fetch(`http://localhost:5000/api/camera/snapshot/${pondId}`, {
      method: 'POST',
    });
    const data = await response.json();
    return data;
  },

  // Get detection events
  getEvents: async (filters?: {
    pondId?: number;
    eventType?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<ApiResponse<DetectionEvent[]>> => {
    const response = await api.get<ApiResponse<DetectionEvent[]>>('/camera/events', {
      params: filters
    });
    return response.data;
  },

  // Get event details
  getEventDetails: async (eventId: number): Promise<ApiResponse<EventDetails>> => {
    const response = await api.get<ApiResponse<EventDetails>>(`/camera/events/${eventId}`);
    return response.data;
  },

  // Acknowledge event
  acknowledgeEvent: async (eventId: number): Promise<ApiResponse> => {
    const response = await api.post<ApiResponse>(`/camera/events/${eventId}/acknowledge`);
    return response.data;
  },

  // Mark event as false alarm
  markAsFalseAlarm: async (eventId: number): Promise<ApiResponse> => {
    const response = await api.post<ApiResponse>(`/camera/events/${eventId}/false-alarm`);
    return response.data;
  },

  // Add notes to event
  addEventNotes: async (eventId: number, notes: string): Promise<ApiResponse> => {
    const response = await api.post<ApiResponse>(`/camera/events/${eventId}/notes`, { notes });
    return response.data;
  },

  // Get alerts
  getAlerts: async (filters?: {
    pondId?: number;
    status?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<ApiResponse<Alert[]>> => {
    const response = await api.get<ApiResponse<Alert[]>>('/camera/alerts', {
      params: filters
    });
    return response.data;
  },

  // Update alert status
  updateAlertStatus: async (alertId: number, status: 'acknowledged' | 'resolved'): Promise<ApiResponse> => {
    const response = await api.put<ApiResponse>(`/camera/alerts/${alertId}/status`, { status });
    return response.data;
  },
};

// ==================== Treatment & Dosing Logs ====================
export interface TreatmentLog {
  id: number;
  pondId: number;
  timestamp: string;
  treatmentType: string;
  dosage: number;
  unit: string;
  reason: string;
  notes?: string;
  recordedBy: string;
  parameter?: string;
  targetValue?: number;
  beforeValue?: number;
  afterValue?: number;
  photoUrl?: string;
  status: 'logged' | 'verified' | 'flagged' | 'completed';
  verifiedAt?: string;
  verifiedBy?: string;
  completedAt?: string;
  completedBy?: string;
}

export interface TreatmentStats {
  total: number;
  thisWeek: number;
  avgPerWeek: number;
}

export const treatmentLogApi = {
  // Get all logs for a pond
  getByPond: async (pondId: number): Promise<ApiResponse<TreatmentLog[]>> => {
    const response = await api.get<ApiResponse<TreatmentLog[]>>(`/treatment-logs/pond/${pondId}`);
    return response.data;
  },

  // Get logs filtered by treatment type
  getByType: async (pondId: number, treatmentType: string): Promise<ApiResponse<TreatmentLog[]>> => {
    const response = await api.get<ApiResponse<TreatmentLog[]>>(`/treatment-logs/pond/${pondId}/type/${encodeURIComponent(treatmentType)}`);
    return response.data;
  },

  // Get logs filtered by parameter
  getByParameter: async (pondId: number, parameter: string): Promise<ApiResponse<TreatmentLog[]>> => {
    const response = await api.get<ApiResponse<TreatmentLog[]>>(`/treatment-logs/pond/${pondId}/parameter/${encodeURIComponent(parameter)}`);
    return response.data;
  },

  // Create new treatment log
  create: async (data: Omit<TreatmentLog, 'id'>): Promise<ApiResponse<TreatmentLog>> => {
    const response = await api.post<ApiResponse<TreatmentLog>>('/treatment-logs', data);
    return response.data;
  },

  // Update treatment log
  update: async (id: number, data: Partial<TreatmentLog>): Promise<ApiResponse<TreatmentLog>> => {
    const response = await api.put<ApiResponse<TreatmentLog>>(`/treatment-logs/${id}`, data);
    return response.data;
  },

  // Delete treatment log
  delete: async (id: number): Promise<ApiResponse> => {
    const response = await api.delete<ApiResponse>(`/treatment-logs/${id}`);
    return response.data;
  },

  // Get statistics
  getStats: async (pondId: number): Promise<ApiResponse<TreatmentStats>> => {
    const response = await api.get<ApiResponse<TreatmentStats>>(`/treatment-logs/pond/${pondId}/stats`);
    return response.data;
  },
};

// ==================== Task Management ====================
export interface Task {
  id: string;
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  status: 'pending' | 'in-progress' | 'completed' | 'snoozed';
  type: 'calibration' | 'maintenance' | 'cleaning' | 'inspection' | 'treatment';
  dueDate: string;
  createdDate: string;
  completedDate?: string;
  snoozeUntil?: string;
  notes: string[];
  linkedParameter?: string;
  autoCloseEnabled: boolean;
  assignedTo?: string;
  pondId?: number;
}

export const taskApi = {
  // Get all tasks
  getAll: async (): Promise<ApiResponse<Task[]>> => {
    const response = await api.get<ApiResponse<Task[]>>('/tasks');
    return response.data;
  },

  // Get task by ID
  getById: async (id: string): Promise<ApiResponse<Task>> => {
    const response = await api.get<ApiResponse<Task>>(`/tasks/${id}`);
    return response.data;
  },

  // Get tasks by status
  getByStatus: async (status: string): Promise<ApiResponse<Task[]>> => {
    const response = await api.get<ApiResponse<Task[]>>(`/tasks/status/${status}`);
    return response.data;
  },

  // Get tasks by priority
  getByPriority: async (priority: string): Promise<ApiResponse<Task[]>> => {
    const response = await api.get<ApiResponse<Task[]>>(`/tasks/priority/${priority}`);
    return response.data;
  },

  // Get overdue tasks
  getOverdue: async (): Promise<ApiResponse<Task[]>> => {
    const response = await api.get<ApiResponse<Task[]>>('/tasks/overdue');
    return response.data;
  },

  // Create new task
  create: async (data: Omit<Task, 'id' | 'createdDate'>): Promise<ApiResponse<Task>> => {
    const response = await api.post<ApiResponse<Task>>('/tasks', data);
    return response.data;
  },

  // Update task
  update: async (id: string, data: Partial<Task>): Promise<ApiResponse<Task>> => {
    const response = await api.put<ApiResponse<Task>>(`/tasks/${id}`, data);
    return response.data;
  },

  // Add note to task
  addNote: async (id: string, note: string): Promise<ApiResponse<Task>> => {
    const response = await api.post<ApiResponse<Task>>(`/tasks/${id}/notes`, { note });
    return response.data;
  },

  // Delete task
  delete: async (id: string): Promise<ApiResponse> => {
    const response = await api.delete<ApiResponse>(`/tasks/${id}`);
    return response.data;
  },
};

// ==================== Power Schedule Management ====================
export interface PowerSchedule {
  id?: number;
  deviceId: string;
  name: string;
  startTime: string; // HH:mm format
  endTime: string;   // HH:mm format
  daysOfWeek: boolean[]; // [Sun, Mon, Tue, Wed, Thu, Fri, Sat]
  enabled: boolean;
  createdAt?: string;
  updatedAt?: string;
}

// Helper functions for days_of_week conversion
const daysToString = (days: boolean[]): string => {
  return days.map(d => d ? '1' : '0').join('');
};

const stringToDays = (str: string): boolean[] => {
  return str.split('').map(c => c === '1');
};

export const powerScheduleApi = {
  // Get all schedules for a device
  getByDevice: async (deviceId: string): Promise<ApiResponse<PowerSchedule[]>> => {
    const response = await api.get<ApiResponse<PowerSchedule[]>>(`/power-schedules/device/${deviceId}`);
    // Convert daysOfWeek from string to boolean array
    if (response.data.data && Array.isArray(response.data.data)) {
      response.data.data = response.data.data.map((schedule: any) => ({
        ...schedule,
        daysOfWeek: typeof schedule.daysOfWeek === 'string' 
          ? stringToDays(schedule.daysOfWeek) 
          : schedule.daysOfWeek
      }));
    }
    return response.data;
  },

  // Get schedule by ID
  getById: async (id: number): Promise<ApiResponse<PowerSchedule>> => {
    const response = await api.get<ApiResponse<PowerSchedule>>(`/power-schedules/${id}`);
    // Convert daysOfWeek from string to boolean array
    if (response.data.data && typeof (response.data.data as any).daysOfWeek === 'string') {
      (response.data.data as any).daysOfWeek = stringToDays((response.data.data as any).daysOfWeek);
    }
    return response.data;
  },

  // Create new schedule
  create: async (schedule: Omit<PowerSchedule, 'id' | 'createdAt' | 'updatedAt'>): Promise<ApiResponse<PowerSchedule>> => {
    // Convert daysOfWeek from boolean array to string
    const payload = {
      ...schedule,
      daysOfWeek: daysToString(schedule.daysOfWeek)
    };
    const response = await api.post<ApiResponse<PowerSchedule>>('/power-schedules', payload);
    // Convert response back to boolean array
    if (response.data.data && typeof (response.data.data as any).daysOfWeek === 'string') {
      (response.data.data as any).daysOfWeek = stringToDays((response.data.data as any).daysOfWeek);
    }
    return response.data;
  },

  // Update schedule
  update: async (id: number, schedule: Partial<PowerSchedule>): Promise<ApiResponse<PowerSchedule>> => {
    // Convert daysOfWeek from boolean array to string if present
    const payload = schedule.daysOfWeek 
      ? { ...schedule, daysOfWeek: daysToString(schedule.daysOfWeek) }
      : schedule;
    const response = await api.put<ApiResponse<PowerSchedule>>(`/power-schedules/${id}`, payload);
    // Convert response back to boolean array
    if (response.data.data && typeof (response.data.data as any).daysOfWeek === 'string') {
      (response.data.data as any).daysOfWeek = stringToDays((response.data.data as any).daysOfWeek);
    }
    return response.data;
  },

  // Toggle schedule enabled/disabled
  toggle: async (id: number): Promise<ApiResponse<PowerSchedule>> => {
    const response = await api.put<ApiResponse<PowerSchedule>>(`/power-schedules/${id}/toggle`);
    // Convert response back to boolean array
    if (response.data.data && typeof (response.data.data as any).daysOfWeek === 'string') {
      (response.data.data as any).daysOfWeek = stringToDays((response.data.data as any).daysOfWeek);
    }
    return response.data;
  },

  // Delete schedule
  delete: async (id: number): Promise<ApiResponse> => {
    const response = await api.delete<ApiResponse>(`/power-schedules/${id}`);
    return response.data;
  },

  // Sync schedules to ESP32 device
  syncToDevice: async (deviceId: string): Promise<ApiResponse> => {
    const response = await api.post<ApiResponse>(`/power-schedules/device/${deviceId}/sync`);
    return response.data;
  },
};

export default api;
