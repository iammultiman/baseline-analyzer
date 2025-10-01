'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { WifiOff, RefreshCw, Clock, CheckCircle } from 'lucide-react';

interface QueuedRequest {
  url: string;
  timestamp: number;
}

export default function OfflinePage() {
  const [isOnline, setIsOnline] = useState(true);
  const [queuedRequests, setQueuedRequests] = useState<QueuedRequest[]>([]);
  const [processedRequests, setProcessedRequests] = useState<QueuedRequest[]>([]);

  useEffect(() => {
    // Check initial online status
    setIsOnline(navigator.onLine);

    // Listen for online/offline events
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Listen for service worker messages
    const handleServiceWorkerMessage = (event: MessageEvent) => {
      const { type, data } = event.data;
      
      switch (type) {
        case 'ANALYSIS_QUEUED':
          setQueuedRequests(prev => [...prev, data]);
          break;
        case 'ANALYSIS_PROCESSED':
          setQueuedRequests(prev => prev.filter(req => req.timestamp !== data.timestamp));
          setProcessedRequests(prev => [...prev, data]);
          break;
      }
    };

    navigator.serviceWorker?.addEventListener('message', handleServiceWorkerMessage);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      navigator.serviceWorker?.removeEventListener('message', handleServiceWorkerMessage);
    };
  }, []);

  const handleRetry = () => {
    window.location.reload();
  };

  const handleProcessQueue = () => {
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: 'PROCESS_QUEUE'
      });
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full space-y-6">
        {/* Main Offline Card */}
        <Card className="text-center">
          <CardHeader>
            <div className="mx-auto w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <WifiOff className="w-8 h-8 text-gray-600" />
            </div>
            <CardTitle className="text-xl">You're Offline</CardTitle>
            <CardDescription>
              {isOnline 
                ? "Connection restored! You can now browse normally."
                : "No internet connection detected. Some features may be limited."
              }
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-center space-x-2">
              <div className={`w-3 h-3 rounded-full ${isOnline ? 'bg-green-500' : 'bg-red-500'}`} />
              <span className="text-sm text-gray-600">
                {isOnline ? 'Online' : 'Offline'}
              </span>
            </div>
            
            <Button 
              onClick={handleRetry} 
              className="w-full"
              variant={isOnline ? "default" : "outline"}
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              {isOnline ? 'Continue' : 'Try Again'}
            </Button>
          </CardContent>
        </Card>

        {/* Queued Requests */}
        {queuedRequests.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center">
                <Clock className="w-5 h-5 mr-2" />
                Queued Requests
              </CardTitle>
              <CardDescription>
                These analysis requests will be processed when you're back online.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {queuedRequests.map((request, index) => (
                <div key={request.timestamp} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                  <div className="flex-1">
                    <div className="text-sm font-medium">Analysis Request #{index + 1}</div>
                    <div className="text-xs text-gray-500">
                      Queued at {new Date(request.timestamp).toLocaleTimeString()}
                    </div>
                  </div>
                  <Badge variant="secondary">Queued</Badge>
                </div>
              ))}
              
              {isOnline && (
                <Button 
                  onClick={handleProcessQueue}
                  variant="outline" 
                  size="sm" 
                  className="w-full mt-2"
                >
                  Process Now
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        {/* Processed Requests */}
        {processedRequests.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center">
                <CheckCircle className="w-5 h-5 mr-2 text-green-600" />
                Completed Requests
              </CardTitle>
              <CardDescription>
                These requests were successfully processed.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {processedRequests.slice(-3).map((request, index) => (
                <div key={request.timestamp} className="flex items-center justify-between p-2 bg-green-50 rounded">
                  <div className="flex-1">
                    <div className="text-sm font-medium">Analysis Request</div>
                    <div className="text-xs text-gray-500">
                      Completed at {new Date(request.timestamp).toLocaleTimeString()}
                    </div>
                  </div>
                  <Badge variant="default" className="bg-green-600">Completed</Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Available Features */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Available Offline</CardTitle>
            <CardDescription>
              You can still access these features while offline.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              <li className="flex items-center">
                <CheckCircle className="w-4 h-4 mr-2 text-green-600" />
                View cached analysis results
              </li>
              <li className="flex items-center">
                <CheckCircle className="w-4 h-4 mr-2 text-green-600" />
                Browse previously visited pages
              </li>
              <li className="flex items-center">
                <CheckCircle className="w-4 h-4 mr-2 text-green-600" />
                Queue analysis requests
              </li>
              <li className="flex items-center">
                <CheckCircle className="w-4 h-4 mr-2 text-green-600" />
                Access documentation
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}