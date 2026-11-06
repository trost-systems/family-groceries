// The copy button: shown only where the clipboard API exists; its strings live in the HTML.
const button = document.querySelector('.copy-button');
const address = document.querySelector('.field');
const status = document.querySelector('.status');
const label = button?.querySelector('.label');
let timer;

if (button && address && status && label && navigator.clipboard) {
  button.hidden = false;
  button.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(address.textContent.trim());
    } catch {
      return;
    }
    button.classList.add('is-copied');
    status.textContent = label.dataset.copied;
    clearTimeout(timer);
    timer = setTimeout(() => {
      button.classList.remove('is-copied');
      status.textContent = '';
    }, 2000);
  });
}
