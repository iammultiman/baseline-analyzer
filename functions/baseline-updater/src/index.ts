import { onSchedule } from 'firebase-functions/v2/scheduler';
import { onRequest } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions';
import { initializeApp } from 'firebase-admin/app';

// Initialize Firebase Admin
initializeApp();

// Baseline data update service (simplified version for Cloud Functions)
class BaselineUpdaterService {
  private readonly webDevApiUrl = 'https://web.dev/api/baseline';
  private readonly databaseUrl = process.env.DATABASE_URL;
  private readonly openaiApiKey = process.env.OPENAI_API_KEY;

  async updateBaselineData(): Promise<{ success: boolean; message: string; details?: any }> {
    try {
      logger.info('Starting baseline data update...');

      // Fetch latest baseline data
      const baselineData = await this.fetchBaselineData();
      logger.info(`Fetched ${baselineData.length} baseline features`);

      // Generate embeddings and update database
      const result = await this.updateDatabase(baselineData);
      
      logger.info('Baseline data update completed', result);
      return {
        success: true,
        message: `Successfully updated baseline data: ${result.featuresUpdated} updated, ${result.featuresAdded} added`,
        details: result,
      };
    } catch (error) {
      logger.error('Error updating baseline data:', error);
      return {
        success: false,
        message: `Failed to update baseline data: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  private async fetchBaselineData(): Promise<any[]> {
    const response = await fetch(this.webDevApiUrl, {
      headers: {
        'User-Agent': 'Baseline-Analyzer-CloudFunction/1.0',
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch baseline data: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return this.transformWebDevData(data);
  }

  private transformWebDevData(data: any): any[] {
    const features: any[] = [];

    if (data.features && Array.isArray(data.features)) {
      features.push(...data.features.map(this.mapFeatureData));
    } else if (Array.isArray(data)) {
      features.push(...data.map(this.mapFeatureData));
    } else if (data.baseline && Array.isArray(data.baseline)) {
      features.push(...data.baseline.map(this.mapFeatureData));
    }

    return features;
  }

  private mapFeatureData = (item: any): any => {
    return {
      id: item.id || item.feature || item.name || crypto.randomUUID(),
      feature: item.feature || item.name || item.title || 'Unknown Feature',
      category: item.category || item.group || 'general',
      status: this.normalizeStatus(item.status || item.baseline_status),
      description: item.description || item.summary || '',
      documentation: item.documentation || item.mdn_url || item.spec_url || '',
      browserSupport: this.normalizeBrowserSupport(item.browser_support || item.support || {}),
      lastUpdated: new Date(),
    };
  };

  private normalizeStatus(status: string): string {
    if (!status) return 'not-baseline';
    
    const normalized = status.toLowerCase();
    if (normalized.includes('baseline') || normalized === 'widely_available') {
      return 'baseline';
    } else if (normalized.includes('limited') || normalized === 'newly_available') {
      return 'limited';
    }
    return 'not-baseline';
  }

  private normalizeBrowserSupport(support: any): any {
    if (!support || typeof support !== 'object') {
      return {};
    }

    return {
      chrome: support.chrome || support.Chrome || support.google_chrome,
      firefox: support.firefox || support.Firefox || support.mozilla_firefox,
      safari: support.safari || support.Safari || support.webkit_safari,
      edge: support.edge || support.Edge || support.microsoft_edge,
      ...support,
    };
  }

  private async updateDatabase(features: any[]): Promise<any> {
    // Call the main application's API endpoint to update the database
    const apiUrl = process.env.APP_BASE_URL || 'https://baseline-analyzer.web.app';
    
    const response = await fetch(`${apiUrl}/api/baseline`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.ADMIN_API_KEY}`, // Admin API key for internal calls
      },
      body: JSON.stringify({
        action: 'update',
        features,
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to update database: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  }
}

const updaterService = new BaselineUpdaterService();

// Scheduled function to run daily at 2 AM UTC
export const scheduledBaselineUpdate = onSchedule(
  {
    schedule: '0 2 * * *', // Daily at 2 AM UTC
    timeZone: 'UTC',
    memory: '1GiB',
    timeoutSeconds: 540, // 9 minutes
  },
  async (event) => {
    logger.info('Scheduled baseline update triggered', { eventId: event.eventId });
    
    const result = await updaterService.updateBaselineData();
    
    if (!result.success) {
      logger.error('Scheduled baseline update failed', result);
      throw new Error(result.message);
    }
    
    logger.info('Scheduled baseline update completed successfully', result);
    return result;
  }
);

// Manual trigger function for testing and manual updates
export const manualBaselineUpdate = onRequest(
  {
    memory: '1GiB',
    timeoutSeconds: 540,
  },
  async (req, res) => {
    logger.info('Manual baseline update triggered');
    
    try {
      const result = await updaterService.updateBaselineData();
      
      res.status(result.success ? 200 : 500).json(result);
    } catch (error) {
      logger.error('Manual baseline update failed:', error);
      res.status(500).json({
        success: false,
        message: `Update failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
    }
  }
);

// Health check function
export const baselineUpdaterHealth = onRequest(async (req, res) => {
  res.json({
    status: 'healthy',
    service: 'baseline-updater',
    timestamp: new Date().toISOString(),
    environment: {
      hasDatabase: !!process.env.DATABASE_URL,
      hasOpenAI: !!process.env.OPENAI_API_KEY,
      hasAppUrl: !!process.env.APP_BASE_URL,
    },
  });
});