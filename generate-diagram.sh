#!/bin/bash

# Generate Architecture Diagram PNG from Mermaid
# This script uses mermaid-cli to generate a PNG from the Mermaid diagram
# 
# Prerequisites:
#   npm install -g @mermaid-js/mermaid-cli
#
# Usage:
#   chmod +x generate-diagram.sh
#   ./generate-diagram.sh

set -e

echo "🎨 Pinterest Affiliate Platform - Diagram Generator"
echo "=================================================="
echo ""

# Check if mmdc is installed
if ! command -v mmdc &> /dev/null; then
    echo "❌ Error: mermaid-cli (mmdc) is not installed"
    echo ""
    echo "To install:"
    echo "  npm install -g @mermaid-js/mermaid-cli"
    echo ""
    echo "Or use Docker:"
    echo "  docker pull minlag/mermaid-cli"
    echo ""
    exit 1
fi

echo "✅ mermaid-cli found"
echo ""

# Extract Mermaid code from markdown
echo "📝 Extracting Mermaid code from architecture-diagram.md..."

# Create temporary mermaid file
sed -n '/```mermaid/,/```/p' architecture-diagram.md | sed '1d;$d' > temp-diagram.mmd

if [ ! -s temp-diagram.mmd ]; then
    echo "❌ Error: Could not extract Mermaid code"
    rm -f temp-diagram.mmd
    exit 1
fi

echo "✅ Mermaid code extracted"
echo ""

# Generate PNG
echo "🖼️  Generating PNG diagram..."

mmdc -i temp-diagram.mmd -o architecture-diagram.png -w 2400 -H 1600 -b white

if [ $? -eq 0 ]; then
    echo "✅ PNG generated successfully: architecture-diagram.png"
    echo ""
    echo "📊 Diagram Details:"
    echo "  - Width: 2400px"
    echo "  - Height: 1600px"
    echo "  - Background: White"
    echo "  - Format: PNG"
    echo ""
else
    echo "❌ Error generating PNG"
    rm -f temp-diagram.mmd
    exit 1
fi

# Clean up
rm -f temp-diagram.mmd

echo "🎉 Done! Your architecture diagram is ready."
echo ""
echo "Next steps:"
echo "  1. View the diagram: open architecture-diagram.png"
echo "  2. Add to README: ![Architecture](./architecture-diagram.png)"
echo "  3. Commit to Git: git add architecture-diagram.png"
echo ""
