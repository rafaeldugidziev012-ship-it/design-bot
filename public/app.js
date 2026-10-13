(() => {
  'use strict';

  const tg = window.Telegram && window.Telegram.WebApp;
  const inTg = !!(tg && tg.initData);

  const S = {
    data: null,      // { settings, services, works }
    me: null,        // { user, isAdmin, orders }
    admin: null,     // { services, orders, usersCount, botEnabled }
    tab: 'home',
    filter: 'all',
    adminTab: 'orders',
    orderFilter: 'new',
    stack: [],
    edit: null,
  };

  // ---------- утилиты ----------
  const $ = (s, el = document) => el.querySelector(s);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const cur = () => S.data?.settings?.currency || '₸';
  const money = (n) => `${Number(n || 0).toLocaleString('ru-RU')} ${cur()}`;
  const priceText = (s) => (s.priceFrom ? 'от ' : '') + money(s.price);
  const imgSrc = (id) => (!id ? '' : /^(\/|https?:)/.test(id) ? id : '/img/' + encodeURIComponent(id));
  const cats = () => S.data?.settings?.categories || [];
  const catName = (id) => cats().find((c) => c.id === id)?.name || 'Другое';
  const fmtDate = (t) => new Date(t).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  const STATUS = { new: 'Новая', in_progress: 'В работе', done: 'Готово', cancelled: 'Отменена' };

  const GRADS = [
    'linear-gradient(135deg,#7c3aed,#db2777)',
    'linear-gradient(135deg,#0ea5e9,#6366f1)',
    'linear-gradient(135deg,#f59e0b,#e11d48)',
    'linear-gradient(135deg,#10b981,#0e7490)',
    'linear-gradient(135deg,#ec4899,#8b5cf6)',
    'linear-gradient(135deg,#f97316,#be123c)',
    'linear-gradient(135deg,#6366f1,#0f172a)',
  ];
  const hash = (s) => [...String(s)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
  const gradFor = (id) => GRADS[hash(id) % GRADS.length];
  const arFor = (id) => ['4/5', '1/1', '3/4', '4/5', '5/6'][hash(id + 'a') % 5];

  function haptic(type = 'light') {
    try {
      if (!tg?.HapticFeedback) return;
      if (['success', 'error', 'warning'].includes(type)) tg.HapticFeedback.notificationOccurred(type);
      else if (type === 'select') tg.HapticFeedback.selectionChanged();
      else tg.HapticFeedback.impactOccurred(type);
    } catch {}
  }

  let toastTimer;
  function toast(msg, err) {
    const el = $('#toast');
    el.textContent = msg;
    el.classList.toggle('err', !!err);
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
    if (err) haptic('error');
  }

  async function api(method, url, body, isForm) {
    const headers = { 'X-Init-Data': tg?.initData || '' };
    if (body && !isForm) headers['Content-Type'] = 'application/json';
    const r = await fetch(url, { method, headers, body: isForm ? body : body ? JSON.stringify(body) : undefined });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.error || 'Что-то пошло не так');
    return data;
  }

  // ---------- иконки ----------
  const I = {
    home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/></svg>',
    works: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="9" rx="2"/><rect x="14" y="3" width="7" height="5" rx="2"/><rect x="14" y="12" width="7" height="9" rx="2"/><rect x="3" y="16" width="7" height="5" rx="2"/></svg>',
    prices: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z"/><circle cx="7.5" cy="7.5" r="1.5"/></svg>',
    orders: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg>',
    admin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5L20 7"/></svg>',
  };

  // ---------- навигация ----------
  function tabs() {
    const t = [['home', 'Главная'], ['works', 'Работы'], ['prices', 'Цены'], ['orders', 'Заказы']];
    if (S.me?.isAdmin) t.push(['admin', 'Админ']);
    return t;
  }

  function renderNav() {
    const newCount = S.admin ? S.admin.orders.filter((o) => o.status === 'new').length : 0;
    $('#nav').innerHTML =
      '<svg width="0" height="0" style="position:absolute"><defs><linearGradient id="ng" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#a78bfa"/><stop offset=".6" stop-color="#f472b6"/><stop offset="1" stop-color="#fb923c"/></linearGradient></defs></svg>' +
      tabs().map(([id, label]) => `<button class="nav-btn ${S.tab === id ? 'on' : ''}" onclick="App.go('${id}')">${I[id]}<span>${label}</span>${id === 'admin' && newCount ? `<i class="dot">${newCount}</i>` : ''}</button>`).join('');
  }

  function go(tab, keepScroll) {
    if (S.tab !== tab) haptic('select');
    S.tab = tab;
    render();
    if (!keepScroll) window.scrollTo(0, 0);
  }

  function render() {
    const views = { home: vHome, works: vWorks, prices: vPrices, orders: vOrders, admin: vAdmin };
    $('#view').innerHTML = (views[S.tab] || vHome)();
    renderNav();
    updateBack();
    if (S.tab === 'works' || S.tab === 'home') bindImgFallback($('#view'));
  }

  function bindImgFallback(root) {
    root.querySelectorAll('img[data-fallback]').forEach((img) => {
      img.onerror = () => { img.replaceWith(Object.assign(document.createElement('div'), { className: 'ph', innerHTML: '<span>✦</span>', style: `--g:${gradFor(img.src)}` })); };
    });
  }

  // ---------- шторки ----------
  function openSheet(html, onClose) {
    const el = document.createElement('div');
    el.className = 'sheet-wrap';
    el.innerHTML = `<div class="sheet-bg"></div><div class="sheet"><div class="sheet-grip"></div><button class="sheet-x" aria-label="Закрыть">✕</button><div class="sheet-body">${html}</div></div>`;
    el.querySelector('.sheet-bg').onclick = back;
    el.querySelector('.sheet-x').onclick = back;
    el._onClose = onClose;
    $('#sheets').appendChild(el);
    requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('open')));
    S.stack.push(el);
    document.body.classList.add('locked');
    updateBack();
    haptic('light');
    return el;
  }

  function closeSheet() {
    const el = S.stack.pop();
    if (!el) return;
    el.classList.remove('open');
    setTimeout(() => el.remove(), 350);
    el._onClose && el._onClose();
    if (!S.stack.length) document.body.classList.remove('locked');
    updateBack();
  }
  const topSheet = () => S.stack[S.stack.length - 1];
  const setSheet = (html) => { const b = topSheet()?.querySelector('.sheet-body'); if (b) b.innerHTML = html; };

  function back() {
    if (S.stack.length) closeSheet();
    else if (S.tab !== 'home') go('home');
  }

  function updateBack() {
    if (!inTg) return;
    if (S.stack.length || S.tab !== 'home') tg.BackButton.show(); else tg.BackButton.hide();
  }

  // ---------- компоненты ----------
  function avatarHtml(s) {
    const initials = (s.name || '?').split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
    return `<div class="avatar">${s.avatar?.thumb ? `<img src="${imgSrc(s.avatar.thumb)}" alt="">` : `<div class="initials">${esc(initials)}</div>`}</div>`;
  }

  function tile(w, i = 0) {
    const c = w.images?.[0];
    const media = c
      ? `<img loading="lazy" data-fallback src="${imgSrc(c.thumb)}" alt="${esc(w.title)}">`
      : `<div class="ph" style="--g:${gradFor(w.id)};--ar:${arFor(w.id)}"><span>${esc((w.title || '?').replace(/[«»"]/g, '')[0])}</span></div>`;
    return `<button class="tile rise" style="--d:${Math.min(i, 10) * 45}ms" onclick="App.openWork('${w.id}')">
      ${media}
      ${w.images?.length > 1 ? `<i class="tile-badge">1/${w.images.length}</i>` : ''}
      ${S.me?.isAdmin && w.demo ? '<i class="tile-badge l">демо</i>' : ''}
      <div class="tile-cap"><b>${esc(w.title)}</b><span>${esc(catName(w.categoryId))}</span></div>
    </button>`;
  }

  function minPrice(catId) {
    const list = S.data.services.filter((s) => s.categoryId === catId);
    if (!list.length) return '';
    return 'от ' + money(Math.min(...list.map((s) => s.price)));
  }

  // ---------- ГЛАВНАЯ ----------
  function vHome() {
    const s = S.data.settings;
    const works = S.data.works;
    const featured = (works.some((w) => w.pinned) ? works.filter((w) => w.pinned) : works).slice(0, 4);
    const stats = [['years', 'лет опыта'], ['projects', 'проектов'], ['clients', 'клиентов']];
    const open = s.acceptingOrders !== false;
    return `
      <section class="hero">
        <div class="rise">${avatarHtml(s)}</div>
        <div class="status-pill rise ${open ? '' : 'off'}" style="--d:60ms"><i></i>${open ? 'Принимаю заказы' : 'Сейчас занят'}</div>
        <h1 class="display rise" style="--d:100ms">${esc(s.name)}</h1>
        <p class="role grad-text rise" style="--d:140ms">${esc(s.title)}</p>
        <p class="bio rise" style="--d:180ms">${esc(s.bio)}</p>
        <div class="stats rise" style="--d:220ms">${stats.map(([k, l]) => `<div class="stat"><b>${esc(s.stats?.[k] || '—')}</b><span>${l}</span></div>`).join('')}</div>
        <div class="hero-cta rise" style="--d:260ms">
          <button class="btn btn-primary" onclick="App.order()">Заказать дизайн</button>
          <button class="btn btn-ghost" onclick="App.go('works')">Портфолио</button>
        </div>
      </section>

      <section class="block">
        <div class="block-head"><h2>Направления</h2><button class="link" onclick="App.go('prices')">Цены →</button></div>
        <div class="hscroll">${cats().map((c) => {
          const n = works.filter((w) => w.categoryId === c.id).length;
          return `<button class="cat" style="--g:${gradFor(c.id + c.name)}" onclick="App.filterGo('${c.id}')">
            ${n ? `<span class="count">${n} ${plural(n, 'работа', 'работы', 'работ')}</span>` : ''}
            <b>${esc(c.name)}</b><small>${minPrice(c.id)}</small></button>`;
        }).join('')}</div>
      </section>

      ${featured.length ? `<section class="block">
        <div class="block-head"><h2>Избранные работы</h2><button class="link" onclick="App.go('works')">Все →</button></div>
        <div class="masonry">${featured.map(tile).join('')}</div>
      </section>` : ''}

      <section class="block">
        <div class="block-head"><h2>Как проходит работа</h2></div>
        <div class="steps">${[
          ['Заявка', 'Вы описываете задачу в приложении — это 2 минуты'],
          ['Обсуждение', 'Я пишу вам, уточняю детали, сроки и стоимость'],
          ['Дизайн и правки', 'Показываю концепции и дорабатываю до результата'],
          ['Готовые файлы', 'Вы получаете исходники во всех нужных форматах'],
        ].map(([t, d], i) => `<div class="step"><div class="step-n">${i + 1}</div><div><b>${t}</b><span>${d}</span></div></div>`).join('')}</div>
      </section>

      <section class="block">
        <div class="cta">
          <h3>Есть идея?</h3>
          <p>Расскажите о задаче — отвечу в течение дня и предложу решение.</p>
          <button class="btn btn-primary btn-block" onclick="App.order()">Оставить заявку</button>
          ${s.contact ? `<button class="btn btn-ghost btn-block" style="margin-top:8px" onclick="App.contact()">Написать @${esc(s.contact)}</button>` : ''}
        </div>
      </section>`;
  }

  function plural(n, one, few, many) {
    const m10 = n % 10, m100 = n % 100;
    if (m10 === 1 && m100 !== 11) return one;
    if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
    return many;
  }

  // ---------- ПОРТФОЛИО ----------
  function vWorks() {
    const all = S.data.works;
    const list = S.filter === 'all' ? all : all.filter((w) => w.categoryId === S.filter);
    const chips = [['all', 'Все', all.length], ...cats().map((c) => [c.id, c.name, all.filter((w) => w.categoryId === c.id).length])].filter(([id, , n]) => id === 'all' || n);
    return `
      <h1 class="page-title">Портфолио</h1>
      <p class="page-sub">${all.length} ${plural(all.length, 'работа', 'работы', 'работ')} · нажмите, чтобы посмотреть</p>
      <div class="chips">${chips.map(([id, name, n]) => `<button class="chip ${S.filter === id ? 'on' : ''}" onclick="App.setFilter('${id}')">${esc(name)}<sup>${n}</sup></button>`).join('')}</div>
      ${list.length ? `<div class="masonry">${list.map(tile).join('')}</div>` : emptyState('🖼', 'Работы скоро появятся', 'Пока здесь пусто, но можно уже заказать дизайн')}`;
  }

  function openWork(id) {
    const w = S.data.works.find((x) => x.id === id);
    if (!w) return;
    const imgs = w.images || [];
    const media = imgs.length
      ? imgs.map((i) => `<div><img src="${imgSrc(i.full)}" alt=""></div>`).join('')
      : `<div class="ph" style="--g:${gradFor(w.id)}"><span>${esc((w.title || '?').replace(/[«»"]/g, '')[0])}</span></div>`;
    const svc = S.data.services.find((s) => s.categoryId === w.categoryId);
    const el = openSheet(`
      <div class="gallery">${media}</div>
      ${imgs.length > 1 ? `<div class="dots">${imgs.map((_, i) => `<i class="${i ? '' : 'on'}"></i>`).join('')}</div>` : ''}
      <div class="work-meta">
        <span class="tag">${esc(catName(w.categoryId))}</span>
        <h3>${esc(w.title)}</h3>
        ${w.description ? `<p>${esc(w.description)}</p>` : ''}
      </div>
      <button class="btn btn-primary btn-block" onclick="App.closeAndOrder('${svc ? svc.id : ''}')">Хочу похожий дизайн</button>
      ${S.me?.isAdmin ? `<button class="btn btn-ghost btn-block" style="margin-top:8px" onclick="App.closeAndEditWork('${w.id}')">✏️ Редактировать</button>` : ''}`);
    const g = el.querySelector('.gallery');
    const dots = el.querySelectorAll('.dots i');
    if (dots.length) g.addEventListener('scroll', () => {
      const i = Math.round(g.scrollLeft / g.clientWidth);
      dots.forEach((d, k) => d.classList.toggle('on', k === i));
    }, { passive: true });
  }

  // ---------- ЦЕНЫ ----------
  function vPrices() {
    const svcs = S.data.services;
    const known = new Set(cats().map((c) => c.id));
    const groups = [...cats(), { id: '__other', name: 'Другое' }]
      .map((c) => ({ c, list: svcs.filter((s) => (c.id === '__other' ? !known.has(s.categoryId) : s.categoryId === c.id)) }))
      .filter((g) => g.list.length);
    return `
      <h1 class="page-title">Услуги и цены</h1>
      <p class="page-sub">Цены ориентировочные — точная стоимость зависит от объёма и сложности задачи.</p>
      ${groups.map(({ c, list }) => `
        <div class="group-title">${esc(c.name)}</div>
        ${list.map((s, i) => `
          <div class="svc rise" style="--d:${i * 50}ms">
            <div class="svc-top">
              <div><b>${esc(s.name)}</b>${s.duration ? `<span class="svc-dur">⏱ ${esc(s.duration)}</span>` : ''}</div>
              <div class="svc-price grad-text">${priceText(s)}</div>
            </div>
            ${s.description ? `<p>${esc(s.description)}</p>` : ''}
            ${s.features?.length ? `<ul class="checks">${s.features.map((f) => `<li>${esc(f)}</li>`).join('')}</ul>` : '<div style="height:14px"></div>'}
            <button class="btn btn-soft btn-block btn-sm" onclick="App.order('${s.id}')">Заказать</button>
          </div>`).join('')}`).join('')}
      <div class="block"><div class="cta"><h3>Нужно что-то другое?</h3><p>Опишите задачу — посчитаю стоимость индивидуально.</p><button class="btn btn-primary btn-block" onclick="App.order()">Обсудить проект</button></div></div>`;
  }

  // ---------- ЗАКАЗ ----------
  function order(serviceId) {
    if (!S.me) return toast('Откройте приложение через Telegram, чтобы оставить заявку', true);
    if (S.data.settings.acceptingOrders === false && !S.me.isAdmin) return toast('Сейчас я не принимаю новые заказы', true);
    const svcs = S.data.services;
    const sel = serviceId || '';
    const u = S.me.user;
    openSheet(`
      <div class="sheet-title">Новый заказ</div>
      <p class="sheet-sub">Заполните заявку — я свяжусь с вами в Telegram</p>
      <form id="orderForm" autocomplete="off">
        <div class="field"><span>Услуга</span><div class="picks">
          ${svcs.map((s) => `<label class="pick"><input type="radio" name="serviceId" value="${s.id}" ${s.id === sel ? 'checked' : ''}><span>${esc(s.name)}<em>${priceText(s)}</em></span></label>`).join('')}
          <label class="pick"><input type="radio" name="serviceId" value="" ${sel ? '' : 'checked'}><span>Другое / не знаю<em>обсудим</em></span></label>
        </div></div>
        <label class="field"><span>Опишите задачу <em>*</em></span><textarea class="input" name="description" required minlength="5" maxlength="2000" placeholder="Что нужно сделать, для кого, какое настроение, где будет использоваться…"></textarea></label>
        <div class="row2">
          <label class="field"><span>Бюджет</span><input class="input" name="budget" maxlength="100" placeholder="напр. 30 000 ${esc(cur())}"></label>
          <label class="field"><span>Сроки</span><input class="input" name="deadline" maxlength="100" placeholder="напр. до пятницы"></label>
        </div>
        <label class="field"><span>Референсы (ссылки)</span><input class="input" name="references" maxlength="1000" placeholder="Pinterest, Behance, примеры…"></label>
        <label class="field"><span>Как с вами связаться</span><input class="input" name="contact" maxlength="100" value="${u.username ? '@' + esc(u.username) : ''}" placeholder="@username или телефон"></label>
        <button class="btn btn-primary btn-block" type="submit">Отправить заявку</button>
        <p class="fine">Оплата обсуждается после согласования деталей. Файлы и референсы можно прислать в чате.</p>
      </form>`);
    $('#orderForm').onsubmit = submitOrder;
  }

  async function submitOrder(e) {
    e.preventDefault();
    const f = e.target;
    const btn = f.querySelector('button[type=submit]');
    const data = Object.fromEntries(new FormData(f));
    if ((data.description || '').trim().length < 5) return toast('Опишите задачу чуть подробнее', true);
    btn.disabled = true;
    btn.textContent = 'Отправляю…';
    try {
      const { order } = await api('POST', '/api/orders', data);
      S.me.orders.unshift(order);
      if (S.admin) S.admin.orders.unshift(order);
      haptic('success');
      setSheet(`
        <div class="success">
          <div class="success-icon">${I.check}</div>
          <h3>Заявка #${order.number} отправлена!</h3>
          <p>Я уже получил уведомление и свяжусь с вами в ближайшее время. Статус заказа — во вкладке «Заказы».</p>
          <button class="btn btn-primary btn-block" onclick="App.closeAndGo('orders')">Мои заказы</button>
        </div>`);
    } catch (err) {
      toast(err.message, true);
      btn.disabled = false;
      btn.textContent = 'Отправить заявку';
    }
  }

  // ---------- МОИ ЗАКАЗЫ ----------
  function vOrders() {
    if (!S.me) return emptyState('🔒', 'Откройте через Telegram', 'Заказы доступны только внутри Telegram-бота');
    const list = S.me.orders;
    if (!list.length) return `<h1 class="page-title">Мои заказы</h1>` + emptyState('✨', 'Заказов пока нет', 'Оставьте первую заявку — это займёт пару минут', 'Заказать дизайн', 'App.order()');
    return `
      <h1 class="page-title">Мои заказы</h1>
      <p class="page-sub">Уведомления о смене статуса придут в чат с ботом</p>
      ${list.map((o, i) => `
        <div class="card rise" style="--d:${i * 40}ms">
          <div class="card-top"><b>#${o.number} · ${esc(o.serviceName)}</b><span class="st st-${o.status}">${STATUS[o.status]}</span></div>
          <div class="muted">${fmtDate(o.createdAt)}</div>
          <div class="desc">${esc(o.description)}</div>
        </div>`).join('')}`;
  }

  function emptyState(icon, title, text, btn, action) {
    return `<div class="empty rise"><div class="empty-icon">${icon}</div><h3>${esc(title)}</h3><p>${esc(text)}</p>${btn ? `<button class="btn btn-primary" onclick="${action}">${esc(btn)}</button>` : ''}</div>`;
  }

  function contact() {
    const c = S.data.settings.contact;
    if (!c) return;
    const url = 'https://t.me/' + c;
    if (inTg) tg.openTelegramLink(url); else window.open(url, '_blank');
  }

  // =====================================================
  //                     АДМИН-ПАНЕЛЬ
  // =====================================================
  let adminLoading = false;
  async function loadAdmin(force) {
    if (adminLoading || (S.admin && !force)) return;
    adminLoading = true;
    try {
      S.admin = await api('GET', '/api/admin/data');
      if (S.tab === 'admin' && !S.stack.length) render(); else renderNav();
    } catch (e) { toast(e.message, true); }
    adminLoading = false;
  }

  async function refreshPublic() {
    S.data = await api('GET', '/api/public');
  }

  function vAdmin() {
    if (!S.me?.isAdmin) return emptyState('🔒', 'Нет доступа', 'Админ-панель доступна только владельцу');
    if (!S.admin) { loadAdmin(); return '<div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div>'; }
    const n = S.admin.orders.filter((o) => o.status === 'new').length;
    const seg = [['orders', 'Заявки', n], ['works', 'Работы'], ['services', 'Услуги'], ['profile', 'Профиль']];
    const body = { orders: aOrders, works: aWorks, services: aServices, profile: aProfile }[S.adminTab]();
    return `
      <div class="seg">${seg.map(([id, l, c]) => `<button class="${S.adminTab === id ? 'on' : ''}" onclick="App.adminTab('${id}')">${l}${c ? `<sup>${c}</sup>` : ''}</button>`).join('')}</div>
      ${!S.admin.botEnabled ? '<div class="notice">⚠️ Бот не подключён (нет BOT_TOKEN) — уведомления и загрузка в Telegram не работают.</div>' : ''}
      ${body}`;
  }

  // ----- заявки -----
  function aOrders() {
    const all = S.admin.orders;
    const c = (s) => all.filter((o) => o.status === s).length;
    const list = S.orderFilter === 'all' ? all : all.filter((o) => o.status === S.orderFilter);
    const filters = [['new', 'Новые'], ['in_progress', 'В работе'], ['done', 'Готово'], ['cancelled', 'Отменены'], ['all', 'Все']];
    return `
      <div class="kpis">
        <div class="kpi"><b style="color:var(--info)">${c('new')}</b><span>новые</span></div>
        <div class="kpi"><b style="color:var(--warn)">${c('in_progress')}</b><span>в работе</span></div>
        <div class="kpi"><b style="color:var(--ok)">${c('done')}</b><span>готово</span></div>
        <div class="kpi"><b>${S.admin.usersCount}</b><span>клиентов</span></div>
      </div>
      <div class="chips">${filters.map(([id, l]) => `<button class="chip ${S.orderFilter === id ? 'on' : ''}" onclick="App.orderFilter('${id}')">${l}<sup>${id === 'all' ? all.length : c(id)}</sup></button>`).join('')}</div>
      ${list.length ? list.map(orderCard).join('') : emptyState('📭', 'Пусто', 'Заявок с таким статусом нет')}`;
  }

  function orderCard(o) {
    const kv = [['Клиент', `${esc(o.name)}${o.username ? ` · @${esc(o.username)}` : ''}`], ['Бюджет', esc(o.budget)], ['Сроки', esc(o.deadline)], ['Контакт', esc(o.contact)], ['Референсы', linkify(o.references)]].filter(([, v]) => v);
    const next = { new: [['in_progress', '✅ В работу'], ['cancelled', '❌ Отклонить']], in_progress: [['done', '🏁 Готово'], ['cancelled', '❌ Отменить']], done: [['in_progress', '↩︎ Вернуть в работу']], cancelled: [['new', '↩︎ Восстановить']] }[o.status] || [];
    return `
      <div class="card">
        <div class="card-top"><b>#${o.number} · ${esc(o.serviceName)}</b><span class="st st-${o.status}">${STATUS[o.status]}</span></div>
        <div class="muted">${fmtDate(o.createdAt)}</div>
        <div class="desc">${esc(o.description)}</div>
        <dl class="kv">${kv.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl>
        ${o.adminNote ? `<div class="notice" style="margin:12px 0 0;color:var(--muted);background:var(--surface-2);border-color:var(--line)">📌 ${esc(o.adminNote)}</div>` : ''}
        <div class="actions">
          ${next.map(([st, l]) => `<button class="btn btn-sm ${st === 'cancelled' ? 'btn-danger' : 'btn-soft'}" onclick="App.setStatus('${o.id}','${st}')">${l}</button>`).join('')}
          ${o.username ? `<button class="btn btn-sm btn-ghost" onclick="App.openChat('${esc(o.username)}')">💬 Чат</button>` : ''}
          <button class="btn btn-sm btn-ghost" onclick="App.orderMore('${o.id}')">•••</button>
        </div>
      </div>`;
  }

  function linkify(s) {
    if (!s) return '';
    return esc(s).replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" style="color:#c4b5fd">$1</a>');
  }

  async function setStatus(id, status) {
    try {
      const { order } = await api('PATCH', `/api/admin/orders/${id}`, { status });
      const i = S.admin.orders.findIndex((o) => o.id === id);
      if (i >= 0) S.admin.orders[i] = order;
      haptic('success');
      toast(`Статус: ${STATUS[status]}`);
      render();
    } catch (e) { toast(e.message, true); }
  }

  function orderMore(id) {
    const o = S.admin.orders.find((x) => x.id === id);
    openSheet(`
      <div class="sheet-title">Заявка #${o.number}</div>
      <p class="sheet-sub">${esc(o.name)} · ${esc(o.serviceName)}</p>
      <label class="field"><span>Написать клиенту через бота</span><textarea class="input" id="msgText" placeholder="Например: Здравствуйте! Посмотрел вашу заявку, давайте обсудим детали…"></textarea></label>
      <button class="btn btn-primary btn-block" onclick="App.sendMsg('${o.id}')">Отправить сообщение</button>
      <div class="section-label">Заметка (видите только вы)</div>
      <label class="field"><textarea class="input" id="noteText" placeholder="Цена, договорённости, предоплата…">${esc(o.adminNote || '')}</textarea></label>
      <button class="btn btn-ghost btn-block" onclick="App.saveNote('${o.id}')">Сохранить заметку</button>
      <div class="section-label">Опасная зона</div>
      <button class="btn btn-danger btn-block" onclick="App.deleteOrder('${o.id}')">Удалить заявку</button>`);
  }

  async function sendMsg(id) {
    const text = $('#msgText').value.trim();
    if (!text) return toast('Напишите сообщение', true);
    try { await api('POST', `/api/admin/orders/${id}/message`, { text }); haptic('success'); toast('Сообщение отправлено'); $('#msgText').value = ''; }
    catch (e) { toast(e.message, true); }
  }

  async function saveNote(id) {
    try {
      const { order } = await api('PATCH', `/api/admin/orders/${id}`, { adminNote: $('#noteText').value });
      const i = S.admin.orders.findIndex((o) => o.id === id);
      if (i >= 0) S.admin.orders[i] = order;
      toast('Заметка сохранена'); closeSheet(); render();
    } catch (e) { toast(e.message, true); }
  }

  async function deleteOrder(id) {
    if (!(await confirmDlg('Удалить заявку безвозвратно?'))) return;
    try {
      await api('DELETE', `/api/admin/orders/${id}`);
      S.admin.orders = S.admin.orders.filter((o) => o.id !== id);
      closeSheet(); render(); toast('Заявка удалена');
    } catch (e) { toast(e.message, true); }
  }

  function confirmDlg(text) {
    return new Promise((res) => {
      if (inTg && tg.showConfirm) {
        try { tg.showConfirm(text, (ok) => res(!!ok)); return; } catch {}
      }
      res(window.confirm(text));
    });
  }

  function openChat(username) {
    const url = 'https://t.me/' + username;
    if (inTg) tg.openTelegramLink(url); else window.open(url, '_blank');
  }

  // ----- работы -----
  function aWorks() {
    const works = S.data.works;
    const demo = works.filter((w) => w.demo).length;
    return `
      <button class="add-btn" onclick="App.editWork()">＋ Добавить работу</button>
      ${demo ? `<div class="notice">В портфолио ${demo} демо-${plural(demo, 'работа', 'работы', 'работ')} без картинок. Отредактируйте или удалите их.</div>` : ''}
      <div class="masonry">${works.map((w, i) => tile(w, i).replace(`App.openWork('${w.id}')`, `App.editWork('${w.id}')`)).join('')}</div>`;
  }

  function editWork(id) {
    const w = id ? S.data.works.find((x) => x.id === id) : null;
    S.edit = { kind: 'work', id: w?.id || null, images: [...(w?.images || [])] };
    openSheet(`
      <div class="sheet-title">${w ? 'Редактировать работу' : 'Новая работа'}</div>
      <p class="sheet-sub">Первая картинка — обложка. Нажмите на картинку, чтобы сделать её обложкой.</p>
      <div class="imgs" id="imgs"></div>
      <label class="field"><span>Название <em>*</em></span><input class="input" id="wTitle" maxlength="120" value="${esc(w?.title || '')}" placeholder="Логотип для кофейни"></label>
      <label class="field"><span>Категория</span><select class="input" id="wCat">${cats().map((c) => `<option value="${c.id}" ${w?.categoryId === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></label>
      <label class="field"><span>Описание</span><textarea class="input" id="wDesc" maxlength="1500" placeholder="Задача, решение, результат…">${esc(w?.description || '')}</textarea></label>
      <label class="switch"><span>Закрепить на главной</span><input type="checkbox" id="wPin" ${w?.pinned ? 'checked' : ''}><i></i></label>
      <button class="btn btn-primary btn-block" id="wSave" onclick="App.saveWork()">Сохранить</button>
      ${w ? `<button class="btn btn-danger btn-block" style="margin-top:8px" onclick="App.deleteWork('${w.id}')">Удалить работу</button>` : ''}`, () => { S.edit = null; });
    renderImgs();
  }

  function renderImgs() {
    const box = $('#imgs');
    if (!box || !S.edit) return;
    const multi = S.edit.kind === 'work';
    box.innerHTML = S.edit.images.map((im, i) => im.loading
      ? '<div class="loading"></div>'
      : `<div onclick="App.makeCover(${i})"><img src="${imgSrc(im.thumb)}" alt="">${i === 0 && multi ? '<span class="cover">обложка</span>' : ''}<button class="x" onclick="event.stopPropagation();App.removeImg(${i})">✕</button></div>`).join('') +
      (multi || !S.edit.images.length ? `<label>＋<input type="file" accept="image/*" ${multi ? 'multiple' : ''} onchange="App.uploadImgs(this)"></label>` : '');
  }

  async function uploadImgs(input) {
    const files = [...input.files].slice(0, 12);
    input.value = '';
    for (const file of files) {
      if (file.size > 10 * 1024 * 1024) { toast(`${file.name}: больше 10 МБ`, true); continue; }
      const slot = { loading: true };
      S.edit.images.push(slot);
      renderImgs();
      try {
        const fd = new FormData();
        fd.append('file', await shrink(file));
        const { image } = await api('POST', '/api/admin/upload', fd, true);
        Object.assign(slot, image, { loading: false });
      } catch (e) {
        S.edit.images = S.edit.images.filter((x) => x !== slot);
        toast(e.message, true);
      }
      renderImgs();
    }
  }

  // уменьшаем огромные фото перед загрузкой (быстрее грузится)
  async function shrink(file) {
    if (!/image\/(jpeg|png|webp)/.test(file.type) || file.size < 1.5 * 1024 * 1024) return file;
    try {
      const bmp = await createImageBitmap(file);
      const max = 2560;
      const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
      const c = document.createElement('canvas');
      c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
      c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
      const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.92));
      return blob ? new File([blob], file.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' }) : file;
    } catch { return file; }
  }

  function makeCover(i) {
    if (!i || S.edit.kind !== 'work') return;
    const [im] = S.edit.images.splice(i, 1);
    S.edit.images.unshift(im);
    haptic('select'); renderImgs();
  }
  function removeImg(i) { S.edit.images.splice(i, 1); renderImgs(); }

  async function saveWork() {
    if (S.edit.images.some((x) => x.loading)) return toast('Дождитесь загрузки картинок', true);
    const body = {
      title: $('#wTitle').value, categoryId: $('#wCat').value, description: $('#wDesc').value,
      pinned: $('#wPin').checked, images: S.edit.images,
    };
    if (!body.title.trim()) return toast('Укажите название', true);
    const btn = $('#wSave'); btn.disabled = true;
    try {
      if (S.edit.id) await api('PATCH', `/api/admin/works/${S.edit.id}`, body);
      else await api('POST', '/api/admin/works', body);
      await refreshPublic();
      haptic('success'); toast('Сохранено'); closeSheet(); render();
    } catch (e) { toast(e.message, true); btn.disabled = false; }
  }

  async function deleteWork(id) {
    if (!(await confirmDlg('Удалить работу из портфолио?'))) return;
    try {
      await api('DELETE', `/api/admin/works/${id}`);
      await refreshPublic();
      closeSheet(); render(); toast('Работа удалена');
    } catch (e) { toast(e.message, true); }
  }

  // ----- услуги -----
  function aServices() {
    const list = S.admin.services;
    return `
      <button class="add-btn" onclick="App.editService()">＋ Добавить услугу</button>
      ${list.map((s) => `
        <button class="list-item ${s.active === false ? 'off-label' : ''}" onclick="App.editService('${s.id}')">
          <div class="grow"><b>${esc(s.name)}</b><small>${esc(catName(s.categoryId))}${s.active === false ? ' · скрыта' : ''}</small></div>
          <div class="price grad-text">${priceText(s)}</div>
        </button>`).join('')}`;
  }

  function editService(id) {
    const s = id ? S.admin.services.find((x) => x.id === id) : null;
    openSheet(`
      <div class="sheet-title">${s ? 'Редактировать услугу' : 'Новая услуга'}</div>
      <p class="sheet-sub">Так услуга будет выглядеть в разделе «Цены»</p>
      <label class="field"><span>Название <em>*</em></span><input class="input" id="sName" maxlength="100" value="${esc(s?.name || '')}" placeholder="Логотип"></label>
      <label class="field"><span>Категория</span><select class="input" id="sCat">${cats().map((c) => `<option value="${c.id}" ${s?.categoryId === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></label>
      <div class="row2">
        <label class="field"><span>Цена, ${esc(cur())}</span><input class="input" id="sPrice" type="number" inputmode="numeric" min="0" value="${s?.price ?? ''}" placeholder="25000"></label>
        <label class="field"><span>Срок</span><input class="input" id="sDur" maxlength="60" value="${esc(s?.duration || '')}" placeholder="3–5 дней"></label>
      </div>
      <label class="switch"><span>Показывать «от» перед ценой</span><input type="checkbox" id="sFrom" ${!s || s.priceFrom ? 'checked' : ''}><i></i></label>
      <label class="field"><span>Описание</span><textarea class="input" id="sDesc" maxlength="600" style="min-height:80px">${esc(s?.description || '')}</textarea></label>
      <label class="field"><span>Что входит (каждый пункт с новой строки)</span><textarea class="input" id="sFeat" placeholder="3 концепции\n2 правки\nИсходники">${esc((s?.features || []).join('\n'))}</textarea></label>
      <label class="switch"><span>Услуга активна (видна клиентам)</span><input type="checkbox" id="sActive" ${!s || s.active !== false ? 'checked' : ''}><i></i></label>
      <button class="btn btn-primary btn-block" id="sSave" onclick="App.saveService('${s?.id || ''}')">Сохранить</button>
      ${s ? `<div class="row2" style="margin-top:8px">
        <button class="btn btn-ghost" onclick="App.moveService('${s.id}',-1)">↑ Выше</button>
        <button class="btn btn-ghost" onclick="App.moveService('${s.id}',1)">↓ Ниже</button>
      </div>
      <button class="btn btn-danger btn-block" style="margin-top:8px" onclick="App.deleteService('${s.id}')">Удалить услугу</button>` : ''}`);
  }

  async function saveService(id) {
    const body = {
      name: $('#sName').value, categoryId: $('#sCat').value, price: $('#sPrice').value,
      duration: $('#sDur').value, priceFrom: $('#sFrom').checked, description: $('#sDesc').value,
      features: $('#sFeat').value, active: $('#sActive').checked,
    };
    if (!body.name.trim()) return toast('Укажите название', true);
    const btn = $('#sSave'); btn.disabled = true;
    try {
      if (id) await api('PATCH', `/api/admin/services/${id}`, body);
      else await api('POST', '/api/admin/services', body);
      await Promise.all([refreshPublic(), loadAdmin(true)]);
      haptic('success'); toast('Сохранено'); closeSheet(); render();
    } catch (e) { toast(e.message, true); btn.disabled = false; }
  }

  async function moveService(id, dir) {
    const list = S.admin.services;
    const i = list.findIndex((s) => s.id === id);
    const j = i + dir;
    if (j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    try {
      await Promise.all(list.map((s, k) => (s.sort !== k ? api('PATCH', `/api/admin/services/${s.id}`, { sort: k }) : null)));
      await Promise.all([refreshPublic(), loadAdmin(true)]);
      haptic('select'); toast(dir < 0 ? 'Перемещено выше' : 'Перемещено ниже');
      closeSheet(); render();
    } catch (e) { toast(e.message, true); }
  }

  async function deleteService(id) {
    if (!(await confirmDlg('Удалить услугу?'))) return;
    try {
      await api('DELETE', `/api/admin/services/${id}`);
      await Promise.all([refreshPublic(), loadAdmin(true)]);
      closeSheet(); render(); toast('Услуга удалена');
    } catch (e) { toast(e.message, true); }
  }

  // ----- профиль -----
  function aProfile() {
    const s = S.data.settings;
    if (!S.edit || S.edit.kind !== 'profile') {
      S.edit = { kind: 'profile', images: s.avatar ? [s.avatar] : [], cats: cats().map((c) => ({ ...c })) };
    }
    return `
      <div class="section-label" style="margin-top:4px">Аватар</div>
      <div class="imgs" id="imgs" style="grid-template-columns:repeat(4,1fr)"></div>

      <div class="section-label">О себе</div>
      <label class="field"><span>Имя / название студии</span><input class="input" id="pName" maxlength="60" value="${esc(s.name)}"></label>
      <label class="field"><span>Специализация</span><input class="input" id="pTitle" maxlength="80" value="${esc(s.title)}"></label>
      <label class="field"><span>Описание</span><textarea class="input" id="pBio" maxlength="600">${esc(s.bio)}</textarea></label>
      <label class="field"><span>Приветствие в боте (/start)</span><textarea class="input" id="pWelcome" maxlength="800" style="min-height:80px">${esc(s.welcome)}</textarea></label>
      <div class="row2">
        <label class="field"><span>Ваш username</span><input class="input" id="pContact" maxlength="40" value="${esc(s.contact)}" placeholder="username"></label>
        <label class="field"><span>Валюта</span><input class="input" id="pCur" maxlength="6" value="${esc(s.currency)}"></label>
      </div>
      <label class="switch"><span>Принимаю заказы</span><input type="checkbox" id="pOpen" ${s.acceptingOrders !== false ? 'checked' : ''}><i></i></label>

      <div class="section-label">Цифры на главной</div>
      <div class="row3">
        <label class="field"><span>Лет опыта</span><input class="input" id="stYears" maxlength="10" value="${esc(s.stats?.years)}"></label>
        <label class="field"><span>Проектов</span><input class="input" id="stProjects" maxlength="10" value="${esc(s.stats?.projects)}"></label>
        <label class="field"><span>Клиентов</span><input class="input" id="stClients" maxlength="10" value="${esc(s.stats?.clients)}"></label>
      </div>

      <div class="section-label">Категории</div>
      <div id="catList"></div>
      <button class="btn btn-ghost btn-block btn-sm" onclick="App.addCat()" style="margin-bottom:24px">＋ Категория</button>

      <button class="btn btn-primary btn-block" id="pSave" onclick="App.saveProfile()">Сохранить профиль</button>
      <p class="fine">Откройте бота и отправьте /admin, чтобы увидеть статистику в чате</p>`;
  }

  function afterProfileRender() {
    if (S.tab === 'admin' && S.adminTab === 'profile') { renderImgs(); renderCats(); }
  }

  function renderCats() {
    const box = $('#catList');
    if (!box) return;
    box.innerHTML = S.edit.cats.map((c, i) => `<div class="cat-row"><input class="input" value="${esc(c.name)}" maxlength="60" oninput="App.catName(${i}, this.value)"><button onclick="App.delCat(${i})">✕</button></div>`).join('');
  }
  function addCat() { S.edit.cats.push({ id: '', name: '' }); renderCats(); box_focus(); }
  function box_focus() { const ins = document.querySelectorAll('#catList input'); ins[ins.length - 1]?.focus(); }
  function delCat(i) { S.edit.cats.splice(i, 1); renderCats(); }
  function setCatName(i, v) { S.edit.cats[i].name = v; }

  async function saveProfile() {
    if (S.edit.images.some((x) => x.loading)) return toast('Дождитесь загрузки фото', true);
    const body = {
      name: $('#pName').value, title: $('#pTitle').value, bio: $('#pBio').value, welcome: $('#pWelcome').value,
      contact: $('#pContact').value, currency: $('#pCur').value, acceptingOrders: $('#pOpen').checked,
      avatar: S.edit.images[0] || null,
      stats: { years: $('#stYears').value, projects: $('#stProjects').value, clients: $('#stClients').value },
      categories: S.edit.cats.filter((c) => c.name.trim()),
    };
    const btn = $('#pSave'); btn.disabled = true;
    try {
      await api('PUT', '/api/admin/settings', body);
      await refreshPublic();
      S.edit = null;
      haptic('success'); toast('Профиль сохранён'); render();
    } catch (e) { toast(e.message, true); btn.disabled = false; }
  }

  // ---------- запуск ----------
  async function init() {
    if (tg) {
      try {
        tg.ready();
        tg.expand();
        tg.setHeaderColor?.('#09090d');
        tg.setBackgroundColor?.('#09090d');
        tg.setBottomBarColor?.('#09090d');
        tg.disableVerticalSwipes?.();
        tg.BackButton.onClick(back);
      } catch {}
    }
    try {
      const [pub, me] = await Promise.all([
        api('GET', '/api/public'),
        api('GET', '/api/me').catch(() => null),
      ]);
      S.data = pub;
      S.me = me;
    } catch (e) {
      $('#view').innerHTML = emptyState('⚠️', 'Не удалось загрузить', e.message, 'Повторить', 'location.reload()');
      $('#loader').classList.add('hide');
      return;
    }

    const q = new URLSearchParams(location.search);
    const startTab = q.get('tab') || (tg?.initDataUnsafe?.start_param || '');
    if (['works', 'prices', 'orders'].includes(startTab)) S.tab = startTab;
    if (startTab === 'admin' && S.me?.isAdmin) S.tab = 'admin';
    render();
    if (S.me?.isAdmin) loadAdmin();
    if (q.get('order') || startTab === 'order') setTimeout(() => order(), 300);
    setTimeout(() => $('#loader').classList.add('hide'), 150);
  }

  // хук для профиля после рендера
  const _render = render;
  render = function () { _render(); afterProfileRender(); };

  window.App = {
    go, order, contact, openWork, openChat,
    setFilter: (id) => { S.filter = id; haptic('select'); render(); },
    filterGo: (id) => { S.filter = id; go('works'); },
    closeAndOrder: (id) => { closeSheet(); setTimeout(() => order(id || undefined), 200); },
    closeAndGo: (tab) => { closeSheet(); go(tab); },
    closeAndEditWork: (id) => { closeSheet(); setTimeout(() => editWork(id), 200); },
    adminTab: (t) => { S.adminTab = t; if (t !== 'profile' && S.edit?.kind === 'profile') S.edit = null; haptic('select'); render(); window.scrollTo(0, 0); },
    orderFilter: (f) => { S.orderFilter = f; haptic('select'); render(); },
    setStatus, orderMore, sendMsg, saveNote, deleteOrder,
    editWork, saveWork, deleteWork, uploadImgs, makeCover, removeImg,
    editService, saveService, moveService, deleteService,
    saveProfile, addCat, delCat, catName: setCatName,
  };

  init();
})();
