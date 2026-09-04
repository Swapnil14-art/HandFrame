@echo off
REM Remove the HandFrame firewall rule (run as Administrator)
netsh advfirewall firewall delete rule name="HandFrame Dev Server"
echo Firewall rule "HandFrame Dev Server" removed.
pause
