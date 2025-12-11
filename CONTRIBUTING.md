# Contributing to Derigo

Thank you for your interest in contributing to Derigo! This document provides guidelines and information for contributors.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Pull Request Process](#pull-request-process)
- [Coding Standards](#coding-standards)
- [Testing Guidelines](#testing-guidelines)
- [Commit Messages](#commit-messages)
- [Issue Guidelines](#issue-guidelines)

## Code of Conduct

This project adheres to a [Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code.

## Getting Started

### Prerequisites

- Node.js 18 or higher
- npm 9 or higher
- Git
- Chrome or Brave browser (for testing)

### Setup

1. Fork the repository on GitHub

2. Clone your fork:
   ```bash
   git clone https://github.com/YOUR_USERNAME/derigo.git
   cd derigo
   ```

3. Add the upstream remote:
   ```bash
   git remote add upstream https://github.com/witlox/derigo.git
   ```

4. Install dependencies:
   ```bash
   npm install
   ```

5. Create a branch for your work:
   ```bash
   git checkout -b feature/your-feature-name
   ```

### Loading the Extension for Development

1. Build the extension:
   ```bash
   npm run dev
   ```

2. Open Chrome/Brave and go to `chrome://extensions/`

3. Enable "Developer mode"

4. Click "Load unpacked" and select the `dist` folder

5. The extension will reload automatically when you make changes

## Development Workflow

### Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development build with file watching |
| `npm run build` | Create production build |
| `npm test` | Run test suite |
| `npm run test:watch` | Run tests in watch mode |
| `npm run test:coverage` | Run tests with coverage report |
| `npm run lint` | Check code for linting errors |
| `npm run lint:fix` | Fix auto-fixable linting errors |
| `npm run package` | Create distributable zip file |

### Project Structure

```
src/
├── background/          # Service worker (extension lifecycle)
├── content/             # Content scripts (page analysis)
│   ├── content.ts       # Main content script
│   └── display.ts       # UI overlay/badge rendering
├── lib/                 # Shared libraries
│   ├── classifier.ts    # Content classification logic
│   ├── author-classifier.ts   # Author analysis
│   ├── author-extractor.ts    # Author extraction from pages
│   ├── extractor.ts     # Content extraction
│   └── storage.ts       # Chrome storage API wrapper
├── options/             # Options page
├── popup/               # Toolbar popup
└── types/               # TypeScript type definitions
```

## Pull Request Process

1. **Update your fork**: Before starting work, sync with upstream:
   ```bash
   git fetch upstream
   git checkout main
   git merge upstream/main
   ```

2. **Create a feature branch**:
   ```bash
   git checkout -b feature/descriptive-name
   ```

3. **Make your changes**: Follow the coding standards below

4. **Test your changes**:
   ```bash
   npm run lint
   npm test
   npm run build
   ```

5. **Commit your changes**: Use [conventional commit messages](#commit-messages)

6. **Push to your fork**:
   ```bash
   git push origin feature/descriptive-name
   ```

7. **Open a Pull Request**: Use the PR template and fill in all sections

### PR Requirements

- [ ] All tests pass
- [ ] Linting passes with no errors
- [ ] Build succeeds
- [ ] New code has appropriate test coverage
- [ ] PR description explains the changes
- [ ] Related issues are linked

## Coding Standards

### TypeScript

- Use TypeScript strict mode
- Prefer `const` over `let`
- Use explicit types for function parameters and return values
- Avoid `any` type - use `unknown` if type is truly unknown

### Code Style

- Use 2 spaces for indentation
- Use single quotes for strings
- No trailing commas in single-line arrays/objects
- Use trailing commas in multi-line arrays/objects

### Naming Conventions

- `camelCase` for variables and functions
- `PascalCase` for types, interfaces, and classes
- `UPPER_SNAKE_CASE` for constants
- Descriptive names that indicate purpose

### File Organization

- One component/module per file
- Group related exports in index files
- Keep files under 500 lines when possible

## Testing Guidelines

### Test Structure

Tests are located in `tests/unit/` and should mirror the source structure:
- `src/lib/classifier.ts` → `tests/unit/classifier.test.ts`

### Writing Tests

```typescript
describe('ModuleName', () => {
  describe('functionName', () => {
    it('should do something specific', () => {
      // Arrange
      const input = 'test';

      // Act
      const result = functionName(input);

      // Assert
      expect(result).toBe('expected');
    });
  });
});
```

### Test Coverage

- Aim for >80% coverage on new code
- Cover edge cases and error conditions
- Mock external dependencies (Chrome APIs, etc.)

## Commit Messages

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

### Types

| Type | Description |
|------|-------------|
| `feat` | New feature |
| `fix` | Bug fix |
| `docs` | Documentation only |
| `style` | Formatting, no code change |
| `refactor` | Code restructuring |
| `test` | Adding/updating tests |
| `chore` | Maintenance tasks |
| `ci` | CI/CD changes |

### Examples

```
feat(classifier): add economic axis scoring

fix(display): correct badge positioning on scroll

docs: update installation instructions

test(author): add tests for bot detection
```

## Issue Guidelines

### Bug Reports

Use the bug report template and include:
- Clear description of the issue
- Steps to reproduce
- Expected vs actual behavior
- Browser and extension version
- Console logs if applicable

### Feature Requests

Use the feature request template and include:
- Problem you're trying to solve
- Proposed solution
- Alternative approaches considered
- Category (classification, UI, etc.)

### Questions

For general questions:
- Check existing issues first
- Use the Discussions tab if available
- Be specific about what you're trying to accomplish

## Getting Help

- **Documentation**: Check the [README](README.md) first
- **Issues**: Search existing issues before creating new ones
- **Discussions**: Use GitHub Discussions for questions

## Recognition

Contributors are recognized in:
- Release notes for their contributions
- The project README (major contributors)

Thank you for contributing to Derigo!
