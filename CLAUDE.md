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
npm test            # Run tests with Vitest
npm run lint        # Run publint to check package quality
npm run format      # Format code with Prettier
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

- **Framework**: Vitest
- **Coverage**: 100% code coverage requirement
- **Test files**: Located in `test/` directory, mirroring `src/` structure
- **Mocking**: File system operations and Puppeteer are mocked in tests
- **Pattern**: Integration tests for CLI commands + unit tests for core functions

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
