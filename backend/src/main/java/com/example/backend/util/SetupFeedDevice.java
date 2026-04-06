package com.example.backend.util;

import java.sql.*;

/**
 * Database setup utility to create feeding device if needed
 * Run this if the device doesn't exist in database
 */
public class SetupFeedDevice {

    private static final String DB_URL = "jdbc:mysql://187.77.189.5:3306/u626686198_fishfeed?useSSL=false&allowPublicKeyRetrieval=true&serverTimezone=UTC";
    private static final String DB_USER = "u626686198_fishfeedu";
    private static final String DB_PASSWORD = "FrevCf&1:2";

    public static void main(String[] args) {
        System.out.println("========================================");
        System.out.println("Setting up Feeding Device in Database");
        System.out.println("========================================\n");

        try (Connection conn = DriverManager.getConnection(DB_URL, DB_USER, DB_PASSWORD)) {
            System.out.println("✓ Connected to database");

            // Check if table exists
            if (tableExists(conn, "sensor_devices")) {
                System.out.println("✓ Table 'sensor_devices' exists");

                // Check if columns exist, add if missing
                ensureColumnsExist(conn);
            } else {
                System.out.println("✗ Table 'sensor_devices' doesn't exist");
                System.out.println("Creating table...");
                createTable(conn);
            }

            // Insert or update device
            System.out.println("\nInserting/updating device 'feed_device_001'...");
            insertDevice(conn);

            // Verify
            System.out.println("\nVerifying device:");
            verifyDevice(conn);

            System.out.println("\n========================================");
            System.out.println("SUCCESS! Setup complete");
            System.out.println("========================================");
            System.out.println("\nYou can now:");
            System.out.println("1. Refresh your frontend dashboard");
            System.out.println("2. Device should show as 'offline' instead of 'Blocked'");
            System.out.println("3. Upload ESP32 code to make device go online");

        } catch (SQLException e) {
            System.err.println("\n========================================");
            System.err.println("ERROR! Setup failed");
            System.err.println("========================================");
            System.err.println("\nReason: " + e.getMessage());
            e.printStackTrace();
        }
    }

    private static boolean tableExists(Connection conn, String tableName) throws SQLException {
        DatabaseMetaData meta = conn.getMetaData();
        try (ResultSet rs = meta.getTables(null, null, tableName, new String[] { "TABLE" })) {
            return rs.next();
        }
    }

    private static void createTable(Connection conn) throws SQLException {
        String sql = """
                CREATE TABLE sensor_devices (
                    id BIGINT AUTO_INCREMENT PRIMARY KEY,
                    device_id VARCHAR(255) UNIQUE NOT NULL,
                    device_type VARCHAR(50),
                    pond_id BIGINT,
                    status VARCHAR(50),
                    ip_address VARCHAR(50),
                    rssi INT,
                    energy_wh DOUBLE,
                    last_seen DATETIME,
                    created_at DATETIME,
                    hopper_level DOUBLE DEFAULT 0,
                    hopper_capacity DOUBLE DEFAULT 20000,
                    hopper_percentage DOUBLE DEFAULT 0,
                    plate_speed DOUBLE DEFAULT 0,
                    motor_status VARCHAR(50) DEFAULT 'STOPPED',
                    feeding_active BOOLEAN DEFAULT FALSE
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
                """;

        try (Statement stmt = conn.createStatement()) {
            stmt.executeUpdate(sql);
            System.out.println("✓ Table created successfully");
        }
    }

    private static void ensureColumnsExist(Connection conn) throws SQLException {
        String[] columns = {
                "hopper_level DOUBLE DEFAULT 0",
                "hopper_capacity DOUBLE DEFAULT 20000",
                "hopper_percentage DOUBLE DEFAULT 0",
                "plate_speed DOUBLE DEFAULT 0",
                "motor_status VARCHAR(50) DEFAULT 'STOPPED'",
                "feeding_active BOOLEAN DEFAULT FALSE"
        };

        DatabaseMetaData meta = conn.getMetaData();
        try (ResultSet rs = meta.getColumns(null, null, "sensor_devices", null)) {
            java.util.Set<String> existingColumns = new java.util.HashSet<>();
            while (rs.next()) {
                existingColumns.add(rs.getString("COLUMN_NAME").toLowerCase());
            }

            try (Statement stmt = conn.createStatement()) {
                for (String column : columns) {
                    String columnName = column.split(" ")[0];
                    if (!existingColumns.contains(columnName.toLowerCase())) {
                        String alterSql = "ALTER TABLE sensor_devices ADD COLUMN " + column;
                        stmt.executeUpdate(alterSql);
                        System.out.println("✓ Added column: " + columnName);
                    }
                }
            }
        }
    }

    private static void insertDevice(Connection conn) throws SQLException {
        String sql = """
                INSERT INTO sensor_devices
                (device_id, device_type, status, hopper_capacity, hopper_level, hopper_percentage,
                 plate_speed, motor_status, feeding_active, created_at, last_seen)
                VALUES
                (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
                ON DUPLICATE KEY UPDATE
                    device_type = VALUES(device_type),
                    hopper_capacity = VALUES(hopper_capacity),
                    last_seen = NOW()
                """;

        try (PreparedStatement pstmt = conn.prepareStatement(sql)) {
            pstmt.setString(1, "feed_device_001");
            pstmt.setString(2, "FEEDING_MANAGEMENT");
            pstmt.setString(3, "offline");
            pstmt.setDouble(4, 20000);
            pstmt.setDouble(5, 0);
            pstmt.setDouble(6, 0);
            pstmt.setDouble(7, 0);
            pstmt.setString(8, "STOPPED");
            pstmt.setBoolean(9, false);

            int rows = pstmt.executeUpdate();
            System.out.println("✓ Device inserted/updated (" + rows + " row affected)");
        }
    }

    private static void verifyDevice(Connection conn) throws SQLException {
        String sql = "SELECT device_id, device_type, status, hopper_level, hopper_capacity, last_seen " +
                "FROM sensor_devices WHERE device_id = ?";

        try (PreparedStatement pstmt = conn.prepareStatement(sql)) {
            pstmt.setString(1, "feed_device_001");

            try (ResultSet rs = pstmt.executeQuery()) {
                if (rs.next()) {
                    System.out.println("  Device ID: " + rs.getString("device_id"));
                    System.out.println("  Type: " + rs.getString("device_type"));
                    System.out.println("  Status: " + rs.getString("status"));
                    System.out.println("  Hopper Level: " + rs.getDouble("hopper_level") + "g");
                    System.out.println("  Hopper Capacity: " + rs.getDouble("hopper_capacity") + "g");
                    System.out.println("  Last Seen: " + rs.getTimestamp("last_seen"));
                } else {
                    System.out.println("✗ Device not found!");
                }
            }
        }
    }
}
