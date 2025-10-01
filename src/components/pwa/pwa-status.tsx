'use client';

import { usePWA } from '@/lib/hooks/use-pwa';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Wifi, 
  WifiOff, 
  Download, 
  RefreshCw, 
  Clock,
  Smartphone,
  CheckCircle
} from 'lucide-react';

interface PWAStatusProps {
  showDetails?: boolean;
  className?: string;
}

export function PWAStatus({ showDetails = false, className = '' }: PWAStatusProps) {
  const {
    isInstallable,
    isInstalled,
    isOnline,
    hasUpdate,
    queuedRequests,
    installApp,
    updateApp,
    processQueue
  } = usePWA();

  const handleInstall = async () => {
    await installApp();
  };

  const handleUpdate = () => {
    updateApp();
  };

  const handleProcessQueue = () => {
    processQueue();
  };

  if (!showDetails) {
    // Simple status indicator
    return (
      <div className={`flex items-center space-x-2 ${className}`}>
        {/* Online/Offline Status */}
        <div className="flex items-center space-x-1">
          {isOnline ? (
            <Wifi className="w-4 h-4 text-green-600" />
          ) : (
            <WifiOff className="w-4 h-4 text-red-600" />
          )}
          <span className="text-sm text-gray-600">
            {isOnline ? 'Online' : 'Offline'}
          </span>
        </div>

        {/* Install Status */}
        {isInstalled && (
          <Badge variant="outline" className="text-xs">
            <Smartphone className="w-3 h-3 mr-1" />
            Installed
          </Badge>
        )}

        {/* Update Available */}
        {hasUpdate && (
          <Badge variant="secondary" className="text-xs">
            <RefreshCw className="w-3 h-3 mr-1" />
            Update
          </Badge>
        )}

        {/* Queued Requests */}
        {queuedRequests > 0 && (
          <Badge variant="outline" className="text-xs">
            <Clock className="w-3 h-3 mr-1" />
            {queuedRequests}
          </Badge>
        )}
      </div>
    );
  }

  // Detailed status with actions
  return (
    <div className={`space-y-3 ${className}`}>
      {/* Connection Status */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          {isOnline ? (
            <Wifi className="w-5 h-5 text-green-600" />
          ) : (
            <WifiOff className="w-5 h-5 text-red-600" />
          )}
          <span className="font-medium">
            {isOnline ? 'Online' : 'Offline'}
          </span>
        </div>
        <Badge variant={isOnline ? 'default' : 'destructive'}>
          {isOnline ? 'Connected' : 'Disconnected'}
        </Badge>
      </div>

      {/* Installation Status */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Smartphone className="w-5 h-5 text-blue-600" />
          <span className="font-medium">App Installation</span>
        </div>
        <div className="flex items-center space-x-2">
          {isInstalled ? (
            <Badge variant="default">
              <CheckCircle className="w-3 h-3 mr-1" />
              Installed
            </Badge>
          ) : isInstallable ? (
            <Button size="sm" onClick={handleInstall}>
              <Download className="w-4 h-4 mr-1" />
              Install
            </Button>
          ) : (
            <Badge variant="outline">Not Available</Badge>
          )}
        </div>
      </div>

      {/* Update Status */}
      {hasUpdate && (
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <RefreshCw className="w-5 h-5 text-green-600" />
            <span className="font-medium">App Update</span>
          </div>
          <Button size="sm" onClick={handleUpdate}>
            <RefreshCw className="w-4 h-4 mr-1" />
            Update Now
          </Button>
        </div>
      )}

      {/* Queued Requests */}
      {queuedRequests > 0 && (
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Clock className="w-5 h-5 text-yellow-600" />
            <span className="font-medium">
              Queued Requests ({queuedRequests})
            </span>
          </div>
          {isOnline && (
            <Button size="sm" variant="outline" onClick={handleProcessQueue}>
              Process Now
            </Button>
          )}
        </div>
      )}

      {/* PWA Features */}
      <div className="pt-2 border-t border-gray-200">
        <h4 className="text-sm font-medium text-gray-700 mb-2">PWA Features</h4>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="flex items-center space-x-2">
            <CheckCircle className="w-4 h-4 text-green-600" />
            <span>Offline Support</span>
          </div>
          <div className="flex items-center space-x-2">
            <CheckCircle className="w-4 h-4 text-green-600" />
            <span>Push Notifications</span>
          </div>
          <div className="flex items-center space-x-2">
            <CheckCircle className="w-4 h-4 text-green-600" />
            <span>Background Sync</span>
          </div>
          <div className="flex items-center space-x-2">
            <CheckCircle className="w-4 h-4 text-green-600" />
            <span>Auto Updates</span>
          </div>
        </div>
      </div>
    </div>
  );
}