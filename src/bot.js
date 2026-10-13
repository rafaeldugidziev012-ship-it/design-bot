const { Bot, InlineKeyboard } = require('grammy');

const STATUS = {
  new: { label: 'Новая', emoji: '🆕' },
  in_progress: { label: 'В работе', emoji: '🎨' },
  done: { label: 'Готово', emoji: '✅' },
  cancelled: { label: 'Отменена', emoji: '❌' },
};

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const money = (n, cur) => `${Number(n || 0).toLocaleString('ru-RU').replace(/,/g, ' ')} ${cur}`;

function orderText(o) {
  const st = STATUS[o.status] || STATUS.new;
  const lines = [
    `${st.emoji} <b>Заявка #${o.number}</b> · ${st.label}`,
    '',
    `👤 <a href="tg://user?id=${o.userId}">${esc(o.name || 'Клиент')}</a>${o.username ? ` (@${esc(o.username)})` : ''}`,
    `🎨 <b>${esc(o.serviceName)}</b>`,
  ];
  if (o.budget) lines.push(`💰 Бюджет: ${esc(o.budget)}`);
  if (o.deadline) lines.push(`⏰ Сроки: ${esc(o.deadline)}`);
  if (o.contact) lines.push(`📱 Контакт: ${esc(o.contact)}`);
  lines.push('', `📝 ${esc(o.description)}`);
  if (o.references) lines.push('', `🔗 Референсы: ${esc(o.references)}`);
  return lines.join('\n');
}

function orderKb(o) {
  const kb = new InlineKeyboard();
  if (o.status === 'new') kb.text('✅ Взять в работу', `st:${o.id}:in_progress`).text('❌ Отклонить', `st:${o.id}:cancelled`).row();
  if (o.status === 'in_progress') kb.text('🏁 Готово', `st:${o.id}:done`).text('❌ Отменить', `st:${o.id}:cancelled`).row();
  if (o.username) kb.url('💬 Написать клиенту', `https://t.me/${o.username}`);
  return kb;
}

const CLIENT_MSG = {
  in_progress: (o) => `🎨 Ваша заявка <b>#${o.number}</b> («${esc(o.serviceName)}») взята в работу! Скоро свяжусь с вами, чтобы обсудить детали.`,
  done: (o) => `✅ Заказ <b>#${o.number}</b> готов! Спасибо, что выбрали меня 🙌\nБуду рад отзыву и новым проектам.`,
  cancelled: (o) => `Заявка <b>#${o.number}</b> отклонена. Если остались вопросы — просто напишите мне.`,
};

