# Koi Fish Friend - Backend

Spring Boot REST API for Koi Fish Farm Management System

## Features

✅ **Pond Management** - Create, update, and manage multiple fish ponds  
✅ **Fish Count Tracking** - Record and track daily fish counts per pond  
✅ **Expenditure Management** - Track all farm expenses by category and pond  
✅ **Inventory System** - POS-style inventory management with stock tracking  
✅ **Stock Transactions** - Add/use stock with automatic expenditure creation  
✅ **Low Stock Alerts** - Automatic alerts for items below reorder level  
✅ **Financial Reports** - Total expenditures by pond, category, and overall

## Tech Stack

- **Java 21**
- **Spring Boot 3.5.6**
- **Spring Data JPA** - Database operations
- **Spring Security** - Authentication & Authorization
- **MySQL 8** - Database
- **Maven** - Build tool

## Prerequisites

- Java 21 or higher
- Maven 3.6+
- MySQL 8.0+

## Database Configuration

The application is pre-configured to connect to the remote MySQL database:

```properties
spring.datasource.url=jdbc:mysql://82.197.82.97:3306/u626686198_fishfeed
spring.datasource.username=u626686198_fishfeedu
spring.datasource.password=FrevCf&1:2
```

The database tables will be created automatically on first run (`spring.jpa.hibernate.ddl-auto=update`).

## Installation & Setup

### 1. Clone the repository

```bash
git clone <repository-url>
cd backend
```

### 2. Build the project

```bash
mvn clean install
```

### 3. Run the application

```bash
mvn spring-boot:run
```

Or run the JAR file:

```bash
java -jar target/backend-0.0.1-SNAPSHOT.jar
```

The API will start on `http://localhost:8080`

## API Endpoints

See [API_DOCUMENTATION.md](API_DOCUMENTATION.md) for complete API documentation.

### Quick Reference

#### Ponds

- `GET /api/ponds` - Get all ponds
- `POST /api/ponds` - Create pond
- `PUT /api/ponds/{id}` - Update pond
- `DELETE /api/ponds/{id}` - Delete pond

#### Fish Counts

- `GET /api/fish-counts` - Get all fish counts
- `GET /api/fish-counts/pond/{pondId}` - Get counts by pond
- `POST /api/fish-counts` - Create fish count
- `PUT /api/fish-counts/{id}` - Update fish count
- `DELETE /api/fish-counts/{id}` - Delete fish count

#### Expenditures

- `GET /api/expenditures` - Get all expenditures
- `GET /api/expenditures/pond/{pondId}` - Get by pond
- `GET /api/expenditures/category/{category}` - Get by category
- `GET /api/expenditures/totals` - Get total amounts
- `POST /api/expenditures` - Create expenditure
- `PUT /api/expenditures/{id}` - Update expenditure
- `DELETE /api/expenditures/{id}` - Delete expenditure

#### Inventory

- `GET /api/inventory` - Get all items
- `GET /api/inventory/low-stock` - Get low stock items
- `GET /api/inventory/total-value` - Get total inventory value
- `POST /api/inventory` - Create inventory item
- `PUT /api/inventory/{id}` - Update item
- `DELETE /api/inventory/{id}` - Delete item

#### Stock Transactions

- `GET /api/stock-transactions` - Get all transactions
- `GET /api/stock-transactions/item/{itemId}` - Get by item
- `POST /api/stock-transactions` - Create transaction (add/use stock)
- `DELETE /api/stock-transactions/{id}` - Delete transaction

## Project Structure

