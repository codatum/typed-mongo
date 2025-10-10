# Contributing to typed-mongo

Thank you for considering contributing to typed-mongo! This document provides guidelines for contributing to the project.

## Code of Conduct

Everyone participating in this project is expected to act respectfully and constructively.

## Ways to Contribute

### Bug Reports

If you find a bug, please report it on [GitHub Issues](https://github.com/codatum/typed-mongo/issues).

Please include the following information in your bug report:
- A clear and concise description of the bug
- Steps to reproduce
- Expected behavior
- Actual behavior
- Environment details (Node.js version, MongoDB version, OS, etc.)
- If possible, minimal reproduction code

### Feature Requests

If you have an idea for a new feature, please start a discussion on [GitHub Issues](https://github.com/codatum/typed-mongo/issues) first.

Feature requests should include:
- A clear description of the feature
- Why this feature is needed
- Possible implementation suggestions

### Pull Requests

Pull requests are welcome! For major changes, please open an issue first to discuss what you would like to change.

## Development Setup

### Prerequisites

- Node.js >= 22.0.0
- pnpm
- MongoDB (mongodb-memory-server is used for testing)

### Setup Steps

1. Fork the repository
2. Clone locally
```bash
git clone https://github.com/your-username/typed-mongo.git
cd typed-mongo
```

3. Install dependencies
```bash
pnpm install
```

4. Run in development mode
```bash
pnpm dev
```

## Development Workflow

### Branch Strategy

- The `main` branch should always be in a releasable state
- Work on new features or fixes in branches like `feature/feature-name` or `fix/bug-name`
- Create pull requests against the `main` branch

### Commit Messages

Use clear and descriptive commit messages. We recommend the following format:

```
<type>: <subject>

<body>

<footer>
```

Type examples:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (no functional impact)
- `refactor`: Refactoring
- `test`: Adding or modifying tests
- `chore`: Changes to build process or tools

### Coding Standards

This project uses Biome to maintain consistent code style.

Before committing code:
```bash
# Lint check
pnpm lint

# Auto-fix
pnpm lint:fix

# Type check
pnpm typecheck
```

### Testing

All new features and bug fixes should include tests.

```bash
# Run tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run tests with coverage report
pnpm test:coverage
```

Test files are located in the `tests/` directory:
- Integration tests: `tests/integration.test.ts`
- Type checking tests: `tests/typecheck.test.ts`, `tests/typecheck.test-d.ts`

### Building

```bash
# Production build
pnpm build

# Clean build
pnpm clean
pnpm build
```

## Pull Request Process

1. Create a new branch from your fork
2. Implement changes and add tests
3. Ensure all tests pass
4. Ensure lint and type checks pass
5. Create a pull request with a clear description of changes
6. Ensure CI checks pass
7. Wait for review

### Pull Request Checklist

- [ ] Code follows the project's style guidelines
- [ ] Self-review completed
- [ ] Comments added (especially for complex parts)
- [ ] Documentation updated (if necessary)
- [ ] Changes don't break existing functionality
- [ ] Tests added and all tests pass
- [ ] Dependency changes are minimal

## Release Process

Releases are managed by repository maintainers:

1. Repository maintainers manually trigger the "Create Release PR" GitHub Action
2. The action creates a release PR with version bumps and changelog updates
3. After review and merge of the release PR, the package is automatically published to npm

Note: Only repository maintainers have permission to trigger releases.

## Directory Structure

```
typed-mongo/
├── src/              # Source code
│   ├── model.ts      # Model class (includes index management)
│   ├── types.ts      # Type definitions
│   └── index.ts      # Entry point (TypedMongo class)
├── tests/            # Test files
│   ├── integration.test.ts    # Integration tests
│   ├── typecheck.test.ts      # Type checking tests
│   ├── typecheck.test-d.ts    # TypeScript definition tests
│   └── setup/                 # Test setup files
├── dist/             # Build artifacts (gitignored)
└── .github/          # GitHub Actions configuration
```

## Type Safety

The main purpose of typed-mongo is to provide type safety. When adding new features:

1. Ensure proper type inference works
2. Add TypeScript type checking tests
3. Be careful not to compromise runtime type safety

## Performance Considerations

typed-mongo is designed as a "thin wrapper":

- Don't add unnecessary abstraction layers
- Maintain MongoDB native driver performance
- Consider memory efficiency

## Getting Help

If you have questions:

1. Search existing issues on [GitHub Issues](https://github.com/codatum/typed-mongo/issues)
2. Create a new issue if not found
3. Join the discussion

## License

By contributing to this project, you agree that your contributions will be licensed under the MIT License.

## Acknowledgments

Thank you for contributing to typed-mongo! Your help makes this project better.