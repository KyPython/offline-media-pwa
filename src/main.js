/**
 * Main Entry Point - App Bootstrap
 * 
 * Registers service worker, initializes modules, wires up UI
 */

import { registerSW } from 'workbox-window';
import * as sync from './sync.js';
import * as ui from './ui.js';
import * as db from './db.js';

/**
 * Register Service Worker
 */
async function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    try {
      // Use the service worker from the public directory
      // Vite PWA plugin will handle the build-time injection
      const registration = await navigator.serviceWorker.register('/service-worker.js', {
        scope: '/'
      });

      console.log('Service Worker registered:', registration);

      // Listen for updates
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            console.log('New service worker available');
            // Could show a notification to reload
          }
        });
      });

      // Listen for messages from service worker
      navigator.serviceWorker.addEventListener('message', (event) => {
        console.log('Message from service worker:', event.data);
        if (event.data && event.data.type === 'SYNC_COMPLETE') {
          // Refresh UI when sync completes
          ui.loadQueue();
          ui.loadSubmissions();
        }
      });

      return registration;
    } catch (error) {
      console.error('Service Worker registration failed:', error);
    }
  } else {
    console.warn('Service Workers are not supported');
  }
}

/**
 * Initialize Database
 */
async function initDatabase() {
  try {
    await db.openDB();
    console.log('Database initialized');
  } catch (error) {
    console.error('Database initialization failed:', error);
  }
}

/**
 * Initialize App
 */
async function initApp() {
  console.log('Initializing Offline Media PWA...');

  // Initialize database
  await initDatabase();

  // Register service worker
  await registerServiceWorker();

  // Initialize sync
  sync.initSync();

  // Initialize UI
  ui.initUI();

  console.log('App initialized');
}

// Start app when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}

