#!/usr/bin/env node
/**
 * Resume Merge Utility
 * Merges a base resume with location-specific overrides
 *
 * Usage: node merge.js <profile_name>
 *   e.g.: node merge.js po_toronto
 *
 * Or programmatic:
 *   import { mergeResume } from './merge.js'
 *   const resume = await mergeResume('po_toronto')
 */

import { readFile, writeFile, mkdir } from 'fs/promises';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Deep merge two objects, with source overriding target
 */
function deepMerge(target, source) {
  const result = { ...target };

  for (const key of Object.keys(source)) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      result[key] = deepMerge(target[key] || {}, source[key]);
    } else {
      result[key] = source[key];
    }
  }

  return result;
}

/**
 * Load and merge resume for a given profile
 */
export async function mergeResume(profileName) {
  // Load config
  const configPath = join(__dirname, 'config.json');
  const config = JSON.parse(await readFile(configPath, 'utf-8'));

  const profile = config.profiles[profileName];
  if (!profile) {
    throw new Error(`Profile "${profileName}" not found. Available: ${Object.keys(config.profiles).join(', ')}`);
  }

  // Load base and location
  const basePath = join(__dirname, profile.base);
  const locationPath = join(__dirname, profile.location);

  const base = JSON.parse(await readFile(basePath, 'utf-8'));
  const location = JSON.parse(await readFile(locationPath, 'utf-8'));

  // Merge: base + location overrides
  const merged = deepMerge(base, location);

  // Add metadata
  merged._generated = {
    profile: profileName,
    base: profile.base,
    location: profile.location,
    timestamp: new Date().toISOString()
  };

  return merged;
}

/**
 * Generate and save merged resume
 */
export async function generateResume(profileName, outputPath = null) {
  const merged = await mergeResume(profileName);

  if (!outputPath) {
    await mkdir(join(__dirname, 'generated'), { recursive: true });
    outputPath = join(__dirname, 'generated', `${profileName}.json`);
  }

  await writeFile(outputPath, JSON.stringify(merged, null, 2));
  console.log(`Generated: ${outputPath}`);

  return { resume: merged, path: outputPath };
}

/**
 * List available profiles
 */
export async function listProfiles() {
  const configPath = join(__dirname, 'config.json');
  const config = JSON.parse(await readFile(configPath, 'utf-8'));

  return Object.entries(config.profiles).map(([name, profile]) => ({
    name,
    description: profile.description,
    base: profile.base,
    location: profile.location
  }));
}

// CLI
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const profileName = process.argv[2];

  if (!profileName || profileName === '--list') {
    const profiles = await listProfiles();
    console.log('Available profiles:');
    for (const p of profiles) {
      console.log(`  ${p.name.padEnd(20)} - ${p.description}`);
    }
    process.exit(0);
  }

  try {
    await generateResume(profileName);
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
}
