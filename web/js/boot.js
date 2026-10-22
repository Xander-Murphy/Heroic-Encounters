/**
 * A plain (non-module) script that still runs when the game's modules fail to
 * load, for example because a browser extension blocked one of them. If the
 * game hasn't started after a while, explain what to try instead of showing
 * "Loading…" forever. main.js marks the page as started.
 */
setTimeout(() => {
  if (document.documentElement.dataset.started) return;
  const root = document.getElementById('app');
  if (!root) return;
  const paragraph = (text) => {
    const element = document.createElement('p');
    element.textContent = text;
    return element;
  };
  const heading = document.createElement('h2');
  heading.textContent = 'Heroic Encounters is taking a long time to start';
  root.replaceChildren(
    heading,
    paragraph('Try reloading the page. If that doesn\'t help, an ad blocker or privacy extension may be blocking part of the game: allow this site in the extension, or try a private window.'),
  );
  root.classList.add('boot-help');
}, 10_000);
