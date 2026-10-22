import { createServices } from './services.js';
import { App } from './ui/App.js';

/**
 * Entry point: build the services, start the app, and register the service
 * worker so the game (and everything the player imported) works offline.
 */
async function main() {
  const root = document.getElementById('app');
  try {
    const services = createServices();
    const app = new App({ services, root });
    globalThis.heroicEncounters = { app, services }; // handy for debugging in the console
    await app.start();
  } catch (error) {
    console.error(error);
    root.textContent = `Something went wrong starting the game: ${error.message}`;
  }

  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('./sw.js').catch((error) => console.warn('Offline mode unavailable:', error));
  }
}

main();
