@echo off
setlocal EnableExtensions
title Creator Studio 3 - build
cd /d "%~dp0"

rem Where Creator Studio v2 lives. Only read, the first time, to copy its Android project.
set "V2=C:\Users\Khale\Projects\creator-studio-v2"

echo.
echo  ===== Creator Studio 3 =====
echo.

where npm >nul 2>nul
if errorlevel 1 (
  echo  Node.js is not installed. Get the LTS version from nodejs.org, then run this again.
  goto :done
)

rem --- 1. Android project, first time only: copied from v2 and given its own identity
if exist android goto :packages
echo  First run: setting up the Android project from Creator Studio v2.
echo  v2 itself is not changed.
call node scripts\android-setup.js "%V2%"
if errorlevel 1 goto :failed

:packages
echo.
echo  Checking packages. The first time takes a few minutes...
call npm install --no-audit --no-fund
if errorlevel 1 goto :failed
call node scripts\copy-web.js
if errorlevel 1 goto :failed
if not exist dist mkdir dist

rem --- 2. Windows app
echo.
choice /c YN /n /m " Build the Windows app? [Y/N] "
if errorlevel 2 goto :android
taskkill /im "Creator Studio 3.exe" /f >nul 2>nul
rem electron-builder's Windows tools archive contains Mac symlinks Windows won't create
rem without Developer Mode. Unpack it once ourselves, skipping those.
set "WCS=%LOCALAPPDATA%\electron-builder\Cache\winCodeSign"
if not exist "%WCS%\winCodeSign-2.6.0\rcedit-x64.exe" (
  echo  Preparing the Windows build tools, one time only...
  if not exist "%WCS%" mkdir "%WCS%"
  powershell -NoProfile -Command "$ProgressPreference='SilentlyContinue'; Invoke-WebRequest -UseBasicParsing 'https://github.com/electron-userland/electron-builder-binaries/releases/download/winCodeSign-2.6.0/winCodeSign-2.6.0.7z' -OutFile '%WCS%\wcs.7z'"
  "node_modules\7zip-bin\win\x64\7za.exe" x -y -bd "%WCS%\wcs.7z" "-o%WCS%\winCodeSign-2.6.0" >nul 2>nul
  del "%WCS%\wcs.7z" >nul 2>nul
)
if not exist "%WCS%\winCodeSign-2.6.0\rcedit-x64.exe" (
  echo  Could not prepare the Windows build tools. Turn on Developer Mode in Windows Settings, then run this again.
  goto :failed
)
call npm run dist:win
if errorlevel 1 goto :failed
echo  Windows app ready in dist: the installer and a portable exe.

rem --- 3. Android app
:android
echo.
choice /c YN /n /m " Build the Android APK? [Y/N] "
if errorlevel 2 goto :git
if not defined ANDROID_HOME if exist "%LOCALAPPDATA%\Android\Sdk" set "ANDROID_HOME=%LOCALAPPDATA%\Android\Sdk"
if not defined JAVA_HOME if exist "%ProgramFiles%\Android\Android Studio\jbr" set "JAVA_HOME=%ProgramFiles%\Android\Android Studio\jbr"
call npm run android:sync
if errorlevel 1 goto :failed
if not defined ANDROID_HOME (
  echo  Android project updated, but Android Studio was not found. Open it with: npm run android:open
  goto :git
)
pushd android
call gradlew.bat assembleDebug
if errorlevel 1 (
  popd
  goto :failed
)
popd
copy /y android\app\build\outputs\apk\debug\app-debug.apk "dist\Creator Studio 3.apk" >nul
if exist "dist\Creator Studio 3.apk" set "APKOUT=%~dp0dist\Creator Studio 3.apk"
echo  APK ready. It installs beside Creator Studio v2 - it does not replace it.

rem --- 4. Save this version in git
:git
if not exist .git goto :finish
where git >nul 2>nul
if errorlevel 1 goto :finish
for /f %%T in ('powershell -NoProfile -Command "Get-Date -Format yyyy-MM-dd_HHmm"') do set "STAMP=%%T"
git add -A >nul
git commit -q -m "Build %STAMP%" >nul 2>nul
git remote get-url origin >nul 2>nul
if errorlevel 1 goto :finish
echo.
choice /c YN /n /m " Push to GitHub? [Y/N] "
if errorlevel 2 goto :finish
git push
if errorlevel 1 goto :failed

:finish
echo.
echo  All done.
if defined APKOUT (
  explorer /select,"%APKOUT%"
) else (
  if exist dist start "" "%~dp0dist"
)
goto :done

:failed
echo.
echo  Something went wrong. Scroll up to see the error, or paste it to Claude.

:done
echo.
pause
