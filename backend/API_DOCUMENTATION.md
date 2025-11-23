# Koi Fish Friend - Backend API Documentation

## Base URL

```
http://localhost:8080/api
```

## Authentication

Currently, the API uses basic authentication. Login endpoint available at `/api/auth/login`

---

## API Endpoints

### 1. Ponds Management

#### Get All Ponds

```http
GET /api/ponds
```

**Response:**

```json
{
  "success": true,
  "message": "Ponds retrieved successfully",
  "data": [
    {
      "id": 1,
      "name": "Pond 1",
      "color": "blue",
      "createdAt": "2024-11-23T10:00:00",
      "updatedAt": "2024-11-23T10:00:00"
    }
  ]
}
```

#### Get Pond by ID

```http
GET /api/ponds/{id}
```

#### Create Pond

```http
POST /api/ponds
Content-Type: application/json

{
  "name": "Pond 3",
  "color": "green"
}
```

#### Update Pond

```http
PUT /api/ponds/{id}
Content-Type: application/json

{
  "name": "Updated Pond Name",
  "color": "purple"
}
```

#### Delete Pond

```http
DELETE /api/ponds/{id}
```

---

### 2. Fish Count Management

#### Get All Fish Counts

```http
GET /api/fish-counts
```

**Response:**

```json
{
  "success": true,
  "message": "Fish counts retrieved successfully",
  "data": [
    {
      "id": 1,
      "date": "2024-11-23",
      "pond": {
        "id": 1,
        "name": "Pond 1",
        "color": "blue"
      },
      "count": 150,
      "notes": "Healthy population",
      "createdAt": "2024-11-23T10:00:00",
      "updatedAt": "2024-11-23T10:00:00"
    }
  ]
}
```

#### Get Fish Counts by Pond

```http
GET /api/fish-counts/pond/{pondId}
```

#### Get Fish Counts by Date Range

```http
GET /api/fish-counts/pond/{pondId}/date-range?startDate=2024-01-01&endDate=2024-12-31
```

#### Create Fish Count

```http
POST /api/fish-counts
Content-Type: application/json

{
  "date": "2024-11-23",
  "pondId": 1,
  "count": 150,
  "notes": "Regular count"
}
```

#### Update Fish Count

```http
PUT /api/fish-counts/{id}
Content-Type: application/json

{
  "date": "2024-11-23",
  "pondId": 1,
  "count": 155,
  "notes": "Updated count"
}
```

#### Delete Fish Count

```http
DELETE /api/fish-counts/{id}
```

---

### 3. Expenditure Management

#### Get All Expenditures

```http
GET /api/expenditures
```

**Response:**

```json
{
  "success": true,
  "message": "Expenditures retrieved successfully",
  "data": [
    {
      "id": 1,
      "date": "2024-11-23",
      "category": "Maintenance and Repairs",
      "subcategory": "Equipment repair (pumps, motors, feeders, sensors)",
      "description": "Fixed water pump",
      "amount": 5000.0,
      "pond": {
        "id": 1,
        "name": "Pond 1"
      },
      "createdAt": "2024-11-23T10:00:00",
      "updatedAt": "2024-11-23T10:00:00"
    }
  ]
}
```

#### Get Expenditures by Pond

```http
GET /api/expenditures/pond/{pondId}
```

#### Get Expenditures by Category

```http
GET /api/expenditures/category/{category}
```

**Categories:**

- `Maintenance and Repairs`
- `Fish Stocking`
- `Infrastructure`
- `Inventory Purchases`

#### Get Expenditures by Date Range

```http
GET /api/expenditures/pond/{pondId}/date-range?startDate=2024-01-01&endDate=2024-12-31
```

#### Get Total Expenditures

```http
GET /api/expenditures/totals
```

**Response:**

```json
{
  "success": true,
  "message": "Totals retrieved successfully",
  "data": {
    "totalAmount": 125000.0
  }
}
```

#### Get Total by Pond

```http
GET /api/expenditures/totals/pond/{pondId}
```

#### Get Total by Category

```http
GET /api/expenditures/totals/category/{category}
```

#### Create Expenditure

```http
POST /api/expenditures
Content-Type: application/json

{
  "date": "2024-11-23",
  "category": "Maintenance and Repairs",
  "subcategory": "Equipment repair (pumps, motors, feeders, sensors)",
  "description": "Fixed water pump motor",
  "amount": 5000.00,
  "pondId": 1
}
```

#### Update Expenditure

```http
PUT /api/expenditures/{id}
Content-Type: application/json

{
  "date": "2024-11-23",
  "category": "Maintenance and Repairs",
  "subcategory": "Equipment repair (pumps, motors, feeders, sensors)",
  "description": "Fixed and serviced water pump motor",
  "amount": 6000.00,
  "pondId": 1
}
```

#### Delete Expenditure

```http
DELETE /api/expenditures/{id}
```

---

### 4. Inventory Management

#### Get All Inventory Items

```http
GET /api/inventory
```

**Response:**

