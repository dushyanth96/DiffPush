# Contributing to DiffPush

Thank you for your interest in contributing to DiffPush! We welcome bug fixes, documentation improvements, problem test case refinements, and UI enhancements from the developer community.

## Ground Rules
- Keep PRs focused on a single bug fix, performance boost, or UI enhancement.
- Do not alter or remove author attributions, source licensing headers, or licensing notices.
- Follow existing React (Vite/Tailwind) structure and clean code practices.
- Ensure all Pyodide execution workers and Monaco editor interactions continue running smoothly.

## Getting Started
1. Check existing GitHub issues or discussions before opening a new ticket.
2. Fork the repository and create your branch from `main`:
   ```bash
   git checkout -b feature/your-feature-name
   ```
3. Test your changes locally to ensure the client-side Pyodide sandbox, local storage caching, and roadmap views render without console errors.
4. Commit with clean, conventional commit messages (feat: ..., fix: ..., docs: ...).
5. Open a Pull Request with a clear description and screenshots of the changes.
