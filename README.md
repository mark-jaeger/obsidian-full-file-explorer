# Full File Explorer for Obsidian

A file explorer plugin for [Obsidian](https://obsidian.md) that shows **all files** including hidden dot-files and folders that Obsidian normally hides.

## Why?

Obsidian's built-in file explorer hides dot-files (like `.gitignore`, `.env`, `.obsidian/`) by design. This plugin provides a separate file explorer panel that shows everything in your vault, making it easy to browse and access hidden configuration files.

## Features

- 📁 **Browse all files** - See every file and folder, including hidden ones
- 🔍 **Visual distinction** - Hidden files appear slightly dimmed
- 🎨 **Smart file icons** - Recognizes common file types (config, code, images, etc.)
- ⚙️ **Configurable exclusions** - Hide specific files/folders (e.g., `node_modules`)
- 🖱️ **Context menu** - Right-click for Copy path, Reveal in Finder, Open in Terminal

## Installation

### From Community Plugins (Recommended)

1. Open Obsidian Settings
2. Go to Community Plugins and disable Safe Mode
3. Click Browse and search for "Full File Explorer"
4. Install and enable the plugin

### Manual Installation

1. Download `main.js`, `manifest.json`, and `styles.css` from the [latest release](https://github.com/mark-jaeger/obsidian-full-file-explorer/releases)
2. Create a folder `full-file-explorer` in your vault's `.obsidian/plugins/` directory
3. Copy the downloaded files into that folder
4. Reload Obsidian and enable the plugin in Settings → Community Plugins

## Usage

- Click the **tree icon** (🌲) in the left ribbon, or
- Use the command palette: `Full Explorer: Open Full Explorer`

The explorer opens in the left sidebar. Click folders to expand them, click files to open them.

## Settings

| Setting | Description |
|---------|-------------|
| Show files | Toggle to show/hide files (show only folders) |
| Exclude patterns | Comma-separated list of names to hide (e.g., `.DS_Store,node_modules`) |

## Desktop Only

This plugin uses Node.js filesystem APIs to read hidden files, so it only works on desktop (Windows, macOS, Linux). It will not work on mobile.

## Support

- 🐛 [Report issues](https://github.com/mark-jaeger/obsidian-full-file-explorer/issues)
- 💡 [Request features](https://github.com/mark-jaeger/obsidian-full-file-explorer/issues)

## License

MIT © Mark Jäger
