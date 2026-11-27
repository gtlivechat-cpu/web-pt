(() => {
  'use strict';

  const catalog = document.querySelector('body[data-catalog]');
  if (!catalog) return;

  const series = catalog.dataset.series;
  if (series !== 'jam' && series !== 'parfum') return;

  const searchBox = document.querySelector('[data-catalog-search]');
  const search = searchBox?.matches('input') ? searchBox : searchBox?.querySelector('input');
  const grid = catalog.querySelector('.catalog-grid');
  const empty = catalog.querySelector('[data-catalog-empty], [data-catalog-no-results]');
  if (!searchBox || !search || !grid || !empty) return;

  const languages = ['id', 'en', 'ms', 'fr', 'es'];
  const messages = {
    id: {
      loading: 'Mencari seluruh katalog…',
      empty: 'Tidak ada produk yang cocok.',
      failed: 'Pencarian seluruh katalog belum dapat diverifikasi. Hasil lokal tetap ditampilkan.',
      count: (total, shown) => total > shown
        ? `Ditemukan ${total} produk. Menampilkan ${shown} hasil pertama; tambahkan kata kunci untuk mempersempit pencarian.`
        : `Ditemukan ${total} produk.`,
    },
    en: {
      loading: 'Searching the full catalogue…',
      empty: 'No matching products.',
      failed: 'The full-catalogue search could not be verified. Local results are still shown.',
      count: (total, shown) => total > shown
        ? `${total} products found. Showing the first ${shown}; add keywords to narrow the results.`
        : `${total} products found.`,
    },
    ms: {
      loading: 'Mencari seluruh katalog…',
      empty: 'Tiada produk yang sepadan.',
      failed: 'Carian seluruh katalog belum dapat disahkan. Hasil setempat masih dipaparkan.',
      count: (total, shown) => total > shown
        ? `${total} produk ditemui. Memaparkan ${shown} hasil pertama; tambah kata kunci untuk mengecilkan carian.`
        : `${total} produk ditemui.`,
    },
    fr: {
      loading: 'Recherche dans tout le catalogue…',
      empty: 'Aucun produit correspondant.',
      failed: 'La recherche dans tout le catalogue n’a pas pu être vérifiée. Les résultats locaux restent affichés.',
      count: (total, shown) => total > shown
        ? `${total} produits trouvés. Affichage des ${shown} premiers résultats ; ajoutez des mots-clés pour affiner la recherche.`
        : `${total} produits trouvés.`,
    },
    es: {
      loading: 'Buscando en todo el catálogo…',
      empty: 'No hay productos que coincidan.',
      failed: 'No se pudo verificar la búsqueda de todo el catálogo. Se muestran los resultados locales.',
      count: (total, shown) => total > shown
        ? `Se encontraron ${total} productos. Se muestran los primeros ${shown}; añade palabras clave para acotar la búsqueda.`
        : `Se encontraron ${total} productos.`,
    },
  };

  const language = () => languages.includes(document.documentElement.lang)
    ? document.documentElement.lang
    : 'id';
  const normalize = (value, lang) => String(value ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase(lang)
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const routePattern = new RegExp(`/katalog-${series}(?:-2)?\\.html$`, 'i');
  const pageRoutes = Array.from(document.querySelectorAll('.navset a[href]'))
    .map(link => new URL(link.getAttribute('href'), location.href))
    .filter(url => url.origin === location.origin && url.protocol === location.protocol && routePattern.test(url.pathname));
  const pageOne = pageRoutes.find(url => url.pathname.toLowerCase().endsWith(`/katalog-${series}.html`));
  const pageTwo = pageRoutes.find(url => url.pathname.toLowerCase().endsWith(`/katalog-${series}-2.html`));
  if (!pageOne || !pageTwo) return;

  const status = document.createElement('p');
  status.className = 'lede';
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  status.hidden = true;
  searchBox.after(status);

  const resultsGrid = document.createElement('div');
  resultsGrid.className = 'catalog-grid';
  resultsGrid.hidden = true;
  status.after(resultsGrid);

  let recordsPromise = null;
  let renderVersion = 0;
  let passThrough = false;
  let globalActive = false;
  let activeLanguage = language();
  const indexCache = new Map();

  const originalCards = () => Array.from(grid.querySelectorAll('[data-product-card]'));
  const resultCards = () => Array.from(resultsGrid.querySelectorAll('[data-global-search-result]'));
  const removeResults = () => resultCards().forEach(card => card.remove());
  const setOriginalCardsHidden = hidden => originalCards().forEach(card => { card.hidden = hidden; });

  function restoreList() {
    globalActive = false;
    removeResults();
    resultsGrid.hidden = true;
    grid.hidden = false;
    setOriginalCardsHidden(false);
    status.hidden = true;
    status.textContent = '';
    empty.hidden = true;
  }

  function runLegacySearch(message = '') {
    restoreList();
    if (message) {
      status.hidden = false;
      status.textContent = message;
    }
    passThrough = true;
    search.dispatchEvent(new Event('input', {bubbles: true}));
  }

  async function loadRecords() {
    if (recordsPromise) return recordsPromise;
    recordsPromise = (async () => {
      const sourceValue = catalog.dataset.src;
      const source = new URL(sourceValue, location.href);
      const compressedSize = Number(catalog.dataset.size);
      const expandedSize = Number(catalog.dataset.expandedSize);
      const digest = (catalog.dataset.sha512 || '').replace(/^sha512-/, '');
      const imageBase = new URL(catalog.dataset.imageBase, location.href);
      if (!sourceValue || source.origin !== location.origin || source.protocol !== location.protocol ||
          !Number.isSafeInteger(compressedSize) || compressedSize <= 0 || compressedSize >= 1900000 ||
          !Number.isSafeInteger(expandedSize) || expandedSize <= 0 || expandedSize > 16000000 ||
          !/^[A-Za-z0-9+/]{86}==$/.test(digest) || imageBase.protocol !== 'https:' ||
          imageBase.username || imageBase.password || imageBase.search || imageBase.hash) {
        throw new Error('Invalid catalogue search seal');
      }

      const response = await fetch(source.href, {
        method: 'GET',
        mode: 'same-origin',
        credentials: 'omit',
        cache: 'no-store',
        redirect: 'error',
      });
      if (response.status !== 200 || response.redirected || (response.url && response.url !== source.href)) {
        throw new Error('Catalogue search request failed');
      }

      const sealed = new Uint8Array(await response.arrayBuffer());
      if (sealed.byteLength !== compressedSize) throw new Error('Incorrect catalogue search length');
      const digestBytes = new Uint8Array(await crypto.subtle.digest('SHA-512', sealed));
      if (btoa(String.fromCharCode(...digestBytes)) !== digest) throw new Error('Catalogue search hash mismatch');

      const decoder = new TextDecoder('utf-8', {fatal: true});
      const envelope = JSON.parse(decoder.decode(sealed));
      if (envelope.encoding !== 'deflate-base64-v1' || envelope.size !== expandedSize || typeof envelope.data !== 'string') {
        throw new Error('Invalid catalogue search envelope');
      }

      const binary = atob(envelope.data);
      const compressed = Uint8Array.from(binary, character => character.charCodeAt(0));
      const expandedStream = new Blob([compressed]).stream().pipeThrough(new DecompressionStream('deflate'));
      const expanded = new Uint8Array(await new Response(expandedStream).arrayBuffer());
      if (expanded.byteLength !== expandedSize) throw new Error('Incorrect expanded catalogue search length');

      const payload = JSON.parse(decoder.decode(expanded));
      if (payload.series !== series || !Array.isArray(payload.records) || payload.records.length !== 1000) {
        throw new Error('Invalid catalogue search records');
      }

      const recordsValid = payload.records.every((record, index) => {
        if (record?.id !== index + 1 || record.filename !== `${series}${index + 1}.webp`) return false;
        const image = new URL(record.image);
        if (image.protocol !== 'https:' || image.username || image.password || image.search || image.hash ||
            image.href !== new URL(record.filename, imageBase).href) return false;
        return languages.every(code => {
          const entry = record.locales?.[code];
          return entry && typeof entry.name === 'string' && typeof entry.summary === 'string' &&
            typeof entry.keywords === 'string' && Array.isArray(entry.facts) &&
            entry.facts.every(fact => Array.isArray(fact) && typeof fact[0] === 'string' && typeof fact[1] === 'string') &&
            Array.isArray(entry.description) && entry.description.every(paragraph => typeof paragraph === 'string');
        });
      });
      if (!recordsValid) throw new Error('Catalogue search integrity validation failed');
      return payload.records;
    })().catch(error => {
      recordsPromise = null;
      throw error;
    });
    return recordsPromise;
  }

  function searchIndex(records, lang) {
    if (indexCache.has(lang)) return indexCache.get(lang);
    const index = records.map(record => {
      const key = `${series}${record.id}`;
      const entry = record.locales[lang];
      const searchable = [key, entry.name, entry.summary, entry.keywords,
        ...entry.facts.flat(), ...entry.description].join(' ');
      const normalized = normalize(searchable, lang);
      return {record, entry, normalized, compact: normalized.replace(/\s/g, '')};
    });
    indexCache.set(lang, index);
    return index;
  }

  function resultURL(record, lang) {
    const target = new URL(record.id <= 500 ? pageOne.href : pageTwo.href);
    target.search = '';
    target.hash = '';
    target.searchParams.set('produk', `${series}${record.id}`);
    if (lang !== 'id') target.searchParams.set('lang', lang);
    return target;
  }

  function createResult(item, lang) {
    const key = `${series}${item.record.id}`;
    const article = document.createElement('article');
    article.className = 'card';
    article.setAttribute('data-global-search-result', '');

    const heading = document.createElement('h2');
    const link = document.createElement('a');
    link.href = resultURL(item.record, lang).href;
    link.textContent = item.entry.name;
    heading.append(link);

    const code = document.createElement('p');
    code.className = 'code';
    code.textContent = key.toUpperCase();

    const details = document.createElement('p');
    details.textContent = item.entry.facts
      .filter(fact => fact[2] !== 'sku' && fact[2] !== 'category')
      .map(fact => `${fact[0]}: ${fact[1]}`)
      .join(' · ');

    article.append(heading, code, details);
    return article;
  }

  async function performSearch() {
    const query = normalize(search.value, language());
    if (!query) {
      restoreList();
      return;
    }

    const version = ++renderVersion;
    const lang = language();
    const copy = messages[lang];
    globalActive = true;
    removeResults();
    setOriginalCardsHidden(true);
    grid.hidden = true;
    resultsGrid.hidden = false;
    empty.hidden = true;
    status.hidden = false;
    status.textContent = copy.loading;

    try {
      const records = await loadRecords();
      if (version !== renderVersion || normalize(search.value, language()) !== query) return;
      const terms = query.split(' ').filter(Boolean);
      const compactQuery = query.replace(/\s/g, '');
      const codeQuery = query.match(new RegExp(`^${series}\\s*([1-9][0-9]{0,2}|1000)$`));
      const index = searchIndex(records, lang);
      const matches = codeQuery
        ? index.filter(item => item.record.id === Number(codeQuery[1]))
        : index.filter(item => terms.every(term => item.normalized.includes(term)) || item.compact.includes(compactQuery));

      if (!matches.length) {
        runLegacySearch();
        return;
      }

      const shown = matches.slice(0, 50);
      shown.map(item => createResult(item, lang)).forEach(card => resultsGrid.append(card));
      const number = new Intl.NumberFormat(lang).format(matches.length);
      const visible = new Intl.NumberFormat(lang).format(shown.length);
      status.textContent = copy.count(number, visible);
      status.hidden = false;
      empty.hidden = true;
      resultsGrid.hidden = false;
      grid.hidden = true;
    } catch {
      if (version !== renderVersion) return;
      runLegacySearch(copy.failed);
    }
  }

  search.addEventListener('input', event => {
    if (passThrough) {
      passThrough = false;
      return;
    }
    if (!search.value.trim()) {
      renderVersion += 1;
      restoreList();
      return;
    }
    event.stopImmediatePropagation();
    performSearch();
  }, true);

  if (typeof MutationObserver === 'function') {
    const languageObserver = new MutationObserver(() => {
      if (globalActive && !empty.hidden) empty.hidden = true;
      const nextLanguage = language();
      if (nextLanguage !== activeLanguage) {
        activeLanguage = nextLanguage;
        if (search.value.trim()) performSearch();
      }
    });
    languageObserver.observe(document.documentElement, {attributes: true, attributeFilter: ['lang']});
    languageObserver.observe(empty, {attributes: true, attributeFilter: ['hidden']});
  }
})();
