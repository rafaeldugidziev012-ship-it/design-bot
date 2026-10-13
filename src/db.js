const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { DEFAULT_SETTINGS, DEFAULT_SERVICES, DEFAULT_WORKS } = require('./defaults');

const newId = () => crypto.randomBytes(6).toString('hex');
const COLLECTIONS = ['services', 'works', 'orders', 'users'];

/** Локальное хранилище в JSON-файле (для разработки / VPS с диском). */
class JsonStore {
  constructor(file) {
    this.file = file;
    this.d = { settings: null, seq: {}, services: [], works: [], orders: [], users: [] };
    if (fs.existsSync(file)) Object.assign(this.d, JSON.parse(fs.readFileSync(file, 'utf8')));
  }
  _save() {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      fs.mkdirSync(path.dirname(this.file), { recursive: true });
      const tmp = this.file + '.tmp';
      fs.writeFileSync(tmp, JSON.stringify(this.d, null, 1));
      fs.renameSync(tmp, this.file);
    }, 80);
  }
  async all(c) { return this.d[c].map((x) => ({ ...x })); }
  async get(c, id) { const x = this.d[c].find((x) => x.id === id); return x ? { ...x } : null; }
  async insert(c, doc) { this.d[c].push({ ...doc }); this._save(); return doc; }
  async update(c, id, patch) {
    const x = this.d[c].find((x) => x.id === id);
    if (!x) return null;
    Object.assign(x, patch); this._save(); return { ...x };
  }
  async upsert(c, id, patch) {
    const x = this.d[c].find((x) => x.id === id);
    if (x) Object.assign(x, patch); else this.d[c].push({ id, ...patch });
    this._save();
  }
  async remove(c, id) {
    const n = this.d[c].length;
    this.d[c] = this.d[c].filter((x) => x.id !== id);
    this._save();
    return n !== this.d[c].length;
  }
  async getSettings() { return this.d.settings; }
  async setSettings(s) { this.d.settings = s; this._save(); return s; }
  async nextSeq(name) { this.d.seq[name] = (this.d.seq[name] || 0) + 1; this._save(); return this.d.seq[name]; }
}

/** Чинит строку подключения: экранирует спецсимволы в логине/пароле, убирает пробелы и <> */
function fixMongoUri(raw) {
  // в строке подключения не бывает пробелов и переносов — убираем их
  let uri = String(raw).replace(/\s+/g, '').replace(/^["']|["']$/g, '');
  const m = uri.match(/^(mongodb(?:\+srv)?:\/\/)([\s\S]*)@([^@]+)$/);
  // безопасная диагностика (без пароля)
  const host = m ? m[3].split(/[/?]/)[0] : '?';
  console.log(`🔎 MONGODB_URI: схема=${/^mongodb(\+srv)?:\/\//.test(uri)} @=${(uri.match(/@/g) || []).length} хост=${host} длина=${uri.length}`);
  if (!m) return uri;
  const cred = m[2];
  const i = cred.indexOf(':');
  if (i < 0) return uri;
  const enc = (s) => {
    s = s.replace(/^<(.*)>$/, '$1');
    try { return encodeURIComponent(decodeURIComponent(s)); } catch { return encodeURIComponent(s); }
  };
  return m[1] + enc(cred.slice(0, i)) + ':' + enc(cred.slice(i + 1)) + '@' + m[3];
}

/** MongoDB (бесплатный кластер MongoDB Atlas) — для облачного хостинга. */
class MongoStore {
  async connect(uri) {
    const { MongoClient } = require('mongodb');
    this.client = new MongoClient(fixMongoUri(uri));
    await this.client.connect();
    this.db = this.client.db(process.env.MONGODB_DB || 'design_studio');
    for (const c of COLLECTIONS) await this.db.collection(c).createIndex({ id: 1 }, { unique: true });
  }
  col(c) { return this.db.collection(c); }
  async all(c) { return this.col(c).find({}, { projection: { _id: 0 } }).toArray(); }
  async get(c, id) { return this.col(c).findOne({ id }, { projection: { _id: 0 } }); }
  async insert(c, doc) { await this.col(c).insertOne({ ...doc }); return doc; }
  async update(c, id, patch) {
    return this.col(c).findOneAndUpdate({ id }, { $set: patch }, { returnDocument: 'after', projection: { _id: 0 } });
  }
  async upsert(c, id, patch) { await this.col(c).updateOne({ id }, { $set: patch }, { upsert: true }); }
  async remove(c, id) { const r = await this.col(c).deleteOne({ id }); return r.deletedCount > 0; }
  async getSettings() { const d = await this.col('meta').findOne({ _id: 'settings' }); return d ? d.value : null; }
  async setSettings(s) { await this.col('meta').updateOne({ _id: 'settings' }, { $set: { value: s } }, { upsert: true }); return s; }
  async nextSeq(name) {
    const r = await this.col('meta').findOneAndUpdate(
      { _id: 'seq_' + name }, { $inc: { v: 1 } }, { upsert: true, returnDocument: 'after' }
    );
    return r.v;
  }
}

async function init() {
  let store;
  if (process.env.MONGODB_URI) {
    store = new MongoStore();
    await store.connect(process.env.MONGODB_URI);
    console.log('📦 База: MongoDB');
  } else {
    store = new JsonStore(path.join(__dirname, '..', 'data', 'db.json'));
    console.log('📦 База: локальный файл data/db.json');
    if (process.env.RENDER || process.env.RAILWAY_ENVIRONMENT) {
      console.warn('⚠️  На облачном хостинге без MONGODB_URI данные пропадут при перезапуске!');
    }
  }

  // Первый запуск — заполняем стартовыми данными
  if (!(await store.getSettings())) {
    await store.setSettings(DEFAULT_SETTINGS);
    const now = Date.now();
    for (const [i, s] of DEFAULT_SERVICES.entries()) {
      await store.insert('services', { id: newId(), active: true, sort: i, createdAt: now, ...s });
    }
    for (const [i, w] of DEFAULT_WORKS.entries()) {
      await store.insert('works', { id: newId(), images: [], pinned: false, demo: true, createdAt: now - i * 1000, ...w });
    }
    console.log('✨ Добавлены стартовые данные');
  }

  // Подмешиваем дефолтные поля, если в настройках их ещё нет (после обновлений)
  const rawGet = store.getSettings.bind(store);
  store.getSettings = async () => {
    const s = (await rawGet()) || {};
    return { ...DEFAULT_SETTINGS, ...s, stats: { ...DEFAULT_SETTINGS.stats, ...(s.stats || {}) } };
  };
  store.newId = newId;
  return store;
}

module.exports = { init, newId };
