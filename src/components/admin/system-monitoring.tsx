'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Activity, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  Database, 
  Loader2, 
  RefreshCw, 
  Server, 
  Zap,
  TrendingUp,
  AlertCircle,
  Cpu,
  HardDrive,
  Network
} from 'lucide-react';

interface SystemHealth {
  status: 'healthy' | 'warning' | 'critical';
  services: {
    database: {
      status: 'up' | 'down' | 'degraded';
      responseTime: number;
      connections: number;
      maxConnections: number;
    };
    aiProviders: Array<{
      name: string;
      status: 'up' | 'down' | 'degraded';
      responseTime: number;
      errorRate: number;
    }>;
    storage: {
      status: 'up' | 'down' | 'degraded';
      usage: number;
      capacity: number;
    };
  };
  performance: {
    avgResponseTime: number;
    requestsPerMinute: number;
    errorRate: number;
    uptime: number;
  };
  alerts: Array<{
    id: string;
    level: 'info' | 'warning' | 'error';
    message: string;
    timestamp: string;
    resolved: boolean;
  }>;
}

interface SystemMetrics {
  cpu: {
    usage: number;
    cores: number;
  };
  memory: {
    used: number;
    total: number;
    usage: number;
  };
  disk: {
    used: number;
    total: number;
    usage: number;
  };
  network: {
    inbound: number;
    outbound: number;
  };
}

