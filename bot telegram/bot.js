const {Telegraf, Markup} = require("telegraf");
const { message } = require('telegraf/filters');
const { inserTgUser, updateTgUserAction, getTgUserAction, authorization, authorizationPassword, registeredUserLogin,
    checkLogin, registeredUserPassword, checkRegisteredUserPassword, unAuthorizationUsers, updateAmountAccount,
    checkUserAmount, checkTarif, checkSelectedTarif, updateAmountWrite, transferBonusToAmountWrite, getAdmin,
    getTransferNotification, getTransferNotificationUsers, getUser, acceptTransferBonus, checkUserBonus
} = require("./database");
require("dotenv").config();
const { BOT_TOKEN } = process.env

const bot = new Telegraf(`${BOT_TOKEN}`)  // Вказуєм токен боту

//КЛАВІАТУРИ
// '💱 Списати кошти'
const main_menu = [['👤 Основний профіль', '💰 Бонусний рахунок'], ['🚶 Вийти з профілю']]
const balance_menu = [['💰 Бонусний рахунок', '🔙 Повернутись до меню']]
const bonus_menu = [['👤 Основний профіль', '💸 Перевести на основний рахунок'],['🔙 Повернутись до меню']]
const bonus_menu_transfer = [['🔙 Повернутись назад']]
const admin_menu = [['📣 Перевірити сповіщення', '👤 Пошук по логіну'], ['🚶 Вийти з профілю']]
const admin_back_menu = [['🔙 Повернутись до меню']]
const admin_user_notification_menu = [['✅ Підтвердити'],['🔙 Повернутись до сповіщень']]
const amount_menu = [['💵 Поповнити баланс', '💰 Списати кошти'],['🔙 Повернутись до пошуку']]
const auth_menu = [['🔐 Авторизація', '🎫 Реєстрація'],]
const main_back = [['🔙 Повернутись до меню']]
const registared_back = [['🔙 Назад'],]

bot.command('start', async ctx => { // Відповідь на перший запуск боту та подальші виклики команди /start
    try {

        const chat_id = ctx?.chat?.id;

        const registered = await inserTgUser(chat_id)

        if(registered){// якщо користувач уже запускав бота раніше

            if(registered?.auth){ // Якщо користувач авторизований
                const isAdmin = await getAdmin(chat_id)
                if(isAdmin){ // Якщо користувач має статус адміністратора
                    let currentDate = new Date();

                    let day = currentDate.getDate();
                    let month = currentDate.getMonth() + 1;
                    let year = currentDate.getFullYear();

                    let formattedDate = `${day < 10 ? '0' : ''}${day}.${month < 10 ? '0' : ''}${month}.${year}`;

                    ctx.replyWithHTML(`Оберіть що відкриваємо`,Markup.keyboard(admin_menu).resize());

                } else {
                    ctx.replyWithHTML(`Оберіть що відкриваємо`,Markup.keyboard(main_menu).resize());
                }
            } else{ // Якщо користувач не авторизований
                ctx.reply('Вітаю, оберіть пункт меню ',Markup.keyboard(auth_menu).resize()
                );
            }

            await updateTgUserAction(chat_id, '')
        } else{
            // якщо користувач вперше запустив бота
            ctx.reply('Привіт, ти тут вперше...',Markup.keyboard(auth_menu).resize()
            );
            await updateTgUserAction(chat_id, '')
        }

    } catch (e) {
        console.error(e)
    }
});

