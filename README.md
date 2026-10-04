<div align="center">

# DiffPush

**An open-source, interactive technical interview preparation workspace and A2Z DSA sheet tracker.**

[![License: PolyForm Noncommercial](https://img.shields.io/badge/License-PolyForm%20Noncommercial-emerald.svg)](LICENSE.md)
[![Deployed with Cloudflare Pages](https://img.shields.io/badge/Deployed%20with-Cloudflare%20Pages-f38020.svg)](https://pages.cloudflare.com/)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

[Live App](https://diffpush.pages.dev) • [Report Issue](https://github.com/dushyanth96/DiffPush/issues) • [Contribute](CONTRIBUTING.md)

</div>

---

## Overview

**DiffPush** is an open-source technical interview workspace built for computer science students and engineers preparing for technical rounds and campus placements. It combines a structured curriculum tracker with an in-browser code editor and client-side sandbox execution.

### Key Features
- **Curated A2Z DSA Roadmap:** Complete tracking across arrays, linked lists, recursion, trees, graphs, dynamic programming, and advanced topics.
- **Client-Side WASM Code Execution:** In-browser code runner powered by Pyodide—run test cases instantly with zero server roundtrips.
- **Monaco Code Editor:** VS Code-grade editing experience with syntax highlighting, keyboard shortcuts, and bracket matching.
- **Persistent Progress Sync:** Seamless synchronization with GitHub OAuth and local storage backup.
- **Company Tagging & Target Prep:** Filter problems by hiring patterns across top tech companies and product startups.
- **Curated Student Toolkit:** Contextual perks, developer cloud credits, and placement study resources.

---

## Tech Stack

- **Frontend:** React, Tailwind CSS, Monaco Editor, Pyodide (WebAssembly)
- **Deployment & Edge:** Cloudflare Pages
- **Backend / Services:** FastAPI, Docker, Oracle Cloud Infrastructure (OCI)

---

## Getting Started Locally

### Prerequisites
- Node.js (v18.0 or higher)
- npm or pnpm

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/dushyanth96/DiffPush.git
   cd DiffPush
   ```
2. **Install dependencies:**
   ```bash
   npm install
   ```
3. **Start local development server:**
   ```bash
   npm run dev
   ```
4. Open http://localhost:5173 to explore the workspace locally.

## Contributing
We welcome community contributions! Please read our Contributing Guidelines for details on code style, branch naming, and testing standards.

## License & Commercial Terms
DiffPush is a Source-Available project distributed under the PolyForm Noncommercial License 1.0.0.

Personal & Educational Use: 100% free forever for students, developers, and non-commercial study.

Commercial Deployment: Any commercial redistribution, monetized hosting, or paid deployment requires prior written authorization and a 10% royalty agreement. For commercial licensing, contact: dushyanthpragada9@gmail.com.
