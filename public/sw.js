// Service Worker for Web Push and Background Notifications
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Handle custom message from app to show a notification
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SHOW_NOTIFICATION') {
    const { title, body, icon, badge, data } = event.data;
    const options = {
      body: body || '',
      icon: icon || 'https://lh3.googleusercontent.com/d/1vuPATVrFqA2sMmvnMEj0ooFDyg1q7YTE=s192',
      badge: badge || 'https://lh3.googleusercontent.com/d/1vuPATVrFqA2sMmvnMEj0ooFDyg1q7YTE=s96',
      vibrate: [200, 100, 200],
      data: data || {},
      actions: [
        { action: 'open', title: 'Buka Aplikasi' },
        { action: 'close', title: 'Tutup' }
      ]
    };

    event.waitUntil(
      self.registration.showNotification(title, options)
    );
  }
});

// Handle push notifications from external server (standard Web Push)
self.addEventListener('push', (event) => {
  let payload = {
    title: 'Notifikasi SACIL SMART',
    body: 'Ada informasi terbaru untuk Anda!'
  };

  if (event.data) {
    try {
      payload = event.data.json();
    } catch (e) {
      payload.body = event.data.text();
    }
  }

  const options = {
    body: payload.body,
    icon: payload.icon || 'https://lh3.googleusercontent.com/d/1vuPATVrFqA2sMmvnMEj0ooFDyg1q7YTE=s192',
    badge: payload.badge || 'https://lh3.googleusercontent.com/d/1vuPATVrFqA2sMmvnMEj0ooFDyg1q7YTE=s96',
    vibrate: [100, 50, 100],
    data: { url: payload.url || '/' },
    actions: [
      { action: 'open', title: 'Buka' },
      { action: 'close', title: 'Tutup' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(payload.title, options)
  );
});

// Handle notification interaction (click)
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const urlToOpen = (event.notification.data && event.notification.data.url) || '/';

  if (event.action === 'close') {
    return;
  }

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((windowClients) => {
        // Look for an existing open tab of the app
        for (let i = 0; i < windowClients.length; i++) {
          const client = windowClients[i];
          if (client.url.includes(urlToOpen) && 'focus' in client) {
            return client.focus();
          }
        }
        // If not open, open a new window/tab
        if (self.clients.openWindow) {
          return self.clients.openWindow(urlToOpen);
        }
      })
  );
});
