@echo off
setlocal EnableExtensions
title Creator Studio v4 - publish to nastime
cd /d "%~dp0"

echo.
echo  ===== Creator Studio v4 on nastime =====
echo.
echo   Builds the web app and copies it to the NAS, where the iPad (and any
echo   browser) opens it. The phone and Windows apps are not changed - build.bat
echo   does those.
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo  Node.js is not installed. Get the LTS version from nodejs.org, then run this again.
  goto :done
)

rem --- where the NAS folder is, asked once and kept in nas-target.txt
set "DEST="
if exist nas-target.txt set /p DEST=<nas-target.txt
if not defined DEST (
  echo  Where is the creator-studio-v4 folder on the NAS?
  echo  In CasaOS Files, share /DATA/AppData/Projects/creator-studio-v4 over the
  echo  network, then type its address, for example:
  echo      \\192.168.4.23\creator-studio-v4
  echo.
  set /p DEST=" Folder: "
)
if not defined DEST goto :done
if not exist "%DEST%\" (
  echo.
  echo  Can't reach %DEST%
  echo  Check the share in CasaOS Files, or that this PC is on the home network.
  echo  To pick a different folder, delete nas-target.txt and run this again.
  goto :done
)
> nas-target.txt echo %DEST%

echo.
echo  Building the web app...
call node scripts\copy-web.js
if errorlevel 1 goto :failed

echo.
echo  Copying to %DEST%\www ...
robocopy www "%DEST%\www" /MIR /NFL /NDL /NJH /NJS /NP /R:1 /W:1
if errorlevel 8 goto :failed
copy /y nas\Caddyfile "%DEST%\Caddyfile" >nul
if errorlevel 1 goto :failed

echo.
echo  Done. Open Creator Studio on the iPad - it picks up the new version on
echo  its own the next time it opens with the NAS in reach.
goto :done

:failed
echo.
echo  Something went wrong - nothing above this line is lost. Send me the
echo  messages above if it keeps happening.

:done
echo.
pause
