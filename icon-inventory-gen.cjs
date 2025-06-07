#!/usr/bin/env node

/*---------------------------------------------------------------------------------------------
 * VS Code Icon Inventory Generator (CommonJS)
 * 
 * This script scans the VS Code workspace for all icons, SVGs, images, and codicons
 * and generates an inventory with usage counts, file sizes, and metadata.
 * 
 * Usage: node icon-inventory-gen.cjs
 *--------------------------------------------------------------------------------------------*/

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// @ts-check

/**
 * VS Code Icon Inventory Generator
 * Scans the workspace for all icons and generates inventory data
 */

const fs = require('fs');
const path = require('path');

const workspace = __dirname;
const iconData = [];
let totalFileSize = 0;

// Function to get file size in bytes
function getFileSize(filePath) {
  try {
    const stats = fs.statSync(filePath);
    return stats.size;
  } catch (e) {
    return 0;
  }
}

// Function to format file size
function formatFileSize(bytes) {
  if (bytes === 0) {
    return '0 B';
  }
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Function to check if a file is in an allowed extension directory
function isAllowedExtension(filePath) {
  const relativePath = path.relative(workspace, filePath);
  const pathParts = relativePath.split(path.sep);
  
  // If not in extensions directory, allow it
  if (!pathParts.includes('extensions')) {
    return true;
  }
  
  // Find the index of 'extensions' in the path
  const extensionsIndex = pathParts.indexOf('extensions');
  if (extensionsIndex === -1 || extensionsIndex + 1 >= pathParts.length) {
    return true;
  }
  
  // Get the extension directory name
  const extensionName = pathParts[extensionsIndex + 1];
  
  // Allow GitHub Copilot and related extensions
  const allowedExtensions = [
    'github',
    'github-authentication', 
    'microsoft-authentication',
    'copilot',
    'github-copilot'
  ];
  
  return allowedExtensions.some(allowed => 
    extensionName.toLowerCase().includes(allowed.toLowerCase())
  );
}

// 1. Gather all SVG, PNG, JPG, etc. files, skipping node_modules, .git, out, and .bin
const exts = ['.svg', '.png', '.jpg', '.jpeg', '.gif', '.ico', '.icns', '.webp', '.bmp'];
const SKIP_DIRS = ['node_modules', '.git', 'out', '.bin', 'dist', 'build', 'testdata', 'tests', 'coverage'];
function walk(dir) {
  let results = [];
  let list;
  try {
    list = fs.readdirSync(dir);
  } catch (e) {
    return results;
  }
  for (const file of list) {
    const filePath = path.join(dir, file);
    let stat;
    try {
      stat = fs.lstatSync(filePath);
    } catch (e) {
      continue;
    }
    if (stat && stat.isDirectory()) {
      if (SKIP_DIRS.includes(file)) {
        continue;
      }
      // Avoid symlinked directories
      if (stat.isSymbolicLink()) {
        continue;
      }
      results = results.concat(walk(filePath));
    } else {
      if (exts.includes(path.extname(file).toLowerCase()) && isAllowedExtension(filePath)) {
        results.push(filePath);
      }
    }
  }
  return results;
}

const imageFiles = walk(workspace);

// 2. For each image, try to count usage in the codebase and track locations

function countUsageWithLocations(file) {
  // Only search for the filename, not full path
  const name = path.basename(file);
  let count = 0;
  const usageLocations = [];
  const aiTerms = new Set();
  
  function searchDir(dir) {
    let list;
    try {
      list = fs.readdirSync(dir);
    } catch (e) {
      return;
    }
    for (const f of list) {
      const filePath = path.join(dir, f);
      let stat;
      try {
        stat = fs.lstatSync(filePath);
      } catch (e) {
        continue;
      }
      if (stat && stat.isDirectory()) {
        if (SKIP_DIRS.includes(f)) { 
          continue; 
        }
        if (stat.isSymbolicLink()) { 
          continue; 
        }
        searchDir(filePath);
      } else if (f.endsWith('.ts') || f.endsWith('.js') || f.endsWith('.json') || f.endsWith('.md') || f.endsWith('.css') || f.endsWith('.html')) {
        let content;
        try {
          content = fs.readFileSync(filePath, 'utf8');
        } catch (e) {
          continue;
        }
        const occurrences = content.split(name).length - 1;
        if (occurrences > 0) {
          count += occurrences;
          const relativePath = path.relative(workspace, filePath);
          usageLocations.push({
            file: relativePath,
            count: occurrences
          });
          
          // Check for AI-related terms in this file path and icon name
          const { isAi, terms } = checkForAiTerms(relativePath, '', name);
          if (isAi) {
            terms.forEach(term => aiTerms.add(term));
          }
        }
      }
    }
  }
  searchDir(workspace);
  return { count, usageLocations, aiTerms: Array.from(aiTerms) };
}


// Keywords for AI/Chat/Copilot detection - specific to documented VS Code features
const aiKeywords = [
  // Core Copilot features (from official documentation)
  'copilot', 'github-copilot', 'copilot-chat', 'copilot-edits', 'copilot-voice',
  
  // Specific AI UI elements (sparkle icons are the main AI indicators)
  'sparkle', 'lightbulb-sparkle', 'sparkle-filled',
  
  // Chat features that are specifically AI/Copilot related
  'copilot-conversation', 'ai-chat', 'copilot-inline-chat',
  
  // Voice features (Hey Code)
  'copilot-voice', 'hey-code',
  
  // Multi-file editing (Copilot Edits)
  'copilot-edits'
];

function checkForAiTerms(filePath, content, iconName) {
  // Only check the actual file path and icon name, not generated content
  const str = (iconName + ' ' + filePath).toLowerCase();
  const foundTerms = new Set();
  let isAi = false;
  
  // Always include sparkle-related icons as AI (main indicator)
  if (iconName.includes('sparkle') || iconName.includes('lightbulb-sparkle')) {
    foundTerms.add('sparkle');
    isAi = true;
  }
  
  // Check for specific Copilot/AI keywords - be very specific
  const specificKeywords = [
    'copilot', 'github-copilot', 'copilot-chat', 'copilot-edits', 'copilot-voice', 'hey-code'
  ];
  
  for (const keyword of specificKeywords) {
    if (str.includes(keyword)) {
      foundTerms.add(keyword);
      isAi = true;
    }
  }
  
  return { isAi, terms: Array.from(foundTerms) };
}

function inferDescription(name, file) {
  // Try to infer a description from the filename or path
  const lower = name.toLowerCase();
  if (lower.includes('ai')) { return 'AI feature icon'; }
  if (lower.includes('copilot')) { return 'Copilot feature icon'; }
  if (lower.includes('chat')) { return 'Chat feature icon'; }
  if (lower.includes('edit')) { return 'Edit feature icon'; }
  if (lower.includes('search')) { return 'Search feature icon'; }
  if (lower.includes('notebook')) { return 'Notebook feature icon'; }
  if (lower.includes('intelli')) { return 'IntelliSense feature icon'; }
  // Try to extract from path
  if (file.toLowerCase().includes('ai')) { return 'AI feature icon'; }
  if (file.toLowerCase().includes('copilot')) { return 'Copilot feature icon'; }
  if (file.toLowerCase().includes('chat')) { return 'Chat feature icon'; }
  if (file.toLowerCase().includes('edit')) { return 'Edit feature icon'; }
  if (file.toLowerCase().includes('search')) { return 'Search feature icon'; }
  if (file.toLowerCase().includes('notebook')) { return 'Notebook feature icon'; }
  if (file.toLowerCase().includes('intelli')) { return 'IntelliSense feature icon'; }
  // Otherwise, prettify the name
  return name.replace(/[-_.]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function isAiRelated(name, file) {
  const str = (name + ' ' + file).toLowerCase();
  
  // Always include sparkle icons as AI-related
  if (str.includes('sparkle') || str.includes('lightbulb-sparkle') || str.includes('sparkle-filled')) {
    return true;
  }
  
  // Check for specific AI keywords with word boundaries for accuracy
  for (const keyword of aiKeywords) {
    // Use word boundaries for single words, exact match for hyphenated terms
    const pattern = keyword.includes('-') ? keyword : `\\b${keyword}\\b`;
    const regex = new RegExp(pattern, 'i');
    
    if (regex.test(str)) {
      return true;
    }
  }
  
  return false;
}

for (const file of imageFiles) {
  const name = path.basename(file);
  const type = path.extname(file).slice(1);
  const relPath = path.relative(workspace, file);
  const { count, usageLocations, aiTerms } = countUsageWithLocations(file);
  const desc = inferDescription(name, relPath);
  const aiRelated = isAiRelated(name, relPath) || aiTerms.length > 0;
  const fileSize = getFileSize(file);
  totalFileSize += fileSize;
  
  iconData.push({
    iconType: 'img',
    name,
    desc,
    count,
    location: '',
    type,
    file: relPath,
    aiRelated,
    fileSize: fileSize,
    fileSizeFormatted: formatFileSize(fileSize),
    usageLocations,
    aiTerms
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
    const usageLocations = [];
    const aiTerms = new Set();
    
    function searchCodiconUsage(dir) {
      let list;
      try {
        list = fs.readdirSync(dir);
      } catch (e) {
        return;
      }
      for (const f of list) {
        const filePath = path.join(dir, f);
        let stat;
        try {
          stat = fs.lstatSync(filePath);
        } catch (e) {
          continue;
        }
        if (stat && stat.isDirectory()) {
          if (SKIP_DIRS.includes(f)) { 
            continue; 
          }
          if (stat.isSymbolicLink()) { 
            continue; 
          }
          searchCodiconUsage(filePath);
        } else if (f.endsWith('.ts') || f.endsWith('.js') || f.endsWith('.json') || f.endsWith('.md') || f.endsWith('.css') || f.endsWith('.html')) {
          let content;
          try {
            content = fs.readFileSync(filePath, 'utf8');
          } catch (e) {
            continue;
          }
          const occurrences1 = content.split(`codicon-${name}`).length - 1;
          const occurrences2 = content.split(`$(${name})`).length - 1;
          const totalOccurrences = occurrences1 + occurrences2;
          
          if (totalOccurrences > 0) {
            count += totalOccurrences;
            const relativePath = path.relative(workspace, filePath);
            usageLocations.push({
              file: relativePath,
              count: totalOccurrences
            });
            
            // Check for AI-related terms in this file path and icon name
            const { isAi, terms } = checkForAiTerms(relativePath, '', name);
            if (isAi) {
              terms.forEach(term => aiTerms.add(term));
            }
          }
        }
      }
    }
    searchCodiconUsage(workspace);
    // Try to infer description for codicons
    const desc = inferDescription(name, '');
    const aiRelated = isAiRelated(name, '') || aiTerms.size > 0;
    iconData.push({
      iconType: 'codicon',
      name,
      desc,
      count,
      location: '',
      type: 'codicon',
      file: '',
      aiRelated,
      fileSize: 0,
      fileSizeFormatted: '0 B',
      usageLocations,
      aiTerms: Array.from(aiTerms)
    });
  }
}


// Sort .icns files to the bottom
iconData.sort((a, b) => {
  if (a.type === 'icns' && b.type !== 'icns') {
    return 1;
  }
  if (a.type !== 'icns' && b.type === 'icns') {
    return -1;
  }
  return 0;
});

// Try to populate UI location for images based on path heuristics
for (const icon of iconData) {
  if (icon.location && icon.location.length > 0) {
    continue;
  }
  // Heuristic: use folder names or file path
  const pathParts = icon.file ? icon.file.split(/[\\/]/) : [];
  if (icon.iconType === 'img' && pathParts.length > 1) {
    // Use the folder just before the file as a guess
    icon.location = pathParts.slice(-2, -1)[0];
  } else if (icon.iconType === 'codicon') {
    icon.location = 'codicon';
  }
}

// Output to icon-inventory.js (overwrite, not prepend)
const totalCount = iconData.length;
const metadata = {
  totalCount,
  totalFileSize,
  totalFileSizeFormatted: formatFileSize(totalFileSize),
  generatedAt: new Date().toISOString()
};

const out = `// Auto-generated icon data
const iconData = ${JSON.stringify(iconData, null, 2)};
const iconMetadata = ${JSON.stringify(metadata, null, 2)};
`;
fs.writeFileSync(path.join(workspace, 'icon-inventory.js'), out);

console.log(`Icon inventory generated: ${totalCount} icons, ${formatFileSize(totalFileSize)} total. Open icon-inventory.html to view.`);
