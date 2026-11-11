@echo off
setlocal EnableExtensions EnableDelayedExpansion
title Creator Studio 3 - publish an update
cd /d "%~dp0"

echo.
echo  ===== Publish to GitHub =====
echo.
echo   This sends the web app to GitHub, which updates the iPad.
echo   It does NOT build the phone APK or the Windows app -
echo   build.bat does those, and offers to push at the end too.
echo.

where git >nul 2>nul
if errorlevel 1 (
  echo  Git is not installed. Get it from git-scm.com, then run this again.
  goto :done
)

if not exist .git (
  echo  This folder is not a git repository.
  echo  Extract the zip OVER your existing creator-studio-3 folder, so the
  echo  hidden .git folder is kept, then run this again.
  goto :done
)

rem --- the remote, re-added if a zip replaced .git and took it away
git remote get-url origin >nul 2>nul
if errorlevel 1 (
  echo  Setting the GitHub address, which this folder had lost...
  git remote add origin https://github.com/solakirus/creator-studio-3.git
)

rem --- is there anything to publish?
git status --porcelain > "%TEMP%\cs3changes.txt"
for /f %%A in ('find /c /v "" ^< "%TEMP%\cs3changes.txt"') do set COUNT=%%A
del "%TEMP%\cs3changes.txt" >nul 2>nul

if "%COUNT%"=="0" (
  echo  Nothing has changed since the last publish.
  echo.
  choice /c YN /n /m "  Push anyway, in case the last one did not finish? [Y/N] "
  if errorlevel 2 goto :done
  goto :push
)

echo  %COUNT% file^(s^) changed.
echo.
set "MSG="
set /p MSG="  What changed? (press Enter for 'Update')  "
if "!MSG!"=="" set "MSG=Update"

git add -A
if errorlevel 1 goto :failed
git commit -m "!MSG!"
if errorlevel 1 goto :failed

:push
echo.
echo  Sending to GitHub...
git push -u origin main
if errorlevel 1 goto :failed

echo.
echo  Done. GitHub is building it now - about a minute.
echo.
echo    Watch it:  https://github.com/solakirus/creator-studio-3/actions
echo    The app:   https://solakirus.github.io/creator-studio-3/
echo.
echo  On the iPad, open the app with signal and it updates itself.
echo.
choice /c YN /n /m "  Open the Actions page to watch? [Y/N] "
if errorlevel 2 goto :done
start "" "https://github.com/solakirus/creator-studio-3/actions"
goto :done

:failed
echo.
echo  Something went wrong. Scroll up for the error, or paste it to Claude.
echo.
echo  If it says the remote has work you do not have, someone (or a zip)
echo  changed things on GitHub. Do NOT force past it without asking.

:done
echo.
pause
