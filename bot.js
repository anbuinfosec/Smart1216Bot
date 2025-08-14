const botStartTime = Date.now();
const TelegramBot = require('node-telegram-bot-api');
const { TELEGRAM_BOT_TOKEN, DB_PATH } = require('./config');
const { saveUser, getSessions, saveSessions } = require('./db');
const log = require('npmlog');
const { number, randomua, sendPin, verifyPin, getHome, getPageData } = require('./func');
const fs = require('fs');
const path = require('path');

const userLoginState = {};
const userSessionState = {};
const previousPageData = {};

const bot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: true });
const dbDir = path.dirname(DB_PATH);

if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });
if (!fs.existsSync(DB_PATH)) fs.writeFileSync(DB_PATH, '');

function getPageKeyboard(pageContent) {
    const buttons = pageContent.map(el => [{ text: el.displayTextEN || 'Button' }]);
    buttons.push([{ text: 'Previous Page' }]);
    return { reply_markup: { keyboard: buttons, resize_keyboard: true, one_time_keyboard: false } };
}

function getResendCancelInlineKeyboard() {
    return {
        reply_markup: {
            inline_keyboard: [
                [{ text: 'Resend OTP', callback_data: 'resend_otp' }, { text: 'Cancel', callback_data: 'cancel_login' }]
            ]
        }
    };
}

const DEFAULT_LANG = 'bn';

bot.onText(/\/login(new)?$/, (msg) => {
    const chatId = msg.chat.id;
    userLoginState[chatId] = { step: 'awaiting_phone' };
    bot.sendMessage(chatId, 'Please send your phone number to login.');
});

bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;

    if (userLoginState[chatId]?.step === 'awaiting_phone' && /^\d{10,}$/.test(text)) {
        userLoginState[chatId] = { step: 'awaiting_otp', phone: text };
        const pinResult = await sendPin(text);
        if (pinResult.success) {
            bot.sendMessage(chatId, `OTP sent to ${text}. Please enter the OTP.`, getResendCancelInlineKeyboard());
        } else {
            bot.sendMessage(chatId, `Failed to send OTP: ${pinResult.message}`, getResendCancelInlineKeyboard());
            userLoginState[chatId] = null;
        }
        return;
    }

    if (userSessionState[chatId]?.awaitingInput) {
        const inputEl = userSessionState[chatId].awaitingInput;
        // If waiting for input text
        if (!inputEl.inputText) {
            // If user sends cancel
            if (text.toLowerCase() === 'cancel' || text === 'বাতিল') {
                userSessionState[chatId].awaitingInput = null;
                bot.sendMessage(chatId, 'Input cancelled.');
                return;
            }
            // Save user input and show Submit/Cancel buttons
            userSessionState[chatId].awaitingInput.inputText = text;
            bot.sendMessage(chatId, 'একটি অপশন নির্বাচন করুন:', {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '✅ সাবমিট', callback_data: 'submit_input' }, { text: '❌ বাতিল', callback_data: 'cancel_input' }]
                    ]
                }
            });
            return;
        }
    }

    if (userLoginState[chatId]?.step === 'awaiting_otp' && /^\d{4,6}$/.test(text)) {
        const phone = userLoginState[chatId].phone;
        const verifyResult = await verifyPin(phone, text);
        if (verifyResult.success && verifyResult.token && verifyResult.key && verifyResult.cli) {
            getSessions(chatId, (sessions) => {
                let newSessions = Array.isArray(sessions) ? sessions : [];
                newSessions.push({ token: verifyResult.token, key: verifyResult.key, cli: verifyResult.cli, phone });
                saveSessions(chatId, newSessions, () => {
                    saveUser(msg.from, { sessions: newSessions });
                    bot.sendMessage(chatId, 'Login successful! Use /home to continue.');
                    userLoginState[chatId] = null;
                });
            });
        } else if (verifyResult.success) {
            bot.sendMessage(chatId, 'Login succeeded, but no session data returned. Please try again or contact support.', getResendCancelInlineKeyboard());
            userLoginState[chatId] = null;
        } else {
            bot.sendMessage(chatId, `Wrong PIN. Please try again or resend OTP.`, getResendCancelInlineKeyboard());
        }
    }
});

