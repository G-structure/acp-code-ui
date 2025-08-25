#!/bin/bash

echo "🚀 Claude Code Web UI Setup Script"
echo "=================================="

check_command() {
    if ! command -v $1 &> /dev/null; then
        echo "❌ $1 is not installed. Please install $1 first."
        exit 1
    fi
    echo "✅ $1 is installed"
}

echo ""
echo "Checking prerequisites..."
check_command node
check_command npm

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js version 18+ is required. Current version: $(node -v)"
    exit 1
fi
echo "✅ Node.js version is compatible: $(node -v)"

echo ""
echo "Checking for Claude Code CLI..."
if ! command -v claude &> /dev/null; then
    echo "⚠️  Claude Code CLI is not installed."
    read -p "Would you like to install it now? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "Installing Claude Code CLI..."
        npm install -g @anthropic-ai/claude-code
    else
        echo "Please install Claude Code CLI manually: npm install -g @anthropic-ai/claude-code"
    fi
else
    echo "✅ Claude Code CLI is installed"
fi

echo ""
echo "Setting up environment..."
if [ ! -f .env ]; then
    cp .env.example .env
    echo "✅ Created .env file from template"
else
    echo "✅ .env file already exists"
fi

echo ""
echo "Installing dependencies..."
npm install

echo ""
echo "Building the application..."
npm run build:backend

echo ""
echo "✅ Setup complete!"
echo ""
echo "To start the application:"
echo "  Development mode: npm run dev"
echo "  Production mode:  npm start"
echo ""
echo "The web UI will be available at http://localhost:3000"
echo "The API server will run on http://localhost:3001"
echo ""
echo "Happy coding with Claude! 🤖"