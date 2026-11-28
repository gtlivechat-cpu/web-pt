(() => {
  'use strict';

  const catalog = document.querySelector('[data-catalog]');
  if (!catalog) return;

  const languages = ['id', 'en', 'ms', 'fr', 'es'];
  const seriesNames = ['hutanlab', 'ombaklab', 'mentarilab', 'langitlab', 'kayulab', 'kapaslab',
    'embunlab', 'daunalab', 'cahayalab', 'bumilab', 'batulab', 'awanlab', 'ularlab', 'jendelalab',
    'arunalab', 'bayulab', 'rantalab', 'pijarlab'];
  const start = Number(catalog.dataset.start);
  const count = Number(catalog.dataset.count);
  const ogLanguages = {id: 'id_ID', en: 'en_US', ms: 'ms_MY', fr: 'fr_FR', es: 'es_ES'};
  const copy = {
    id: {photo: 'Foto belum tersedia', expand: 'Deskripsi produk', loading: 'Memuat informasi produk…', unavailable: 'Informasi produk belum tersedia. Muat ulang halaman untuk mencoba lagi.', invalid: 'Kode produk tidak ditemukan dalam seri ini.'},
    en: {photo: 'Photo unavailable', expand: 'Product description', loading: 'Loading product information…', unavailable: 'Product information is unavailable. Reload the page to try again.', invalid: 'This product code was not found in the series.'},
    ms: {photo: 'Foto belum tersedia', expand: 'Penerangan produk', loading: 'Memuatkan maklumat produk…', unavailable: 'Maklumat produk belum tersedia. Muat semula halaman untuk mencuba lagi.', invalid: 'Kod produk ini tidak ditemui dalam siri ini.'},
    fr: {photo: 'Photo indisponible', expand: 'Description du produit', loading: 'Chargement des informations produit…', unavailable: 'Les informations produit sont indisponibles. Rechargez la page pour réessayer.', invalid: 'Ce code produit est introuvable dans cette série.'},
    es: {photo: 'Foto no disponible', expand: 'Descripción del producto', loading: 'Cargando información del producto…', unavailable: 'La información del producto no está disponible. Recarga la página para volver a intentarlo.', invalid: 'Este código de producto no figura en la serie.'},
  };
  const series = seriesNames.includes(catalog.dataset.series) ? catalog.dataset.series : '';
  const page = new URL(location.href);
  page.search = '';
  page.hash = '';
  const root = document.documentElement;
  const list = catalog.querySelector('[data-catalog-list]');
  const listPosition = document.createComment('catalog-list');
  list?.before(listPosition);
  const detail = catalog.querySelector('[data-catalog-detail]');
  const detailBack = catalog.querySelector('[data-detail-back]');
  const detailTitle = catalog.querySelector('[data-detail-title]');
  const detailImage = catalog.querySelector('[data-detail-image]');
  const detailDescription = catalog.querySelector('[data-detail-description]');
  const detailFacts = catalog.querySelector('[data-detail-facts]');
  const detailStatus = catalog.querySelector('[data-detail-status]');
  const detailPrice = catalog.querySelector('[data-detail-price]');
  const detailContact = catalog.querySelector('[data-detail-contact]');
  const searchBox = document.querySelector('[data-catalog-search]');
  const search = searchBox?.matches('input') ? searchBox : searchBox?.querySelector('input');
  const empty = catalog.querySelector('[data-catalog-empty], [data-catalog-no-results]');
  const localeControl = document.querySelector('select[data-catalog-language]');
  const languageLinks = document.querySelectorAll('a[data-catalog-language]');
  const cards = new Map();

  for (const card of catalog.querySelectorAll('[data-product-card]')) {
    const key = card.dataset.productCard;
    if (!isProductKey(key) || cards.has(key)) continue;
    const name = card.querySelector('[data-card-name]');
    const summary = card.querySelector('[data-card-summary]');
    cards.set(key, {
      card,
      name,
      summary,
      category: card.querySelector('[data-card-category]'),
      price: card.querySelector('[data-card-price]'),
      contact: card.querySelector('[data-card-contact]'),
      image: card.querySelector('img[data-catalog-image]'),
      link: card.querySelector('a[data-product]'),
      expander: card.querySelector('details[data-card-expander]'),
      description: card.querySelector('[data-card-description]'),
      descriptionLanguage: 'id',
    });
  }

  const meta = (key, kind = 'name') => document.head.querySelector(`meta[${kind}="${key}"]`);
  const initial = {
    title: document.title,
    summary: meta('description')?.content ?? '',
    keywords: meta('keywords')?.content ?? '',
    robots: meta('robots')?.content ?? 'index,follow',
    ogImage: meta('og:image', 'property')?.content ?? '',
    ogAlt: meta('og:image:alt', 'property')?.content ?? '',
    twitterImage: meta('twitter:image')?.content ?? '',
    twitterAlt: meta('twitter:image:alt')?.content ?? '',
    twitterCard: meta('twitter:card')?.content ?? 'summary',
  };
  let language = 'id';
  let cardsLanguage = 'id';
  let rowPromise;
  let renderVersion = 0;
  let firstRender = true;

  function isProductKey(value) {
    if (!series || typeof value !== 'string' || !value.startsWith(series)) return false;
    return /^(?:[1-9][0-9]{0,2}|1000)$/.test(value.slice(series.length));
  }

  function productNumber(key) {
    return Number(key.slice(series.length));
  }

  function routeURL(key, lang) {
    const target = new URL(page.href);
    if (key) target.searchParams.set('produk', key);
    if (lang !== 'id') target.searchParams.set('lang', lang);
    return target;
  }

  function productRequest() {
    const params = new URLSearchParams(location.search);
    const products = params.getAll('produk');
    const choices = params.getAll('lang');
    const lang = choices.length === 1 && languages.includes(choices[0]) ? choices[0] : 'id';
    const key = products.length === 1 && cards.has(products[0]) ? products[0] : '';
    return {key, lang, invalid: Boolean(series && products.length && !key)};
  }

  function text(node, value) {
    if (node) node.textContent = value;
  }

  function setMeta(key, value, kind = 'name') {
    let node = meta(key, kind);
    if (!value) {
      node?.remove();
      return;
    }
    if (!node) {
      node = document.createElement('meta');
      node.setAttribute(kind, key);
      document.head.append(node);
    }
    node.content = value;
  }

  function applyMetadata(key, entry, image, invalid = false) {
    const listingTitle = catalog.getAttribute(`data-title-${language}`) || initial.title;
    const listingSummary = catalog.getAttribute(`data-summary-${language}`) || initial.summary;
    const listingKeywords = catalog.getAttribute(`data-keywords-${language}`) || initial.keywords;
    const target = routeURL(key, language);
    const title = entry?.title || listingTitle;
    const summary = entry?.summary || listingSummary;
    document.title = title;
    setMeta('description', summary);
    setMeta('keywords', entry?.keywords || listingKeywords);
    setMeta('robots', invalid ? 'noindex,follow' : initial.robots);
    setMeta('og:title', title, 'property');
    setMeta('og:description', summary, 'property');
    setMeta('og:url', target.href, 'property');
    setMeta('og:locale', ogLanguages[language], 'property');
    setMeta('og:type', entry ? 'product' : 'website', 'property');
    setMeta('og:image', entry && image === '' ? '' : image || initial.ogImage, 'property');
    setMeta('og:image:alt', entry && image === '' ? '' : entry?.alt || initial.ogAlt, 'property');
    setMeta('twitter:title', title);
    setMeta('twitter:description', summary);
    setMeta('twitter:image', entry && image === '' ? '' : image || initial.twitterImage);
    setMeta('twitter:image:alt', entry && image === '' ? '' : entry?.alt || initial.twitterAlt);
    setMeta('twitter:card', entry && image === '' ? 'summary' : image ? 'summary_large_image' : initial.twitterCard);

    let canonical = document.head.querySelector('link[rel=canonical]');
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.rel = 'canonical';
      document.head.append(canonical);
    }
    canonical.href = target.href;

    for (const lang of [...languages, 'x-default']) {
      let link = document.head.querySelector(`link[rel=alternate][hreflang="${lang}"]`);
      if (!link) {
        link = document.createElement('link');
        link.rel = 'alternate';
        link.hreflang = lang;
        document.head.append(link);
      }
      link.href = routeURL(key, lang === 'x-default' ? 'id' : lang).href;
    }
  }

  function applyTheme(dark, toggle) {
    root.setAttribute('data-dirac-theme', dark ? 'dark' : 'light');
    toggle.setAttribute('aria-pressed', String(dark));
  }

  const toggle = document.querySelector('[data-catalog-theme]');
  if (toggle) {
    const themeKey = 'dirac.site.theme.v1';
    let theme = null;
    try { theme = localStorage.getItem(themeKey); } catch {}
    applyTheme(theme ? theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches, toggle);
    toggle.hidden = false;
    toggle.addEventListener('click', () => {
      const dark = root.getAttribute('data-dirac-theme') !== 'dark';
      applyTheme(dark, toggle);
      try { localStorage.setItem(themeKey, dark ? 'dark' : 'light'); } catch {}
    });
  }

  function applyLanguage(nextLanguage, key) {
    const changed = firstRender || language !== nextLanguage;
    firstRender = false;
    language = nextLanguage;
    if (changed) {
      root.lang = language;
      try { localStorage.setItem('dirac.site.language.v1', language); } catch {}
      for (const node of document.querySelectorAll('[data-l10n-id], [data-l10n-key]')) {
        const wanted = node.getAttribute(`data-l10n-${language}`) ?? copy[language][node.dataset.l10nKey];
        if (typeof wanted === 'string') text(node, wanted);
      }
      for (const node of document.querySelectorAll('[data-l10n-aria-label-id], [data-l10n-placeholder-id], [data-l10n-alt-id], [data-l10n-title-id]')) {
        for (const attribute of ['aria-label', 'placeholder', 'alt', 'title']) {
          const wanted = node.getAttribute(`data-l10n-${attribute}-${language}`);
          if (wanted !== null) node.setAttribute(attribute, wanted);
        }
      }
      for (const link of document.querySelectorAll('a[data-keep-language]')) {
        const href = link.getAttribute('href');
        if (!href || href.startsWith('#')) continue;
        const target = new URL(href, page);
        if (target.origin !== page.origin) continue;
        if (language === 'id') target.searchParams.delete('lang');
        else target.searchParams.set('lang', language);
        link.href = target.href;
      }
      for (const [product, card] of cards) {
        if (card.link) card.link.href = routeURL(product, language).href;
        if (card.description) card.description.hidden = card.descriptionLanguage !== language;
      }
    }
    if (localeControl) localeControl.value = language;
    for (const link of languageLinks) {
      const next = link.dataset.catalogLanguage;
      if (!languages.includes(next)) continue;
      link.href = routeURL(key, next).href;
      if (next === language) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    }
    if (detailBack) detailBack.href = routeURL('', language).href;
  }

  function localImageError(img) {
    if (!(img instanceof HTMLImageElement)) return;
    const filename = img.getAttribute('data-catalog-image');
    if (!filename || !filename.endsWith('.webp') || !isProductKey(filename.slice(0, -5))) return;
    if (img.hasAttribute('data-catalog-local')) {
      img.setAttribute('data-missing', '');
      return;
    }
    img.setAttribute('data-catalog-local', '');
    img.src = new URL(`./${filename}`, page).href;
  }

  document.addEventListener('error', event => localImageError(event.target), true);
  for (const img of catalog.querySelectorAll('img[data-catalog-image]')) {
    if (img.getAttribute('src') && img.complete && !img.naturalWidth) localImageError(img);
  }

  async function readExact(stream, size) {
    if (!stream) throw new Error('Missing catalogue body');
    const result = new Uint8Array(size);
    const reader = stream.getReader();
    let offset = 0;
    try {
      while (offset < size) {
        const {done, value} = await reader.read();
        if (done || !value?.length || value.length > size - offset) throw new Error('Incorrect catalogue length');
        result.set(value, offset);
        offset += value.length;
      }
      if (!(await reader.read()).done) throw new Error('Unexpected trailing catalogue bytes');
      return result;
    } catch (error) {
      try { await reader.cancel(); } catch {}
      throw error;
    } finally {
      reader.releaseLock();
    }
  }

  async function unpackRows() {
    const file = `./katalog-${series}${start === 1 ? '' : '-2'}-data.json`;
    const source = new URL(file, page);
    const compressedSize = Number(catalog.dataset.size);
    const expandedSize = Number(catalog.dataset.expandedSize);
    const digest = (catalog.dataset.sha512 || '').replace(/^sha512-/, '');
    if (!series || ![1, 501].includes(start) || count !== 500 ||
        !catalog.dataset.src || new URL(catalog.dataset.src, page).href !== source.href ||
        !Number.isSafeInteger(compressedSize) || compressedSize <= 0 || compressedSize >= 1900000 ||
        !Number.isSafeInteger(expandedSize) || expandedSize <= 0 || expandedSize > 16000000 ||
        !/^[A-Za-z0-9+/]{86}==$/.test(digest)) {
      throw new Error('Invalid catalogue data seal');
    }

    const response = await fetch(source, {mode: 'same-origin', credentials: 'omit', redirect: 'error'});
    if (response.status !== 200 || response.redirected || (response.url && response.url !== source.href)) {
      throw new Error('Catalogue data request failed');
    }
    const sealed = await readExact(response.body, compressedSize);
    const sum = new Uint8Array(await crypto.subtle.digest('SHA-512', sealed));
    if (btoa(String.fromCharCode(...sum)) !== digest) throw new Error('Catalogue hash does not match');

    const decoder = new TextDecoder('utf-8', {fatal: true});
    const envelope = JSON.parse(decoder.decode(sealed));
    if (envelope.encoding !== 'deflate-base64-v1' || envelope.size !== expandedSize || typeof envelope.data !== 'string') {
      throw new Error('Invalid catalogue data envelope');
    }
    const binary = atob(envelope.data);
    const compressed = Uint8Array.from(binary, character => character.charCodeAt(0));
    const expanded = new Blob([compressed]).stream().pipeThrough(new DecompressionStream('deflate'));
    const payload = JSON.parse(decoder.decode(await readExact(expanded, expandedSize)));
    if (payload.series !== series || !Array.isArray(payload.records) || payload.records.length !== count ||
        payload.records.some((record, index) => record?.id !== start + index)) {
      throw new Error('Invalid catalogue record sequence');
    }
    return payload.records;
  }

  function rows() {
    rowPromise ??= unpackRows();
    return rowPromise;
  }

  const reviewedProductCategories = {
    langitlab672: ['Disposable Cap', 'P108061217', 'hair'],
    kapaslab190: ['PROSHARE Color Disposable Cap', 'P108212042', 'hair'],
    bumilab67: ['CELLUCAP Disposable Lab Coat', 'P116026431', 'coat'],
    embunlab940: ['CELLUCAP Lab Coat Polypropylene', 'P116040237', 'coat'],
    mentarilab738: ['Mobcap White', 'P110813923', 'hair'],
    awanlab309: ['Nurse Cap - Disposable', 'EISCO:BI0364', 'hair'],
    jendelalab719: ['Nurse Cap', 'P107051666', 'hair'],
  };
  const reviewedPriceLabels = {"langitlab672":{"id":["4.159.870","363.870"],"en":["4,159,870","363,870"],"ms":["4,159,870","363,870"],"fr":["4 159 870","363 870"],"es":["4.159.870","363.870"]},"kapaslab190":{"id":["1.819.870","531.700"],"en":["1,819,870","531,700"],"ms":["1,819,870","531,700"],"fr":["1 819 870","531 700"],"es":["1.819.870","531.700"]}};
  const reviewedLabels = {"hair":{"id":"Penutup kepala sekali pakai","en":"Disposable hair covering","ms":"Penutup kepala pakai buang","fr":"Coiffe à usage unique","es":"Gorro desechable"},"coat":{"id":"Jas laboratorium","en":"Laboratory coats","ms":"Kot makmal","fr":"Blouses de laboratoire","es":"Batas de laboratorio"}};
  const reviewedDescriptions = {"hair":{"id":"Produk ini adalah penutup kepala sekali pakai, bukan botol atau wadah. Periksa jenis bahan, ukuran, jumlah per kemasan, dan petunjuk penggunaan dari pemasok sebelum memesan.","en":"This item is a disposable hair covering, not a bottle or container. Confirm material, size, pack quantity and instructions with the supplier before ordering.","ms":"Produk ini ialah penutup kepala pakai buang, bukan botol atau bekas. Sahkan bahan, saiz, kuantiti pek dan arahan penggunaan dengan pembekal sebelum membuat pesanan.","fr":"Ce produit est une coiffe à usage unique, et non un flacon ou récipient. Vérifiez la matière, la taille, la quantité par paquet et les consignes auprès du fournisseur.","es":"Este artículo es un gorro desechable, no una botella ni un recipiente. Confirma el material, la talla, las unidades por paquete y las instrucciones con el proveedor."},"coat":{"id":"Produk ini adalah jas laboratorium, bukan botol atau wadah. Periksa bahan, ukuran, jenis penutupan, jumlah per kemasan, dan persyaratan penggunaan dari pemasok sebelum memesan.","en":"This item is a laboratory coat, not a bottle or container. Confirm material, size, fastening, pack quantity and usage requirements with the supplier before ordering.","ms":"Produk ini ialah kot makmal, bukan botol atau bekas. Sahkan bahan, saiz, penutup pakaian, kuantiti pek dan syarat penggunaan dengan pembekal.","fr":"Ce produit est une blouse de laboratoire, et non un flacon ou récipient. Vérifiez la matière, la taille, la fermeture, la quantité par paquet et les consignes.","es":"Este artículo es una bata de laboratorio, no una botella ni un recipiente. Confirma material, talla, cierre, cantidad por paquete y requisitos de uso con el proveedor."}};

  function entryAt(records, key) {
    const record = records[productNumber(key) - start];
    const entry = record?.locales?.[language];
    if (!entry || record.filename !== `${key}.webp`) return null;
    const review = reviewedProductCategories[key];
    if (review && entry.name === review[0] && entry.facts?.[2]?.[2] === 'mpn' && entry.facts[2][1] === review[1]) {
      const category = reviewedLabels[review[2]][language];
      entry.category = category;
      const categoryFact = entry.facts?.[1]?.[2] === 'category' ? entry.facts[1] : null;
      if (categoryFact) categoryFact[1] = category;
      entry.keywords = `${entry.name}, ${key.toUpperCase()}, ${category}`;
      entry.description = [
        `${entry.name} (${key.toUpperCase()}). ${reviewedDescriptions[review[2]][language]}`,
        `${entry.facts?.[2]?.[0] || 'Referensi pemasok'}: ${review[1]}.`,
        entry.priceLabel || ''
      ];
      const exactPrice = reviewedPriceLabels[key]?.[language];
      const lastFact = entry.facts?.[entry.facts.length - 1];
      if (exactPrice && typeof entry.priceLabel === 'string' && entry.priceLabel.includes(exactPrice[0]) &&
          lastFact && typeof lastFact[1] === 'string' && lastFact[1].includes(exactPrice[0])) {
        entry.priceLabel = entry.priceLabel.replace(exactPrice[0], exactPrice[1]);
        lastFact[1] = lastFact[1].replace(exactPrice[0], exactPrice[1]);
        entry.description[entry.description.length - 1] = entry.priceLabel;
      }
    }
    return {record, entry};
  }

  function replaceParagraphs(container, paragraphs) {
    if (!container || !Array.isArray(paragraphs)) return;
    const output = document.createDocumentFragment();
    for (const paragraph of paragraphs) {
      const node = document.createElement('p');
      text(node, paragraph);
      output.append(node);
    }
    container.replaceChildren(output);
  }

  function localizeCard(card, entry) {
    if (entry) {
      text(card.name, entry.name);
      text(card.summary, entry.summary);
      const category = entry.facts?.find(fact => fact[2] === 'category');
      text(card.category, category?.[1] || entry.category);
      if (card.image) card.image.alt = entry.alt;
      text(card.price, entry.priceLabel || '');
      text(card.contact, entry.quoteLabel);
    }
    if (card.expander?.open && card.description && card.descriptionLanguage !== language && entry) {
      replaceParagraphs(card.description, entry.description);
      card.descriptionLanguage = language;
    }
    if (card.description) card.description.hidden = card.descriptionLanguage !== language;
  }

  function normalize(value) {
    return String(value ?? '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase(language).replace(/[^\p{L}\p{N}]+/gu, ' ').replace(/\s+/g, ' ').trim();
  }

  const typoDistanceWithin = (left,right,limit) => {
    if (!Number.isInteger(limit) || limit<0 || limit>10 || Math.abs(left.length-right.length)>limit || Math.max(left.length,right.length)>256) return Infinity;
    if (left===right) return 0;
    const width=right.length+1;
    const unreachable=limit+1;
    let previousPrevious=new Uint16Array(width).fill(unreachable);
    let previous=new Uint16Array(width).fill(unreachable);
    let current=new Uint16Array(width).fill(unreachable);
    for (let j=0;j<=Math.min(right.length,limit);j++) previous[j]=j;
    for (let i=1;i<=left.length;i++) {
      current.fill(unreachable);
      if (i<=limit) current[0]=i;
      const first=Math.max(1,i-limit), last=Math.min(right.length,i+limit);
      for (let j=first;j<=last;j++) {
        const substitution=previous[j-1]+(left.charCodeAt(i-1)===right.charCodeAt(j-1)?0:1);
        current[j]=Math.min(unreachable,substitution,previous[j]+1,current[j-1]+1);
        if (i>1 && j>1 && left.charCodeAt(i-1)===right.charCodeAt(j-2) && left.charCodeAt(i-2)===right.charCodeAt(j-1)) {
          current[j]=Math.min(current[j],previousPrevious[j-2]+1);
        }
      }
      const spare=previousPrevious;
      previousPrevious=previous;
      previous=current;
      current=spare;
    }
    return previous[right.length]<=limit ? previous[right.length] : Infinity;
  };
  const fuzzySearchMatch = (candidateTokens,queryTokens,cache,titleCompact,queryCompact) => {
    if (!queryTokens.length || queryTokens.length>32 || queryCompact.length>256) return Infinity;
    const tokenScore=queryTokens.reduce((total,queryToken) => {
      if (total>10) return Infinity;
      const nearest=candidateTokens.reduce((best,candidateToken) => {
        if (best===0 || queryToken===candidateToken) return 0;
        const maxLength=Math.max(queryToken.length,candidateToken.length);
        if (Math.min(queryToken.length,candidateToken.length)<2 || (queryToken.length===2 && candidateToken.length===2) || maxLength>64) return best;
        const limit=Math.min(10,Math.max(1,Math.floor(maxLength/2)));
        if (Math.abs(queryToken.length-candidateToken.length)>limit) return best;
        const key=queryToken+'|'+candidateToken;
        const distance=cache.has(key)?cache.get(key):typoDistanceWithin(queryToken,candidateToken,limit);
        if (cache.size<50000) cache.set(key,distance);
        return Math.min(best,distance);
      },Infinity);
      return total+nearest;
    },0);
    if (tokenScore===0 || !queryCompact || !titleCompact || Math.min(queryCompact.length,titleCompact.length)<4 || Math.max(queryCompact.length,titleCompact.length)>256) return tokenScore;
    const limit=Math.min(10,Math.floor(Math.max(queryCompact.length,titleCompact.length)/2));
    if (Math.abs(queryCompact.length-titleCompact.length)>limit) return tokenScore;
    const key='full|'+queryCompact+'|'+titleCompact;
    const distance=cache.has(key)?cache.get(key):typoDistanceWithin(queryCompact,titleCompact,limit);
    if (cache.size<50000) cache.set(key,distance);
    return Math.min(tokenScore,distance);
  };

  let searchOrderChanged = false;

  function filterCards() {
    const query = normalize(search?.value.trim() || '');
    const terms = query.split(/\s+/);
    const cardGrid = catalog.querySelector('.catalog-grid');
    const matches = [];
    const candidates = [];
    for (const [key, card] of cards) {
      const name = normalize(card.name?.textContent ?? '');
      const haystack = normalize(`${key} ${card.name?.textContent ?? ''} ${card.category?.textContent ?? ''} ${card.summary?.textContent ?? ''}`);
      const exact = terms.every(term => haystack.includes(term));
      card.card.hidden = !exact;
      if (exact) matches.push(card);
      candidates.push({card, name, haystack});
    }
    if (query && !matches.length) {
      const normalizedQuery = query.replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
      const queryTokens = normalizedQuery.split(' ').filter(Boolean);
      const compactQuery = normalizedQuery.replace(/\s/g, '');
      const cache = new Map();
      const ranked = [];
      for (const {card, name, haystack} of candidates) {
        const tokens = [...new Set(haystack.replace(/[^\p{L}\p{N}]+/gu, ' ').split(' ').filter(Boolean))];
        const score = fuzzySearchMatch(tokens, queryTokens, cache, name.replace(/[^\p{L}\p{N}]/gu, ''), compactQuery);
        card.card.hidden = score > 10;
        if (!card.card.hidden) ranked.push({card, score});
      }
      ranked.sort((left, right) => left.score - right.score);
      for (const {card} of ranked) {
        matches.push(card);
        if (cardGrid) cardGrid.append(card.card);
      }
      searchOrderChanged ||= Boolean(ranked.length);
    } else if (searchOrderChanged) {
      for (const {card} of cards.values()) if (cardGrid) cardGrid.append(card);
      searchOrderChanged = false;
    }
    if (empty) empty.hidden = matches.length !== 0;
  }

  function showStatus(key = '') {
    if (!detailStatus) return;
    text(detailStatus, key ? copy[language][key] : '');
    detailStatus.hidden = !key;
  }

  function updateFacts(facts) {
    if (!detailFacts || !Array.isArray(facts)) return;
    const output = document.createDocumentFragment();
    for (const [label, value, property] of facts) {
      const group = document.createElement('div');
      const name = document.createElement('dt');
      const data = document.createElement('dd');
      text(name, label);
      text(data, value);
      if (['sku', 'mpn', 'category', 'brand', 'size', 'additionalProperty'].includes(property)) {
        data.setAttribute('itemprop', property);
      }
      group.append(name, data);
      output.append(group);
    }
    detailFacts.replaceChildren(output);
  }

  function restoreList() {
    if (!list) return;
    if (!list.parentNode) listPosition.after(list);
    list.hidden = false;
  }

  const host = location.hostname.toLowerCase().replace(/\.$/, '');
  const parts = host.split('.');
  if (parts.length > 2 && /^(?:www|cs|shop|pt|cv|parfum|order|panel|auth|dev|dev1|secure|security|api|project|domain|topup)$/.test(parts[0])) parts.shift();
  const email = /^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)*[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(parts.join('.')) ? 'pt@' + parts.join('.') : '';
  const noteLines = {
    id: 'Jika foto produk masih memuat companydirac@gmail.com, alamat itu merupakan email lama. Email layanan saat ini: ',
    en: 'If a product photo shows companydirac@gmail.com, that address is outdated. Current service email: ',
    ms: 'Jika foto produk masih memaparkan companydirac@gmail.com, alamat itu ialah e-mel lama. E-mel perkhidmatan semasa: ',
    fr: 'Si une photo affiche companydirac@gmail.com, cette adresse est obsolète. E-mail de contact actuel : ',
    es: 'Si una foto muestra companydirac@gmail.com, esa dirección es antigua. Correo de atención actual: '
  };

  // Display-only email notice; does not modify image sources or contact routing.
  function updatePhotoEmailNotice(image, lang, available) {
    if (!image) return;
    const photo = image.closest("figure");
    if (!photo) return;
    let notice = photo.querySelector("[data-photo-email-note]");
    if (!notice) {
      notice = document.createElement("p");
      notice.className = "photo-email-note";
      notice.setAttribute("data-photo-email-note", "");
      photo.append(notice);
    }
    notice.hidden = !available || !email;
    notice.textContent = (noteLines[lang] || noteLines.id) + email;
  }

  function showDetail(key, record, entry) {
    if (!detail) return;
    const image = new URL(record.image);
    const base = catalog.dataset.imageBase;
    if (image.protocol !== 'https:' || image.username || image.password || image.search || image.hash ||
        !image.pathname.endsWith(`/${record.filename}`) ||
        (base && image.href !== new URL(record.filename, base).href)) {
      throw new Error('Invalid catalogue image location');
    }
    text(detailTitle, entry.name);
    replaceParagraphs(detailDescription, entry.description);
    updateFacts(entry.facts);
    text(detailPrice, entry.priceLabel || '');
    if (detailPrice) detailPrice.hidden = !entry.priceLabel;
    if (detailContact) {
      text(detailContact, entry.quoteLabel);
      const contact = new URL('./kontak.html', page);
      contact.searchParams.set('produk', key);
      if (language !== 'id') contact.searchParams.set('lang', language);
      detailContact.href = contact.href;
    }
    if (detailImage) {
      detailImage.alt = entry.alt;
      if (record.photoAvailable === false) {
        detailImage.removeAttribute('data-catalog-image');
        detailImage.removeAttribute('data-catalog-local');
        detailImage.removeAttribute('src');
        detailImage.removeAttribute('itemprop');
        detailImage.setAttribute('data-missing', '');
      } else if (detailImage.getAttribute('data-catalog-image') !== record.filename || !detailImage.getAttribute('src')) {
        detailImage.removeAttribute('data-catalog-local');
        detailImage.removeAttribute('data-missing');
        detailImage.setAttribute('itemprop', 'image');
        detailImage.setAttribute('data-catalog-image', record.filename);
        detailImage.src = image.href;
      }
    }
    updatePhotoEmailNotice(detailImage, language, record.photoAvailable !== false);
    detail.hidden = false;
    if (list) {
      list.hidden = true;
      list.remove();
    }
    showStatus();
    applyMetadata(key, entry, record.photoAvailable === false ? '' : image.href, record.identified === false);
  }

  async function render(focusDetail = false) {
    const {key, lang, invalid} = productRequest();
    const version = ++renderVersion;
    if (detail) detail.hidden = true;
    restoreList();
    applyLanguage(lang, key);
    showStatus(invalid ? 'invalid' : key ? 'loading' : '');
    applyMetadata(key, null, null, invalid);

    if (!series || (!key && !rowPromise && lang === 'id')) {
      if (search) filterCards();
      return;
    }

    try {
      const records = await rows();
      if (version !== renderVersion) return;
      if (cardsLanguage !== lang) {
        for (const [product, card] of cards) localizeCard(card, entryAt(records, product)?.entry);
        cardsLanguage = lang;
        if (search) filterCards();
      }
      if (!key) return;
      const selected = entryAt(records, key);
      if (!selected) throw new Error('Catalogue record was not found');
      showDetail(key, selected.record, selected.entry);
      if (focusDetail) {
        detailTitle?.focus();
        window.scrollTo(0, 0);
      }
    } catch {
      if (version !== renderVersion) return;
      if (detail) detail.hidden = true;
      restoreList();
      showStatus('unavailable');
      applyMetadata('', null, null, Boolean(key));
    }
  }

  function openRoute(target, focusDetail = false, replace = false) {
    if (target.href !== location.href) {
      if (replace) history.replaceState(null, '', target.href);
      else history.pushState(null, '', target.href);
    }
    return render(focusDetail);
  }

  document.addEventListener('click', event => {
    if (event.defaultPrevented || event.button !== 0 || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    const link = event.target.closest?.('a[data-product], a[data-detail-back], a[data-catalog-language]');
    if (!link || link.hasAttribute('download') || (link.target && link.target !== '_self')) return;
    if (link.hasAttribute('data-detail-back') && link === detailBack) {
      event.preventDefault();
      openRoute(routeURL('', language));
      return;
    }
    if (link.hasAttribute('data-catalog-language') && languages.includes(link.dataset.catalogLanguage)) {
      event.preventDefault();
      openRoute(routeURL(productRequest().key, link.dataset.catalogLanguage), false, true);
      return;
    }
    const key = link.dataset.product;
    if (cards.get(key)?.link !== link) return;
    event.preventDefault();
    openRoute(routeURL(key, language), true);
  });

  localeControl?.addEventListener('change', () => {
    if (languages.includes(localeControl.value)) {
      openRoute(routeURL(productRequest().key, localeControl.value), false, true);
    }
  });

  const catalogMotionPreference = window.matchMedia?.('(prefers-reduced-motion: reduce)');
  const catalogMotionDuration = 2600;
  catalog.addEventListener('click', event => {
    if (event.defaultPrevented || !event.cancelable || event.button !== 0 ||
        event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
    const target = event.target && event.target.nodeType === 1 ? event.target : event.target?.parentElement;
    const summary = target?.closest?.('summary');
    const expander = summary?.parentElement;
    if (!summary || !expander || expander.tagName !== 'DETAILS' || !catalog.contains(expander) ||
        summary.closest('.main-nav,.nav-group')) return;
    const interactive = target?.closest?.('a,button,input,select,textarea');
    if (interactive && summary.contains(interactive)) return;
    if (catalogMotionPreference?.matches || typeof expander.animate !== 'function') return;
    if (expander.hasAttribute('data-dirac-catalog-animating')) {
      event.preventDefault();
      return;
    }
    const key = expander.closest('[data-product-card]')?.dataset.productCard;
    const item = key ? cards.get(key) : null;
    if (expander.matches('details[data-card-expander]') && (!item || item.expander !== expander)) return;
    event.preventDefault();
    const opening = !expander.open;
    const startHeight = expander.getBoundingClientRect().height;
    const summaryStyle = getComputedStyle(summary);
    const detailsStyle = getComputedStyle(expander);
    const closedHeight = summary.getBoundingClientRect().height +
      (Number.parseFloat(summaryStyle.marginTop) || 0) +
      (Number.parseFloat(summaryStyle.marginBottom) || 0) +
      (Number.parseFloat(detailsStyle.paddingTop) || 0) +
      (Number.parseFloat(detailsStyle.paddingBottom) || 0) +
      (Number.parseFloat(detailsStyle.borderTopWidth) || 0) +
      (Number.parseFloat(detailsStyle.borderBottomWidth) || 0);
    expander.setAttribute('data-dirac-catalog-animating', opening ? 'opening' : 'closing');
    expander.style.boxSizing = 'border-box';
    expander.style.overflow = 'hidden';
    expander.style.overflowAnchor = 'none';
    expander.style.height = `${startHeight}px`;
    const settle = (animation, finalOpen) => {
      if (finalOpen !== null) expander.open = finalOpen;
      expander.style.removeProperty('height');
      expander.style.removeProperty('overflow');
      expander.style.removeProperty('box-sizing');
      expander.style.removeProperty('overflow-anchor');
      expander.removeAttribute('data-dirac-catalog-animating');
      animation?.cancel();
    };
    const play = (endHeight, finalOpen) => {
      let animation;
      try {
        animation = expander.animate(
          [{height: `${startHeight}px`}, {height: `${endHeight}px`}],
          {duration: catalogMotionDuration, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'both'}
        );
      } catch {
        settle(null, finalOpen);
        return;
      }
      animation.finished.then(() => settle(animation, finalOpen), () => settle(animation, finalOpen));
    };
    if (!opening) {
      play(closedHeight, false);
      return;
    }
    expander.open = true;
    const currentLanguage = language;
    const open = async () => {
      try {
        if (item && item.descriptionLanguage !== currentLanguage) {
          const records = await rows();
          if (currentLanguage === language && expander.isConnected && expander.open) {
            localizeCard(item, entryAt(records, key)?.entry);
          }
        }
      } catch {
        if (currentLanguage === language) showStatus('unavailable');
      }
      if (!expander.isConnected || !expander.open) {
        settle(null, null);
        return;
      }
      expander.style.height = 'auto';
      const endHeight = expander.getBoundingClientRect().height;
      expander.style.height = `${startHeight}px`;
      void expander.offsetHeight;
      play(endHeight, true);
    };
    open();
  }, true);

  catalog.addEventListener('toggle', async event => {
    const expander = event.target;
    if (!expander.matches?.('details[data-card-expander]') || !expander.open || expander.hasAttribute('data-dirac-catalog-animating')) return;
    const card = expander.closest('[data-product-card]');
    const key = card?.dataset.productCard;
    const item = cards.get(key);
    if (!item || item.expander !== expander || item.descriptionLanguage === language) return;
    const currentLanguage = language;
    try {
      const records = await rows();
      if (currentLanguage === language && expander.open) {
        localizeCard(item, entryAt(records, key)?.entry);
      }
    } catch {
      if (currentLanguage === language) showStatus('unavailable');
    }
  }, true);

  window.addEventListener('popstate', () => render());

  if (search) {
    searchBox.hidden = false;
    search.addEventListener('input', filterCards);
  }

  render();
})();