export function SystemMonitoring() {
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchSystemData();
    const interval = setInterval(fetchSystemData, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const fetchSystemData = async () => {
    try {
      setRefreshing(true);
      const [healthResponse, metricsResponse] = await Promise.all([
        fetch('/api/admin/system/health'),
        fetch('/api/admin/system/metrics')
      ]);

      if (!healthResponse.ok || !metricsResponse.ok) {
        throw new Error('Failed to fetch system data');
      }

      const [healthData, metricsData] = await Promise.all([
        healthResponse.json(),
        metricsResponse.json()
      ]);

      setHealth(healthData);
      setMetrics(metricsData);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'up':
      case 'healthy':
        return 'text-green-600 bg-green-100';
      case 'warning':
      case 'degraded':
        return 'text-yellow-600 bg-yellow-100';
      case 'down':
      case 'critical':
        return 'text-red-600 bg-red-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'up':
      case 'healthy':
        return <CheckCircle className="h-4 w-4" />;
      case 'warning':
      case 'degraded':
        return <AlertTriangle className="h-4 w-4" />;
      case 'down':
      case 'critical':
        return <AlertCircle className="h-4 w-4" />;
      default:
        return <Clock className="h-4 w-4" />;
    }
  };

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${days}d ${hours}h ${minutes}m`;
  };

  const formatBytes = (bytes: number) => {
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    if (bytes === 0) return '0 B';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin mr-2" />
            Loading system monitoring data...
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-red-600">
            <AlertCircle className="w-8 h-8 mx-auto mb-2" />
            <p>{error}</p>
            <Button onClick={fetchSystemData} className="mt-4">
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">System Monitoring</h2>
          <p className="text-gray-600">
            Real-time system health and performance metrics
          </p>
        </div>
        <Button
          onClick={fetchSystemData}
          disabled={refreshing}
          variant="outline"
          size="sm"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="services">Services</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="alerts">Alerts</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          {/* System Status Overview */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">System Status</CardTitle>
                <Server className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="flex items-center space-x-2">
                  {health && getStatusIcon(health.status)}
                  <Badge className={health ? getStatusColor(health.status) : ''}>
                    {health?.status || 'Unknown'}
                  </Badge>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Uptime</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {health ? formatUptime(health.performance.uptime) : 'N/A'}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Requests/Min</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {health?.performance.requestsPerMinute || 0}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Error Rate</CardTitle>
                <AlertTriangle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {health ? `${(health.performance.errorRate * 100).toFixed(2)}%` : 'N/A'}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Resource Usage */}
          {metrics && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">CPU Usage</CardTitle>
                  <Cpu className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold mb-2">
                    {metrics.cpu.usage.toFixed(1)}%
                  </div>
                  <Progress value={metrics.cpu.usage} className="h-2" />
                  <p className="text-xs text-muted-foreground mt-1">
                    {metrics.cpu.cores} cores
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Memory Usage</CardTitle>
                  <HardDrive className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold mb-2">
                    {metrics.memory.usage.toFixed(1)}%
                  </div>
                  <Progress value={metrics.memory.usage} className="h-2" />
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatBytes(metrics.memory.used)} / {formatBytes(metrics.memory.total)}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Disk Usage</CardTitle>
                  <Database className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold mb-2">
                    {metrics.disk.usage.toFixed(1)}%
                  </div>
                  <Progress value={metrics.disk.usage} className="h-2" />
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatBytes(metrics.disk.used)} / {formatBytes(metrics.disk.total)}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Network I/O</CardTitle>
                  <Network className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span>In:</span>
                      <span>{formatBytes(metrics.network.inbound)}/s</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Out:</span>
                      <span>{formatBytes(metrics.network.outbound)}/s</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        <TabsContent value="services" className="space-y-4">
          {health && (
            <>
              {/* Database Status */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Database className="h-5 w-5" />
                    Database
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="flex items-center space-x-2">
                      {getStatusIcon(health.services.database.status)}
                      <Badge className={getStatusColor(health.services.database.status)}>
                        {health.services.database.status}
                      </Badge>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Response Time</p>
                      <p className="font-medium">{health.services.database.responseTime}ms</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Connections</p>
                      <p className="font-medium">
                        {health.services.database.connections} / {health.services.database.maxConnections}
                      </p>
                      <Progress 
                        value={(health.services.database.connections / health.services.database.maxConnections) * 100} 
                        className="h-2 mt-1" 
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* AI Providers Status */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Zap className="h-5 w-5" />
                    AI Providers
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {health.services.aiProviders.map((provider, index) => (
                      <div key={index} className="grid grid-cols-1 md:grid-cols-4 gap-4 p-3 border rounded-lg">
                        <div className="flex items-center space-x-2">
                          {getStatusIcon(provider.status)}
                          <span className="font-medium">{provider.name}</span>
                        </div>
                        <div>
                          <Badge className={getStatusColor(provider.status)}>
                            {provider.status}
                          </Badge>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Response Time</p>
                          <p className="font-medium">{provider.responseTime}ms</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Error Rate</p>
                          <p className="font-medium">{(provider.errorRate * 100).toFixed(2)}%</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Storage Status */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <HardDrive className="h-5 w-5" />
                    Storage
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="flex items-center space-x-2">
                      {getStatusIcon(health.services.storage.status)}
                      <Badge className={getStatusColor(health.services.storage.status)}>
                        {health.services.storage.status}
                      </Badge>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Usage</p>
                      <p className="font-medium">
                        {formatBytes(health.services.storage.usage)} / {formatBytes(health.services.storage.capacity)}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Usage Percentage</p>
                      <p className="font-medium">
                        {((health.services.storage.usage / health.services.storage.capacity) * 100).toFixed(1)}%
                      </p>
                      <Progress 
                        value={(health.services.storage.usage / health.services.storage.capacity) * 100} 
                        className="h-2 mt-1" 
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        <TabsContent value="performance" className="space-y-4">
          {health && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle>Response Time</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold mb-2">
                    {health.performance.avgResponseTime}ms
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Average response time across all endpoints
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Request Rate</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold mb-2">
                    {health.performance.requestsPerMinute}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Requests per minute
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Error Rate</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold mb-2">
                    {(health.performance.errorRate * 100).toFixed(2)}%
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Percentage of failed requests
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>System Uptime</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold mb-2">
                    {formatUptime(health.performance.uptime)}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Time since last restart
                  </p>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        <TabsContent value="alerts" className="space-y-4">
          {health && (
            <Card>
              <CardHeader>
                <CardTitle>System Alerts</CardTitle>
              </CardHeader>
              <CardContent>
                {health.alerts.length === 0 ? (
                  <div className="text-center py-8">
                    <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-500" />
                    <h3 className="text-lg font-semibold mb-2">No Active Alerts</h3>
                    <p className="text-gray-600">All systems are operating normally</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {health.alerts.map((alert) => (
                      <div
                        key={alert.id}
                        className={`p-4 border rounded-lg ${
                          alert.resolved ? 'bg-gray-50 border-gray-200' : 
                          alert.level === 'error' ? 'bg-red-50 border-red-200' :
                          alert.level === 'warning' ? 'bg-yellow-50 border-yellow-200' :
                          'bg-blue-50 border-blue-200'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-start space-x-3">
                            {alert.level === 'error' && <AlertCircle className="h-5 w-5 text-red-500 mt-0.5" />}
                            {alert.level === 'warning' && <AlertTriangle className="h-5 w-5 text-yellow-500 mt-0.5" />}
                            {alert.level === 'info' && <Activity className="h-5 w-5 text-blue-500 mt-0.5" />}
                            <div>
                              <p className="font-medium">{alert.message}</p>
                              <p className="text-sm text-muted-foreground">
                                {new Date(alert.timestamp).toLocaleString()}
                              </p>
                            </div>
                          </div>
                          <Badge variant={alert.resolved ? "secondary" : "destructive"}>
                            {alert.resolved ? 'Resolved' : 'Active'}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}