/* The corporate menu on SEO catalog pages.
 * One delegated click handler, no recurring tasks or iterative navigation.
 * Product/search/auth/security business logic remains with its existing owner. */
(() => {
  'use strict';
  const header = document.querySelector('.site-header');
  const menu = header?.querySelector('.menu-button');
  const panel = document.getElementById('main-nav');
  const backdrop = document.querySelector('.nav-backdrop');
  const subnavMotions = new WeakMap();
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  if (!header || !menu || !panel || !backdrop) return;
  document.documentElement.classList.remove('no-js');
  document.documentElement.classList.add('js');
  const setOpen = (open) => {
    menu.setAttribute('aria-expanded', String(open));
    const menuLabel = open
      ? panel.querySelector('.nav-close')?.getAttribute('aria-label')
      : menu.getAttribute('data-l10n-aria-label-' + document.documentElement.lang);
    if (menuLabel) menu.setAttribute('aria-label', menuLabel);
    menu.classList.toggle('dig-menu-opening', open);
    menu.classList.toggle('dig-menu-closing', !open);
    panel.classList.toggle('is-open', open);
    backdrop.hidden = !open;
    document.body.classList.toggle('menu-open', open);
    document.documentElement.classList.toggle('dig-nav-lock', open);
  };
  document.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (target.closest('.site-header .menu-button')) {
      setOpen(menu.getAttribute('aria-expanded') !== 'true');
      return;
    }
    if (target.closest('.nav-close, .nav-backdrop')) {
      setOpen(false);
      return;
    }
    const toggle = target.closest('.site-header .nav-toggle');
    if (toggle) {
      const group = toggle.closest('.nav-group');
      const flyout = group?.querySelector('.nav-flyout');
      if (!group || !flyout) return;
      const previous = subnavMotions.get(group);
      const opening = previous ? !previous.opening : !group.classList.contains('is-open');
      const start = group.getBoundingClientRect().height;
      if (previous) {
        subnavMotions.delete(group);
        previous.motion.cancel();
      }
      const setSubnav = state => {
        group.classList.toggle('is-open', state);
        flyout.classList.toggle('dig-v21-subnav-open', state);
      };
      toggle.setAttribute('aria-expanded', String(opening));
      if (reducedMotion.matches || typeof group.animate !== 'function') {
        setSubnav(opening);
        group.removeAttribute('data-dirac-subnav-animating');
        return;
      }
      setSubnav(opening);
      const end = group.getBoundingClientRect().height;
      if (!opening) setSubnav(true);
      group.setAttribute('data-dirac-subnav-animating', '');
      const motion = group.animate([
        {height: start + 'px'}, {height: end + 'px'}
      ], {duration: 2000, easing: 'cubic-bezier(.22,.72,.2,1)', fill: 'both'});
      const record = {motion, opening};
      subnavMotions.set(group, record);
      motion.finished.then(() => {
        if (subnavMotions.get(group) !== record) return;
        subnavMotions.delete(group);
        setSubnav(opening);
        group.removeAttribute('data-dirac-subnav-animating');
        motion.cancel();
      }, () => {});
      return;
    }
    if (target.closest('.site-header .main-nav a')) {
      setOpen(false);
      return;
    }
    if (target.closest('[data-contact-open]')) {
      window.location.assign('./kontak.html');
    }
    const theme = target.closest('#dirac-pref-theme');
    if (theme) theme.setAttribute('aria-checked', String(document.documentElement.getAttribute('data-dirac-theme') === 'dark'));
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && menu.getAttribute('aria-expanded') === 'true') {
      setOpen(false);
      menu.focus();
    }
  });
})();

