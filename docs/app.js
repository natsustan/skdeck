const npxCommand = 'npx skdeck';
const npmCommand = 'npm install --global skdeck';

const installCmd = document.querySelector('#install-cmd');
const installTabs = [...document.querySelectorAll('.install-tabs button')];
const copyButton = document.querySelector('.copy');
const tuiTablist = document.querySelector('.tui-tabs');
const tuiTabs = [...document.querySelectorAll('.tui-tabs [role="tab"]')];
const screens = document.querySelectorAll('.screen');

function setInstall(tab) {
  if (!installCmd || !tab) return;
  installCmd.textContent = tab.dataset.cmd === 'npm' ? npmCommand : npxCommand;
  installTabs.forEach(button => {
    button.setAttribute('aria-pressed', button === tab ? 'true' : 'false');
  });
}

installTabs.forEach(button => {
  button.addEventListener('click', () => setInstall(button));
});

async function copyInstall() {
  if (!installCmd || !copyButton) return;
  const value = installCmd.textContent ?? npxCommand;
  try {
    await navigator.clipboard.writeText(value);
  } catch {
    const field = document.createElement('textarea');
    field.value = value;
    field.setAttribute('readonly', '');
    field.style.position = 'absolute';
    field.style.left = '-9999px';
    document.body.append(field);
    field.select();
    document.execCommand('copy');
    field.remove();
  }
  copyButton.dataset.state = 'copied';
  copyButton.textContent = 'copied';
  window.setTimeout(() => {
    copyButton.dataset.state = '';
    copyButton.textContent = 'copy';
  }, 1400);
}

copyButton?.addEventListener('click', () => {
  void copyInstall();
});

function showScreen(id, {focusTab = false} = {}) {
  screens.forEach(screen => {
    screen.hidden = screen.id !== id;
  });
  tuiTabs.forEach(button => {
    const selected = button.dataset.screen === id;
    button.setAttribute('aria-selected', selected ? 'true' : 'false');
    button.tabIndex = selected ? 0 : -1;
    if (selected && focusTab) button.focus();
  });
}

tuiTabs.forEach(button => {
  button.addEventListener('click', () => {
    showScreen(button.dataset.screen);
  });
});

tuiTablist?.addEventListener('keydown', event => {
  const index = tuiTabs.indexOf(event.target);
  if (index < 0) return;
  let next = index;
  if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = (index + 1) % tuiTabs.length;
  else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = (index - 1 + tuiTabs.length) % tuiTabs.length;
  else if (event.key === 'Home') next = 0;
  else if (event.key === 'End') next = tuiTabs.length - 1;
  else if (event.key === 'Enter' || event.key === ' ') next = index;
  else return;
  event.preventDefault();
  showScreen(tuiTabs[next].dataset.screen, {focusTab: true});
});

document.addEventListener('keydown', event => {
  if (event.metaKey || event.ctrlKey || event.altKey) return;
  const target = event.target;
  if (target instanceof HTMLElement) {
    const tag = target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable) return;
    if (target.closest('[role="tablist"]')) return;
  }
  if (event.key >= '1' && event.key <= '4') {
    const tab = tuiTabs[Number(event.key) - 1];
    if (tab) {
      showScreen(tab.dataset.screen);
      event.preventDefault();
    }
  }
});
