#!/bin/bash
# Conflict.Game — macOS Gatekeeper fix
# Run this once if macOS says the app is "damaged"

APP="/Applications/Conflict.Game.app"

if [ -d "$APP" ]; then
    xattr -cr "$APP"
    echo "✓ Done! Opening Conflict.Game..."
    open "$APP"
else
    # Try to find the app next to this script (inside DMG)
    SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
    DMG_APP="$SCRIPT_DIR/Conflict.Game.app"
    if [ -d "$DMG_APP" ]; then
        xattr -cr "$DMG_APP"
        open "$DMG_APP"
    else
        echo "Conflict.Game.app not found."
        echo "Drag Conflict.Game.app to Applications first, then run this script again."
    fi
fi
