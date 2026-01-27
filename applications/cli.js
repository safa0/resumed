#!/usr/bin/env node
/**
 * Job Application Tracker CLI
 *
 * Commands:
 *   add <folder>              Register application folder in index
 *   status <id> <status>      Update application status
 *   list [--status=X]         List applications in terminal
 *   init <company> <role>     Create new application folder with templates
 *   render [folder]           Generate job.html from job.txt
 *   export                    Generate export.csv from index.json
 */

import { readFile, writeFile, readdir, mkdir } from 'fs/promises';
import { dirname, join, basename } from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));

const VALID_STATUSES = ['saved', 'applied', 'interviewing', 'rejected', 'withdrawn', 'offer'];

// ============ Helpers ============

async function loadIndex() {
  const indexPath = join(__dirname, 'index.json');
  return JSON.parse(await readFile(indexPath, 'utf-8'));
}

async function saveIndex(index) {
  index.lastUpdated = new Date().toISOString();
  // Recalculate stats
  index.stats = {
    total: index.applications.length,
    saved: 0, applied: 0, interviewing: 0, rejected: 0, withdrawn: 0, offer: 0
  };
  for (const app of index.applications) {
    if (index.stats[app.status] !== undefined) {
      index.stats[app.status]++;
    }
  }
  const indexPath = join(__dirname, 'index.json');
  await writeFile(indexPath, JSON.stringify(index, null, 2));
}

function formatDate(dateStr) {
  if (!dateStr) return '-';
  return dateStr.split('T')[0];
}

