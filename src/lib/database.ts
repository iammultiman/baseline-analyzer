import { PrismaClient } from '@prisma/client'
import { Pool } from 'pg'

const IS_DEMO = process.env.NEXT_PUBLIC_DEMO_MODE === 'true'

// Prisma Client Singleton
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma = IS_DEMO
  ? ({} as unknown as PrismaClient) // Stub in demo mode
  : (globalForPrisma.prisma ?? new PrismaClient({
      log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
      datasources: {
        db: {
          url: process.env.DATABASE_URL,
        },
      },
    }))

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

// PostgreSQL Connection Pool for raw queries (especially for vector operations)
const globalForPool = globalThis as unknown as {
  pool: Pool | undefined
}

export const pool = IS_DEMO
  ? ({
      query: async () => [],
      end: async () => undefined,
    } as unknown as Pool)
  : (globalForPool.pool ?? new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
      maxUses: 7500,
    }))

if (process.env.NODE_ENV !== 'production') globalForPool.pool = pool

// Database connection utilities
export class DatabaseConnection {
  /**
   * Test database connection
   */
  static async testConnection(): Promise<boolean> {
    try {
      await prisma.$queryRaw`SELECT 1`
      return true
    } catch (error) {
      console.error('Database connection test failed:', error)
      return false
    }
  }

  /**
   * Get database connection info
   */
  static async getConnectionInfo() {
    try {
      const result = await prisma.$queryRaw<Array<{ version: string }>>`SELECT version()`
      return result[0]?.version || 'Unknown'
    } catch (error) {
      console.error('Failed to get database version:', error)
      return 'Connection failed'
    }
  }

  /**
   * Check if pgvector extension is available
   */
  static async checkPgVectorExtension(): Promise<boolean> {
    try {
      const result = await prisma.$queryRaw<Array<{ extname: string }>>`
        SELECT extname FROM pg_extension WHERE extname = 'vector'
      `
      return result.length > 0
    } catch (error) {
      console.error('Failed to check pgvector extension:', error)
      return false
    }
  }

  /**
   * Execute vector similarity search using raw SQL
   */
  static async vectorSimilaritySearch(
    embedding: number[],
    limit: number = 10,
    threshold: number = 0.8
  ) {
    try {
      const embeddingString = `[${embedding.join(',')}]`
      const result = await pool.query(
        `
        SELECT 
          id,
          feature,
          category,
          status,
          description,
          documentation,
          browser_support,
          last_updated,
          1 - (embedding <=> $1::vector) as similarity
        FROM baseline_data 
        WHERE embedding IS NOT NULL
          AND 1 - (embedding <=> $1::vector) > $2
        ORDER BY embedding <=> $1::vector
        LIMIT $3
        `,
        [embeddingString, threshold, limit]
      )
      return result.rows
    } catch (error) {
      console.error('Vector similarity search failed:', error)
      throw error
    }
  }

  /**
   * Insert baseline data with vector embedding
   */
  static async insertBaselineDataWithEmbedding(data: {
    feature: string
    category?: string
    status?: string
    description?: string
    documentation?: string
    browserSupport?: any
    embedding?: number[]
  }) {
    try {
      const embeddingString = data.embedding ? `[${data.embedding.join(',')}]` : null
      
      const result = await pool.query(
        `
        INSERT INTO baseline_data (
          feature, category, status, description, documentation, browser_support, embedding
        ) VALUES ($1, $2, $3, $4, $5, $6, $7::vector)
        RETURNING id
        `,
        [
          data.feature,
          data.category || null,
          data.status || null,
          data.description || null,
          data.documentation || null,
          data.browserSupport ? JSON.stringify(data.browserSupport) : null,
          embeddingString
        ]
      )
      return result.rows[0]
    } catch (error) {
      console.error('Failed to insert baseline data with embedding:', error)
      throw error
    }
  }

  /**
   * Gracefully close database connections
   */
  static async closeConnections() {
    try {
      await prisma.$disconnect()
      await pool.end()
    } catch (error) {
      console.error('Error closing database connections:', error)
    }
  }
}

// Graceful shutdown handling
if (!IS_DEMO) {
  process.on('beforeExit', async () => {
    await DatabaseConnection.closeConnections()
  })

  process.on('SIGINT', async () => {
    await DatabaseConnection.closeConnections()
    process.exit(0)
  })

  process.on('SIGTERM', async () => {
    await DatabaseConnection.closeConnections()
    process.exit(0)
  })
}