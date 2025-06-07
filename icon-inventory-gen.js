// VS Code Icon Inventory Data Generator
// This script scans the workspace for icons and images, counts their usage, and outputs icon-inventory.js data.
// Run with: node icon-inventory-gen.js

const fs = require('fs');
const path = require('path');

const workspace = __dirname;
const iconData = [];

// 1. Gather all SVG, PNG, JPG, etc. files
const exts = ['.svg', '.png', '.jpg', '.jpeg', '.gif', '.ico', '.icns', '.webp', '.bmp'];
function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(filePath));
    } else {
      if (exts.includes(path.extname(file).toLowerCase())) {
        results.push(filePath);
      }
    }
  }
  return results;
}

const imageFiles = walk(workspace);

// 2. For each image, try to count usage in the codebase
function countUsage(file) {
  // Only search for the filename, not full path
  const name = path.basename(file);
  let count = 0;
  function searchDir(dir) {
    const list = fs.readdirSync(dir);
    for (const f of list) {
      const filePath = path.join(dir, f);
      const stat = fs.statSync(filePath);
      if (stat && stat.isDirectory()) {
        searchDir(filePath);
      } else if (f.endsWith('.ts') || f.endsWith('.js') || f.endsWith('.json') || f.endsWith('.md') || f.endsWith('.css') || f.endsWith('.html')) {
        const content = fs.readFileSync(filePath, 'utf8');
        count += (content.split(name).length - 1);
      }
    }
  }
  searchDir(workspace);
  return count;
}

for (const file of imageFiles) {
  const name = path.basename(file);
  const type = path.extname(file).slice(1);
  const relPath = path.relative(workspace, file);
  const count = countUsage(file);
  iconData.push({
    iconType: 'img',
    name,
    desc: '',
    count,
    location: '',
    type,
    file: relPath
  });
}

// 3. Codicons: extract from codiconsLibrary
const codiconsLibPath = path.join(workspace, 'src/vs/base/common/codiconsLibrary.ts');
if (fs.existsSync(codiconsLibPath)) {
  const codiconSrc = fs.readFileSync(codiconsLibPath, 'utf8');
  const codiconRegex = /register\('([\w-]+)'/g;
  let match;
  const codiconNames = new Set();
  while ((match = codiconRegex.exec(codiconSrc))) {
    codiconNames.add(match[1]);
  }
  for (const name of codiconNames) {
    // Count usage: look for codicon-${name} and $(name)
    let count = 0;
    function searchCodiconUsage(dir) {
      const list = fs.readdirSync(dir);
      for (const f of list) {
        const filePath = path.join(dir, f);
        const stat = fs.statSync(filePath);
        if (stat && stat.isDirectory()) {
          searchCodiconUsage(filePath);
        } else if (f.endsWith('.ts') || f.endsWith('.js') || f.endsWith('.json') || f.endsWith('.md') || f.endsWith('.css') || f.endsWith('.html')) {
          const content = fs.readFileSync(filePath, 'utf8');
          count += (content.split(`codicon-${name}`).length - 1);
          count += (content.split(`$(${name})`).length - 1);
        }
      }
    }
    searchCodiconUsage(workspace);
    iconData.push({
      iconType: 'codicon',
      name,
      desc: '',
      count,
      location: '',
      type: 'codicon',
      file: ''
    });
  }
}

// 4. Output to icon-inventory.js
const out = `// Auto-generated icon data\nconst iconData = ${JSON.stringify(iconData, null, 2)};\n\n` + fs.readFileSync(path.join(workspace, 'icon-inventory.js'), 'utf8');
fs.writeFileSync(path.join(workspace, 'icon-inventory.js'), out);

console.log('Icon inventory generated. Open icon-inventory.html to view.');
