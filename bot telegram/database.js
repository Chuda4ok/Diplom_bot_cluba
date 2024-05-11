const sqlite3 = require('sqlite3').verbose();
const util = require('util');
const {Markup} = require("telegraf");
const db = new sqlite3.Database('clubBot.db');

db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='user'", (err, row) => {
    if (err) {
        console.error(err.message);
    } else if (!row) {
        // Якщо таблиці user не існує, створити її
        db.run('CREATE TABLE user (id INTEGER, login TEXT, password TEXT, amount NUMERIC, bonus NUMERIC, transfer NUMERIC, notification BOOLEAN, admin BOOLEAN, chat_id NUMERIC, activate BOOLEAN, PRIMARY KEY(id AUTOINCREMENT))');
    }
});

// Перевірка наявності таблиці tg_user
db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='tg_user'", (err, row) => {
    if (err) {
        console.error(err.message);
    } else if (!row) {
        // Якщо таблиці tg_user не існує, створити її
        db.run('CREATE TABLE tg_user (id INTEGER, chat_id NUMERIC UNIQUE, action TEXT, login TEXT, password TEXT, auth BOOLEAN, PRIMARY KEY(id AUTOINCREMENT))');
    }
});

// Перевірка наявності таблиці tarif
db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='tarif'", (err, row) => {
    if (err) {
        console.error(err.message);
    } else if (!row) {
        // Якщо таблиці tarif не існує, створити її
        db.run('CREATE TABLE tarif (id INTEGER, title TEXT, price NUMERIC, price_minut NUMERIC, PRIMARY KEY(id AUTOINCREMENT))');
    }
});

const getAsync = util.promisify(db.get);
const getAll = util.promisify(db.all);
const runAsync = util.promisify(db.run);

async function inserTgUser(chat_id) {   // Реєстрація телеграм акаунту користувача, якщо він відсутній
    try {
        const result = await getAsync.bind(db)('SELECT * FROM tg_user WHERE chat_id = ?', [chat_id]);
        if(result){
            return result;
        } else{
            await runAsync.bind(db)('INSERT INTO tg_user (chat_id) VALUES (?)', [chat_id]);
            return false
        }

    } catch (e){
        console.error(e)
    }
}

async function updateTgUserAction(chat_id, newAction) {   // Оновлення стану телеграм користувача
    try {
        await runAsync.bind(db)('UPDATE tg_user SET action = ? WHERE chat_id = ?', [newAction, chat_id]);
        return true;
    } catch (e){
        console.error(e)
    }
}

async function authorizationPassword(chat_id,password) { // Перевірка паролю
    try {
        const login = await getAsync.bind(db)('SELECT login FROM tg_user WHERE chat_id = ?', [chat_id]);
        const row = await getAsync.bind(db)('SELECT * FROM user WHERE login = ? AND password = ?', [login?.login,password]);
        if(row !== undefined && login?.login){
            await runAsync.bind(db)('UPDATE user SET activate = ?, notification = ? WHERE login = ?', [true, false, login?.login]);
            await runAsync.bind(db)('UPDATE tg_user SET auth = ? , login = ? WHERE chat_id = ?', [true,login?.login, chat_id]);
            return row
        } else {
            return false
        }

    } catch (e) {
        console.error(e)
    }
}

async function unAuthorizationUsers(chat_id) { // Вихід з профілю
    try {
        const login = await getAsync.bind(db)('SELECT * FROM tg_user WHERE chat_id = ?', [chat_id]);
        const row = await getAsync.bind(db)('SELECT * FROM user WHERE login = ?', [login?.login]);

        if(row !== undefined && login?.login && row?.activate){
            await runAsync.bind(db)('UPDATE user SET activate = ? WHERE login = ?', [false, login?.login]);
            await runAsync.bind(db)('UPDATE tg_user SET auth = ? , login = ? WHERE chat_id = ?', [false, '', chat_id]);
            return true
        } else {
            return false
        }

    } catch (e) {
        console.error(e)
    }
}

async function getTgUserAction(chat_id) {  // Перевірка стану користувача телеграм
    try {
        const row = await getAsync.bind(db)('SELECT action FROM tg_user WHERE chat_id = ?', [chat_id]);
        return row?.action

    } catch (e){
        console.error(e)
    }
}

async function getAdmin(chat_id) {  // Перевірка чи являється користувач адміністратором
    try {
        const login = await getAsync.bind(db)('SELECT * FROM tg_user WHERE chat_id = ?', [chat_id]);
        const row = await getAsync.bind(db)('SELECT admin FROM user WHERE login = ?', [login?.login]);
        return row?.admin

    } catch (e){
        console.error(e)
    }
}

