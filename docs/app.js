const npxCommand = 'npx skdeck';
const npmCommand = 'npm install --global skdeck';

const installCmd = document.querySelector('#install-cmd');
const installTabs = document.querySelectorAll('.install-tabs button');
const copyButton = document.querySelector('.copy');
const tuiTabs = document.querySelectorAll('.tui-tabs button');
const screens = document.querySelectorAll('.screen');

function setInstall(command, tab) {
  if (!installCmd) return;
  installCmd.textContent = command;
  installTabs.forEach(button => {
    button.setAttribute('aria-selected', button === tab ? 'true' : 'false');
  });
}

installTabs.forEach(button => {
  button.addEventListener('click', () => {
    setInstall(button.dataset.cmd === 'npm' ? npmCommand : npxCommand, button);
  });
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

function showScreen(id) {
  screens.forEach(screen => {
    screen.hidden = screen.id !== id;
  });
  tuiTabs.forEach(button => {
    button.setAttribute('aria-selected', button.dataset.screen === id ? 'true' : 'false');
  });
}

tuiTabs.forEach(button => {
  button.addEventListener('click', () => {
    showScreen(button.dataset.screen);
  });
});

document.addEventListener('keydown', event => {
  if (event.metaKey || event.ctrlKey || event.altKey) return;
  const target = event.target;
  if (target instanceof HTMLElement) {
    const tag = target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable) return;
  }
  if (event.key >= '1' && event.key <= '4') {
    const tab = tuiTabs[Number(event.key) - 1];
    if (tab) {
      showScreen(tab.dataset.screen);
      event.preventDefault();
    }
  }
});
