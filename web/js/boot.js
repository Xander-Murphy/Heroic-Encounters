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
  // Styled on its own wrapper: the game may still load and replace this, and must not inherit the layout.
  const help = document.createElement('div');
  help.className = 'boot-help';
  help.append(
    heading,
    paragraph('The server may be waking up, which can take up to a minute. The game will start on its own when it\'s ready.'),
    paragraph('Still stuck after that? Try reloading the page. An ad blocker or privacy extension may also be blocking part of the game: allow this site in the extension, or try a private window.'),
  );
  root.replaceChildren(help);
}, 10_000);
