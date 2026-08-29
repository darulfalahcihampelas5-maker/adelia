// Utility for Web Push Notifications and Service Worker registration

export interface NotificationPayload {
  title: string;
  body: string;
  url?: string;
}

// Register Service Worker for background Web Push support
export async function registerSW(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) {
    console.warn('Service Workers are not supported in this browser.');
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/'
    });
    console.log('Service Worker registered successfully:', registration);
    return registration;
  } catch (error) {
    console.error('Service Worker registration failed:', error);
    return null;
  }
}

// Request notification permissions
export async function requestPermission(): Promise<NotificationPermission> {
  if (!('Notification' in window)) {
    console.warn('Notifications not supported in this browser.');
    return 'denied';
  }

  const permission = await Notification.requestPermission();
  return permission;
}

// Check current notification permission
export function getNotificationPermission(): NotificationPermission {
  if (!('Notification' in window)) {
    return 'denied';
  }
  return Notification.permission;
}

// Send an immediate or delayed out-of-app notification
// Delayed notifications are perfect for testing: click, lock screen or go to home screen, then see it trigger!
export async function triggerWebPushNotification(
  title: string,
  body: string,
  delaySeconds: number = 0
): Promise<boolean> {
  if (!('Notification' in window) || Notification.permission !== 'granted') {
    console.warn('Notification permission not granted.');
    return false;
  }

  const sendNotification = async () => {
    // If Service Worker is active, send via Service Worker so it runs correctly in the background
    if ('serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.getRegistration();
        if (registration && registration.active) {
          // Send message to Service Worker
          if (navigator.serviceWorker.controller) {
            navigator.serviceWorker.controller.postMessage({
              type: 'SHOW_NOTIFICATION',
              title,
              body,
              data: { url: window.location.origin }
            });
            return;
          }
          
          // Fallback to direct background registration call
          await registration.showNotification(title, {
            body,
            icon: 'https://lh3.googleusercontent.com/d/1vuPATVrFqA2sMmvnMEj0ooFDyg1q7YTE=s192',
            badge: 'https://lh3.googleusercontent.com/d/1vuPATVrFqA2sMmvnMEj0ooFDyg1q7YTE=s96',
            vibrate: [200, 100, 200],
            data: { url: window.location.origin }
          } as any);
          return;
        }
      } catch (e) {
        console.error('Failed to send through Service Worker, falling back:', e);
      }
    }

    // Direct fallback (only works if tab is open, but good for compatibility)
    try {
      new Notification(title, {
        body,
        icon: 'https://lh3.googleusercontent.com/d/1vuPATVrFqA2sMmvnMEj0ooFDyg1q7YTE=s192'
      });
    } catch (err) {
      console.error('Direct notification construction failed:', err);
    }
  };

  if (delaySeconds > 0) {
    setTimeout(sendNotification, delaySeconds * 1000);
  } else {
    await sendNotification();
  }

  return true;
}