async function getTransferNotification() {  // Перевірка чи є нові сповіщення
    try {
        const row = await getAsync.bind(db)('SELECT COUNT(transfer) FROM user WHERE transfer != ?', [0]);
        return row['COUNT(transfer)'] ? row['COUNT(transfer)'] : 0

    } catch (e){
        console.error(e)
    }
}

async function getTransferNotificationUsers() {  // Перевірка користувачів які подали перевід коштів з бонусного акаунту
    try {
        const row = await getAll.bind(db)('SELECT login FROM user WHERE transfer != ?', [0]);
        return row

    } catch (e){
        console.error(e)
    }
}

async function getUser(login) {  // Інформація про користувача
    try {
        const row = await getAsync.bind(db)('SELECT * FROM user WHERE login = ?', [login]);
        return row

    } catch (e){
        console.error(e)
    }
}

async function acceptTransferBonus(login) {  // Переказ з бонусного на основний
    try {
        const row = await getAsync.bind(db)('SELECT * FROM user WHERE login = ?', [login]);
        const amount = row.amount !== null ? Number(row.amount) : 0
        const bonus = row.bonus !== null ? Number(row.bonus) : 0
        const transfer = row.transfer !== null ? Number(row.transfer) : 0
        const updatedAmount = amount + transfer
        const updatedBonus = bonus - transfer

        await runAsync.bind(db)('UPDATE user SET amount = ?, bonus = ?, transfer = ?, notification = ? WHERE login = ?', [updatedAmount, updatedBonus, 0, true, row?.login]);
        const findUser = await getAsync.bind(db)('SELECT chat_id FROM tg_user WHERE login = ?', [login]);
        return [row,updatedAmount,findUser]
    } catch (e){
        console.error(e)
    }
}

async function authorization(chat_id,login) { // Авторизація користувача та перевірка чи користувач авторизований в іншому ТГ
    try {
        const row = await getAsync.bind(db)('SELECT * FROM user WHERE login = ?', [login]);

        if(row !== undefined && row?.login === login && !row?.activate){
            await runAsync.bind(db)('UPDATE tg_user SET login = ? WHERE chat_id = ?', [login, chat_id]);
            return row
        } else{
            return row
        }

    } catch (e){
        console.error(e)
    }
}

async function registeredUserLogin(chat_id,login) {  // Реєстрація, зберігаєм логін
    try {
        const row = await runAsync.bind(db)('UPDATE tg_user SET login = ? WHERE chat_id = ?', [login, chat_id]);

        return true;
    } catch (e){
        console.error(e)
    }
}

async function registeredUserPassword(chat_id,password) {  // Реєстрація, зберігаєм пароль
    try {
        const row = await runAsync.bind(db)('UPDATE tg_user SET password = ? WHERE chat_id = ?', [password, chat_id]);
        return true;
    } catch (e){
        console.error(e)
    }
}

async function updateAmountAccount(chat_id,amount,login) {  // Поповнення балансу
    try {
        const row = await getAsync.bind(db)('SELECT * FROM user WHERE login = ?', [login]);

        if(row){
            let newAmount = Number(row?.amount) + Number(amount)

            let bonus = Number(row?.bonus)
            if(amount >= 100 && amount < 200){
                bonus = (Number(amount) * 5 / 100) + bonus
            } else if(amount >= 200 && amount < 500){
                bonus = (Number(amount) * 10 / 100) + bonus
            } else if(amount >= 500 && amount < 1000){
                bonus = (Number(amount) * 15 / 100) + bonus
            } else if(amount >= 1000){
                bonus = (Number(amount) * 20 / 100) + bonus
            }

            await runAsync.bind(db)('UPDATE user SET amount = ?, bonus = ? WHERE login = ?', [newAmount, bonus, login]);

            return true;
        } else{
            return false;
        }

    } catch (e){
        console.error(e)
    }
}

async function transferBonusToAmountWrite(chat_id,amount) {  // Запит на зняття бонусних коштів
    try {
        const user = await getAsync.bind(db)('SELECT * FROM tg_user WHERE chat_id = ?', [chat_id]);
        const row = await getAsync.bind(db)('SELECT * FROM user WHERE login = ?', [user?.login]);

        if(row){
            if(Number(row?.bonus) >= Number(amount)){
                const transfer = Number(amount)
                await runAsync.bind(db)('UPDATE user SET transfer = ? WHERE login = ?', [transfer, user?.login]);
                return true;
            } else{
                return false;
            }
        } else{
            return false;
        }

    } catch (e){
        console.error(e)
    }
}

