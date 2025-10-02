#!/usr/bin/env tsx

import { PrismaClient } from '@prisma/client';

async function testDatabaseConnection() {
  const prisma = new PrismaClient();
  
  try {
    console.log('Testing database connection...');
    
    // Test basic connectivity
    await prisma.$queryRaw`SELECT 1 as test`;
    console.log('✅ Database connection successful');
    
    // Test pgvector extension
    const extensions = await prisma.$queryRaw`
      SELECT extname FROM pg_extension WHERE extname = 'vector'
    `;
    
    if (Array.isArray(extensions) && extensions.length > 0) {
      console.log('✅ pgvector extension is available');
    } else {
      console.log('❌ pgvector extension is not installed');
      process.exit(1);
    }
    
    // Test performance with a simple query
    const startTime = Date.now();
    await prisma.user.findMany({ take: 1 });
    const queryTime = Date.now() - startTime;
    
    console.log(`✅ Query performance: ${queryTime}ms`);
    
    if (queryTime > 5000) {
      console.log('⚠️  Database queries are slow (>5s)');
    }
    
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

testDatabaseConnection();