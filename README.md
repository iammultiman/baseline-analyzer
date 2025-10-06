# Baseline Analyzer

AI-powered code repository analysis against web platform baseline standards. This Progressive Web Application helps developers understand their code's compatibility with modern web standards and provides actionable recommendations for improvement.

## Features

- 🔍 **Repository Analysis**: Submit GitHub/GitLab URLs for comprehensive analysis
- 🤖 **AI-Powered Insights**: Leverages multiple AI providers (OpenAI, Gemini, Claude, etc.)
- 📊 **Baseline Compliance**: Analyzes against current web.dev baseline data
- 💳 **Credit-Based Pricing**: Pay-as-you-go model with transparent costs
- 👥 **Multi-Tenancy**: Organization and team management
- 📱 **Progressive Web App**: Works offline with mobile-first design
- 🔧 **CI/CD Integration**: API endpoints for automated analysis

## Tech Stack

- **Frontend**: Next.js 14, TypeScript, Tailwind CSS, PWA
- **Backend**: Next.js API Routes, Cloud Run
- **Database**: Cloud SQL (PostgreSQL) with pgvector
- **Authentication**: Firebase Auth
- **Hosting**: Firebase Hosting + Google Cloud Platform
- **AI Providers**: OpenRouter, OpenAI, Google Gemini, Claude, Qwen

## Getting Started

### Prerequisites

- Node.js 18+
- Google Cloud Platform account
- Firebase project

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd baseline-analyzer
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.local.example .env.local
# Edit .env.local with your configuration
```

4. Set up Google Cloud Platform:
```bash
npm run setup:gcp your-project-id
```

5. Initialize Firebase:
```bash
firebase init
```

6. Start development server:
```bash
npm run dev
```

### Development

- **Local Development**: `npm run dev`
- **Firebase Emulators**: `npm run emulators`
- **Build**: `npm run build`
- **Lint**: `npm run lint`

### Deployment

- **Firebase Hosting**: `npm run deploy:firebase`
- **Google Cloud Run**: `npm run deploy:gcp`

## Project Structure

```
baseline-analyzer/
├── src/
│   ├── app/                 # Next.js App Router
│   ├── components/          # React components
│   ├── lib/                 # Utilities and configurations
│   └── types/               # TypeScript type definitions
├── public/                  # Static assets
├── scripts/                 # Deployment and setup scripts
├── firebase.json            # Firebase configuration
├── cloudbuild.yaml          # Google Cloud Build configuration
└── Dockerfile               # Container configuration
```

## Configuration

### Environment Variables

See `.env.local.example` for required environment variables:

- Firebase configuration
- Google Cloud settings
- Database connection
- AI provider API keys

### Google Cloud APIs

The following APIs need to be enabled:
- Cloud Build API
- Cloud Run API
- Cloud SQL Admin API
- Cloud Functions API
- Secret Manager API
- Container Registry API
- Firebase API
- Firestore API

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License.

## Demo Mode (Static GitHub Pages)

You can publish a static, authentication-free demo that showcases synthetic analysis data.

### Build Locally

```bash
npm run build:demo
npx serve out
```

### Deploy via GitHub Actions

Push to the `demo-static` branch (or run the workflow manually) to publish to `gh-pages`:

```bash
git checkout -b demo-static
git push origin demo-static
# Trigger the Demo Static Build workflow
```

The site will be available at: `https://<your-username>.github.io/baseline-analyzer/`

### GitHub Pages Base Path
When deploying to a project site (username.github.io/reponame), asset URLs must include the repo folder. The build workflow sets `GITHUB_PAGES=true` which causes `next.config.ts` to apply:

```
basePath = /baseline-analyzer
assetPrefix = /baseline-analyzer/
```

If you fork/rename the repository, either:
1. Set `GITHUB_PAGES=true` and change the `repoName` constant in `next.config.ts`, or
2. Export `NEXT_PUBLIC_DEMO_MODE=true GITHUB_PAGES=true REPO_NAME=your-repo` and adjust the config to read from `process.env.REPO_NAME` (future enhancement).

Service worker and offline fallback URLs were made relative so they work with or without a basePath.

### What Demo Mode Does
| Capability | In Demo |
|------------|---------|
| Auth / Sign In | Disabled |
| Repository Analysis | Mocked |
| Credit Purchases | Disabled |
| Charts / Scores | Synthetic fixtures |

Environment flag: `NEXT_PUBLIC_DEMO_MODE=true`.

## Codespaces Live Demo

Launch a live development environment (Next.js dev server + SQLite) with one click:

[![Open in GitHub Codespaces](https://github.com/codespaces/badge.svg)](https://codespaces.new/iammultiman/baseline-analyzer)

### What Happens Automatically
1. Dependencies install (`npm ci`)
2. Prisma schema is pushed (SQLite dev.db)
3. Dev server starts on port 3000

### Container Image Note
Originally the devcontainer used `mcr.microsoft.com/devcontainers/node:18`, but provisioning intermittently failed in Codespaces (`docker inspect` error). It now uses the broader `mcr.microsoft.com/devcontainers/universal:2` image for reliability. If you need a slimmer image, change the `image` field or introduce a Dockerfile pinning a digest.

### Customizing
Add data seeding or switch to Postgres by editing `.devcontainer/devcontainer.json`.

## Preview Environments (Optional Next Step)

For dynamic previews (Cloud Run per PR) add a workflow similar to `demo-static.yml` but deploying the container.
