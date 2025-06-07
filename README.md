# VS Code Icon Inventory

This tool lets you visualize and explore all icons used in the Visual Studio Code codebase.

## How It Works

- The generator scripts (`icon-inventory-gen.js` and `.cjs`) are designed to be run inside a VS Code source repository. They scan the repo for icon files and usage, then generate the `icon-inventory.js` data file.
- The HTML UI (`icon-inventory.html`) references the icon files by their relative paths, so it must be opened in a context where those files exist (typically inside the VS Code repo, or with the icons copied alongside).

## Usage

1. **Copy the icon inventory tool** (this folder or just the needed files) into the root of your VS Code repo.
2. **Run the generator script**:
   ```bash
   node icon-inventory-gen.js
   # or
   node icon-inventory-gen.cjs
   ```
   This will scan the VS Code repo and generate up-to-date icon data in `icon-inventory.js`.
3. **Open `icon-inventory.html` in your browser** (from within the VS Code repo) to view the inventory.

## Requirements

- VSCode codebase
- Node.js (for running the generator scripts)
- Web browser (for viewing the inventory)
