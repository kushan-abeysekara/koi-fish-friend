# Inventory Management & POS System

## Overview

The Expenditure Tracking page now includes a comprehensive **Inventory Management System** with POS-like functionality to track stock levels, manage purchases, and record usage.

## Features

### 📦 Dual Tab Interface

- **Expenditures Tab**: Track all farm expenses
- **Inventory & Stock Tab**: Manage inventory with real-time stock levels

### 🎯 Key Capabilities

#### 1. **Add Stock (Purchase)**

- Add items to inventory when purchased
- Enter quantity and unit cost
- Automatically creates expenditure record
- Updates stock levels in real-time
- Tracks supplier information

#### 2. **Use Stock (Consumption)**

- Record when items are used
- Select which pond the item was used for
- Deducts from current stock automatically
- Maintains usage history

#### 3. **Add New Items**

- Create new inventory items
- Set reorder levels for automatic alerts
- Define units (pieces, kg, liters, tablets, etc.)
- Track supplier details
- Set default cost per unit

### 📊 Inventory Dashboard

#### Stock Level Indicators

- **Visual Progress Bars**: Green (good), Yellow (low), Red (critical)
- **Current Stock Display**: Real-time quantity tracking
- **Reorder Level Alerts**: Automatic warnings when stock is low
- **Total Inventory Value**: Calculate total value of all stock

#### Stock Status

- ✅ **In Stock**: Items above reorder level
- ⚠️ **Low Stock**: Items at or below reorder level
- Automatic alerts at top of page for items needing reorder

### 📋 Pre-configured Items

The system comes with 5 common koi farm inventory items:

1. **Water Filter** (Equipment)

   - Unit: pieces
   - Default: 15 pieces at Rs 2,500 each

2. **Fish Feed (Premium)** (Feed)

   - Unit: kg
   - Default: 50 kg at Rs 350 per kg

3. **pH Stabilizer** (Chemical)

   - Unit: liters
   - Default: 8 liters at Rs 1,200 per liter

4. **Oxygen Tablets** (Chemical)

   - Unit: tablets
   - Default: 100 tablets at Rs 15 each

5. **Net (Large)** (Equipment)
   - Unit: pieces
   - Default: 3 pieces at Rs 1,800 each

### 🔄 Stock Transaction History

- View recent stock movements (adds and uses)
- See which pond items were used for
- Track quantity changes over time
- Filter by transaction type
- View associated notes and costs

### 💰 Integration with Expenditures

**Automatic Expenditure Creation:**

- When you **Add Stock** (purchase), the system automatically:
  - Creates an expenditure record
  - Calculates total cost (quantity × unit cost)
  - Categorizes based on item type
  - Links to pond if specified
  - Updates both inventory AND expenditure records

**Categories Mapping:**

- Feed items → "Feed and Nutrition"
- Chemical items → "Chemicals and Water Quality"
- Equipment items → "Maintenance and Repairs"

### 📈 Real-time Statistics

#### Quick Stats Cards:

1. **Total Items**: Count of unique inventory items
2. **In Stock**: Items with adequate stock levels
3. **Low Stock**: Items needing reorder (with count)

#### Financial Metrics:

- Total Inventory Value (all stock × unit costs)
- Individual item values
- Purchase cost tracking

### 🎨 User Interface Features

#### POS-Style Actions:

- **Add Stock** button (Green) - Purchase new items
- **Use Stock** button (Orange) - Record consumption
- **New Item** button (Blue) - Add new inventory items

#### Smart Forms:

- Auto-fill pond selection when filtered
- Unit cost defaults to saved value (can override)
- Validation for stock availability
- Required pond selection for stock usage
- Optional notes for all transactions

#### Visual Indicators:

- Color-coded categories (Feed=Green, Chemical=Blue, Equipment=Gray)
- Status badges for stock levels
- Transaction type badges (Added=Green, Used=Orange)
- Pond color coding throughout

### 🔔 Alert System

**Low Stock Alerts:**

- Red banner at top when items are low
- Lists all items needing reorder
- Shows count of low-stock items
- Persistent until stock is replenished

### 💡 Usage Examples

#### Example 1: Purchasing Water Filters

1. Click **"Add Stock"** button
2. Select "Water Filter" from dropdown
3. Enter quantity: 10
4. Enter unit cost: Rs 2,500 (or leave blank for default)
5. Select pond (optional)
6. Add notes (optional)
7. Click **"Add to Stock"**

**Result:**

- Stock increased by 10 pieces (now 25 total)
- Expenditure created: Rs 25,000
- Last restocked date updated

#### Example 2: Using Fish Feed

1. Click **"Use Stock"** button
2. Select "Fish Feed (Premium)"
3. Enter quantity: 5 kg
4. Select pond: "Pond 1" (required)
5. Add note: "Daily feeding"
6. Click **"Record Usage"**

**Result:**

- Stock decreased by 5 kg (now 45 kg)
- Transaction recorded with pond and notes
- If stock drops to reorder level, alert appears

#### Example 3: Adding New Item

1. Click **"New Item"** button
2. Enter name: "Anti-fungal Medicine"
3. Category: "Medicine"
4. Unit: "bottles"
5. Initial stock: 3
6. Reorder level: 2
7. Cost per unit: Rs 3,500
8. Supplier: "Fish Health Pro"
9. Click **"Add Item"**

**Result:**

- New item added to inventory
- Expenditure created for initial purchase
- Item appears in inventory table

## Data Structure

### Inventory Item

```typescript
{
  id: string
  name: string
  category: string
  currentStock: number
  unit: string
  reorderLevel: number
  costPerUnit: number
  lastRestocked: string (date)
  supplier?: string
}
```

### Stock Transaction

```typescript
{
  id: string
  itemId: string
  type: 'add' | 'use'
  quantity: number
  date: string
  pondId?: string
  notes?: string
  unitCost?: number
}
```

## Benefits

✅ **Real-time Stock Tracking**: Always know what's available
✅ **Automatic Alerts**: Never run out of critical items
✅ **Cost Management**: Track spending on inventory
✅ **Usage Analytics**: See consumption patterns by pond
✅ **Integrated System**: Stock purchases automatically create expenses
✅ **Historical Records**: Complete transaction history
✅ **Supplier Management**: Track where items come from
✅ **Flexible Units**: Support various measurement types
✅ **Multi-pond Support**: Track usage per pond
✅ **Professional POS Experience**: Easy-to-use interface

## Future Enhancements (Potential)

- 📊 Stock usage trends and charts
- 📅 Reorder scheduling and reminders
- 📦 Batch/lot tracking for items
- 🔄 Automatic reorder suggestions
- 📱 Mobile-optimized inventory scanning
- 📈 Consumption forecasting
- 💾 Export inventory reports
- 🔍 Advanced filtering and search
- 📊 Cost analysis by time period
- 🏪 Multiple supplier comparison

## Technical Notes

- All data currently stored in React state (client-side)
- Ready for backend API integration
- Currency formatted in LKR (Sri Lankan Rupees)
- Automatic validation for stock availability
- Transaction timestamps for audit trail
- Linked to pond management system

---

**Status**: ✅ Fully Functional with Mock Data
**Next Step**: Backend API integration for data persistence
