@echo off
echo ========================================
echo 执行 SQL 迁移脚本
echo ========================================
echo.

REM 从 .env.local 读取配置
for /f "tokens=2 delims==" %%a in ('findstr "NEXT_PUBLIC_SUPABASE_URL" .env.local') do set SUPABASE_URL=%%a
for /f "tokens=2 delims==" %%a in ('findstr "SUPABASE_SERVICE_ROLE_KEY" .env.local') do set SUPABASE_KEY=%%a

if "%SUPABASE_URL%"=="" (
    echo ❌ 无法读取 NEXT_PUBLIC_SUPABASE_URL
    exit /b 1
)

if "%SUPABASE_KEY%"=="" (
    echo ❌ 无法读取 SUPABASE_SERVICE_ROLE_KEY
    exit /b 1
)

echo ✅ 配置读取成功
echo    URL: %SUPABASE_URL%
echo.

REM 提取数据库连接信息
for /f "tokens=3 delims=/" %%a in ("%SUPABASE_URL%") do set DB_HOST=%%a
set DB_PORT=5432
set DB_NAME=postgres
set DB_USER=postgres

echo 🔧 正在连接数据库...
echo.

REM 执行 SQL 文件
psql -h %DB_HOST%.db.supabase.co -p %DB_PORT% -U %DB_USER% -d %DB_NAME% -f add-order-cny-fields.sql

if %errorlevel% equ 0 (
    echo.
    echo 🎉 SQL 迁移执行成功！
) else (
    echo.
    echo ❌ SQL 迁移执行失败
    echo 💡 请检查：
    echo    1. 是否安装了 psql 命令行工具
    echo    2. 数据库连接信息是否正确
    echo    3. 或者直接在 Supabase Dashboard 中执行 SQL
)

pause
