# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Resumed is a lightweight (~180 LOC) JSON Resume builder and CLI tool that serves as a modern, no-frills alternative to resume-cli. It's a pure ESM package with both CLI and Node.js API capabilities, written in TypeScript with 100% code coverage.

## Development Commands

### Build & Development

```bash
npm run build       # Build the project (compiles TypeScript to dist/)
npm run prebuild    # Generate TypeScript types from JSON Resume schema
npm run start       # Watch mode for development
```

### Testing & Quality

```bash
npm test                           # Run tests with Vitest (watch mode)
npm test -- --run                  # Run tests once without watch
npm test -- --run src/render.ts    # Run a single test file
npm test -- --coverage             # Run tests with coverage report
npm run lint                       # Run publint to check package quality
npm run format                     # Format code with Prettier
```

### CLI Usage (after building)

```bash
node bin/resumed.js render [resume.json] --theme <theme-name>
node bin/resumed.js export [resume.json] --theme <theme-name> -o output.pdf
node bin/resumed.js validate [resume.json]
node bin/resumed.js init [resume.json]
```

## Architecture

### Core Design Principles

- **ESM-only**: Pure ES Modules, no CommonJS output
- **Minimal dependencies**: ~4 runtime dependencies for small footprint
- **Separation of concerns**: CLI layer separate from business logic
- **Type-safe**: Full TypeScript with strict mode enabled
- **Lazy loading**: Optional dependencies (Puppeteer) loaded only when needed

### Project Structure

```
bin/resumed.js          # CLI entry point (shebang script)
src/
  ├── cli.ts            # Sade-based CLI command routing
  ├── index.ts          # Public API barrel exports
  ├── types.ts          # TypeScript type definitions
  ├── render.ts         # Theme rendering function
  ├── pdf.ts            # PDF export with Puppeteer
  ├── init.ts           # Sample resume initialization
  ├── validate.ts       # JSON Resume schema validation
  └── global.d.ts       # Module declarations
```

### Command Implementation

All CLI commands are defined in `src/cli.ts` using the Sade library and delegate to individual functions in separate files:

- **render**: Reads resume JSON → loads theme → calls `theme.render(resume)` → writes HTML
- **export**: Same as render → converts HTML to PDF via Puppeteer → writes PDF file
- **validate**: Reads resume → validates against JSON Resume schema → reports errors with paths
- **init**: Creates a new resume file from the sample in @jsonresume/schema

### Theme Resolution

Themes are resolved with the following priority:

1. CLI `--theme` option
2. `resume.meta.theme` field in the JSON file

Themes are **not bundled** with Resumed. Users must install theme packages separately (e.g., `jsonresume-theme-even`). Themes are dynamically imported at runtime using `import(themeName)`.

**Theme Interface:**

```typescript
type Theme = {
  render: (resume: Resume) => string | Promise<string>
  pdfRenderOptions?: PDFOptions // Optional Puppeteer settings
}
```

### Type System

- Resume types are generated from `@jsonresume/schema` during prebuild via `json2ts`
- Output file: `src/resume-schema.d.ts` (gitignored, regenerated on build)
- Extended with `meta` field for tool-specific config (theme, pdfRenderOptions)

### Build Process

- **Build tool**: Vite with TypeScript plugin (vite-plugin-dts)
- **Output**: Single ESM bundle in `dist/index.js` + type definitions
- **Externals**: All dependencies and Node.js built-ins marked external
- **Target**: ESNext (requires Node.js 20+)

### JSON Comments Support

Resume files support JSON with comments using `strip-json-comments` package. Comments are stripped before parsing in the CLI layer.

## Testing Strategy

- **Framework**: Vitest (configured in `vite.config.js`, not a separate config file)
- **Coverage**: 100% code coverage requirement
- **Test files**: Located in `test/` directory, mirroring `src/` structure
- **Mocking**: File system operations and Puppeteer are mocked in tests
- **Pattern**: Integration tests for CLI commands + unit tests for core functions
- **CLI tests**: Use `cli.parse(['', '', 'command', ...args])` to simulate CLI invocations

## Important Conventions

1. **ESM imports**: Always use `.js` extensions in import statements (TypeScript convention for ESM)
2. **Error handling**: Use colored output via `yoctocolors` for user-facing errors
3. **Async-first**: All command handlers are async, theme.render() can return Promise
4. **Exit codes**: Use `process.exit(1)` for validation failures and errors
5. **File I/O**: Use Node.js `fs/promises` API exclusively

## Dependencies

**Core Runtime:**

- `@jsonresume/schema`: JSON Resume schema and validation
- `sade`: Lightweight CLI routing
- `strip-json-comments`: JSON comment removal
- `yoctocolors`: Terminal colors (minimal, no deps)

**Peer (Optional):**

