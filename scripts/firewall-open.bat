@echo off
REM ─────────────────────────────────────────────────────────
REM HandFrame — Open Windows Firewall for LAN Development
REM Must be run as Administrator
REM ─────────────────────────────────────────────────────────

echo.
echo ═══════════════════════════════════════════════════
echo   HandFrame — Firewall Rule Setup
echo ═══════════════════════════════════════════════════
echo.

REM Check for admin privileges
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: This script must be run as Administrator.
    echo Right-click this file and select "Run as administrator".
    pause
    exit /b 1
)

REM Remove existing rule if it exists (idempotent)
netsh advfirewall firewall delete rule name="HandFrame Dev Server" >nul 2>&1

REM Add inbound TCP rule for port 5173
netsh advfirewall firewall add rule ^
    name="HandFrame Dev Server" ^
    dir=in ^
    action=allow ^
    protocol=TCP ^
    localport=5173 ^
    profile=private ^
    description="Allow inbound connections to HandFrame Vite dev server on port 5173 from private network devices"

if %errorlevel% equ 0 (
    echo.
    echo SUCCESS: Firewall rule "HandFrame Dev Server" created.
    echo   Direction: Inbound
    echo   Protocol:  TCP
    echo   Port:      5173
    echo   Profile:   Private (same Wi-Fi network)
    echo.
    echo Other devices on the same Wi-Fi can now connect to this laptop.
) else (
    echo.
    echo FAILED: Could not create firewall rule.
)

echo.
pause