function slugify(str) {
  return str.toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

// ============ Commands ============

async function cmdAdd(folder) {
  const folderPath = join(__dirname, folder);
  const appJsonPath = join(folderPath, 'application.json');

  if (!existsSync(appJsonPath)) {
    console.error(`Error: ${appJsonPath} not found`);
    process.exit(1);
  }

  const app = JSON.parse(await readFile(appJsonPath, 'utf-8'));
  const index = await loadIndex();

  // Check for duplicate
  if (index.applications.find(a => a.id === app.id)) {
    console.error(`Error: Application ${app.id} already exists in index`);
    process.exit(1);
  }

  // Load ATS score if available
  let atsScore = null;
  const atsPath = join(folderPath, 'ats-analysis.json');
  if (existsSync(atsPath)) {
    const ats = JSON.parse(await readFile(atsPath, 'utf-8'));
    atsScore = ats.score;
  }

  // Add to index
  index.applications.push({
    id: app.id,
    company: app.company,
    role: app.role,
    status: app.status,
    applied: app.timeline?.applied || null,
    atsScore,
    location: app.location,
    url: app.url
  });

  await saveIndex(index);
  console.log(`Added: ${app.id}`);
}

async function cmdStatus(id, status) {
  if (!VALID_STATUSES.includes(status)) {
    console.error(`Invalid status. Valid: ${VALID_STATUSES.join(', ')}`);
    process.exit(1);
  }

  const index = await loadIndex();
  const appIndex = index.applications.findIndex(a => a.id === id);

  if (appIndex === -1) {
    console.error(`Application ${id} not found`);
    process.exit(1);
  }

  // Update index
  index.applications[appIndex].status = status;
  await saveIndex(index);

  // Update application.json
  const appJsonPath = join(__dirname, id, 'application.json');
  if (existsSync(appJsonPath)) {
    const app = JSON.parse(await readFile(appJsonPath, 'utf-8'));
    app.status = status;

    // Update timeline
    const today = new Date().toISOString().split('T')[0];
    if (status === 'applied' && !app.timeline.applied) app.timeline.applied = today;
    if (status === 'interviewing' && !app.timeline.interview) app.timeline.interview = today;
    if (status === 'offer' && !app.timeline.offer) app.timeline.offer = today;
    if (['rejected', 'withdrawn', 'offer'].includes(status) && !app.timeline.closed) {
      app.timeline.closed = today;
    }

    await writeFile(appJsonPath, JSON.stringify(app, null, 2));
  }

  console.log(`Updated ${id} → ${status}`);
}

async function cmdList(filterStatus = null) {
  const index = await loadIndex();

  let apps = index.applications;
  if (filterStatus) {
    apps = apps.filter(a => a.status === filterStatus);
  }

  // Sort by date descending
  apps.sort((a, b) => (b.applied || '').localeCompare(a.applied || ''));

  console.log('\n' + '='.repeat(100));
  console.log(
    'Date'.padEnd(12) +
    'Company'.padEnd(20) +
    'Role'.padEnd(30) +
    'Status'.padEnd(14) +
    'ATS'.padEnd(6) +
    'Location'
  );
  console.log('='.repeat(100));

  for (const app of apps) {
    console.log(
      formatDate(app.applied).padEnd(12) +
      (app.company || '').slice(0, 18).padEnd(20) +
      (app.role || '').slice(0, 28).padEnd(30) +
      (app.status || '').padEnd(14) +
      (app.atsScore ? `${app.atsScore}%` : '-').padEnd(6) +
      (app.location || '')
    );
  }

  console.log('='.repeat(100));
  console.log(`Total: ${apps.length} applications\n`);

  // Stats summary
  const s = index.stats;
  console.log(`Stats: ${s.applied} applied, ${s.interviewing} interviewing, ${s.offer} offers, ${s.rejected} rejected`);
}

async function cmdInit(company, role) {
  const today = new Date().toISOString().split('T')[0];
  const id = `${today}-${slugify(company)}-${slugify(role)}`;
  const folderPath = join(__dirname, id);

  if (existsSync(folderPath)) {
    console.error(`Folder already exists: ${id}`);
    process.exit(1);
  }

  await mkdir(folderPath, { recursive: true });

  // Create application.json
  const application = {
    id,
    company,
    role,
    url: '',
    location: '',
    remote: false,
    source: 'manual',
    status: 'saved',
    timeline: {
      found: today,
      applied: null,
      response: null,
      interview: null,
      offer: null,
      closed: null
    },
    salary: {
      posted: null,
      asked: null,
      offered: null
    },
    contacts: [],
    notes: '',
    rating: null,
    tags: []
  };

  await writeFile(join(folderPath, 'application.json'), JSON.stringify(application, null, 2));
  await writeFile(join(folderPath, 'job.txt'), '# Paste job listing here\n');
  await writeFile(join(folderPath, 'cover-letter.md'), `# Cover Letter - ${company} ${role}\n\n`);

  console.log(`Created: ${folderPath}/`);
  console.log('Files: application.json, job.txt, cover-letter.md');
  console.log('\nNext steps:');
  console.log('1. Paste job listing into job.txt');
  console.log('2. Add URL and location to application.json');
  console.log('3. Run: node cli.js add ' + id);
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ============ Job HTML Generator ============

function generateJobHTML(jobText, app) {
  // Convert plain text to HTML with basic formatting
  const lines = jobText.split('\n');
  let html = '';
  let inList = false;

  for (const line of lines) {
    const trimmed = line.trim();

    // Headers (lines starting with # or all caps short lines)
    if (trimmed.startsWith('#')) {
      if (inList) { html += '</ul>'; inList = false; }
      const level = (trimmed.match(/^#+/) || ['#'])[0].length;
      const text = trimmed.replace(/^#+\s*/, '');
      html += `<h${Math.min(level + 1, 4)}>${escapeHtml(text)}</h${Math.min(level + 1, 4)}>\n`;
    }
    // Bullet points
    else if (trimmed.startsWith('•') || trimmed.startsWith('-') || trimmed.startsWith('*')) {
      if (!inList) { html += '<ul>'; inList = true; }
      const text = trimmed.replace(/^[•\-*]\s*/, '');
      html += `<li>${escapeHtml(text)}</li>\n`;
    }
    // Empty lines
    else if (!trimmed) {
      if (inList) { html += '</ul>'; inList = false; }
      html += '<br>\n';
    }
    // Regular text
    else {
      if (inList) { html += '</ul>'; inList = false; }
      html += `<p>${escapeHtml(trimmed)}</p>\n`;
    }
  }
  if (inList) html += '</ul>';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(app.company)} - ${escapeHtml(app.role)}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #f9fafb;
      padding: 2rem;
      color: #1f2937;
      line-height: 1.6;
    }
    .container { max-width: 800px; margin: 0 auto; background: white; padding: 2rem; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .header { border-bottom: 2px solid #e5e7eb; padding-bottom: 1rem; margin-bottom: 1.5rem; }
    .header h1 { color: #111827; margin-bottom: 0.5rem; }
    .meta { color: #6b7280; font-size: 0.875rem; }
    .meta a { color: #3b82f6; }
    .badge { display: inline-block; padding: 0.25rem 0.75rem; border-radius: 9999px; font-size: 0.75rem; font-weight: 600; color: white; background: #3b82f6; margin-left: 0.5rem; }
    h2, h3, h4 { margin: 1.5rem 0 0.75rem; color: #111827; }
    p { margin: 0.5rem 0; }
    ul { margin: 0.5rem 0 0.5rem 1.5rem; }
    li { margin: 0.25rem 0; }
    .nav { margin-top: 2rem; padding-top: 1rem; border-top: 1px solid #e5e7eb; }
    .nav a { color: #3b82f6; text-decoration: none; margin-right: 1rem; }
    .nav a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${escapeHtml(app.company)} <span class="badge">${app.status}</span></h1>
      <p style="font-size: 1.25rem; color: #374151; margin: 0.5rem 0;">${escapeHtml(app.role)}</p>
      <p class="meta">
        ${app.location ? `${escapeHtml(app.location)} · ` : ''}
        ${app.url ? `<a href="${escapeHtml(app.url)}" target="_blank">View Original Posting</a> · ` : ''}
        Applied: ${app.timeline?.applied || 'Not yet'}
      </p>
    </div>
    ${html}
    <div class="nav">
      <a href="resume.html">View Tailored Resume</a>
      <a href="cover-letter.md">Cover Letter</a>
      <a href="application.json">Application Data</a>
      <a href="../dashboard.html">← Back to Dashboard</a>
    </div>
  </div>
</body>
</html>`;
}

async function cmdRender(folderId) {
  const folderPath = folderId ? join(__dirname, folderId) : null;

  if (folderId) {
    // Render single application
    await renderApplicationFolder(folderPath);
  } else {
    // Render all applications
    const index = await loadIndex();
    for (const app of index.applications) {
      const appFolder = join(__dirname, app.id);
      if (existsSync(appFolder)) {
        await renderApplicationFolder(appFolder);
      }
    }
  }
}

async function renderApplicationFolder(folderPath) {
  const appJsonPath = join(folderPath, 'application.json');
  const jobTxtPath = join(folderPath, 'job.txt');

  if (!existsSync(appJsonPath)) {
    console.error(`Skipping ${folderPath}: no application.json`);
    return;
  }

  const app = JSON.parse(await readFile(appJsonPath, 'utf-8'));

  // Generate job.html from job.txt
  if (existsSync(jobTxtPath)) {
    const jobText = await readFile(jobTxtPath, 'utf-8');
    const jobHtml = generateJobHTML(jobText, app);
    await writeFile(join(folderPath, 'job.html'), jobHtml);
    console.log(`Generated: ${app.id}/job.html`);
  }
}

// ============ Export ============

async function cmdExport() {
  const index = await loadIndex();
  const apps = [...index.applications].sort((a, b) =>
    (b.applied || b.id || '').localeCompare(a.applied || a.id || '')
  );

  // Generate data.js for dashboard
  const dataJs = `// Auto-generated from index.json - do not edit
const APP_DATA = ${JSON.stringify(index, null, 2)};
`;
  await writeFile(join(__dirname, 'data.js'), dataJs);
  console.log('Generated: data.js');

  // Generate CSV
  const headers = ['Date', 'Company', 'Role', 'Location', 'Status', 'ATS Score', 'URL'];
  const rows = apps.map(app => [
    formatDate(app.applied),
    `"${(app.company || '').replace(/"/g, '""')}"`,
    `"${(app.role || '').replace(/"/g, '""')}"`,
    `"${(app.location || '').replace(/"/g, '""')}"`,
    app.status,
    app.atsScore || '',
    app.url || ''
  ]);
  const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  await writeFile(join(__dirname, 'export.csv'), csv);
  console.log('Generated: export.csv');
}

// ============ Main ============

const [,, command, ...args] = process.argv;

switch (command) {
  case 'add':
    if (!args[0]) { console.error('Usage: cli.js add <folder>'); process.exit(1); }
    await cmdAdd(args[0]);
    break;

  case 'status':
    if (!args[0] || !args[1]) { console.error('Usage: cli.js status <id> <status>'); process.exit(1); }
    await cmdStatus(args[0], args[1]);
    break;

  case 'list':
    const statusFilter = args.find(a => a.startsWith('--status='))?.split('=')[1] || null;
    await cmdList(statusFilter);
    break;

  case 'init':
    if (!args[0] || !args[1]) { console.error('Usage: cli.js init <company> <role>'); process.exit(1); }
    await cmdInit(args[0], args[1]);
    break;

  case 'render':
    await cmdRender(args[0] || null);
    break;

  case 'export':
    await cmdExport();
    break;

  default:
    console.log(`
Job Application Tracker CLI

Commands:
  init <company> <role>      Create new application folder
  add <folder>               Register application in index
  status <id> <status>       Update status (${VALID_STATUSES.join(', ')})
  list [--status=X]          List applications
  render [folder]            Generate job.html from job.txt (all if no folder)
  export                     Generate data.js and export.csv for dashboard

Dashboard: Open dashboard.html in browser (run 'export' first to update data)
`);
}
