// The waitlist variations' mock form (job 83). It never sends anything: no fetch, no form
// submission. It checks the fields, then shows the states the real form would: sending, "check
// your inbox" and, through the mock link, the confirmed page. `?s=inbox|confirmed|known` opens a
// state directly. Elements with `data-when` show only in the states they list.
const main = document.querySelector('main[data-wv]');
const card = document.querySelector('[data-wv-form]');
const STATES = ['page', 'sending', 'inbox', 'confirmed', 'known'];

function show(state) {
  main.dataset.state = state;
  for (const el of document.querySelectorAll('[data-when]')) el.hidden = !el.dataset.when.split(' ').includes(state);
}

function fieldError(input, error, message) {
  error.textContent = message ?? '';
  error.hidden = !message;
  if (message) {
    input.setAttribute('aria-invalid', 'true');
    input.setAttribute('aria-describedby', `${input.dataset.hint ?? ''} ${error.id}`.trim());
  } else {
    input.removeAttribute('aria-invalid');
    if (input.dataset.hint) input.setAttribute('aria-describedby', input.dataset.hint);
    else input.removeAttribute('aria-describedby');
  }
}

if (main && card) {
  const form = card.querySelector('form');
  const email = form.elements.email;
  const radios = [...form.querySelectorAll('input[name="platform"]')];
  const emailError = document.getElementById('wl-email-error');
  const platformError = document.getElementById('wl-platform-error');
  email.dataset.hint = email.getAttribute('aria-describedby') ?? '';

  const requested = new URLSearchParams(location.search).get('s');
  if (STATES.includes(requested) && requested !== 'sending') show(requested);

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const value = email.value.trim();
    const emailMessage =
      value === '' ? card.dataset.msgEmailMissing : /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? null : card.dataset.msgEmailInvalid;
    const platform = radios.find((r) => r.checked);
    fieldError(email, emailError, emailMessage);
    platformError.textContent = platform ? '' : card.dataset.msgPlatformMissing;
    platformError.hidden = Boolean(platform);
    for (const r of radios) {
      if (platform) r.removeAttribute('aria-invalid');
      else r.setAttribute('aria-invalid', 'true');
    }
    if (emailMessage) return email.focus();
    if (!platform) return radios[0].focus();
    show('sending');
    setTimeout(() => {
      for (const el of card.querySelectorAll('[data-email]')) el.textContent = value;
      show('inbox');
      card.querySelector('.wl-done').focus();
    }, 700);
  });

  for (const button of document.querySelectorAll('[data-goto]')) {
    button.addEventListener('click', () => {
      show(button.dataset.goto);
      window.scrollTo(0, 0);
      document.querySelector('.wv-confirmed .wl-page')?.focus();
    });
  }
}

// V4's sort animation plays once, when half of it is in view; reduced motion keeps the sorted list.
const sort = document.querySelector('[data-sort]');
if (sort && !matchMedia('(prefers-reduced-motion: reduce)').matches && 'IntersectionObserver' in window) {
  sort.classList.add('is-ready');
  const observer = new IntersectionObserver(
    ([entry]) => {
      if (!entry.isIntersecting) return;
      sort.classList.add('is-playing');
      observer.disconnect();
    },
    { threshold: 0.5 },
  );
  observer.observe(sort);
}
