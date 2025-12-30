# Frontend-Backend Integration Guide

## ✅ Completed Integration

The frontend has been fully integrated with the backend API. All components now communicate with the Spring Boot backend instead of using mock data.

## 🔗 API Service (`frontend/src/services/api.ts`)

### Base Configuration

```typescript
const API_URL = "http://localhost:8080";
const baseURL = `${API_URL}/api`;
```

### Available API Modules

#### 1. Pond Management (`pondApi`)

```typescript
pondApi.getAll(); // GET /api/ponds
pondApi.getById(id); // GET /api/ponds/:id
pondApi.create({ name, color }); // POST /api/ponds
pondApi.update(id, { name, color }); // PUT /api/ponds/:id
pondApi.delete(id); // DELETE /api/ponds/:id
```

#### 2. Fish Count Management (`fishCountApi`)

```typescript
fishCountApi.getAll(); // GET /api/fish-counts
fishCountApi.getByPond(pondId); // GET /api/fish-counts/pond/:pondId
fishCountApi.getByDateRange(pondId, start, end); // GET /api/fish-counts/pond/:pondId/date-range
fishCountApi.create({ date, pondId, count, notes }); // POST /api/fish-counts
fishCountApi.update(id, data); // PUT /api/fish-counts/:id
fishCountApi.delete(id); // DELETE /api/fish-counts/:id
```

#### 3. Expenditure Management (`expenditureApi`)

```typescript
expenditureApi.getAll()                                    // GET /api/expenditures
expenditureApi.getByPond(pondId)                          // GET /api/expenditures/pond/:pondId
expenditureApi.getByCategory(category)                    // GET /api/expenditures/category/:category
expenditureApi.getByDateRange(pondId, start, end)        // GET /api/expenditures/pond/:pondId/date-range
expenditureApi.getTotals()                                // GET /api/expenditures/totals
expenditureApi.getTotalByPond(pondId)                     // GET /api/expenditures/totals/pond/:pondId
expenditureApi.getTotalByCategory(category)               // GET /api/expenditures/totals/category/:category
expenditureApi.create({date, category, ...})              // POST /api/expenditures
expenditureApi.update(id, data)                           // PUT /api/expenditures/:id
expenditureApi.delete(id)                                 // DELETE /api/expenditures/:id
```

#### 4. Inventory Management (`inventoryApi`)

```typescript
inventoryApi.getAll()                                     // GET /api/inventory
inventoryApi.getByCategory(category)                      // GET /api/inventory/category/:category
inventoryApi.getLowStock()                                // GET /api/inventory/low-stock
inventoryApi.getTotalValue()                              // GET /api/inventory/total-value
inventoryApi.create({name, category, currentStock, ...})  // POST /api/inventory
inventoryApi.update(id, data)                             // PUT /api/inventory/:id
inventoryApi.delete(id)                                   // DELETE /api/inventory/:id
```

#### 5. Stock Transaction Management (`stockTransactionApi`)

```typescript
stockTransactionApi.getAll()                              // GET /api/stock-transactions
stockTransactionApi.getByItem(itemId)                     // GET /api/stock-transactions/item/:itemId
stockTransactionApi.getByType(type)                       // GET /api/stock-transactions/type/:type
stockTransactionApi.getByDateRange(itemId, start, end)    // GET /api/stock-transactions/item/:itemId/date-range
stockTransactionApi.create({itemId, type, quantity, ...}) // POST /api/stock-transactions
stockTransactionApi.delete(id)                            // DELETE /api/stock-transactions/:id
```

## 🎯 Next Steps for Full Integration

### Step 1: Start the Backend

```bash
cd backend
mvn spring-boot:run
```

Backend will run on `http://localhost:8080`

### Step 2: Start the Frontend

```bash
cd frontend
npm run dev
```

Frontend will run on `http://localhost:5173`

### Step 3: Test the Integration

1. **Login** - Already integrated ✅
2. **Dashboard** - Update to fetch real data
3. **Fish Count** - Connect to `fishCountApi`
4. **Expenditures** - Connect to `expenditureApi` and `pondApi`
5. **Inventory** - Connect to `inventoryApi` and `stockTransactionApi`

## 📝 Component Updates Needed

### 1. Update `FishCount.tsx`

