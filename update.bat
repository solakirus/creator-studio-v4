@echo off
setlocal EnableExtensions EnableDelayedExpansion
title Creator Studio v4 - update
cd /d "%~dp0"

rem  One click for every update. Double-click it, or drop an update zip on it.
rem
rem    1. Gets the update: the zip you dropped on it, else the newest
rem       cs4-update-*.zip in Downloads it hasn't used yet, else whatever is
rem       new on GitHub (what Claude pushed there).
rem    2. Sends it to GitHub (your phone, laptop and nastime pick it up from
rem       there) and copies it to nastime straight away if this PC can reach it.
rem    3. Rebuilds and reinstalls the Windows app ONLY when the update changed
rem       the app itself (electron\, android\, package.json). Most updates
rem       don't - every device downloads them on its own and offers Restart now.

echo.
echo  ===== Creator Studio v4 - update =====
echo.

where git >nul 2>nul || (echo  Git is not installed. Get it from git-scm.com, then run this again. & goto :done)
where node >nul 2>nul || (echo  Node.js is not installed. Get the LTS version from nodejs.org, then run this again. & goto :done)

rem --- a folder with no history yet gets one, so we can tell what an update changed
if not exist .git (
  echo  First run: starting this folder's history...
  git init -q -b main
  git add -A
  git -c user.name="Kris Catten" -c user.email="solakirus@gmail.com" commit -q -m "Creator Studio v4"
)
git config user.name >nul 2>nul || git config user.name "Kris Catten"
git config user.email >nul 2>nul || git config user.email "solakirus@gmail.com"
git remote get-url origin >nul 2>nul || git remote add origin https://github.com/solakirus/creator-studio-v4.git

rem --- anything changed by hand in this folder is kept as its own step first
git add -A >nul 2>nul
git diff --cached --quiet || git commit -q -m "Changes made on this computer"

for /f %%H in ('git rev-parse HEAD') do set "OLD=%%H"

rem --- 1. the update: first whatever is new on GitHub (what Claude pushed), then a zip
git ls-remote --exit-code origin main >nul 2>nul
if errorlevel 1 (
  echo  GitHub isn't set up yet, or no internet - see PUT IT ON GITHUB.txt. Carrying on.
) else (
  git pull -q --ff-only origin main 2>nul
  if errorlevel 1 (
    echo.
    echo  GitHub has changes this folder can't simply add on top of.
    echo  Nothing was changed. Paste this window to Claude.
    goto :failed
  )
  call :pulled
)

set "ZIP=%~1"
if not defined ZIP (
  for /f "delims=" %%F in ('dir /b /o-d "%USERPROFILE%\Downloads\cs4-update-*.zip" 2^>nul') do (
    if not defined ZIP (
      findstr /x /c:"%%F" .applied-updates.txt >nul 2>nul || set "ZIP=%USERPROFILE%\Downloads\%%F"
    )
  )
)
if defined ZIP (
  for %%Z in ("!ZIP!") do set "ZNAME=%%~nxZ"
  echo  Using !ZNAME!
  powershell -NoProfile -Command "$ProgressPreference='SilentlyContinue'; Expand-Archive -LiteralPath '!ZIP!' -DestinationPath '.' -Force"
  if errorlevel 1 (
    echo  Could not open the zip.
    goto :failed
  )
  >> .applied-updates.txt echo !ZNAME!
  git add -A
  git diff --cached --quiet && (echo  That zip had nothing new.) || git commit -q -m "Update: !ZNAME!"
)

for /f %%H in ('git rev-parse HEAD') do set "NEW=%%H"
if "%OLD%"=="%NEW%" (
  echo.
  echo  Already up to date - nothing new to send.
)

rem --- did the app itself change? (otherwise every device updates on its own)
set "SHELL="
for /f %%F in ('git diff --name-only %OLD% %NEW% -- electron android native package.json 2^>nul') do set "SHELL=1"

rem --- 2. out to GitHub and nastime
echo.
echo  Sending to GitHub...
set "AHEAD=1"
git rev-parse -q --verify origin/main >nul 2>nul && (
  for /f %%C in ('git rev-list --count origin/main..HEAD') do if "%%C"=="0" set "AHEAD="
)
if not defined AHEAD (
  echo  GitHub already has it.
) else (
  git push -q -u origin main 2>nul
  if errorlevel 1 (
    echo  Could not send to GitHub - not set up yet, or no internet. Carrying on;
    echo  run this again later and it sends it then.
  ) else (
    echo  GitHub has it. Phone, laptop and nastime update from there in a few minutes.
  )
)
echo.
echo  Copying to nastime...
call publish-nas.bat /quiet

rem --- 3. only when the app itself changed
if defined SHELL (
  echo.
  echo  This update changes the app itself, so the Windows app is being rebuilt.
  call npm install --no-audit --no-fund || goto :failed
  taskkill /im "Creator Studio v4.exe" /f >nul 2>nul
  call npm run dist:win || goto :failed
  set "SETUP="
  for /f "delims=" %%F in ('dir /b /o-d "dist\*Setup*.exe" 2^>nul') do if not defined SETUP set "SETUP=dist\%%F"
  if defined SETUP (
    echo  Installing !SETUP! ...
    start "" /wait "!SETUP!"
  )
  echo.
  echo  The phone needs a new APK for this one too: run build.bat and answer Y
  echo  to Android, or wait - the phone keeps working on its current version.
) else (
  echo.
  echo  Nothing to install. Every device downloads this on its own within 30
  echo  minutes and offers Restart now - or Settings, App updates, Check now.
)
goto :done

:pulled
for /f %%H in ('git rev-parse HEAD') do if not "%%H"=="%OLD%" echo  Got what was new on GitHub.
exit /b 0

:failed
echo.
echo  Something went wrong - nothing that was working is lost. Paste this
echo  window to Claude.

:done
echo.
pause
