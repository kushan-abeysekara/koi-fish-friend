@echo off
echo ====================================
echo Power Management Database Migration
echo ====================================
echo.

REM Set database connection details
set PGHOST=localhost
set PGPORT=5432
set PGDATABASE=koi_management
set PGUSER=postgres

echo Running migration: add_power_management_columns.sql
psql -U %PGUSER% -d %PGDATABASE% -f add_power_management_columns.sql

echo.
echo ====================================
echo Migration complete!
echo ====================================
pause
