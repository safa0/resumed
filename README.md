# Resumed

[![npm package version](https://img.shields.io/npm/v/resumed)](https://www.npmjs.com/package/resumed)
[![Build status](https://img.shields.io/github/actions/workflow/status/rbardini/resumed/main.yml)](https://github.com/rbardini/resumed/actions)
[![Code coverage](https://img.shields.io/codecov/c/github/rbardini/resumed.svg)](https://codecov.io/gh/rbardini/resumed)
[![Dependencies status](https://img.shields.io/librariesio/release/npm/resumed)](https://libraries.io/npm/resumed)

👔 Lightweight [JSON Resume](https://jsonresume.org/) builder, no-frills [alternative to resume-cli](#motivation).

- 🗜️ Small (~180 LOC)
- 📦 Pure ESM package
- 🧩 CLI and Node.js API
- 🤖 TypeScript typings
- ⏱️ Async render support
- 🧪 100% code coverage

## Installation

```shell
npm install resumed jsonresume-theme-even # or your theme of choice
```

## Usage

```console
$ resumed --help

  Usage
    $ resumed <command> [options]

  Available Commands
    render      Render resume
    export      Export resume to PDF
    init        Create sample resume
    validate    Validate resume

  For more info, run any command with the `--help` flag
    $ resumed render --help
    $ resumed export --help

  Options
    -v, --version    Displays current version
    -h, --help       Displays this message

  Examples
  param="jsonresume-theme-stackoverflow"; echo $param | sed 's/.*-//' | xargs -I {} bash -c 'resumed render PO_resume.json -o PO_resume_{}.html --theme $0' "$param"
```

See [examples](examples).

## Commands

### `render` (default)

Render resume.

**Usage:** `resumed render [filename] [options]`

**Options:**

- `-o`, `--output`: Output filename
- `-t`, `--theme`: Theme to use
- `-h`, `--help`: Display help message

### `export`

Export resume to PDF.

**Usage:** `resumed export [filename] [options]`

**Options:**

- `-o, --output`: Output filename
- `-t, --theme`: Theme to use
- `-h, --help`: Displays help message

### `init`

Create sample resume.

**Usage:** `resumed init [filename] [options]`

**Aliases:** `create`

**Options:**

- `-h`, `--help`: Display help message

### `validate`

Validate resume.

**Usage:** `resumed validate [filename] [options]`

**Options:**

- `-h`, `--help`: Display help message

## Motivation

[resume-cli](https://github.com/jsonresume/resume-cli) is the original command line tool for [JSON Resume](https://jsonresume.org/), the open source initiative to create a JSON-based standard for resumes. It has served the community well for years, but its broad scope and aging codebase has become increasingly harder to maintain.

Resumed is a _complete reimplementation_ of resume-cli, using more modern technologies while dropping certain features, to remain small and focused.

### Theme resolution

Resumed does not install any themes. You must [pick and install one](https://www.npmjs.com/search?q=jsonresume-theme) yourself, and specify your choice via the `--theme` option or the `.meta.theme` field of your resume.

In contrast, resume-cli comes with a default theme, and only supports the `--theme` option. This is fine for most users, but it ties the default theme package release cycle to that of the CLI, and may be a little more verbose.

### Interface

While both tools can be used from the command line, Resumed also provides a fully-tested, strongly-typed Node.js API to create, validate and render resumes programatically.

### Other features

Resumed makes some compromises in terms of features, such as no local previews or YAML format support. If you miss any of these, you can combine Resumed with other tools or continue using resume-cli.
