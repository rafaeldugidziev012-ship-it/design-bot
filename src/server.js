require('dotenv').config();
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const multer = require('multer');
const { webhookCallback, InputFile } = require('grammy');
const store = require('./db');
const { validateInitData } = require('./auth');
const { createBot, STATUS } = require('./bot');

const PORT = Number(process.env.PORT) || 3000;
// если в поле случайно оказалось несколько токенов подряд — берём последний
const TOKEN = ((process.env.BOT_TOKEN || '').match(/\d{6,12}:[A-Za-z0-9_-]{35}/g) || ['']).pop();
const ADMIN_IDS = (process.env.ADMIN_IDS || '').split(',').map((s) => Number(s.trim())).filter(Boolean);
const PUBLIC_URL = (process.env.PUBLIC_URL || process.env.RENDER_EXTERNAL_URL || '').trim().replace(/\/$/, '');
const DEV = process.env.DEV_MODE === 'true';
const STORAGE_CHAT = process.env.STORAGE_CHAT_ID || ADMIN_IDS[0];
const UPLOAD_DIR = path.join(__dirname, '..', 'data', 'uploads');

// ---------- helpers ----------
const fail = (msg, status = 400) => Object.assign(new Error(msg), { status, expose: true });
const wrap = (fn) => (req, res) =>
  Promise.resolve(fn(req, res)).catch((e) => {
    if (!e.expose) console.error(e);
    res.status(e.status || 500).json({ error: e.expose ? e.message : 'Ошибка сервера' });
  });
