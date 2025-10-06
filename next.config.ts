import type { NextConfig } from "next";
import withPWA from "@ducanh2912/next-pwa";

const isDemo = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';
const isGitHubPages = process.env.GITHUB_PAGES === 'true';
// Repository name used for GitHub Pages project site basePath.
const repoName = 'baseline-analyzer';

const nextConfig: NextConfig = {
  output: isDemo ? 'export' : 'standalone',
  experimental: {
    optimizePackageImports: ['lucide-react', '@radix-ui/react-icons'],
  },
  eslint: isDemo
    ? {
        // Allow static demo build even if lint errors exist.
        ignoreDuringBuilds: true,
      }
    : undefined,
  typescript: isDemo
    ? {
        // Ignore type errors for demo-only static showcase build.
        ignoreBuildErrors: true,
      }
    : undefined,
};

// Apply GitHub Pages basePath & assetPrefix only for static demo build on gh-pages.
if (isDemo && isGitHubPages) {
  // basePath ensures all Next.js generated asset URLs point under /baseline-analyzer.
  // assetPrefix mirrors basePath for consistency with PWA assets.
  (nextConfig as any).basePath = `/${repoName}`;
  (nextConfig as any).assetPrefix = `/${repoName}/`;
}

export default withPWA({
  dest: "public",
  register: true,
  disable: process.env.NODE_ENV === "development",
  workboxOptions: {
    disableDevLogs: true,
    skipWaiting: true,
    clientsClaim: true,
    runtimeCaching: [
      {
        urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
        handler: 'CacheFirst',
        options: {
          cacheName: 'google-fonts-cache',
          expiration: {
            maxEntries: 10,
            maxAgeSeconds: 60 * 60 * 24 * 365, // 365 days
          },
        },
      },
      {
        urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
        handler: 'CacheFirst',
        options: {
          cacheName: 'gstatic-fonts-cache',
          expiration: {
            maxEntries: 10,
            maxAgeSeconds: 60 * 60 * 24 * 365, // 365 days
          },
        },
      },
      {
        urlPattern: /\.(?:eot|otf|ttc|ttf|woff|woff2|font.css)$/i,
        handler: 'StaleWhileRevalidate',
        options: {
          cacheName: 'static-font-assets',
          expiration: {
            maxEntries: 4,
            maxAgeSeconds: 60 * 60 * 24 * 7, // 7 days
          },
        },
      },
      {
        urlPattern: /\.(?:jpg|jpeg|gif|png|svg|ico|webp)$/i,
        handler: 'StaleWhileRevalidate',
        options: {
          cacheName: 'static-image-assets',
          expiration: {
            maxEntries: 64,
            maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
          },
        },
      },
      {
        urlPattern: /\/_next\/static.+\.js$/i,
        handler: 'CacheFirst',
        options: {
          cacheName: 'next-static-js-assets',
          expiration: {
            maxEntries: 64,
            maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
          },
        },
      },
      {
        urlPattern: /\/_next\/static.+\.css$/i,
        handler: 'CacheFirst',
        options: {
          cacheName: 'next-static-css-assets',
          expiration: {
            maxEntries: 32,
            maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
          },
        },
      },
      {
        urlPattern: /\/_next\/image\?url=.+$/i,
        handler: 'StaleWhileRevalidate',
        options: {
          cacheName: 'next-image',
          expiration: {
            maxEntries: 64,
            maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
          },
        },
      },
      {
        urlPattern: /\/api\/auth\/.*/i,
        handler: 'NetworkFirst',
        options: {
          cacheName: 'auth-api-cache',
          expiration: {
            maxEntries: 32,
            maxAgeSeconds: 60 * 5, // 5 minutes
          },
          networkTimeoutSeconds: 10,
        },
      },
      {
        urlPattern: /\/api\/credits$/i,
        handler: 'NetworkFirst',
        options: {
          cacheName: 'credits-api-cache',
          expiration: {
            maxEntries: 16,
            maxAgeSeconds: 60 * 2, // 2 minutes
          },
          networkTimeoutSeconds: 5,
        },
      },
      {
        urlPattern: /\/api\/baseline\/search.*/i,
        handler: 'StaleWhileRevalidate',
        options: {
          cacheName: 'baseline-search-cache',
          expiration: {
            maxEntries: 128,
            maxAgeSeconds: 60 * 60 * 24, // 24 hours
          },
        },
      },
    ],
    navigateFallback: '/offline',
    navigateFallbackDenylist: [/^\/_/, /\/[^/?]+\.[^/]+$/],
    // Use relative URL so it works with or without a basePath (GitHub Pages).
    additionalManifestEntries: [
      {
        url: 'offline',
        revision: `${Date.now()}`,
      },
    ],
  },
  fallbacks: {
    // Relative so basePath-aware.
    document: 'offline',
  },
})(nextConfig);