```
backend/
├── src/
│   ├── main/
│   │   ├── java/com/example/backend/
│   │   │   ├── config/              # Security & Data initialization
│   │   │   ├── controller/          # REST API endpoints
│   │   │   │   ├── AuthController.java
│   │   │   │   ├── PondController.java
│   │   │   │   ├── FishCountController.java
│   │   │   │   ├── ExpenditureController.java
│   │   │   │   ├── InventoryItemController.java
│   │   │   │   └── StockTransactionController.java
│   │   │   ├── dto/                 # Data Transfer Objects
│   │   │   │   ├── ApiResponse.java
│   │   │   │   ├── PondRequest.java
│   │   │   │   ├── FishCountRequest.java
│   │   │   │   ├── ExpenditureRequest.java
│   │   │   │   ├── InventoryItemRequest.java
│   │   │   │   └── StockTransactionRequest.java
│   │   │   ├── entity/              # JPA Entities
│   │   │   │   ├── User.java
│   │   │   │   ├── Pond.java
│   │   │   │   ├── FishCount.java
│   │   │   │   ├── Expenditure.java
│   │   │   │   ├── InventoryItem.java
│   │   │   │   └── StockTransaction.java
│   │   │   ├── repository/          # JPA Repositories
│   │   │   │   ├── UserRepository.java
│   │   │   │   ├── PondRepository.java
│   │   │   │   ├── FishCountRepository.java
│   │   │   │   ├── ExpenditureRepository.java
│   │   │   │   ├── InventoryItemRepository.java
│   │   │   │   └── StockTransactionRepository.java
│   │   │   ├── service/             # Business Logic
│   │   │   │   ├── PondService.java
│   │   │   │   ├── FishCountService.java
│   │   │   │   ├── ExpenditureService.java
│   │   │   │   ├── InventoryItemService.java
│   │   │   │   └── StockTransactionService.java
│   │   │   └── BackendApplication.java
│   │   └── resources/
│   │       └── application.properties
│   └── test/
├── pom.xml
├── API_DOCUMENTATION.md
└── README.md
```

## Key Features Explained

### 1. Automatic Expenditure Creation

When stock is added to inventory (`type: "add"`), an expenditure is automatically created in the "Inventory Purchases" category. This ensures all purchases are tracked in the expenditure system.

### 2. Stock Management

- **Add Stock**: Increases inventory, creates expenditure
- **Use Stock**: Decreases inventory, requires pond assignment
- **Low Stock Alerts**: Items with `currentStock <= reorderLevel`

### 3. Multi-Pond Support

All expenditures and fish counts are associated with specific ponds, allowing for per-pond financial tracking and analysis.

### 4. Category System

**Manual Entry Categories:**

- Maintenance and Repairs
- Fish Stocking
- Infrastructure

**Automatic Category:**

- Inventory Purchases (created when stock is added)

## Testing the API

### Using cURL

**Create a Pond:**

```bash
curl -X POST http://localhost:8080/api/ponds \
  -H "Content-Type: application/json" \
  -d '{"name": "Pond 1", "color": "blue"}'
```

**Get All Ponds:**

```bash
curl http://localhost:8080/api/ponds
```

**Create Fish Count:**

```bash
curl -X POST http://localhost:8080/api/fish-counts \
  -H "Content-Type: application/json" \
  -d '{"date": "2024-11-23", "pondId": 1, "count": 150, "notes": "Healthy"}'
```

### Using Postman

1. Import the API endpoints from `API_DOCUMENTATION.md`
2. Set base URL to `http://localhost:8080/api`
3. Use JSON format for request bodies

## Development

### Build without tests

```bash
mvn clean install -DskipTests
```

### Run in development mode

```bash
mvn spring-boot:run
```

### Package as JAR

```bash
mvn clean package
```

## Troubleshooting

### Port already in use

Change the port in `application.properties`:

```properties
server.port=8081
```

### Database connection issues

Verify MySQL is running and credentials are correct in `application.properties`

### Build errors

Ensure Java 21 and Maven 3.6+ are installed:

```bash
java -version
mvn -version
```

## Security

The application uses Spring Security with basic authentication. Update `SecurityConfig.java` to customize authentication and authorization.

## License

This project is for educational and commercial use.

## Contributors

- Backend API Development
- Database Design
- Spring Boot Architecture

## Support

For issues and feature requests, please contact the development team.