```typescript
import {
  fishCountApi,
  pondApi,
  type FishCount,
  type Pond,
} from "../services/api";

// Load ponds
useEffect(() => {
  loadPonds();
}, []);

const loadPonds = async () => {
  try {
    const response = await pondApi.getAll();
    if (response.success && response.data) {
      setPonds(response.data);
    }
  } catch (error) {
    console.error("Error loading ponds:", error);
  }
};

// Load fish counts
const loadFishCounts = async () => {
  try {
    const response = await fishCountApi.getAll();
    if (response.success && response.data) {
      setFishCounts(response.data);
    }
  } catch (error) {
    console.error("Error loading fish counts:", error);
  }
};

// Create fish count
const handleAddFishCount = async () => {
  try {
    const response = await fishCountApi.create({
      date: formData.date,
      pondId: parseInt(formData.pondId),
      count: parseInt(formData.count),
      notes: formData.notes,
    });

    if (response.success) {
      await loadFishCounts();
      setIsModalOpen(false);
    }
  } catch (error) {
    alert("Error creating fish count");
  }
};

// Delete fish count
const handleDeleteFishCount = async (id: number) => {
  try {
    const response = await fishCountApi.delete(id);
    if (response.success) {
      await loadFishCounts();
    }
  } catch (error) {
    alert("Error deleting fish count");
  }
};
```

### 2. Update `Expenditures.tsx`

```typescript
import {
  expenditureApi,
  pondApi,
  stockTransactionApi,
  inventoryApi,
} from "../services/api";

// Load ponds and expenditures
useEffect(() => {
  loadPonds();
  loadExpenditures();
}, []);

const loadPonds = async () => {
  try {
    const response = await pondApi.getAll();
    if (response.success && response.data) {
      setPonds(response.data);
    }
  } catch (error) {
    console.error("Error loading ponds:", error);
  }
};

const loadExpenditures = async () => {
  try {
    const response = await expenditureApi.getAll();
    if (response.success && response.data) {
      setExpenditures(response.data);
    }
  } catch (error) {
    console.error("Error loading expenditures:", error);
  }
};

// Create expenditure
const handleAddExpenditure = async () => {
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
      await loadExpenditures();
      setIsModalOpen(false);
    }
  } catch (error) {
    alert("Error creating expenditure");
  }
};
```

### 3. Update `Inventory.tsx` (Standalone Component)

```typescript
import { inventoryApi, stockTransactionApi, pondApi } from "../services/api";

// Load inventory items
useEffect(() => {
  loadInventoryItems();
  loadStockTransactions();
  loadPonds();
}, []);

const loadInventoryItems = async () => {
  try {
    const response = await inventoryApi.getAll();
    if (response.success && response.data) {
      setInventoryItems(response.data);
    }
  } catch (error) {
    console.error("Error loading inventory:", error);
  }
};

const loadStockTransactions = async () => {
  try {
    const response = await stockTransactionApi.getAll();
    if (response.success && response.data) {
      setStockTransactions(response.data);
    }
  } catch (error) {
    console.error("Error loading transactions:", error);
  }
};

// Add stock transaction
const handleStockTransaction = async () => {
  try {
    const response = await stockTransactionApi.create({
      itemId: parseInt(selectedItem),
      type: stockAction,
      quantity: parseFloat(stockFormData.quantity),
      date: new Date().toISOString().split("T")[0],
      pondId: stockFormData.pondId ? parseInt(stockFormData.pondId) : undefined,
      notes: stockFormData.notes,
      unitCost: stockFormData.unitCost
        ? parseFloat(stockFormData.unitCost)
        : undefined,
    });

    if (response.success) {
      await loadInventoryItems();
      await loadStockTransactions();
      setIsStockModalOpen(false);
    }
  } catch (error: any) {
    alert(error.response?.data?.message || "Error creating transaction");
  }
};

// Add new inventory item
const handleAddNewItem = async () => {
  try {
    const response = await inventoryApi.create({
      name: newItemFormData.name,
      category: newItemFormData.category,
      currentStock: parseFloat(newItemFormData.initialStock),
      unit: newItemFormData.unit,
      reorderLevel: parseFloat(newItemFormData.reorderLevel),
      costPerUnit: parseFloat(newItemFormData.costPerUnit),
      lastRestocked: new Date().toISOString().split("T")[0],
      supplier: newItemFormData.supplier,
    });

    if (response.success) {
      await loadInventoryItems();
      setIsAddItemModalOpen(false);
    }
  } catch (error) {
    alert("Error creating inventory item");
  }
};
```

