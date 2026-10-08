---
title: Contributing
hide:
  - navigation
---

# Contributing to K3d Tweaks

Thank you for your interest in contributing to K3d Tweaks! This guide covers the different ways you can help improve the project.

## Ways to Contribute

### Reporting Issues

Found a bug or have a feature request? Open an issue on [GitHub](https://github.com/vxyaq/k3d-tweaks/issues).

When reporting bugs, include:

- K3d Tweaks version
- Windows version
- Log file (Located at C:\\Users\\YOUR_USER\\AppData\\Roaming\\k3d\\logs)
- Steps to reproduce
- Expected vs actual behavior

### Pull Requests

We welcome pull requests. To get started:

1. Fork the [repository](https://github.com/vxyaq/k3d-tweaks)
2. Create a new branch for your changes
3. Make your changes and test them
4. Submit a pull request with a clear description

## Adding New Apps

You can add new applications to the K3d Tweaks app installer by editing the `apps.json` file.

See the full guide: [Contributing New Apps](/apps/#contributing-new-apps)

## Creating Tweaks

Want to add a new tweak? Tweaks use PowerShell scripts and a `meta.json` configuration file.

See the full guide: [Creating Tweaks](/creating-tweaks/)

## Development Setup

To run K3d Tweaks locally:

```bash
# Clone the repository
git clone https://github.com/vxyaq/k3d-tweaks.git
cd k3d

# Install dependencies
pnpm install

# Start development mode (Admin Recomended. Some things only work with admin)
pnpm dev
```

## Community

- [GitHub Repository](https://github.com/vxyaq/k3d-tweaks)
- [Discord Server](https://discord.com/invite/En5YJYWj3Z)