bot.onText(/\/home/, async (msg) => {
    const chatId = msg.chat.id;
    getSessions(chatId, async (sessions) => {
        if (!Array.isArray(sessions) || sessions.length === 0) {
            bot.sendMessage(chatId, 'No session found. Please login first.');
            return;
        }
        const session = sessions[sessions.length - 1];
        const homeResult = await getHome(DEFAULT_LANG, session.cli, session.token, session.key);
        if (homeResult.success && Array.isArray(homeResult.data?.elements) && homeResult.data.elements.length > 0) {
            userSessionState[chatId] = session;
            userSessionState[chatId].lastPageContent = homeResult.data.elements;
            const buttons = getPageButtons(homeResult.data.elements);
            bot.sendMessage(chatId, homeResult.data.pageHeading?.BN || 'একটি অপশন নির্বাচন করুন:', { reply_markup: { inline_keyboard: buttons } });
        } else {
            bot.sendMessage(chatId, `Home failed: ${homeResult.message}`);
        }
    });
});

bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id;
    const messageId = query.message.message_id;

    if (query.data === 'resend_otp') {
        const phone = userLoginState[chatId]?.phone;
        if (phone) {
            const pinResult = await sendPin(phone);
            if (pinResult.success) bot.sendMessage(chatId, `OTP resent to ${phone}. Please enter the OTP.`, getResendCancelInlineKeyboard());
            else bot.sendMessage(chatId, `Failed to resend OTP: ${pinResult.message}`, getResendCancelInlineKeyboard());
        }
        bot.answerCallbackQuery(query.id);
        return;
    }

    if (query.data === 'cancel_login') {
        userLoginState[chatId] = null;
        bot.sendMessage(chatId, 'Login cancelled.');
        bot.answerCallbackQuery(query.id);
        return;
    }

    const session = userSessionState[chatId];
    if (!session) {
        bot.sendMessage(chatId, 'Session not found. Please login again.');
        bot.answerCallbackQuery(query.id);
        return;
    }

    if (query.data.startsWith('page_')) {
        const elementId = query.data.replace('page_', '');
        // Store current page as previous before navigating
        previousPageData[chatId] = {
            currentPage: userSessionState[chatId]?.currentPage || '',
            buttonId: elementId
        };
        const pageResult = await getPageData(session.cli, userSessionState[chatId]?.currentPage || '', elementId, session.token, session.key, DEFAULT_LANG);
        if (pageResult.success) {
            userSessionState[chatId].currentPage = pageResult.data.currentPage;
            userSessionState[chatId].lastPageContent = pageResult.data.elements;
            await sendPageData(chatId, pageResult, messageId, false);
        } else {
            bot.sendMessage(chatId, `Page failed: ${pageResult.message}`);
        }
        bot.answerCallbackQuery(query.id);
        return;
    }

    if (query.data === 'previous_page') {
        // Use stored previous page info
        const prev = previousPageData[chatId];
        if (prev && prev.currentPage && prev.buttonId) {
            const pageResult = await getPageData(session.cli, prev.currentPage, prev.buttonId, session.token, session.key, DEFAULT_LANG);
            await sendPageData(chatId, pageResult, messageId, false);
        } else {
            // Fallback to home if no previous page
            const homeResult = await getHome(DEFAULT_LANG, session.cli, session.token, session.key);
            await sendPageData(chatId, homeResult, messageId, true);
        }
        bot.answerCallbackQuery(query.id);
        return;
    }

    if (query.data === 'go_home') {
        getSessions(chatId, async (sessions) => {
            if (!Array.isArray(sessions) || sessions.length === 0) {
                bot.sendMessage(chatId, 'No session found. Please login first.');
                bot.answerCallbackQuery(query.id);
                return;
            }
            const session = sessions[sessions.length - 1];
            const homeResult = await getHome(DEFAULT_LANG, session.cli, session.token, session.key);
            if (homeResult.success) {
                userSessionState[chatId] = session;
                userSessionState[chatId].lastPageContent = homeResult.data.elements;
                await sendPageData(chatId, homeResult, messageId, true);
            } else {
                bot.sendMessage(chatId, `Home failed: ${homeResult.message}`);
            }
            bot.answerCallbackQuery(query.id);
        });
        return;
    }
});

