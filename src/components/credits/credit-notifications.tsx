'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  AlertTriangle, 
  Bell, 
  CreditCard, 
  TrendingDown,
  X,
  Settings
} from 'lucide-react';
import { toast } from 'sonner';

interface CreditNotification {
  id: string;
  type: 'low_balance' | 'usage_limit' | 'spending_alert' | 'recommendation';
  severity: 'info' | 'warning' | 'critical';
  title: string;
  message: string;
  actionLabel?: string;
  actionUrl?: string;
  dismissible: boolean;
  createdAt: string;
  metadata?: Record<string, unknown>;
}

interface NotificationSettings {
  lowBalanceThreshold: number;
  enableLowBalanceAlerts: boolean;
  enableUsageLimitAlerts: boolean;
  enableSpendingAlerts: boolean;
  enableRecommendations: boolean;
  monthlySpendingLimit?: number;
}

export function CreditNotifications() {
  const [notifications, setNotifications] = useState<CreditNotification[]>([]);
  const [settings, setSettings] = useState<NotificationSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    fetchNotifications();
    fetchSettings();
  }, []);

  const fetchNotifications = async () => {
    try {
      const response = await fetch('/api/credits/notifications');
      if (response.ok) {
        const data = await response.json();
        setNotifications(data.notifications || []);
      }
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    }
  };

  const fetchSettings = async () => {
    try {
      const response = await fetch('/api/credits/notification-settings');
      if (response.ok) {
        const data = await response.json();
        setSettings(data.settings);
      }
    } catch (error) {
      console.error('Failed to fetch notification settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const dismissNotification = async (notificationId: string) => {
    try {
      const response = await fetch(`/api/credits/notifications/${notificationId}`, {
        method: 'DELETE',
      });
      
      if (response.ok) {
        setNotifications(prev => prev.filter(n => n.id !== notificationId));
        toast.success('Notification dismissed');
      }
    } catch (error) {
      toast.error('Failed to dismiss notification');
    }
  };

  const updateSettings = async (newSettings: Partial<NotificationSettings>) => {
    try {
      const response = await fetch('/api/credits/notification-settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newSettings),
      });
      
      if (response.ok) {
        const data = await response.json();
        setSettings(data.settings);
        toast.success('Notification settings updated');
      }
    } catch (error) {
      toast.error('Failed to update settings');
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'low_balance':
        return <AlertTriangle className="h-4 w-4" />;
      case 'usage_limit':
        return <TrendingDown className="h-4 w-4" />;
      case 'spending_alert':
        return <CreditCard className="h-4 w-4" />;
      case 'recommendation':
        return <Bell className="h-4 w-4" />;
      default:
        return <Bell className="h-4 w-4" />;
    }
  };



  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'text-red-600 bg-red-50 border-red-200';
      case 'warning':
        return 'text-amber-600 bg-amber-50 border-amber-200';
      case 'info':
        return 'text-blue-600 bg-blue-50 border-blue-200';
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  if (loading) {
    return (
      <div className="animate-pulse">
        <div className="h-4 bg-gray-200 rounded w-1/4 mb-2"></div>
        <div className="h-20 bg-gray-200 rounded"></div>
      </div>
    );
  }

  if (notifications.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium flex items-center gap-2">
          <Bell className="h-5 w-5" />
          Credit Notifications
          {notifications.length > 0 && (
            <Badge variant="secondary">{notifications.length}</Badge>
          )}
        </h3>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowSettings(!showSettings)}
        >
          <Settings className="h-4 w-4 mr-2" />
          Settings
        </Button>
      </div>

      {showSettings && settings && (
        <Card>
          <CardContent className="p-4 space-y-4">
            <h4 className="font-medium">Notification Settings</h4>
            
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-sm">Low balance alerts</label>
                <input
                  type="checkbox"
                  checked={settings.enableLowBalanceAlerts}
                  onChange={(e) => updateSettings({ enableLowBalanceAlerts: e.target.checked })}
                  className="rounded"
                />
              </div>
              
              <div className="flex items-center justify-between">
                <label className="text-sm">Usage limit alerts</label>
                <input
                  type="checkbox"
                  checked={settings.enableUsageLimitAlerts}
                  onChange={(e) => updateSettings({ enableUsageLimitAlerts: e.target.checked })}
                  className="rounded"
                />
              </div>
              
              <div className="flex items-center justify-between">
                <label className="text-sm">Spending alerts</label>
                <input
                  type="checkbox"
                  checked={settings.enableSpendingAlerts}
                  onChange={(e) => updateSettings({ enableSpendingAlerts: e.target.checked })}
                  className="rounded"
                />
              </div>
              
              <div className="flex items-center justify-between">
                <label className="text-sm">Recommendations</label>
                <input
                  type="checkbox"
                  checked={settings.enableRecommendations}
                  onChange={(e) => updateSettings({ enableRecommendations: e.target.checked })}
                  className="rounded"
                />
              </div>

              <div className="flex items-center justify-between">
                <label className="text-sm">Low balance threshold</label>
                <input
                  type="number"
                  value={settings.lowBalanceThreshold}
                  onChange={(e) => updateSettings({ lowBalanceThreshold: parseInt(e.target.value) })}
                  className="w-20 px-2 py-1 border rounded text-sm"
                  min="1"
                  max="100"
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {notifications.map((notification) => (
          <Alert
            key={notification.id}
            className={`${getSeverityColor(notification.severity)} border`}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                {getNotificationIcon(notification.type)}
                <div className="flex-1">
                  <div className="font-medium text-sm">{notification.title}</div>
                  <AlertDescription className="text-sm mt-1">
                    {notification.message}
                  </AlertDescription>
                  {notification.actionLabel && notification.actionUrl && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-2"
                      onClick={() => window.location.href = notification.actionUrl!}
                    >
                      {notification.actionLabel}
                    </Button>
                  )}
                </div>
              </div>
              
              {notification.dismissible && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => dismissNotification(notification.id)}
                  className="h-6 w-6 p-0"
                  aria-label="Dismiss notification"
                >
                  <X className="h-4 w-4" />
                  <span className="sr-only">Dismiss</span>
                </Button>
              )}
            </div>
          </Alert>
        ))}
      </div>
    </div>
  );
}