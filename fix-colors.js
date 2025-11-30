#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Color mapping from DESIGN_SYSTEM.md
const colorMap = {
  // Exact matches
  '#FFFFFF': 'colors.surface.primary',
  '#ffffff': 'colors.surface.primary',
  '#FFF': 'colors.surface.primary',
  '#fff': 'colors.surface.primary',
  '#000000': 'colors.text.primary',
  '#000': 'colors.text.primary',

  // Grays/Neutrals
  '#F9FAFB': 'colors.background.secondary',
  '#f9fafb': 'colors.background.secondary',
  '#F3F4F6': 'colors.background.tertiary',
  '#f3f4f6': 'colors.background.tertiary',
  '#E5E7EB': 'colors.border.DEFAULT',
  '#e5e7eb': 'colors.border.DEFAULT',
  '#D1D5DB': 'colors.border.DEFAULT',
  '#d1d5db': 'colors.border.DEFAULT',
  '#9CA3AF': 'colors.text.tertiary',
  '#9ca3af': 'colors.text.tertiary',
  '#6B7280': 'colors.text.secondary',
  '#6b7280': 'colors.text.secondary',
  '#374151': 'colors.text.primary',
  '#111827': 'colors.text.primary',
  '#1F2937': 'colors.text.primary',
  '#1f2937': 'colors.text.primary',

  // Primary/Indigo
  '#6366F1': 'colors.primary[600]',
  '#6366f1': 'colors.primary[600]',
  '#4F46E5': 'colors.primary[700]',
  '#4f46e5': 'colors.primary[700]',
  '#8B5CF6': 'colors.primary[500]',
  '#8b5cf6': 'colors.primary[500]',
  '#A78BFA': 'colors.primary[400]',
  '#a78bfa': 'colors.primary[400]',
  '#EEF2FF': 'colors.primary[50]',
  '#eff6ff': 'colors.primary[50]',
  '#DBEAFE': 'colors.info[100]',
  '#dbeafe': 'colors.info[100]',
  '#93C5FD': 'colors.info[300]',
  '#93c5fd': 'colors.info[300]',

  // Success/Green
  '#10B981': 'colors.success[600]',
  '#16A34A': 'colors.success[700]',
  '#16a34a': 'colors.success[700]',
  '#059669': 'colors.success[600]',
  '#DCFCE7': 'colors.success[100]',
  '#dcfce7': 'colors.success[100]',
  '#F0FDF4': 'colors.success[50]',
  '#f0fdf4': 'colors.success[50]',

  // Error/Red
  '#EF4444': 'colors.error[600]',
  '#ef4444': 'colors.error[600]',
  '#DC2626': 'colors.error[700]',
  '#dc2626': 'colors.error[700]',
  '#FEE2E2': 'colors.error[100]',
  '#fee2e2': 'colors.error[100]',
  '#FEF2F2': 'colors.error[50]',
  '#fef2f2': 'colors.error[50]',

  // Warning/Yellow/Amber
  '#F59E0B': 'colors.warning[600]',
  '#f59e0b': 'colors.warning[600]',
  '#FEF3C7': 'colors.warning[100]',
  '#fef3c7': 'colors.warning[100]',
  '#FBBF24': 'colors.warning[500]',
  '#fbbf24': 'colors.warning[500]',
  '#A16207': 'colors.warning[800]',
  '#a16207': 'colors.warning[800]',

  // Info/Blue
  '#0EA5E9': 'colors.info[600]',
  '#0ea5e9': 'colors.info[600]',
  '#0284C7': 'colors.info[700]',
  '#0284c7': 'colors.info[700]',
  '#E0F2FE': 'colors.info[100]',
  '#e0f2fe': 'colors.info[100]',
  '#1D4ED8': 'colors.info[700]',
  '#1d4ed8': 'colors.info[700]',
  '#2563EB': 'colors.info[600]',
  '#2563eb': 'colors.info[600]',

  // Purple/Violet
  '#7C3AED': 'colors.accent[600]',
  '#7c3aed': 'colors.accent[600]',
  '#9333EA': 'colors.accent[600]',
  '#9333ea': 'colors.accent[600]',

  // Pink
  '#EC4899': 'colors.accent[500]',
  '#ec4899': 'colors.accent[500]',
  '#BE185D': 'colors.accent[700]',
  '#be185d': 'colors.accent[700]',
  '#E11D48': 'colors.error[600]',
  '#e11d48': 'colors.error[600]',

  // Orange
  '#EA580C': 'colors.warning[700]',
  '#ea580c': 'colors.warning[700]',

  // Cyan
  '#0891B2': 'colors.info[600]',
  '#0891b2': 'colors.info[600]',
  '#06B6D4': 'colors.info[500]',
  '#06b6d4': 'colors.info[500]',
};

const filePath = process.argv[2];
if (!filePath) {
  console.error('Usage: node fix-colors.js <file-path>');
  process.exit(1);
}

let content = fs.readFileSync(filePath, 'utf8');
let replacements = 0;

// Replace exact color matches
for (const [oldColor, newToken] of Object.entries(colorMap)) {
  const regex = new RegExp(oldColor.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
  const matches = content.match(regex);
  if (matches) {
    content = content.replace(regex, newToken);
    replacements += matches.length;
    console.log(`Replaced ${matches.length}x ${oldColor} → ${newToken}`);
  }
}

fs.writeFileSync(filePath, content, 'utf8');
console.log(`\n✓ Total replacements: ${replacements}`);
console.log(`✓ Updated: ${filePath}`);
