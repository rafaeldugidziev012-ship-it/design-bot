// Стартовые данные. Всё это редактируется в админ-панели мини-приложения.

const DEFAULT_SETTINGS = {
  name: 'Rafael Dessign',
  title: 'Графический дизайнер',
  titleEn: 'Graphic designer',
  bio: 'Создаю логотипы и фирменный стиль, оформление соцсетей, презентации, афиши и обложки для музыки. Делаю дизайн, который запоминается.',
  bioEn: 'I create logos and brand identities, social media design, presentations, posters and music covers. Design that people remember.',
  welcome: 'Привет! 👋 Здесь можно посмотреть мои работы, узнать цены и оставить заявку на дизайн. Жми кнопку ниже 👇',
  avatar: null, // { thumb, full }
  contact: 'meowsteraf', // username в Telegram без @
  currency: '₸',
  acceptingOrders: true,
  stats: { years: '3+', projects: '150+', clients: '80+' },
  categories: [
    { id: 'logo', name: 'Логотипы и брендинг', nameEn: 'Logos & branding' },
    { id: 'smm', name: 'Дизайн для соцсетей', nameEn: 'Social media design' },
    { id: 'pres', name: 'Презентации', nameEn: 'Presentations' },
    { id: 'poster', name: 'Афиши', nameEn: 'Posters' },
    { id: 'music', name: 'Обложки для музыки', nameEn: 'Music covers' },
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

// Английские версии стартовых услуг и работ (по русскому названию)
const EN_SERVICES = {
  'Логотип': { nameEn: 'Logo', durationEn: '3–5 days', descriptionEn: 'A unique mark that reflects your brand’s character.', featuresEn: ['3 concepts to choose from', '3 rounds of revisions', 'Source files AI / SVG / PNG', 'Mini usage guide'] },
  'Фирменный стиль': { nameEn: 'Brand identity', durationEn: '7–14 days', descriptionEn: 'Logo plus colors, fonts, patterns and brand materials.', featuresEn: ['Logo and its versions', 'Color palette and fonts', 'Business card, letterhead, social media', 'Brand book PDF'] },
  'Оформление профиля': { nameEn: 'Profile design', durationEn: '2–3 days', descriptionEn: 'Avatar, highlight covers and templates in one style.', featuresEn: ['Avatar', 'Highlight covers', '3 post templates', 'Editable source files'] },
  'Пост / сторис': { nameEn: 'Post / story', durationEn: '1 day', descriptionEn: 'Eye-catching design for a post, carousel or story.', featuresEn: ['In your style or from scratch', '2 revisions', 'Ready to publish'] },
  'Презентация': { nameEn: 'Presentation', durationEn: '3–5 days', descriptionEn: 'A deck of up to 10 slides: pitch, report or proposal.', featuresEn: ['Structure and visuals', 'Infographics and icons', 'PDF + source (Figma / PPTX)'] },
  'Афиша': { nameEn: 'Poster', durationEn: '2–3 days', descriptionEn: 'A poster for a concert, party or event.', featuresEn: ['2 concepts', 'Print and story versions', '2 revisions'] },
  'Обложка трека': { nameEn: 'Single cover', durationEn: '2–3 days', descriptionEn: 'A single cover that meets streaming platform requirements.', featuresEn: ['3000×3000 px', 'Story version', '2 revisions'] },
  'Обложка альбома': { nameEn: 'Album cover', durationEn: '4–6 days', descriptionEn: 'An album or EP cover plus promo materials.', featuresEn: ['Main cover', 'Animation / Canvas on request', 'Social media promo'] },
};
const EN_WORKS = {
  'Логотип кофейни «Зерно»': { titleEn: 'Coffee shop logo “Zerno”', descriptionEn: 'A minimal mark and typography for a city coffee shop.' },
  'Обложка сингла «Полночь»': { titleEn: 'Single cover “Midnight”', descriptionEn: 'Night atmosphere, neon light and film grain.' },
  'Афиша NEON NIGHT': { titleEn: 'NEON NIGHT poster', descriptionEn: 'A party poster with acid typography.' },
  'Instagram студии йоги': { titleEn: 'Yoga studio Instagram', descriptionEn: 'Avatar, highlights and post templates in a soft palette.' },
  'Питч-дек стартапа': { titleEn: 'Startup pitch deck', descriptionEn: '12 slides for investors: structure, charts, visuals.' },
  'Айдентика барбершопа': { titleEn: 'Barbershop identity', descriptionEn: 'Logo, signage, business cards and uniform.' },
  'Обложка альбома «Город»': { titleEn: 'Album cover “City”', descriptionEn: 'A collage of architecture and handwritten letters.' },
  'Сторис для бренда одежды': { titleEn: 'Stories for a clothing brand', descriptionEn: 'A set of 10 stories for a collection launch.' },
};
DEFAULT_SERVICES.forEach((s) => Object.assign(s, EN_SERVICES[s.name] || {}));
DEFAULT_WORKS.forEach((w) => Object.assign(w, EN_WORKS[w.title] || {}));

module.exports = { DEFAULT_SETTINGS, DEFAULT_SERVICES, DEFAULT_WORKS, EN_SERVICES, EN_WORKS };