/* Product-card disclosure motion: event-driven, finite, no timers or frame loops. */
(() => {
  'use strict';
  const catalog = document.querySelector('[data-catalog]');
  if (!catalog) return;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const active = new WeakMap();
  const numeric = value => Number.parseFloat(value) || 0;
  document.addEventListener('click', event => {
    if (event.defaultPrevented || !event.cancelable || event.button !== 0 ||
        event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
    const target = event.target instanceof Element ? event.target : null;
    const summary = target?.closest('summary');
    const details = summary?.parentElement;
    if (!details?.matches('details[data-card-expander]') || !catalog.contains(details) ||
        reduced.matches || typeof details.animate !== 'function') return;
    if (target.closest('a,button,input,select,textarea')) return;
    event.preventDefault();
    const previous = active.get(details);
    const opening = previous ? !previous.opening : !details.open;
    const start = details.getBoundingClientRect().height;
    const content = details.querySelector('[data-card-description]');
    const startOpacity = content ? getComputedStyle(content).opacity : '1';
    if (previous) {
      active.delete(details);
      previous.height.cancel();
      previous.fade?.cancel();
    }
    details.open = true;
    const full = details.getBoundingClientRect().height;
    const box = getComputedStyle(details);
    const label = getComputedStyle(summary);
    const closed = summary.getBoundingClientRect().height + numeric(label.marginTop) +
      numeric(label.marginBottom) + numeric(box.paddingTop) + numeric(box.paddingBottom) +
      numeric(box.borderTopWidth) + numeric(box.borderBottomWidth);
    details.setAttribute('data-dirac-catalog-animating', opening ? 'opening' : 'closing');
    const height = details.animate([
      {height: start + 'px'}, {height: (opening ? full : closed) + 'px'}
    ], {duration: 2600, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'both'});
    const fade = content ? content.animate([
      {opacity: previous ? startOpacity : (opening ? '0' : '1')},
      {opacity: opening ? '1' : '0'}
    ], {duration: 2600, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'both'}) : null;
    const record = {height, fade, opening};
    active.set(details, record);
    height.finished.then(() => {
      if (active.get(details) !== record) return;
      active.delete(details);
      details.open = opening;
      details.removeAttribute('data-dirac-catalog-animating');
      height.cancel();
      fade?.cancel();
    }, () => {});
  });
})();

/* Missing catalog floating controls: event-driven like corporate pages; no loops or timers. */
(() => {
  'use strict';
  const host = document.querySelector('body[data-catalog]');
  if (!host) return;
  const contact = host.querySelector('[data-quick-contact]');
  const toggle = contact?.querySelector('[data-contact-toggle]');
  const panel = contact?.querySelector('[data-quick-contact-panel]');
  const close = contact?.querySelector('[data-contact-close]');
  if (contact && toggle && panel && close) {
    const setContactOpen = open => {
      panel.hidden = !open;
      toggle.setAttribute('aria-expanded', String(open));
    };
    toggle.addEventListener('click', () => setContactOpen(panel.hidden));
    close.addEventListener('click', () => { setContactOpen(false); toggle.focus(); });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && !panel.hidden) { setContactOpen(false); toggle.focus(); }
    });
    document.addEventListener('click', event => {
      if (!panel.hidden && event.target instanceof Node && !contact.contains(event.target)) setContactOpen(false);
    });
  }
  const button = host.querySelector('.dirac-page-scroll');
  if (!button) return;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const language = document.getElementById('dirac-pref-language');
  let direction = 'down';
  const updateDirection = () => {
    const doc = document.scrollingElement || document.documentElement;
    const extent = Math.max(0, doc.scrollHeight - doc.clientHeight);
    const position = Math.max(0, window.scrollY, doc.scrollTop);
    button.hidden = extent <= 8;
    if (position <= 40) direction = 'down';
    else if (position >= extent - 40) direction = 'up';
    button.setAttribute('data-dirac-direction', direction);
    const lang = language?.value || document.documentElement.getAttribute('data-dirac-ui-lang') || 'id';
    const label = lang === 'en' ? (direction === 'up' ? 'Scroll to top' : 'Scroll to bottom')
      : lang === 'ms' ? (direction === 'up' ? 'Skrol ke atas halaman' : 'Skrol ke bawah halaman')
      : lang === 'fr' ? (direction === 'up' ? 'Remonter en haut de la page' : 'Descendre en bas de la page')
      : lang === 'es' ? (direction === 'up' ? 'Subir al inicio de la página' : 'Bajar al final de la página')
      : (direction === 'up' ? 'Gulir ke atas halaman' : 'Gulir ke bawah halaman');
    button.setAttribute('aria-label', label);
    button.setAttribute('title', label);
  };
  button.addEventListener('click', () => {
    const doc = document.scrollingElement || document.documentElement;
    const destination = direction === 'up' ? 0 : Math.max(0, doc.scrollHeight - doc.clientHeight);
    const current = Math.max(0, window.scrollY, doc.scrollTop);
    const distance = Math.abs(destination - current);
    window.scrollTo({top: destination, behavior: reduced.matches || distance > Math.max(1200, innerHeight * 2) ? 'auto' : 'smooth'});
    updateDirection();
  });
  window.addEventListener('scroll', updateDirection, {passive:true});
  window.addEventListener('resize', updateDirection, {passive:true});
  window.addEventListener('load', updateDirection, {once:true});
  language?.addEventListener('change', updateDirection);
  updateDirection();
})();