async function updateAmountWrite(chat_id,minuts,login) {  // Зняття коштів з балансу
    try {
        const user = await getAsync.bind(db)('SELECT * FROM tg_user WHERE chat_id = ?', [chat_id]);
        const row = await getAsync.bind(db)('SELECT * FROM user WHERE login = ?', [login]);

        if(row){
            const price_minute = Number(user?.password)
            const order = Number(minuts)*price_minute
            if(Number(row?.amount) >= Number(order)){
                const newAmount = Number(row?.amount) - Number(order)
                await runAsync.bind(db)('UPDATE user SET amount = ? WHERE login = ?', [newAmount, login]);
                return order.toFixed(0);
            } else{
                return false;
            }
        } else{
            return false;
        }

    } catch (e){
        console.error(e)
    }
}

async function checkUserAmount(chat_id) {   // Отримання числа балансу користувача
    try {
        const login = await getAsync.bind(db)('SELECT * FROM tg_user WHERE chat_id = ?', [chat_id]);
        const row = await getAsync.bind(db)('SELECT * FROM user WHERE login = ?', [login?.login]);

        if(row){
            return row?.bonus === null && row?.bonus <= 1 ? [0,login?.login] : [row?.bonus.toFixed(0),login?.login];
        } else{
            return false;
        }

    } catch (e){
        console.error(e)
    }
}

async function checkUserBonus(chat_id) {   // Отримання числа балансу користувача
    try {
        const login = await getAsync.bind(db)('SELECT * FROM tg_user WHERE chat_id = ?', [chat_id]);
        const row = await getAsync.bind(db)('SELECT * FROM user WHERE login = ?', [login?.login]);

        if(row){
            return row?.amount === null && row?.amount <= 1 ? [0,login?.login] : [parseInt(row?.amount),login?.login];
        } else{
            return false;
        }

    } catch (e){
        console.error(e)
    }
}

async function checkTarif() { // Вивід кнопок тарифів
    try {
        const tarifs = await getAll.bind(db)('SELECT * FROM tarif');

        let buttons = tarifs.map(item => {
            return [Markup.button.callback(`${item.title} ${item.price} грн/год (${item.price_minut} грн/хв)`, `${item.id}`)];
        });

        return buttons

    } catch (e){
        console.error(e)
    }
}

async function checkSelectedTarif(id,chat_id) { // Перевірка обраного тарифу
    try {
        const selectedTarif = await getAsync.bind(db)('SELECT * FROM tarif WHERE id = ?', [id]);
        await runAsync.bind(db)('UPDATE tg_user SET password = ? WHERE chat_id = ?', [selectedTarif?.price_minut,chat_id]);
        return selectedTarif

    } catch (e){
        console.error(e)
    }
}

async function checkRegisteredUserPassword(chat_id,password) { // Перевірка повторного введення пароль, якщо співпадають - створюєм користувача та авторизуєм
    try {
        const login = await getAsync.bind(db)('SELECT login FROM tg_user WHERE chat_id = ?', [chat_id]);
        const row = await getAsync.bind(db)('SELECT password,login FROM tg_user WHERE login = ? AND password = ?', [login?.login,password]);

        if(row?.password === password){
            await runAsync.bind(db)('INSERT INTO user (login, password, chat_id, activate, bonus, notification, transfer, admin, amount) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', [login?.login, password, chat_id, true, 0, false, 0, false, 0]);
            await runAsync.bind(db)('UPDATE tg_user SET password = ? , login = ? , auth = ? WHERE chat_id = ?', ['', login?.login, true, chat_id]);
            return row;
        } else{
            return false;
        }

    } catch (e){
        console.error(e)
    }
}

async function checkLogin(login) {  // Перевірка чи існує логін
    try{
        const row = await getAsync.bind(db)('SELECT * FROM user WHERE login = ?', [login]);

        return !!(row !== undefined && row);
    }catch (e) {
        console.error(e)
    }
}

module.exports = {
    acceptTransferBonus,
    getUser,
    getTransferNotificationUsers,
    getTransferNotification,
    getAdmin,
    transferBonusToAmountWrite,
    registeredUserLogin,
    checkTarif,
    updateAmountWrite,
    checkSelectedTarif,
    checkUserAmount,
    unAuthorizationUsers,
    updateAmountAccount,
    checkRegisteredUserPassword,
    registeredUserPassword,
    checkLogin,
    inserTgUser,
    checkUserBonus,
    updateTgUserAction,
    getTgUserAction,
    authorization,
    authorizationPassword
}