- `puppeteer`: Only needed for PDF export command

Note: Theme packages in package.json (e.g., `jsonresume-theme-*`) are user additions for local resume projects, not part of the library's core dependencies.

## Common Patterns

### Loading a theme dynamically

```typescript
const theme = (await import(themeName)) as Theme
```

### Reading resume with comment support

```typescript
const resumeJson = stripJsonComments(await readFile(filename, 'utf-8'))
const resume = JSON.parse(resumeJson)
```

### PDF export with merged options

```typescript
const pdfOptions = {
  ...theme.pdfRenderOptions,
  ...resume.meta?.pdfRenderOptions,
}
```

## Node.js Version

Requires Node.js 20+ (specified in package.json engines field)

## Resume Files in This Repo

This repo contains personal resume JSON files:

- `PO_resume.json` - Product Owner / Software Architect resume
- `voi_resume.json` - Alternative version
- `housing/housing_combined_resume.json` - Housing/blockchain project CV

## Rendering Resumes

### Quick Render

```bash
npm run build  # Required first time or after code changes
node bin/resumed.js render PO_resume.json --theme jsonresume-theme-stackoverflow
```

### Installed Themes

- `jsonresume-theme-stackoverflow` - Professional StackOverflow style (recommended)
- `jsonresume-theme-even` - Clean minimal design
- `jsonresume-theme-elegant` - Elegant with sidebar
- `jsonresume-theme-kendall` - Modern layout
- `jsonresume-theme-flat` - Flat design, smallest output

**Theme names must use full package name** (e.g., `jsonresume-theme-stackoverflow`, not just `stackoverflow`).

### Image Handling

**Use local relative paths for images, NOT Gravatar URLs.**

```json
{
  "basics": {
    "image": "profile.jpeg"
  }
}
```

- Place image file in same directory as resume JSON
- HTML output will reference the image relatively
- Gravatar requires account setup and correct MD5 hash of email

### Location Field

Some themes require `location` (not `locationTemp`):

```json
{
  "basics": {
    "location": {
      "city": "Toronto",
      "countryCode": "CA",
      "region": "Ontario"
    }
  }
}
```

## ATS Optimization

A custom ATS scoring skill is available at `~/.claude/skills/resume-ats/SKILL.md`.

### ATS Workflow

1. **Analyze job description** - Extract required skills, keywords, qualifications
2. **Score resume match** - Calculate match percentage across categories
3. **Identify gaps** - Missing keywords, skills, action verbs
4. **Optimize JSON Resume** - Add missing keywords where truthful, reorder skills
5. **Re-render** - Generate optimized HTML/PDF

### Key ATS Optimizations

- Add explicit keywords: CI/CD, Scrum, DevOps (not just the tools)
- Use exact phrases from job description
- Include both acronyms and full terms
- Place keywords in summary, skills, AND work highlights
- Fix typos (e.g., "Atlasian" → "Atlassian")

### ATS Score Categories

| Category        | Weight | What to Check                         |
| --------------- | ------ | ------------------------------------- |
| Required Skills | 30%    | Match JD required skills              |
| Keywords        | 25%    | Technical terms, tools, methodologies |
| Experience      | 15%    | Years and relevance                   |
| Education       | 10%    | Degree match                          |
| Action Verbs    | 10%    | Led, designed, implemented, etc.      |
| Format          | 10%    | ATS-friendly structure                |

## LinkedIn Job Application Automation

A custom LinkedIn job search and Easy Apply skill is available at `~/.claude/skills/linkedin-apply/SKILL.md`.

### Prerequisites

- **Playwright MCP** must be installed:
  ```bash
  claude mcp add playwright -- npx @playwright/mcp@latest
  ```
- Must be logged into LinkedIn in the Playwright browser session

### LinkedIn Apply Workflow

1. **Search** - Search LinkedIn for jobs with Easy Apply filter
2. **Score** - Score each job against your resume using ATS analysis
3. **Filter** - Only apply to jobs with 70%+ match score
4. **Tailor** - Generate cover letter with job-specific keywords
5. **Apply** - Automate Easy Apply form (with user confirmation)

### Usage Examples

```bash
# Search only
"Search for Product Owner jobs in Toronto"

# Search + score
"Find Software Architect jobs in Remote and score them"

# Full apply workflow
"Apply to Product Owner jobs in Toronto"
```

### Safety Features

- **Never auto-submits** - Always requires user approval before each application
- **Match threshold** - Only suggests jobs with 70%+ ATS score
- **Rate limiting** - 45 second delay between applications
- **Application log** - Tracks all applications at `~/.claude/linkedin-applications.json`

### Configuration

Edit `~/.claude/linkedin-apply-config.json` to customize:
- Minimum match score threshold
- Max applications per session
- Excluded companies
- Default resume path
- Screening question defaults
