import axios, { type AxiosInstance } from 'axios';

// Use environment variable or fallback to localhost
const API_URL: string = import.meta.env.VITE_API_URL || 'http://localhost:8080';

// Create a pre-configured Axios instance
const api: AxiosInstance = axios.create({
  baseURL: `${API_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Define types for API responses
interface ApiResponse<T = unknown> {
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

export default api;
