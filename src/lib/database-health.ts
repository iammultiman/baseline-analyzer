import { DatabaseConnection } from './database'

export interface DatabaseHealthCheck {
  status: 'healthy' | 'unhealthy' | 'degraded'
  checks: {
    connection: boolean
    pgvector: boolean
    migrations: boolean
    performance: {
      queryTime: number
      connectionCount: number
    }
  }
  timestamp: Date
  version?: string
}

export class DatabaseHealthChecker {
  /**
   * Perform comprehensive database health check
   */
  static async performHealthCheck(): Promise<DatabaseHealthCheck> {
    const startTime = Date.now()
    const checks = {
      connection: false,
      pgvector: false,
      migrations: false,
      performance: {
        queryTime: 0,
        connectionCount: 0
      }
    }

    let version: string | undefined
    let status: 'healthy' | 'unhealthy' | 'degraded' = 'unhealthy'

    try {
      // Test basic connection
      const connectionStart = Date.now()
      checks.connection = await DatabaseConnection.testConnection()
      checks.performance.queryTime = Date.now() - connectionStart

      if (checks.connection) {
        // Get database version
        version = await DatabaseConnection.getConnectionInfo()

        // Check pgvector extension
        checks.pgvector = await DatabaseConnection.checkPgVectorExtension()

        // Check migrations (basic table existence check)
        checks.migrations = await this.checkMigrations()

        // Get connection count
        checks.performance.connectionCount = await this.getConnectionCount()

        // Determine overall status
        if (checks.connection && checks.pgvector && checks.migrations) {
          status = 'healthy'
        } else if (checks.connection && checks.migrations) {
          status = 'degraded'
        }
      }
    } catch (error) {
      console.error('Database health check failed:', error)
    }

    return {
      status,
      checks,
      timestamp: new Date(),
      version
    }
  }

  /**
   * Check if database migrations have been applied
   */
  private static async checkMigrations(): Promise<boolean> {
    try {
      const { prisma } = await import('./database')
      
      // Try to query a core table to verify migrations
      await prisma.user.findFirst({
        take: 1
      })
      
      return true
    } catch (error) {
      console.error('Migration check failed:', error)
      return false
    }
  }

  /**
   * Get current database connection count
   */
  private static async getConnectionCount(): Promise<number> {
    try {
      const { prisma } = await import('./database')
      
      const result = await prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT count(*) as count 
        FROM pg_stat_activity 
        WHERE state = 'active'
      `
      
      return Number(result[0]?.count || 0)
    } catch (error) {
      console.error('Connection count check failed:', error)
      return 0
    }
  }

  /**
   * Get database performance metrics
   */
  static async getPerformanceMetrics() {
    try {
      const { prisma } = await import('./database')
      
      const [
        tableStats,
        indexStats,
        connectionStats
      ] = await Promise.all([
        // Table statistics
        prisma.$queryRaw<Array<{
          table_name: string
          row_count: bigint
          total_size: string
        }>>`
          SELECT 
            schemaname||'.'||tablename as table_name,
            n_tup_ins + n_tup_upd + n_tup_del as row_count,
            pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as total_size
          FROM pg_stat_user_tables 
          ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
          LIMIT 10
        `,
        
        // Index usage statistics
        prisma.$queryRaw<Array<{
          table_name: string
          index_name: string
          index_scans: bigint
          index_size: string
        }>>`
          SELECT 
            schemaname||'.'||tablename as table_name,
            indexname as index_name,
            idx_scan as index_scans,
            pg_size_pretty(pg_relation_size(schemaname||'.'||indexname)) as index_size
          FROM pg_stat_user_indexes 
          ORDER BY idx_scan DESC
          LIMIT 10
        `,
        
        // Connection statistics
        prisma.$queryRaw<Array<{
          state: string
          count: bigint
        }>>`
          SELECT state, count(*) as count
          FROM pg_stat_activity 
          WHERE pid <> pg_backend_pid()
          GROUP BY state
        `
      ])

      return {
        tables: tableStats.map(stat => ({
          ...stat,
          row_count: Number(stat.row_count)
        })),
        indexes: indexStats.map(stat => ({
          ...stat,
          index_scans: Number(stat.index_scans)
        })),
        connections: connectionStats.map(stat => ({
          ...stat,
          count: Number(stat.count)
        }))
      }
    } catch (error) {
      console.error('Performance metrics check failed:', error)
      return null
    }
  }

  /**
   * Test vector search performance
   */
  static async testVectorSearchPerformance(sampleEmbedding?: number[]): Promise<{
    success: boolean
    queryTime: number
    resultCount: number
    error?: string
  }> {
    const testEmbedding = sampleEmbedding || Array(1536).fill(0).map(() => Math.random())
    const startTime = Date.now()

    try {
      const results = await DatabaseConnection.vectorSimilaritySearch(
        testEmbedding,
        5,
        0.1
      )

      return {
        success: true,
        queryTime: Date.now() - startTime,
        resultCount: results.length
      }
    } catch (error) {
      return {
        success: false,
        queryTime: Date.now() - startTime,
        resultCount: 0,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }
}