function getPageButtons(elements) {
    return elements
        .filter(el => el.elementType === 'button' || el.elementType === 'a' || el.elementValue?.BN || el.elementValue?.EN || !el.elementType)
        .map(el => {
            // If elementValue contains a URL, create a link button
            if ((el.elementValue?.BN && /^https?:\/\//.test(el.elementValue.BN)) || (el.elementValue?.EN && /^https?:\/\//.test(el.elementValue.EN))) {
                return [{
                    text: el.displayTextBN || el.displayText || 'লিংক ভিজিট করুন',
                    url: el.elementValue.BN || el.elementValue.EN
                }];
            }
            if (el.elementType === 'a' && el.elementValue?.BN) {
                return [{ text: el.displayText || 'লিংক', url: el.elementValue.BN }];
            }
            return [{ text: el.displayText || 'বাটন', callback_data: `page_${el.elementId}` }];
        });
}

async function sendPageData(chatId, pageResult, oldMessageId = null, isHomePage = false) {
    if (pageResult.success && Array.isArray(pageResult.data?.elements)) {
        let messageText = '';
        const paragraphs = pageResult.data.elements.filter(el => el.elementType === 'paragraph');
        for (const para of paragraphs) messageText += (para.displayText || '') + '\n';
        const tables = pageResult.data.elements.filter(el => el.elementType === 'table');
        for (const table of tables) {
            let hasTableData = Array.isArray(table.tableData?.BN) && table.tableData.BN.length > 0;
            if (hasTableData && table.tableHead && table.tableData) {
                const head = Array.isArray(table.tableHead.BN) ? table.tableHead.BN : [];
                const rows = Array.isArray(table.tableData.BN) ? table.tableData.BN : [];
                if (head.length > 0) messageText += head.join(' | ') + '\n';
                for (const row of rows) messageText += row.join(' | ') + '\n';
            }
            if (table.displayTextBN) messageText += table.displayTextBN + '\n';
            else if (table.displayText) messageText += table.displayText + '\n';
        }
        const dynamicInputs = pageResult.data.elements.filter(el => el.elementType === 'dynamicInput');
        if (dynamicInputs.length > 0) {
            const input = dynamicInputs[0];
            userSessionState[chatId].awaitingInput = { ...input, inputText: null };
            bot.sendMessage(chatId, input.displayTextBN || input.displayText || 'দয়া করে আপনার স্ক্র্যাচ কার্ড এর গোপন নাম্বার গুলো টাইপ করুন');
            return;
        }
        let buttons = getPageButtons(pageResult.data.elements);
        // Add Home and Previous Page buttons except on home page
        if (!isHomePage) {
            buttons.push([
                { text: '← পূর্ববর্তী পৃষ্ঠা', callback_data: 'previous_page' },
                { text: '🏠 হোম', callback_data: 'go_home' }
            ]);
        }
        messageText += '\n' + (pageResult.data.pageHeading?.BN || 'একটি অপশন নির্বাচন করুন:');
        // Delete old message if messageId provided
        if (oldMessageId) {
            try { await bot.deleteMessage(chatId, oldMessageId); } catch (e) { /* ignore */ }
        }
        bot.sendMessage(chatId, messageText.trim(), { reply_markup: { inline_keyboard: buttons } });
    } else {
        bot.sendMessage(chatId, 'দুঃখিত, এই মুহূর্তে সার্ভিসটি দেয়া সম্ভব হচ্ছে না। অনুগ্রহ করে কিছুক্ষণ পর আবার চেষ্টা করুন। ধন্যবাদ।');
    }
}