bot.on(message, async ctx => {
    try {

        const chat_id = ctx?.chat?.id;
        const message = ctx?.message?.text;
        const command = message?.replace(/[\u{1F300}-\u{1F5FF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '').trim();
        const action = await getTgUserAction(chat_id)
        const isAdmin = await getAdmin(chat_id)
        const callback = ctx?.update?.callback_query?.data

        const callback_split = action?.split('-')

        const callback_action = action ? callback_split[0] : false
        const callback_login = action ? callback_split[1] : false

        switch (true) {
            case (command === 'Авторизація'): {  // Викликається при кліку на кнопку Авторизація
                try {
                    await updateTgUserAction(chat_id, 'authorization_login')
                    ctx.replyWithHTML('Введіть ваш <b>Логін</b>')
                    break;
                } catch (e) {
                    console.error(e)
                    break;
                }
            }
            case (action === 'authorization_login' && command !== 'Назад'  && command !== 'Реєстрація'): { // Авторизація, перевірка логіна
                try {
                    const auth = await authorization(chat_id, message)
                    if (auth !== undefined && !auth?.activate) {
                        ctx.replyWithHTML(`Ваш логін: <b>${auth?.login}</b>\nВведіть <b>пароль</b>`)
                        await updateTgUserAction(chat_id, 'authorization_password')
                    } else if(auth !== undefined && auth?.activate) {
                        ctx.replyWithHTML('Користувач авторизований з іншого телеграм акаунту, авторизація не можлива\nВкажіть інший логін',Markup.keyboard(registared_back).resize()
                        );
                    } else{
                        ctx.replyWithHTML('Невірний <b>логін</b>\nВкажіть існуючий логін',Markup.keyboard(registared_back).resize()
                        );
                    }
                    break;
                } catch (e) {
                    console.error(e)
                    break;
                }
            }
            case (action === 'authorization_password' && command !== 'Назад'): { // Авторизація, перевірка паролю
                try {
                    const registered = await authorizationPassword(chat_id, message)
                    if (registered) {
                        const isAdmin = await getAdmin(chat_id)
                        if(isAdmin){ // Якщо користувач має статус адміністратора
                            let currentDate = new Date();

                            let day = currentDate.getDate();
                            let month = currentDate.getMonth() + 1;
                            let year = currentDate.getFullYear();

                            let formattedDate = `${day < 10 ? '0' : ''}${day}.${month < 10 ? '0' : ''}${month}.${year}`;

                            await ctx.replyWithHTML(`<b>Статус:</b> Admin\n\n<b>Дата: ${formattedDate}</b> `,Markup.keyboard(admin_menu).resize());

                            const notification = await getTransferNotification()
                            await ctx.replyWithHTML(`<b>Нових сповіщень:</b> ${notification}`,Markup.keyboard(admin_menu).resize());
                        } else {
                            ctx.replyWithHTML(`Вітаю <b>${registered?.login}</b>\n\nОберіть пункт меню`,Markup.keyboard(main_menu).resize());
                        }

                        if(registered?.notification){
                            ctx.replyWithHTML(`✅ Запит підтверджено, кошти з бонусного рахунку переведено на основний, приємного проведення часу`,Markup.keyboard(main_menu).resize());
                        }

                        await updateTgUserAction(chat_id, '')
                    } else {
                        ctx.replyWithHTML('Невірний <b>пароль</b>',Markup.keyboard(registared_back).resize());
                    }
                    break;
                } catch (e) {
                    console.error(e)
                    break;
                }
            }
            case (command === 'Реєстрація'): {  //Викликається при кліку на кнопку Реєстрація
                try {
                    await updateTgUserAction(chat_id, 'registration')
                    ctx.replyWithHTML('Вигадайте ваш <b>Логін</b>, він має бути унікальним')
                    break;
                } catch (e) {
                    console.error(e)
                    break;
                }
            }
            case (action === 'registration' && command !== 'Назад'): { // Реєстрація користувача, введення логіну
                try {
                    if (message.length >= 4) {
                        const regex = /\s/;
                        if(!regex.test(message)){
                            const confirmLogin = await checkLogin(message)
                            if (!confirmLogin) {
                                await registeredUserLogin(chat_id, message)
                                ctx.replyWithHTML(`Ваш логін: <b>${message}</b>\n\nВигадайте пароль`)
                                await updateTgUserAction(chat_id, 'registration_password')

                            } else {
                                ctx.replyWithHTML(`Користувач з логіном <b>${message}</b> уже зареєстрований\nВигадайте інший логін`)
                            }
                        } else{
                            ctx.replyWithHTML('Логін має бути одним словом, без пробілів!',Markup.keyboard(registared_back).resize())
                        }

                    } else {
                        ctx.replyWithHTML('Логін має містити 4 або більше символів',Markup.keyboard(registared_back).resize())
                    }
                    break;
                } catch (e) {
                    console.error(e)
                    break;
                }
            }
            case (action === 'registration_password' && command !== 'Назад'): { //створення паролю
                try {
                    if (message.length >= 6) {
                        const registeredLogin = await registeredUserPassword(chat_id, message)
                        ctx.replyWithHTML(`Підтвердіть пароль`)
                        await updateTgUserAction(chat_id, 'registration_password_wait')
                    } else {
                        ctx.replyWithHTML('Пароль має містити 6 або більше символів',Markup.keyboard(registared_back).resize())
                    }
                    break;
                } catch (e) {
                    console.error(e)
                    break;
                }
            }
            case (action === 'registration_password_wait' && command !== 'Назад'): { // Перевірка паролю при реєстрації
                try {
                    if (message.length >= 6) {
                        const checkUserPassword = await checkRegisteredUserPassword(chat_id, message)
                        if(checkUserPassword){
                            ctx.replyWithHTML(`Вітаю <b>${checkUserPassword?.login}</b>\n\nОберіть пункт меню`,Markup.keyboard(main_menu).resize()
                            );
                            await updateTgUserAction(chat_id, 'userLogin')
                        } else{
                            ctx.replyWithHTML('Невірно вказаний пароль',Markup.keyboard(registared_back).resize()
                            );
                        }

                    } else {
                        ctx.replyWithHTML('Невірно вказаний пароль',Markup.keyboard(registared_back).resize()
                        );
                    }
                    break;
                } catch (e) {
                    console.error(e)
                    break;
                }
            }
            case (action === 'registration_password_wait' && command === 'Назад'         //Кнопка НАЗАД при реєстрації/авторизації
                    || action === 'authorization_login' && command === 'Назад'
                    || action === 'authorization_password' && command === 'Назад'
                    || action === 'registration_password'): {
                try {
                    ctx.reply('Оберіть пункт меню ',Markup.keyboard(auth_menu).resize()
                    );
                    break;
                } catch (e) {
                    console.error(e)
                    break;
                }
            }
            case (command === 'Вийти з профілю'): { // Вихід з акаунту
                try {
                    const unAuthResult = await unAuthorizationUsers(chat_id)
                    if(unAuthResult){
                        ctx.reply('Ви успішно вийшли з профілю ',Markup.keyboard(auth_menu).resize()
                        );
                        await updateTgUserAction(chat_id, '')
                    }
                    break;
                } catch (e) {
                    console.error(e)
                    break;
                }
            }
            case (command === 'Повернутись до меню'): { //Повернення до головного меню
                try {
                    const isAdmin = await getAdmin(chat_id)
                    if(isAdmin){ // Якщо користувач має статус адміністратора

                        ctx.replyWithHTML(`Оберіть що відкриваємо `,Markup.keyboard(admin_menu).resize());

                    } else {
                        ctx.replyWithHTML(`Оберіть що відкриваємо`,Markup.keyboard(main_menu).resize());
                    }
                    await updateTgUserAction(chat_id, '')

                    break;
                } catch (e) {
                    console.error(e)
                    break;
                }
            }

            case (command === 'Перевірити сповіщення' || command === 'Повернутись до сповіщень'): { // кнопка Перевірка сповіщень
                try {
                    const notification = await getTransferNotification()

                    if(notification){
                       const users = await getTransferNotificationUsers()

                        let menu = []
                        for (let i = 0; i < users.length; i += 2) {
                            const currentUser = users[i];
                            const nextUser = users[i + 1];
                            if(nextUser !== undefined){
                                menu.push([`Логін: ${currentUser?.login}`, `Логін: ${nextUser?.login}`]);
                            } else{
                                menu.push([`Логін: ${currentUser?.login}`]);
                            }
                        }

                        menu = [...menu,...admin_back_menu]
                        await ctx.replyWithHTML(`<b>Нових сповіщень:</b> ${notification}`,Markup.keyboard(menu).resize());
                    } else{
                        await ctx.replyWithHTML(`<b>Нових сповіщень немає</b>`,Markup.keyboard(admin_back_menu).resize());
                    }

                    await updateTgUserAction(chat_id, 'findNotification')

                    break;
                } catch (e) {
                    console.error(e)
                    break;
                }
            }

            case (command !== 'Повернутись до меню' && action === 'findNotification'): { // Обирання користувача в сповіщеннях
                try {
                    const user = await getUser(message?.replace('Логін: ',''))

                    if(user){
                        await ctx.replyWithHTML(`Запит від користувача <b>${user?.login}</b> на переказ <b>${parseInt(user?.transfer)}₴</b> з бонусного рахунку на основний рахунок`,Markup.keyboard(admin_user_notification_menu).resize());
                        await updateTgUserAction(chat_id, `${user?.login}`)
                   }

                    break;
                } catch (e) {
                    console.error(e)
                    break;
                }
            }

            case (command === 'Підтвердити' && action !== 'findNotification' && action !== ''): { // Підтвердження переказу
                try {
                    const user = await acceptTransferBonus(action)

                    if(user){
                        const notification = await getTransferNotification()
                        if(notification){
                            const users = await getTransferNotificationUsers()

                            let menu = []

                            for (let i = 0; i < users.length; i += 2) {
                                const currentUser = users[i];
                                const nextUser = users[i + 1];
                                if(nextUser !== undefined){
                                    menu.push([`Логін: ${currentUser?.login}`, `Логін: ${nextUser?.login}`]);
                                } else{
                                    menu.push([`Логін: ${currentUser?.login}`]);
                                }
                            }

                            menu = [...menu,...admin_back_menu]
                            await ctx.replyWithHTML(`Запит від користувача <b>${user[0]?.login}</b> на переказ <b>${parseInt(user[0]?.transfer)}₴</b> з бонусного рахунку на основний рахунок\n\n<b>✅ Підтверджено</b>\n<b>👤Основний рахунок користувача:</b> ${parseInt(user[1])}`,Markup.keyboard(menu).resize());

                        } else{
                            await ctx.replyWithHTML(`Запит від користувача <b>${user[0]?.login}</b> на переказ <b>${parseInt(user[0]?.transfer)}₴</b> з бонусного рахунку на основний рахунок\n\n<b>✅ Підтверджено</b>\n<b>👤Основний рахунок користувача:</b> ${parseInt(user[1])}`,Markup.keyboard(admin_back_menu).resize());
                        }
                        if(user[2]?.chat_id)
                            await ctx.replyWithHTML({chat_id:user[2]?.chat_id, text:`✅ Запит підтверджено, <b>${parseInt(user[0]?.transfer)}₴</b> з бонусного рахунку переведено на основний, приємного проведення часу`}).catch((e)=>{});

                        await updateTgUserAction(chat_id, 'findNotification')
                    }

                    break;
                } catch (e) {
                    console.error(e)
                    break;
                }
            }
            case (callback_action === 'accountEnroll' && callback_login !== undefined && command === 'Повернутись назад'): {
                try {
                    const user = await getUser(callback_login)

                    await ctx.replyWithHTML(`<b>Логін: </b>${user?.login}\n<b>Основний рахунок: </b>${parseInt(user?.amount)}₴\n<b>Бонусний рахунок: </b>${parseInt(user?.bonus)}₴`,Markup.keyboard(amount_menu).resize());
                    await updateTgUserAction(chat_id, callback_login)

                    break;
                } catch (e) {
                    console.error(e)
                    break;
                }
            }

            case (command === 'Пошук по логіну' || command === 'Повернутись до пошуку'): { // Пошук по логіну
                try {
                    await ctx.replyWithHTML(`Введіть логін користувача`,Markup.keyboard(admin_back_menu).resize());
                    await updateTgUserAction(chat_id, 'searchLogin')
                    break;
                } catch (e) {
                    console.error(e)
                    break;
                }
            }

            case (action === 'searchLogin'): { // Підтвердження переказу
                try {
                    const user = await getUser(message)

                    if(user){
                        await ctx.replyWithHTML(`<b>Логін: </b>${user?.login}\n<b>Основний рахунок: </b>${parseInt(user?.amount)}₴\n<b>Бонусний рахунок: </b>${parseInt(user?.bonus)}₴`,Markup.keyboard(amount_menu).resize());
                        await updateTgUserAction(chat_id, message)
                    } else{
                        await ctx.replyWithHTML(`Користувача з логіном "${message}" не знайдено`, Markup.keyboard(admin_back_menu).resize());
                        await updateTgUserAction(chat_id, 'searchLogin')
                    }

                    break;
                } catch (e) {
                    console.error(e)
                    break;
                }
            }

            case (command === 'Поповнити баланс'): { // Поповнення балансу
                try {
                    ctx.reply('Введіть суму поповнення', Markup.keyboard(main_back).resize());
                    await updateTgUserAction(chat_id, `accountEnroll-${action}`)

                    break;
                } catch (e) {
                    console.error(e)
                    break;
                }
            }
            case (command === 'Основний профіль'): { // Перегляд балансу
                try {
                    const userAmount = await checkUserBonus(chat_id)
                    ctx.replyWithHTML(`<b>Логін:</b> ${userAmount[1]}\n\<b>На вашому рахунку:</b> ${userAmount[0]}₴`, Markup.keyboard(balance_menu).resize());
                    break;
                } catch (e) {
                    console.error(e)
                    break;
                }
            }

            case (command === 'Бонусний рахунок' || action === 'transferBonus' && command === 'Повернутись назад'): { // Перегляд бонусного балансу
                try {
                    const userAmount = await checkUserAmount(chat_id)
                    ctx.replyWithHTML(`<b>Логін:</b> ${userAmount[1]}\n\<b>На вашому бонусному рахунку:</b> ${userAmount[0]}₴`, Markup.keyboard(bonus_menu).resize());
                    break;
                } catch (e) {
                    console.error(e)
                    break;
                }
            }

            case (command === 'Перевести на основний рахунок'): { // Перевод на бонусних коштів на основний баланс
                try {
                    await updateTgUserAction(chat_id, 'transferBonus')
                    ctx.replyWithHTML(`Вкажіть сумму переводу переказу з боноснуго рахунку <b>(мінімальна сумма 50₴)</b>`, Markup.keyboard(bonus_menu_transfer).resize());
                    break;
                } catch (e) {
                    console.error(e)
                    break;
                }
            }

            case (action === 'transferBonus'): { // Перевод на бонусних коштів на основний баланс
                try {
                    const numberRegExp = /^-?\d*\.?\d+$/;
                    if(numberRegExp.test(message)){
                        if(Number(message) >=50){
                            const amountWrite = await transferBonusToAmountWrite(chat_id,message)
                            if(amountWrite) {
                                ctx.reply(`Дякую, ваш запит успішно відправлено, очікуйте підтвердження`, Markup.keyboard(bonus_menu_transfer).resize());
                            } else{
                                ctx.reply(`Недостатньо коштів на бонусному рахунку для виконання операції!`, Markup.keyboard(bonus_menu_transfer).resize());
                            }
                        } else{
                            ctx.reply(`Мінімальна сумма переказу з бонусного рахунку - 50₴, будь ласка вкажіть допустиму сумму!`, Markup.keyboard(bonus_menu_transfer).resize());
                        }

                    } else {
                        ctx.reply(`Будь ласка введіть валідне число, наприклад: 50`,Markup.keyboard(bonus_menu_transfer).resize());
                    }
                    // await updateTgUserAction(chat_id, 'transferBonus')
                    // ctx.replyWithHTML(`Вкажіть суму переводу переказу з боноснуго рахунку <b>(мінімальна сума 50₴)</b>`, Markup.keyboard(bonus_menu).resize());
                    break;
                } catch (e) {
                    console.error(e)
                    break;
                }
            }

            case (command === 'Списати кошти'): { // Списання з балансу
                try {
                    const userAmount = await checkUserAmount(chat_id)
                    const tarif = await checkTarif()
                    if(tarif){
                        ctx.reply(`Оберіть тариф:`, Markup.inlineKeyboard(tarif).resize());
                        await updateTgUserAction(chat_id, `write_offs_tarif-${callback_login !== undefined ? callback_login : action}`)
                    }
                    break;
                } catch (e) {
                    console.error(e)
                    break;
                }
            }

            case (callback_action === 'write_offs_tarif' && callback_login !== '' && callback !== undefined): { //  Перевірка обраного тарифу, вивід інформації про тариф
                try {
                    const tarif = await checkSelectedTarif(callback,chat_id)
                    if(tarif){
                        ctx.reply(`Ви обрали зону ${tarif?.title} ${tarif?.price} грн/год (${tarif?.price_minut} грн/хв)!\nВкажіть кількість хвилин, скільки ви користувалися послугою клубу`, Markup.keyboard(amount_menu).resize());
                        await updateTgUserAction(chat_id, `write_offs-${callback_login !== undefined ? callback_login : action}`)
                    }
                    break;
                } catch (e) {
                    console.error(e)
                    break;
                }
            }
            case (callback_action === 'write_offs' && callback_login !== ''): { // Перевірка та списання коштів з балансу
                try {
                    if(callback){
                        const tarif = await checkSelectedTarif(callback,chat_id)
                        if(tarif){
                            ctx.reply(`Ви обрали зону ${tarif?.title} ${tarif?.price} грн/год (${tarif?.price_minut} грн/хв)!\nВкажіть кількість хвилин, скільки ви користувалися послугою клубу`, Markup.keyboard(amount_menu).resize());
                            await updateTgUserAction(chat_id, `write_offs-${callback_login !== undefined ? callback_login : action}`)
                        }
                    } else{
                        const numberRegExp = /^-?\d*\.?\d+$/;
                        if(numberRegExp.test(message)){
                            const amountWrite = await updateAmountWrite(chat_id,message,callback_login)
                            if(amountWrite) {
                                ctx.reply(`З балансу аккаунта ${callback_login} списано ${amountWrite}₴ !`, Markup.keyboard(amount_menu).resize());
                                await updateTgUserAction(chat_id, `${callback_login}`)
                            } else{
                                ctx.reply(`Недостатньо коштів на балансі, виберіть інший тариф або виправте час!`, Markup.keyboard(amount_menu).resize());
                            }
                        } else{
                            ctx.reply(`Будь ласка введіть валідне число, наприклад: 60`,Markup.keyboard(amount_menu).resize());
                        }
                    }
                    break;
                } catch (e) {
                    console.error(e)
                    break;
                }
            }

            case (callback_action === 'accountEnroll' && callback_login !== undefined): { // Перевірка та поповнення на введену суму
                try {
                    const numberRegExp = /^-?\d*\.?\d+$/;
                    if(numberRegExp.test(message)){
                        const updateAmount = await updateAmountAccount(chat_id,message,callback_login)
                        if(updateAmount) {
                            ctx.replyWithHTML(`Акаунт користувача <b>${callback_login}</b> успішно поповнено на ${message}₴`, Markup.keyboard([['🔙 Повернутись назад']]).resize());
                        }
                    } else{
                        ctx.reply(`Будь ласка введіть валідне число, наприклад: 200.50 `,Markup.keyboard(main_back).resize());
                    }
                    break;
                } catch (e) {
                    console.error(e)
                    break;
                }
            }

            default: {  // Відповідь бота, якщо не було опрацьовано команду
                try {
                    ctx.replyWithHTML('<b>Вибачте</b>, я вас не розумію')
                } catch (e) {
                    console.error(e)
                    break;
                }
            }
        }
    } catch (e) {
        console.error(e)
    }
})

module.exports = bot