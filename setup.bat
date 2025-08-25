@echo off
echo Claude Code Web UI Setup Script
echo ==================================
echo.

echo Checking prerequisites...
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo Error: Node.js is not installed. Please install Node.js first.
    exit /b 1
)
echo OK: Node.js is installed

where npm >nul 2>nul
if %errorlevel% neq 0 (
    echo Error: npm is not installed. Please install npm first.
    exit /b 1
)
echo OK: npm is installed

for /f "tokens=2 delims=v" %%i in ('node -v') do set NODE_VERSION=%%i
for /f "tokens=1 delims=." %%i in ("%NODE_VERSION%") do set NODE_MAJOR=%%i
if %NODE_MAJOR% lss 18 (
    echo Error: Node.js version 18+ is required. Current version: %NODE_VERSION%
    exit /b 1
)
echo OK: Node.js version is compatible: v%NODE_VERSION%

echo.
echo Checking for Claude Code CLI...
where claude >nul 2>nul
if %errorlevel% neq 0 (
    echo Warning: Claude Code CLI is not installed.
    set /p INSTALL_CLAUDE="Would you like to install it now? (y/n): "
    if /i "%INSTALL_CLAUDE%"=="y" (
        echo Installing Claude Code CLI...
        npm install -g @anthropic-ai/claude-code
    ) else (
        echo Please install Claude Code CLI manually: npm install -g @anthropic-ai/claude-code
    )
) else (
    echo OK: Claude Code CLI is installed
)

echo.
echo Setting up environment...
if not exist .env (
    copy .env.example .env >nul
    echo OK: Created .env file from template
) else (
    echo OK: .env file already exists
)

echo.
echo Installing dependencies...
call npm install

echo.
echo Building the application...
call npm run build:backend

echo.
echo Setup complete!
echo.
echo To start the application:
echo   Development mode: npm run dev
echo   Production mode:  npm start
echo.
echo The web UI will be available at http://localhost:3000
echo The API server will run on http://localhost:3001
echo.
echo Happy coding with Claude!
pause