function createBot({ token, adminIds, publicUrl, db }) {
  const bot = new Bot(token);
  const isAdmin = (id) => adminIds.includes(id);
  const appUrl = (q = '') => publicUrl + q;

  // запоминаем пользователей
  bot.use(async (ctx, next) => {
    const u = ctx.from;
    if (u && !u.is_bot) {
      db.upsert('users', u.id, {
        username: u.username || null,
        name: [u.first_name, u.last_name].filter(Boolean).join(' '),
        lastSeen: Date.now(),
      }).catch(() => {});
    }
    await next();
  });

  bot.command('start', async (ctx) => {
    const s = await db.getSettings();
    const text = `<b>${esc(s.name)}</b> · ${esc(s.title)}\n\n${esc(s.welcome)}`;
    const kb = new InlineKeyboard();
    if (publicUrl) kb.webApp('✨ Открыть портфолио', appUrl()).row();
    kb.text('💰 Цены', 'prices').text('📩 Связаться', 'contact');
    if (publicUrl && isAdmin(ctx.from.id)) kb.row().webApp('⚙️ Админ-панель', appUrl('/?tab=admin'));
    if (s.avatar?.full) {
      await ctx.replyWithPhoto(s.avatar.full, { caption: text, parse_mode: 'HTML', reply_markup: kb });
    } else {
      await ctx.reply(text, { parse_mode: 'HTML', reply_markup: kb });
    }
  });

  bot.callbackQuery('prices', async (ctx) => {
    await ctx.answerCallbackQuery();
    const s = await db.getSettings();
    const services = (await db.all('services')).filter((x) => x.active !== false).sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0));
    const groups = [...s.categories, { id: null, name: 'Другое' }]
      .map((c) => {
        const list = services.filter((x) => (c.id ? x.categoryId === c.id : !s.categories.some((k) => k.id === x.categoryId)));
        if (!list.length) return '';
        return `<b>${esc(c.name)}</b>\n` + list.map((x) => `• ${esc(x.name)} — ${x.priceFrom ? 'от ' : ''}${money(x.price, s.currency)}${x.duration ? ` · ${esc(x.duration)}` : ''}`).join('\n');
      })
      .filter(Boolean);
    const kb = publicUrl ? new InlineKeyboard().webApp('📝 Оставить заявку', appUrl('/?tab=prices')) : undefined;
    await ctx.reply(`💰 <b>Услуги и цены</b>\n\n${groups.join('\n\n')}\n\n<i>Точная стоимость зависит от задачи.</i>`, { parse_mode: 'HTML', reply_markup: kb });
  });

  bot.callbackQuery('contact', async (ctx) => {
    await ctx.answerCallbackQuery();
    const s = await db.getSettings();
    const kb = publicUrl ? new InlineKeyboard().webApp('📝 Оставить заявку', appUrl('/?order=1')) : undefined;
    const text = s.contact
      ? `Пишите мне напрямую: @${esc(s.contact)}\nИли оставьте заявку — я отвечу в течение дня.`
      : 'Оставьте заявку в приложении — я отвечу в течение дня.';
    await ctx.reply(text, { parse_mode: 'HTML', reply_markup: kb });
  });

  // ---------- админ ----------
  bot.command('admin', async (ctx) => {
    if (!isAdmin(ctx.from.id)) return;
    const orders = await db.all('orders');
    const count = (st) => orders.filter((o) => o.status === st).length;
    const works = (await db.all('works')).length;
    const users = (await db.all('users')).length;
    const kb = publicUrl ? new InlineKeyboard().webApp('⚙️ Открыть админ-панель', appUrl('/?tab=admin')) : undefined;
    await ctx.reply(
      `⚙️ <b>Панель управления</b>\n\n🆕 Новых заявок: <b>${count('new')}</b>\n🎨 В работе: <b>${count('in_progress')}</b>\n✅ Выполнено: <b>${count('done')}</b>\n\n🖼 Работ в портфолио: ${works}\n👥 Пользователей бота: ${users}\n\nТвой ID: <code>${ctx.from.id}</code>`,
      { parse_mode: 'HTML', reply_markup: kb }
    );
  });

  bot.command('orders', async (ctx) => {
    if (!isAdmin(ctx.from.id)) return;
    const list = (await db.all('orders')).filter((o) => o.status === 'new' || o.status === 'in_progress').sort((a, b) => b.createdAt - a.createdAt).slice(0, 10);
    if (!list.length) return ctx.reply('Активных заявок нет 🎉');
    for (const o of list) await ctx.reply(orderText(o), { parse_mode: 'HTML', reply_markup: orderKb(o) });
  });

  bot.command('id', (ctx) => ctx.reply(`Ваш ID: <code>${ctx.from.id}</code>`, { parse_mode: 'HTML' }));

  bot.callbackQuery(/^st:([a-f0-9]+):(\w+)$/, async (ctx) => {
    if (!isAdmin(ctx.from.id)) return ctx.answerCallbackQuery({ text: 'Нет доступа' });
    const [, id, status] = ctx.match;
    if (!STATUS[status]) return ctx.answerCallbackQuery();
    const order = await db.update('orders', id, { status, updatedAt: Date.now() });
    if (!order) return ctx.answerCallbackQuery({ text: 'Заявка не найдена' });
    await ctx.answerCallbackQuery({ text: `Статус: ${STATUS[status].label}` });
    await syncAdminMessages(order);
    await notifyClient(order);
  });

  bot.catch((err) => console.error('Bot error:', err.error?.description || err.message));

  // ---------- уведомления ----------
  async function notifyNewOrder(order) {
    const messages = [];
    for (const id of adminIds) {
      try {
        const m = await bot.api.sendMessage(id, orderText(order), { parse_mode: 'HTML', reply_markup: orderKb(order) });
        messages.push({ chatId: id, messageId: m.message_id });
      } catch (e) {
        console.error(`Не удалось уведомить админа ${id} (он нажал /start в боте?):`, e.description || e.message);
      }
    }
    if (messages.length) await db.update('orders', order.id, { adminMessages: messages });
    try {
      await bot.api.sendMessage(order.userId, `📩 Заявка <b>#${order.number}</b> отправлена!\n\nЯ свяжусь с вами в ближайшее время. Статус можно смотреть в разделе «Заказы» приложения.`, { parse_mode: 'HTML' });
    } catch {}
  }

  async function syncAdminMessages(order) {
    for (const m of order.adminMessages || []) {
      try {
        await bot.api.editMessageText(m.chatId, m.messageId, orderText(order), { parse_mode: 'HTML', reply_markup: orderKb(order) });
      } catch {}
    }
  }

  async function notifyClient(order) {
    const fn = CLIENT_MSG[order.status];
    if (!fn) return;
    try { await bot.api.sendMessage(order.userId, fn(order), { parse_mode: 'HTML' }); } catch {}
  }

  async function messageClient(order, text) {
    await bot.api.sendMessage(order.userId, `💬 <b>Сообщение по заказу #${order.number}</b>\n\n${esc(text)}`, { parse_mode: 'HTML' });
  }

  async function setup() {
    const cmds = [{ command: 'start', description: 'Главное меню' }];
    await bot.api.setMyCommands(cmds).catch(() => {});
    for (const id of adminIds) {
      await bot.api.setMyCommands([...cmds,
        { command: 'admin', description: 'Статистика и админ-панель' },
        { command: 'orders', description: 'Активные заявки' },
      ], { scope: { type: 'chat', chat_id: id } }).catch(() => {});
    }
    if (publicUrl) {
      await bot.api.setChatMenuButton({ menu_button: { type: 'web_app', text: 'Портфолио', web_app: { url: publicUrl } } }).catch((e) => console.error('Menu button:', e.description));
    }
  }

  return { bot, notifyNewOrder, syncAdminMessages, notifyClient, messageClient, setup };
}

module.exports = { createBot, STATUS };
