// Стартовые данные. Всё это редактируется в админ-панели мини-приложения.

const DEFAULT_SETTINGS = {
  name: 'Rafael Dessign',
  title: 'Графический дизайнер',
  bio: 'Создаю логотипы и фирменный стиль, оформление соцсетей, презентации, афиши и обложки для музыки. Делаю дизайн, который запоминается.',
  welcome: 'Привет! 👋 Здесь можно посмотреть мои работы, узнать цены и оставить заявку на дизайн. Жми кнопку ниже 👇',
  avatar: null, // { thumb, full }
  contact: 'meowsteraf', // username в Telegram без @
  currency: '₸',
  acceptingOrders: true,
  stats: { years: '3+', projects: '150+', clients: '80+' },
  categories: [
    { id: 'logo', name: 'Логотипы и брендинг' },
    { id: 'smm', name: 'Дизайн для соцсетей' },
    { id: 'pres', name: 'Презентации' },
    { id: 'poster', name: 'Афиши' },
    { id: 'music', name: 'Обложки для музыки' },
  ],
};

const DEFAULT_SERVICES = [
  {
    categoryId: 'logo', name: 'Логотип', price: 25000, priceFrom: true, duration: '3–5 дней',
    description: 'Уникальный знак, который отражает характер бренда.',
    features: ['3 концепции на выбор', '3 раунда правок', 'Исходники AI / SVG / PNG', 'Мини-гайд по использованию'],
  },
  {
    categoryId: 'logo', name: 'Фирменный стиль', price: 80000, priceFrom: true, duration: '7–14 дней',
    description: 'Логотип + цвета, шрифты, паттерны и носители.',
    features: ['Логотип и его версии', 'Цветовая палитра и шрифты', 'Визитка, бланк, соцсети', 'Брендбук в PDF'],
  },
  {
    categoryId: 'smm', name: 'Оформление профиля', price: 15000, priceFrom: true, duration: '2–3 дня',
    description: 'Аватар, обложки highlights и шаблоны в едином стиле.',
    features: ['Аватар', 'Обложки для highlights', '3 шаблона постов', 'Исходники для правок'],
  },
  {
    categoryId: 'smm', name: 'Пост / сторис', price: 3000, priceFrom: true, duration: '1 день',
    description: 'Яркий дизайн отдельного поста, карусели или сторис.',
    features: ['Под ваш стиль или с нуля', '2 правки', 'Готово к публикации'],
  },
  {
    categoryId: 'pres', name: 'Презентация', price: 20000, priceFrom: true, duration: '3–5 дней',
    description: 'Презентация до 10 слайдов: питч, отчёт, коммерческое предложение.',
    features: ['Структура и визуал', 'Инфографика и иконки', 'PDF + исходник (Figma / PPTX)'],
  },
  {
    categoryId: 'poster', name: 'Афиша', price: 12000, priceFrom: true, duration: '2–3 дня',
    description: 'Афиша для концерта, вечеринки или мероприятия.',
    features: ['2 концепции', 'Версии для печати и сторис', '2 правки'],
  },
  {
    categoryId: 'music', name: 'Обложка трека', price: 10000, priceFrom: true, duration: '2–3 дня',
    description: 'Обложка для сингла под требования стриминговых площадок.',
    features: ['3000×3000 px', 'Версия для сторис', '2 правки'],
  },
  {
    categoryId: 'music', name: 'Обложка альбома', price: 20000, priceFrom: true, duration: '4–6 дней',
    description: 'Обложка альбома или EP + промо-материалы.',
    features: ['Основная обложка', 'Анимация / Canvas по запросу', 'Промо для соцсетей'],
  },
];

// Демо-работы без картинок — удали их и добавь свои в админке
const DEFAULT_WORKS = [
  { categoryId: 'logo', title: 'Логотип кофейни «Зерно»', description: 'Минималистичный знак и типографика для городской кофейни.', pinned: true },
  { categoryId: 'music', title: 'Обложка сингла «Полночь»', description: 'Ночная атмосфера, неоновый свет и зерно плёнки.', pinned: true },
  { categoryId: 'poster', title: 'Афиша NEON NIGHT', description: 'Афиша вечеринки с кислотной типографикой.', pinned: true },
  { categoryId: 'smm', title: 'Instagram студии йоги', description: 'Аватар, highlights и шаблоны постов в мягкой палитре.', pinned: true },
  { categoryId: 'pres', title: 'Питч-дек стартапа', description: '12 слайдов для инвесторов: структура, графики, визуал.' },
  { categoryId: 'logo', title: 'Айдентика барбершопа', description: 'Логотип, вывеска, визитки и униформа.' },
  { categoryId: 'music', title: 'Обложка альбома «Город»', description: 'Коллаж из архитектуры и рукописных букв.' },
  { categoryId: 'smm', title: 'Сторис для бренда одежды', description: 'Набор из 10 анимированных сторис к запуску коллекции.' },
];

module.exports = { DEFAULT_SETTINGS, DEFAULT_SERVICES, DEFAULT_WORKS };
