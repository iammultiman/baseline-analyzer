'use client';

import { useEffect, useState } from 'react';
import { usePWA } from '@/lib/hooks/use-pwa';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Download, 
  RefreshCw, 
  WifiOff, 
  Wifi, 
  Clock, 
  X,
  Smartphone
} from 'lucide-react';

export function PWANotifications() {
  const {
    isInstallable,
    isOnline,
    hasUpdate,
    queuedRequests,
    installApp,
    updateApp,
    processQueue
  } = usePWA();

  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const [showUpdatePrompt, setShowUpdatePrompt] = useState(false);
  const [showOfflineNotice, setShowOfflineNotice] = useState(false);
  const [showQueueNotice, setShowQueueNotice] = useState(false);

  // Show install prompt
  useEffect(() => {
    if (isInstallable) {
      const hasSeenPrompt = localStorage.getItem('pwa-install-prompt-seen');
      if (!hasSeenPrompt) {
        setShowInstallPrompt(true);
      }
    }
  }, [isInstallable]);

  // Show update prompt
  useEffect(() => {
    if (hasUpdate) {
      setShowUpdatePrompt(true);
    }
  }, [hasUpdate]);

  // Show offline notice
  useEffect(() => {
    if (!isOnline) {
      setShowOfflineNotice(true);
    } else {
      setShowOfflineNotice(false);
    }
  }, [isOnline]);

  // Show queue notice
  useEffect(() => {
    if (queuedRequests > 0) {
      setShowQueueNotice(true);
    } else {
      setShowQueueNotice(false);
    }
  }, [queuedRequests]);

  const handleInstall = async () => {
    const success = await installApp();
    if (success) {
      setShowInstallPrompt(false);
      localStorage.setItem('pwa-install-prompt-seen', 'true');
    }
  };

  const handleDismissInstall = () => {
    setShowInstallPrompt(false);
    localStorage.setItem('pwa-install-prompt-seen', 'true');
  };

  const handleUpdate = () => {
    updateApp();
    setShowUpdatePrompt(false);
  };

  const handleProcessQueue = () => {
    processQueue();
  };

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2 max-w-sm">
      {/* Install App Notification */}
      {showInstallPrompt && (
        <Card className="border-blue-200 bg-blue-50">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Smartphone className="w-5 h-5 text-blue-600" />
                <CardTitle className="text-sm">Install App</CardTitle>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDismissInstall}
                className="h-6 w-6 p-0"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
            <CardDescription className="text-xs">
              Install Baseline Analyzer for a better experience
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex space-x-2">
              <Button size="sm" onClick={handleInstall} className="flex-1">
                <Download className="w-4 h-4 mr-1" />
                Install
              </Button>
              <Button size="sm" variant="outline" onClick={handleDismissInstall}>
                Later
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* App Update Notification */}
      {showUpdatePrompt && (
        <Card className="border-green-200 bg-green-50">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <RefreshCw className="w-5 h-5 text-green-600" />
                <CardTitle className="text-sm">Update Available</CardTitle>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowUpdatePrompt(false)}
                className="h-6 w-6 p-0"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
            <CardDescription className="text-xs">
              A new version of the app is ready
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex space-x-2">
              <Button size="sm" onClick={handleUpdate} className="flex-1">
                <RefreshCw className="w-4 h-4 mr-1" />
                Update Now
              </Button>
              <Button size="sm" variant="outline" onClick={() => setShowUpdatePrompt(false)}>
                Later
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Offline Status Notification */}
      {showOfflineNotice && (
        <Card className="border-orange-200 bg-orange-50">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <WifiOff className="w-5 h-5 text-orange-600" />
                <CardTitle className="text-sm">You're Offline</CardTitle>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowOfflineNotice(false)}
                className="h-6 w-6 p-0"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
            <CardDescription className="text-xs">
              Some features may be limited
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {/* Online Status Notification */}
      {!showOfflineNotice && isOnline && queuedRequests === 0 && (
        <div className="flex items-center space-x-2 bg-green-100 text-green-800 px-3 py-2 rounded-md text-sm">
          <Wifi className="w-4 h-4" />
          <span>Online</span>
        </div>
      )}

      {/* Queued Requests Notification */}
      {showQueueNotice && (
        <Card className="border-yellow-200 bg-yellow-50">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Clock className="w-5 h-5 text-yellow-600" />
                <CardTitle className="text-sm">Queued Requests</CardTitle>
                <Badge variant="secondary" className="text-xs">
                  {queuedRequests}
                </Badge>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowQueueNotice(false)}
                className="h-6 w-6 p-0"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
            <CardDescription className="text-xs">
              Analysis requests waiting to be processed
            </CardDescription>
          </CardHeader>
          {isOnline && (
            <CardContent className="pt-0">
              <Button size="sm" onClick={handleProcessQueue} className="w-full">
                Process Now
              </Button>
            </CardContent>
          )}
        </Card>
      )}
    </div>
  );
}