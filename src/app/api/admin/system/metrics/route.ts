import { NextRequest, NextResponse } from 'next/server';

export async function GET() {
  try {
    // In a real implementation, these would come from system monitoring tools
    // like Cloud Monitoring, Prometheus, etc.
    const metrics = await getSystemMetrics();

    return NextResponse.json(metrics);
  } catch (error) {
    console.error('Failed to get system metrics:', error);
    return NextResponse.json(
      { error: 'Failed to get system metrics' },
      { status: 500 }
    );
  }
}

async function getSystemMetrics() {
  // Mock system metrics
  // In a real implementation, these would come from actual system monitoring
  
  // Simulate some realistic values with slight randomization
  
  return {
    cpu: {
      usage: Math.random() * 30 + 20, // 20-50% usage
      cores: 4,
    },
    memory: {
      used: 2.1 * 1024 * 1024 * 1024, // 2.1GB
      total: 8 * 1024 * 1024 * 1024, // 8GB
      usage: (2.1 / 8) * 100, // ~26%
    },
    disk: {
      used: 45 * 1024 * 1024 * 1024, // 45GB
      total: 100 * 1024 * 1024 * 1024, // 100GB
      usage: 45, // 45%
    },
    network: {
      inbound: Math.random() * 1024 * 1024 + 512 * 1024, // 0.5-1.5 MB/s
      outbound: Math.random() * 2 * 1024 * 1024 + 1024 * 1024, // 1-3 MB/s
    },
    timestamp: new Date().toISOString(),
  };
}