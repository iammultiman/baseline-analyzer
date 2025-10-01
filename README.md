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