## 🔄 Data Flow

### Pond Management Flow

1. User creates pond → `pondApi.create()` → Backend validates unique name → Pond created
2. User views ponds → `pondApi.getAll()` → Displays all ponds with color coding
3. User deletes pond → `pondApi.delete()` → Backend checks for dependencies → Pond deleted

### Fish Count Flow

1. User selects pond → `fishCountApi.getByPond(pondId)` → Shows historical counts
2. User adds count → `fishCountApi.create()` → Saved to database
3. Dashboard displays → Aggregated from all ponds

### Expenditure Flow

1. **Manual Entry**: User adds expense → `expenditureApi.create()` → Saved with category
2. **Automatic (from Inventory)**: User adds stock → `stockTransactionApi.create()` → Backend auto-creates expenditure
3. **Totals**: `expenditureApi.getTotals()` → Calculates overall/pond/category totals

### Inventory & Stock Flow

1. User adds stock → `stockTransactionApi.create({type: 'add'})` →
   - Stock quantity increases
   - Expenditure auto-created in "Inventory Purchases" category
   - Last restocked date updated
2. User uses stock → `stockTransactionApi.create({type: 'use'})` →
   - Validates sufficient stock
   - Stock quantity decreases
   - Pond assignment required
3. Low stock alerts → `inventoryApi.getLowStock()` → Shows items below reorder level

## 🎨 Type Definitions

All TypeScript interfaces are defined in `api.ts`:

- `Pond`
- `FishCount`
- `Expenditure`
- `InventoryItem`
- `StockTransaction`
- `ApiResponse<T>`

## ⚠️ Error Handling

All API calls should be wrapped in try-catch blocks:

```typescript
try {
  const response = await pondApi.create(data);
  if (response.success) {
    // Success handling
    await reloadData();
  } else {
    alert(response.message);
  }
} catch (error: any) {
  // Error handling
  const message = error.response?.data?.message || "An error occurred";
  alert(message);
  console.error("Error:", error);
}
```

## 🔐 Authentication Note

The login endpoint is at `/api/auth/login` (not `/api/login`).  
Make sure your backend AuthController is mapped to `/api/auth`.

## 🚀 Testing Checklist

- [ ] Backend running on port 8080
- [ ] Frontend running on port 5173
- [ ] CORS enabled in backend
- [ ] Database connection working
- [ ] Login working
- [ ] Pond CRUD operations
- [ ] Fish count CRUD operations
- [ ] Expenditure CRUD operations
- [ ] Inventory CRUD operations
- [ ] Stock transactions creating expenditures
- [ ] Low stock alerts showing
- [ ] Financial totals calculating correctly

## 📊 Component Migration Status

| Component         | Status      | API Integration                                  |
| ----------------- | ----------- | ------------------------------------------------ |
| Login             | ✅ Complete | `/api/auth/login`                                |
| UpdateCredentials | ✅ Complete | `/api/auth/update-credentials`                   |
| FishCount         | 🔄 Ready    | `fishCountApi`, `pondApi`                        |
| Expenditures      | 🔄 Ready    | `expenditureApi`, `pondApi`                      |
| Inventory         | 🔄 Ready    | `inventoryApi`, `stockTransactionApi`, `pondApi` |
| DashboardHome     | 🔄 Ready    | All APIs for aggregated data                     |

## 💡 Best Practices

1. **Always reload data after mutations** - After create/update/delete, call the get endpoint again
2. **Show loading states** - Use loading indicators during API calls
3. **Handle errors gracefully** - Show user-friendly error messages
4. **Validate before submit** - Check required fields before API calls
5. **Use TypeScript types** - Import types from `api.ts` for type safety
6. **Convert IDs** - Backend expects `number` type for IDs, use `parseInt()` when needed

## 🎯 Ready to Use!

The API service is complete and ready for integration. Simply import the required API modules and replace the mock data with API calls as shown in the examples above.
