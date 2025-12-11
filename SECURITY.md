# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.x.x   | :white_check_mark: |
| < 1.0   | :x:                |

## Reporting a Vulnerability

We take security seriously. If you discover a security vulnerability in Derigo, please report it responsibly.

### How to Report

**Please do NOT report security vulnerabilities through public GitHub issues.**

Instead, please report them via one of these methods:

1. **GitHub Security Advisories**: Use the [Security tab](https://github.com/witlox/derigo/security/advisories/new) to report vulnerabilities privately.

2. **Email**: Send details to the repository maintainer (see GitHub profile for contact).

### What to Include

Please include as much of the following information as possible:

- Type of vulnerability (XSS, injection, privilege escalation, etc.)
- Full paths of affected source files
- Location of the affected source code (tag/branch/commit or direct URL)
- Step-by-step instructions to reproduce the issue
- Proof-of-concept or exploit code (if possible)
- Impact assessment of the vulnerability

### Response Timeline

- **Acknowledgment**: Within 48 hours of report
- **Initial Assessment**: Within 1 week
- **Resolution Timeline**: Depends on severity and complexity
- **Disclosure**: Coordinated with reporter

### What to Expect

1. **Acknowledgment**: We will acknowledge receipt of your report
2. **Communication**: We will keep you informed of our progress
3. **Credit**: We will credit you in the security advisory (unless you prefer anonymity)
4. **No Retaliation**: We will not take legal action against researchers who follow this policy

## Security Measures

### Extension Security

Derigo follows Chrome Extension Manifest V3 security best practices:

- **Minimal Permissions**: Only requests permissions that are necessary
- **Content Security Policy**: Strict CSP prevents inline script execution
- **No Remote Code**: All code is bundled; no remote script loading
- **Sandboxed Context**: Content scripts run in isolated world

### Data Security

- **Local Processing**: All classification happens locally by default
- **No Telemetry**: No usage data, analytics, or tracking
- **Hash-Only Cache**: Only URL hashes are cached, not page content
- **Optional APIs**: External API calls are opt-in and user-controlled

### API Key Security

If using optional external APIs:

- API keys are stored in Chrome's secure storage
- Keys are never transmitted except to their respective services
- Keys are never logged or included in error reports

## Security Updates

Security updates are released as patch versions (e.g., 1.0.1) and announced via:

- GitHub Security Advisories
- Release notes
- Repository notifications (for watchers)

## Scope

### In Scope

- Derigo extension code (this repository)
- Chrome storage security
- Content script isolation
- API key handling
- Cross-site scripting prevention
- Data privacy concerns

### Out of Scope

- Third-party dependencies (report to respective projects)
- Chrome browser vulnerabilities (report to Google)
- External API services (report to respective services)
- Social engineering attacks
- Physical access attacks

## Security Best Practices for Users

1. **Install from trusted sources**: Only install from official releases
2. **Review permissions**: Understand what permissions the extension requests
3. **Protect API keys**: If using external APIs, keep your keys secure
4. **Keep updated**: Install updates promptly for security fixes
5. **Report issues**: If something seems wrong, report it

## Acknowledgments

We thank the security researchers who have helped improve Derigo's security:

*No vulnerabilities reported yet.*

---

Thank you for helping keep Derigo and its users safe!