const str = (v, max = 200) => String(v ?? '').trim().slice(0, max);
const bool = (v) => v === true || v === 'true' || v === 'on' || v === 1;
const bySort = (a, b) => (a.sort ?? 0) - (b.sort ?? 0) || (a.createdAt ?? 0) - (b.createdAt ?? 0);
const byWork = (a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || (b.createdAt ?? 0) - (a.createdAt ?? 0);

function cleanImage(i) {
  if (!i || typeof i !== 'object') return null;
  const thumb = str(i.thumb, 400);
  const full = str(i.full, 400) || thumb;
  return thumb ? { thumb, full } : null;
}
const cleanImages = (arr) => (Array.isArray(arr) ? arr.map(cleanImage).filter(Boolean).slice(0, 12) : []);

function cleanWork(b, partial) {
  const w = {};
  if (!partial || 'title' in b) { w.title = str(b.title, 120); if (!w.title) throw fail('Укажите название работы'); }
  if (!partial || 'categoryId' in b) w.categoryId = str(b.categoryId, 40);
  if (!partial || 'description' in b) w.description = str(b.description, 1500);
  if (!partial || 'images' in b) w.images = cleanImages(b.images);
  if (!partial || 'pinned' in b) w.pinned = bool(b.pinned);
  if ('client' in b) w.client = str(b.client, 120);
  if (!partial || 'titleEn' in b) w.titleEn = str(b.titleEn, 120);
  if (!partial || 'descriptionEn' in b) w.descriptionEn = str(b.descriptionEn, 1500);
  return w;
}

function cleanService(b, partial) {
  const s = {};
  if (!partial || 'name' in b) { s.name = str(b.name, 100); if (!s.name) throw fail('Укажите название услуги'); }
  if (!partial || 'categoryId' in b) s.categoryId = str(b.categoryId, 40);
  if (!partial || 'description' in b) s.description = str(b.description, 600);
  if (!partial || 'price' in b) s.price = Math.max(0, Math.round(Number(b.price) || 0));
  if (!partial || 'priceFrom' in b) s.priceFrom = bool(b.priceFrom);
  if (!partial || 'duration' in b) s.duration = str(b.duration, 60);
  if (!partial || 'features' in b) {
    const f = Array.isArray(b.features) ? b.features : String(b.features || '').split('\n');
    s.features = f.map((x) => str(x, 120)).filter(Boolean).slice(0, 12);
  }
  if (!partial || 'active' in b) s.active = 'active' in b ? bool(b.active) : true;
  if ('sort' in b) s.sort = Number(b.sort) || 0;
  if (!partial || 'nameEn' in b) s.nameEn = str(b.nameEn, 100);
  if (!partial || 'descriptionEn' in b) s.descriptionEn = str(b.descriptionEn, 600);
  if (!partial || 'durationEn' in b) s.durationEn = str(b.durationEn, 60);
  if (!partial || 'featuresEn' in b) {
    const f = Array.isArray(b.featuresEn) ? b.featuresEn : String(b.featuresEn || '').split('\n');
    s.featuresEn = f.map((x) => str(x, 120)).filter(Boolean).slice(0, 12);
  }
  return s;
}

async function main() {
  const db = await store.init();
  const tg = TOKEN ? createBot({ token: TOKEN, adminIds: ADMIN_IDS, publicUrl: PUBLIC_URL, db }) : null;
  if (!tg) console.warn('⚠️  BOT_TOKEN не задан или неверный формат — бот выключен');
  else console.log(`🔎 BOT_TOKEN: id бота=${TOKEN.split(':')[0]}, найдено токенов=${((process.env.BOT_TOKEN || '').match(/\d{6,12}:[A-Za-z0-9_-]{35}/g) || []).length}`);
  if (!ADMIN_IDS.length) console.warn('⚠️  ADMIN_IDS не задан — админ-панель никому не доступна');

  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(express.json({ limit: '1mb' }));

  app.get('/health', (req, res) => res.send('ok'));

  // ---------- авторизация через Telegram ----------
  function auth(req, res, next) {
    const initData = req.get('X-Init-Data') || '';
    let user = initData && TOKEN ? validateInitData(initData, TOKEN) : null;
    if (!user && DEV) user = { id: ADMIN_IDS[0] || 1, first_name: 'Dev', username: 'dev_user' };
    if (!user) return res.status(401).json({ error: 'Откройте приложение через Telegram' });
    req.user = user;
    req.isAdmin = ADMIN_IDS.includes(user.id);
    next();
  }
  const adminOnly = (req, res, next) => (req.isAdmin ? next() : res.status(403).json({ error: 'Нет доступа' }));

  // ---------- публичное API ----------
  app.get('/api/public', wrap(async (req, res) => {
    const [settings, services, works] = await Promise.all([db.getSettings(), db.all('services'), db.all('works')]);
    res.json({
      settings,
      services: services.filter((s) => s.active !== false).sort(bySort),
      works: works.sort(byWork),
    });
  }));

  // курсы валют: 1 ₸ = X ₽ / $ (обновляются раз в 12 часов, есть запасные значения)
  let ratesCache = { rates: { KZT: 1, RUB: 0.18, USD: 0.002 }, updated: 0, source: 'fallback' };
  app.get('/api/rates', wrap(async (req, res) => {
    if (Date.now() - ratesCache.updated > 12 * 3600e3) {
      try {
        const r = await fetch('https://open.er-api.com/v6/latest/KZT', { signal: AbortSignal.timeout(5000) });
        const d = await r.json();
        if (d && d.rates && d.rates.USD && d.rates.RUB) {
          ratesCache = { rates: { KZT: 1, RUB: d.rates.RUB, USD: d.rates.USD }, updated: Date.now(), source: 'open.er-api.com' };
        } else ratesCache.updated = Date.now() - 11 * 3600e3;
      } catch (e) {
        console.warn('Курсы валют не загрузились:', e.message);
        ratesCache.updated = Date.now() - 11 * 3600e3; // повторить через час
      }
    }
    res.set('Cache-Control', 'public, max-age=3600');
    res.json(ratesCache);
  }));

  app.get('/api/me', auth, wrap(async (req, res) => {
    const u = req.user;
    db.upsert('users', u.id, { username: u.username || null, name: [u.first_name, u.last_name].filter(Boolean).join(' '), lastSeen: Date.now() }).catch(() => {});
    const orders = (await db.all('orders'))
      .filter((o) => o.userId === u.id)
      .sort((a, b) => b.createdAt - a.createdAt)
      .map(({ adminMessages, adminNote, ...o }) => o);
    res.json({ user: { id: u.id, first_name: u.first_name, username: u.username || null }, isAdmin: req.isAdmin, orders });
  }));

  app.post('/api/orders', auth, wrap(async (req, res) => {
    const b = req.body || {};
    const settings = await db.getSettings();
    if (settings.acceptingOrders === false && !req.isAdmin) throw fail('Сейчас я не принимаю новые заказы');
    const description = str(b.description, 2000);
    if (description.length < 5) throw fail('Опишите задачу чуть подробнее');

    const all = await db.all('orders');
    const recent = all.filter((o) => o.userId === req.user.id && Date.now() - o.createdAt < 24 * 3600e3);
    if (recent.length >= 5) throw fail('Слишком много заявок за сутки — напишите мне напрямую', 429);

    const svc = b.serviceId ? await db.get('services', str(b.serviceId, 40)) : null;
    const u = req.user;
    const order = {
      id: db.newId(),
      number: await db.nextSeq('order'),
      userId: u.id,
      username: u.username || null,
      name: [u.first_name, u.last_name].filter(Boolean).join(' '),
      serviceId: svc?.id || null,
      serviceName: svc?.name || 'Другое / индивидуально',
      description,
      budget: str(b.budget, 100),
      deadline: str(b.deadline, 100),
      contact: str(b.contact, 100),
      references: str(b.references, 1000),
      lang: b.lang === 'en' ? 'en' : 'ru',
      currency: ['KZT', 'RUB', 'USD'].includes(b.currency) ? b.currency : 'KZT',
      status: 'new',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    await db.insert('orders', order);
    if (tg) tg.notifyNewOrder(order).catch((e) => console.error(e));
    res.json({ order });
  }));

  // ---------- админ API ----------
  const admin = express.Router();
  admin.use(auth, adminOnly);

  admin.get('/data', wrap(async (req, res) => {
    const [services, orders, users] = await Promise.all([db.all('services'), db.all('orders'), db.all('users')]);
    res.json({
      services: services.sort(bySort),
      orders: orders.sort((a, b) => b.createdAt - a.createdAt).map(({ adminMessages, ...o }) => o),
      usersCount: users.length,
      botEnabled: !!tg,
    });
  }));

  admin.patch('/orders/:id', wrap(async (req, res) => {
    const patch = { updatedAt: Date.now() };
    if ('status' in req.body) {
      if (!STATUS[req.body.status]) throw fail('Неверный статус');
      patch.status = req.body.status;
    }
    if ('adminNote' in req.body) patch.adminNote = str(req.body.adminNote, 1000);
    const before = await db.get('orders', req.params.id);
    if (!before) throw fail('Заявка не найдена', 404);
    const order = await db.update('orders', req.params.id, patch);
    if (tg && patch.status && patch.status !== before.status) {
      tg.syncAdminMessages(order).catch(() => {});
      tg.notifyClient(order).catch(() => {});
    }
    const { adminMessages, ...out } = order;
    res.json({ order: out });
  }));

  admin.post('/orders/:id/message', wrap(async (req, res) => {
    const text = str(req.body.text, 3000);
    if (!text) throw fail('Пустое сообщение');
    if (!tg) throw fail('Бот не подключён');
    const order = await db.get('orders', req.params.id);
    if (!order) throw fail('Заявка не найдена', 404);
    try { await tg.messageClient(order, text); } catch { throw fail('Не удалось отправить: клиент заблокировал бота или не запускал его'); }
    res.json({ ok: true });
  }));

  admin.delete('/orders/:id', wrap(async (req, res) => {
    await db.remove('orders', req.params.id);
    res.json({ ok: true });
  }));

  admin.post('/works', wrap(async (req, res) => {
    const w = { id: db.newId(), createdAt: Date.now(), ...cleanWork(req.body || {}, false) };
    await db.insert('works', w);
    res.json({ work: w });
  }));
  admin.patch('/works/:id', wrap(async (req, res) => {
    const w = await db.update('works', req.params.id, { ...cleanWork(req.body || {}, true), demo: false });
    if (!w) throw fail('Работа не найдена', 404);
    res.json({ work: w });
  }));
  admin.delete('/works/:id', wrap(async (req, res) => {
    await db.remove('works', req.params.id);
    res.json({ ok: true });
  }));

  admin.post('/services', wrap(async (req, res) => {
    const count = (await db.all('services')).length;
    const s = { id: db.newId(), createdAt: Date.now(), sort: count, ...cleanService(req.body || {}, false) };
    await db.insert('services', s);
    res.json({ service: s });
  }));
  admin.patch('/services/:id', wrap(async (req, res) => {
    const s = await db.update('services', req.params.id, cleanService(req.body || {}, true));
    if (!s) throw fail('Услуга не найдена', 404);
    res.json({ service: s });
  }));
  admin.delete('/services/:id', wrap(async (req, res) => {
    await db.remove('services', req.params.id);
    res.json({ ok: true });
  }));

  admin.put('/settings', wrap(async (req, res) => {
    const b = req.body || {};
    const cur = await db.getSettings();
    const next = { ...cur };
    for (const [k, max] of [['name', 60], ['title', 80], ['bio', 600], ['welcome', 800], ['currency', 6], ['titleEn', 80], ['bioEn', 600]]) {
      if (k in b) next[k] = str(b[k], max);
    }
    if ('contact' in b) next.contact = str(b.contact, 40).replace(/^@/, '').replace(/^https?:\/\/t\.me\//, '');
    if ('acceptingOrders' in b) next.acceptingOrders = bool(b.acceptingOrders);
    if ('avatar' in b) next.avatar = cleanImage(b.avatar);
    if (b.stats && typeof b.stats === 'object') {
      next.stats = { years: str(b.stats.years, 10), projects: str(b.stats.projects, 10), clients: str(b.stats.clients, 10) };
    }
    if (Array.isArray(b.categories)) {
      next.categories = b.categories
        .map((c) => ({ id: str(c.id, 40) || db.newId(), name: str(c.name, 60), nameEn: str(c.nameEn, 60) }))
        .filter((c) => c.name)
        .slice(0, 20);
    }
    if (!next.currency) next.currency = '₸';
    await db.setSettings(next);
    res.json({ settings: await db.getSettings() });
  }));

  // загрузка картинок: храним в Telegram (бесплатно и навсегда), без бота — на диск
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (req, file, cb) => cb(null, /^image\//.test(file.mimetype)),
  });
  admin.post('/upload', upload.single('file'), wrap(async (req, res) => {
    if (!req.file) throw fail('Нужна картинка (JPG, PNG, WEBP) до 10 МБ');
    if (tg && STORAGE_CHAT) {
      const name = req.file.originalname || 'image.jpg';
      try {
        const m = await tg.bot.api.sendPhoto(STORAGE_CHAT, new InputFile(req.file.buffer, name), { disable_notification: true, caption: '🖼 файл портфолио — не удаляйте' });
        const sizes = m.photo;
        const full = sizes[sizes.length - 1].file_id;
        const mid = sizes.filter((p) => p.width >= 600).sort((a, b) => a.width - b.width)[0] || sizes[sizes.length - 1];
        return res.json({ image: { thumb: mid.file_id, full } });
      } catch (e) {
        try {
          const m = await tg.bot.api.sendDocument(STORAGE_CHAT, new InputFile(req.file.buffer, name), { disable_notification: true });
          return res.json({ image: { thumb: m.document.file_id, full: m.document.file_id } });
        } catch (e2) {
          console.error('Upload error:', e2.description || e2.message);
          throw fail('Не удалось загрузить: убедитесь, что вы нажали /start в боте');
        }
      }
    }
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    const ext = (path.extname(req.file.originalname || '') || '.jpg').toLowerCase().replace(/[^.a-z0-9]/g, '');
    const file = crypto.randomBytes(8).toString('hex') + ext;
    fs.writeFileSync(path.join(UPLOAD_DIR, file), req.file.buffer);
    res.json({ image: { thumb: '/uploads/' + file, full: '/uploads/' + file } });
  }));

  app.use('/api/admin', admin);
  app.use('/uploads', express.static(UPLOAD_DIR, { maxAge: '30d' }));

  // ---------- прокси картинок из Telegram ----------
  const pathCache = new Map();
  const bufCache = new Map();
  let bufBytes = 0;
  const MAX_BUF = 80 * 1024 * 1024;
  const MIME = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif' };

  app.get('/img/:fileId', async (req, res) => {
    const id = req.params.fileId;
    if (!tg || !/^[\w-]{10,250}$/.test(id)) return res.status(404).end();
    try {
      let hit = bufCache.get(id);
      if (!hit) {
        let p = pathCache.get(id);
        if (!p || p.exp < Date.now()) {
          const f = await tg.bot.api.getFile(id);
          p = { path: f.file_path, exp: Date.now() + 50 * 60e3 };
          pathCache.set(id, p);
        }
        const r = await fetch(`https://api.telegram.org/file/bot${TOKEN}/${p.path}`);
        if (!r.ok) { pathCache.delete(id); throw new Error('tg ' + r.status); }
        const buf = Buffer.from(await r.arrayBuffer());
        const ext = (p.path.split('.').pop() || '').toLowerCase();
        hit = { buf, type: MIME[ext] || r.headers.get('content-type') || 'image/jpeg' };
        bufCache.set(id, hit);
        bufBytes += buf.length;
        while (bufBytes > MAX_BUF && bufCache.size) {
          const [k, v] = bufCache.entries().next().value;
          bufCache.delete(k); bufBytes -= v.buf.length;
        }
      }
      res.set('Content-Type', hit.type);
      res.set('Cache-Control', 'public, max-age=31536000, immutable');
      res.send(hit.buf);
    } catch (e) {
      res.status(404).end();
    }
  });

  // ---------- мини-приложение ----------
  app.use(express.static(path.join(__dirname, '..', 'public'), { maxAge: DEV ? 0 : '10m' }));

  // ---------- вебхук бота ----------
  let hookPath = null;
  if (tg && PUBLIC_URL && !DEV) {
    const secret = crypto.createHash('sha256').update(TOKEN).digest('hex').slice(0, 32);
    hookPath = '/tg/' + secret;
    app.post(hookPath, webhookCallback(tg.bot, 'express', { secretToken: secret }));
    tg.hookSecret = secret;
  }

  app.listen(PORT, async () => {
    console.log(`🚀 Сервер: http://localhost:${PORT}`);
    if (!tg) return;
    try {
      await tg.bot.init();
      console.log(`🤖 Бот: @${tg.bot.botInfo.username}`);
      if (hookPath) {
        await tg.bot.api.setWebhook(PUBLIC_URL + hookPath, { secret_token: tg.hookSecret, allowed_updates: ['message', 'callback_query'], drop_pending_updates: false });
        console.log('🔗 Вебхук:', PUBLIC_URL + '/tg/***');
      } else {
        await tg.bot.api.deleteWebhook();
        tg.bot.start({ allowed_updates: ['message', 'callback_query'] });
        console.log('🔄 Бот работает в режиме polling');
      }
      await tg.setup();
      if (!PUBLIC_URL) console.warn('⚠️  PUBLIC_URL не задан — кнопка мини-приложения в боте не появится');
    } catch (e) {
      console.error('❌ Не удалось запустить бота:', e.description || e.message);
    }
  });
}

main().catch((e) => {
  console.error('❌', e);
  process.exit(1);
});