```json
{
  "success": true,
  "message": "Inventory items retrieved successfully",
  "data": [
    {
      "id": 1,
      "name": "Water Filter",
      "category": "Equipment",
      "currentStock": 15.0,
      "unit": "pieces",
      "reorderLevel": 5.0,
      "costPerUnit": 2500.0,
      "lastRestocked": "2024-11-20",
      "supplier": "Aqua Supplies Ltd",
      "createdAt": "2024-11-20T10:00:00",
      "updatedAt": "2024-11-23T10:00:00"
    }
  ]
}
```

#### Get Inventory Items by Category

```http
GET /api/inventory/category/{category}
```

**Categories:**

- `Equipment`
- `Feed`
- `Chemical`
- `Medicine`
- `Other`

#### Get Low Stock Items

```http
GET /api/inventory/low-stock
```

#### Get Total Inventory Value

```http
GET /api/inventory/total-value
```

**Response:**

```json
{
  "success": true,
  "message": "Total inventory value retrieved successfully",
  "data": {
    "totalValue": 87500.0
  }
}
```

#### Create Inventory Item

```http
POST /api/inventory
Content-Type: application/json

{
  "name": "Water Filter Pro",
  "category": "Equipment",
  "currentStock": 10.00,
  "unit": "pieces",
  "reorderLevel": 5.00,
  "costPerUnit": 3000.00,
  "lastRestocked": "2024-11-23",
  "supplier": "Aqua Supplies Ltd"
}
```

#### Update Inventory Item

```http
PUT /api/inventory/{id}
Content-Type: application/json

{
  "name": "Water Filter Pro Plus",
  "category": "Equipment",
  "currentStock": 12.00,
  "unit": "pieces",
  "reorderLevel": 5.00,
  "costPerUnit": 3200.00,
  "lastRestocked": "2024-11-23",
  "supplier": "Aqua Supplies Ltd"
}
```

#### Delete Inventory Item

```http
DELETE /api/inventory/{id}
```

---

### 5. Stock Transactions

#### Get All Stock Transactions

```http
GET /api/stock-transactions
```

**Response:**

```json
{
  "success": true,
  "message": "Stock transactions retrieved successfully",
  "data": [
    {
      "id": 1,
      "item": {
        "id": 1,
        "name": "Water Filter",
        "category": "Equipment"
      },
      "type": "add",
      "quantity": 5.0,
      "date": "2024-11-23",
      "pond": {
        "id": 1,
        "name": "Pond 1"
      },
      "notes": "Regular restock",
      "unitCost": 2500.0,
      "createdAt": "2024-11-23T10:00:00",
      "updatedAt": "2024-11-23T10:00:00"
    }
  ]
}
```

#### Get Transactions by Item

```http
GET /api/stock-transactions/item/{itemId}
```

#### Get Transactions by Type

```http
GET /api/stock-transactions/type/{type}
```

**Types:** `add` or `use`

#### Get Transactions by Date Range

```http
GET /api/stock-transactions/item/{itemId}/date-range?startDate=2024-01-01&endDate=2024-12-31
```

#### Create Stock Transaction (Add or Use Stock)

```http
POST /api/stock-transactions
Content-Type: application/json

{
  "itemId": 1,
  "type": "add",
  "quantity": 10.00,
  "date": "2024-11-23",
  "pondId": 1,
  "notes": "Regular purchase",
  "unitCost": 2500.00
}
```

**For 'use' type:**

```json
{
  "itemId": 1,
  "type": "use",
  "quantity": 2.0,
  "date": "2024-11-23",
  "pondId": 1,
  "notes": "Replaced old filters"
}
```

**Note:** When type is `add`, an expenditure is automatically created in the "Inventory Purchases" category.

#### Delete Stock Transaction

```http
DELETE /api/stock-transactions/{id}
```

**Note:** This reverses the stock changes automatically.

---

## Error Responses

All endpoints return errors in the following format:

```json
{
  "success": false,
  "message": "Error description here",
  "data": null
}
```

### Common HTTP Status Codes

- `200 OK` - Request successful
- `201 Created` - Resource created successfully
- `400 Bad Request` - Invalid request data
- `404 Not Found` - Resource not found
- `500 Internal Server Error` - Server error

---

## Business Logic Notes

1. **Stock Transactions:**

   - When adding stock (`type: "add"`), an expenditure is automatically created
   - Stock levels are automatically updated
   - Cannot use more stock than available
   - Pond is optional for `add` but required for `use`

2. **Inventory:**

   - Low stock items are those where `currentStock <= reorderLevel`
   - Total value calculated as `currentStock × costPerUnit` for all items

3. **Expenditures:**

   - Categories include manual entries and automatic "Inventory Purchases"
   - All amounts stored in LKR (Sri Lankan Rupees)

4. **Ponds:**
   - Cannot delete ponds with associated data (expenditures, fish counts, etc.)
   - Pond names must be unique

---

## Database Schema

The backend uses MySQL with the following main tables:

- `ponds` - Pond information
- `fish_counts` - Daily fish count records
- `expenditures` - All expense records
- `inventory_items` - Stock items
- `stock_transactions` - Stock add/use history

All tables include `created_at` and `updated_at` timestamps for audit purposes.
