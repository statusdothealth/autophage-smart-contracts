# Contributing to Autophage Smart Contracts

Thank you for your interest in contributing to the Autophage Protocol! We welcome contributions from the community and are excited to work with developers who share our vision of a metabolic economy that rewards healthy behaviors.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Process](#development-process)
- [Pull Request Process](#pull-request-process)
- [Coding Standards](#coding-standards)
- [Testing Guidelines](#testing-guidelines)
- [Security Considerations](#security-considerations)
- [Documentation](#documentation)
- [Community](#community)

## Code of Conduct

We are committed to providing a welcoming and inclusive environment. Please read and follow our Code of Conduct:

- Be respectful and inclusive
- Welcome newcomers and help them get started
- Focus on what is best for the community
- Show empathy towards other community members
- Respect differing viewpoints and experiences

## Getting Started

1. **Fork the Repository**
   ```bash
   git clone https://github.com/97115104/autophage-smart-contracts.git
   cd autophage-smart-contracts
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Set Up Environment**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Run Tests**
   ```bash
   npx hardhat test
   ```

## Development Process

### 1. Check Existing Issues

Before starting work:
- Check if an issue already exists for your feature/bug
- Comment on the issue to indicate you're working on it
- If no issue exists, create one to discuss your proposal

### 2. Create a Feature Branch

```bash
git checkout -b feature/your-feature-name
# or
git checkout -b fix/your-bug-fix
```

Branch naming conventions:
- `feature/` - New features
- `fix/` - Bug fixes
- `docs/` - Documentation updates
- `test/` - Test additions or fixes
- `refactor/` - Code refactoring

### 3. Make Your Changes

- Write clean, readable code
- Follow the existing code style
- Add tests for new functionality
- Update documentation as needed

### 4. Commit Guidelines

We follow conventional commits:

```bash
feat: add new decay calculation method
fix: correct whale threshold calculation
docs: update README with new examples
test: add tests for lazy decay
refactor: optimize storage packing
```

Commit format:
```
<type>(<scope>): <subject>

<body>

<footer>
```

Types:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Test additions or modifications
- `chore`: Maintenance tasks

## Pull Request Process

1. **Update Your Branch**
   ```bash
   git fetch upstream
   git rebase upstream/main
   ```

2. **Run All Tests**
   ```bash
   npm run test
   npm run test:coverage
   npm run lint
   ```

3. **Create Pull Request**
   - Use a clear, descriptive title
   - Reference related issues
   - Provide a detailed description
   - Include test results and gas benchmarks

4. **PR Template**
   ```markdown
   ## Description
   Brief description of changes

   ## Type of Change
   - [ ] Bug fix
   - [ ] New feature
   - [ ] Breaking change
   - [ ] Documentation update

   ## Testing
   - [ ] All tests pass
   - [ ] Added new tests
   - [ ] Gas optimization verified

   ## Checklist
   - [ ] Code follows style guidelines
   - [ ] Self-review completed
   - [ ] Documentation updated
   - [ ] No security vulnerabilities introduced
   ```

## Coding Standards

### Solidity Style Guide

Follow the [Solidity Style Guide](https://docs.soliditylang.org/en/latest/style-guide.html) with these additions:

1. **File Structure**
   ```solidity
   // SPDX-License-Identifier: Apache-2.0
   pragma solidity ^0.8.19;
   
   // Imports
   import "./interfaces/IAutophageToken.sol";
   
   /**
    * @title ContractName
    * @notice Brief description
    * @dev Detailed description
    */
   contract ContractName {
       // Type declarations
       // State variables
       // Events
       // Modifiers
       // Constructor
       // External functions
       // Public functions
       // Internal functions
       // Private functions
       // View/Pure functions
   }
   ```

2. **Naming Conventions**
   - Contracts: `PascalCase`
   - Functions: `camelCase`
   - Constants: `UPPER_SNAKE_CASE`
   - Variables: `camelCase`
   - Events: `PascalCase`

3. **Documentation**
   - Use NatSpec comments for all public/external functions
   - Document complex algorithms
   - Include gas cost considerations

### JavaScript/TypeScript Style

- Use ESLint configuration
- Prefer async/await over promises
- Use descriptive variable names

## Testing Guidelines

### Test Coverage Requirements

- Minimum 90% code coverage
- 100% coverage for critical functions
- Test all edge cases
- Include gas benchmarks

### Test Structure

```javascript
describe("ContractName", () => {
  describe("functionName", () => {
    it("should do expected behavior", async () => {
      // Arrange
      // Act
      // Assert
    });
    
    it("should revert on invalid input", async () => {
      // Test error cases
    });
  });
});
```

### Gas Optimization Tests

```javascript
describe("Gas Benchmarks", () => {
  it("should measure gas for lazy decay", async () => {
    const tx = await contract.method();
    const receipt = await tx.wait();
    console.log(`Gas used: ${receipt.gasUsed}`);
    expect(receipt.gasUsed).to.be.below(100000);
  });
});
```

## Security Considerations

### Before Submitting

1. **Run Security Tools**
   ```bash
   npm run slither
   npm run mythril
   ```

2. **Check for Common Vulnerabilities**
   - Reentrancy attacks
   - Integer overflow/underflow
   - Access control issues
   - Front-running vulnerabilities
   - Gas limit issues

3. **Follow Best Practices**
   - Use OpenZeppelin contracts where possible
   - Implement proper access controls
   - Add emergency pause mechanisms
   - Use checks-effects-interactions pattern

### Security Checklist

- [ ] No use of `tx.origin`
- [ ] All external calls are last
- [ ] State changes before external calls
- [ ] Proper validation of inputs
- [ ] No floating pragma
- [ ] Events emitted for state changes

## Documentation

### Code Documentation

- Document all functions with NatSpec
- Explain complex algorithms
- Include examples where helpful

### README Updates

Update README.md when:
- Adding new features
- Changing deployment process
- Modifying configuration

### API Documentation

For significant changes:
- Update API documentation
- Add integration examples
- Document breaking changes

## Community

### Communication Channels

- **GitHub Issues**: Bug reports and feature requests
- **Discussions**: General questions and ideas
- **Email**: info@0x42r.io for security issues

### Getting Help

- Check existing documentation
- Search closed issues
- Ask in discussions
- Reach out to maintainers

### Recognition

Contributors will be:
- Listed in CONTRIBUTORS.md
- Mentioned in release notes
- Eligible for bounties (when available)

## Advanced Contributing

### Protocol Improvements

For protocol-level changes:
1. Create a detailed proposal
2. Include mathematical proofs
3. Provide simulation results
4. Demonstrate health impact

### Economic Model Changes

Changes affecting tokenomics require:
- Economic analysis
- Simulation results
- Community discussion
- Governance approval

### Gas Optimizations

When optimizing gas:
- Benchmark before and after
- Document savings
- Ensure no security compromise
- Test all edge cases

## License

By contributing, you agree that your contributions will be licensed under the Apache License 2.0.

## Questions?

If you have questions about contributing:
1. Check this guide
2. Search existing issues
3. Open a discussion
4. Contact maintainers

Thank you for contributing to the Autophage Protocol! Together, we're building a healthier economic future.

---

*"Design for life, not death"*