const Database = require('better-sqlite3');
const path = require('path');
const log = require('npmlog');
const { DB_PATH } = require('./config');

// Ensure DB_PATH is set to a file inside the /data directory
const absDbPath = path.resolve(DB_PATH.startsWith('data/') ? DB_PATH : 'data/sim-bot.db');
let db;

try {
    db = new Database(absDbPath);
    log.info('db', 'Database opened');
} catch (err) {
    log.error('db', 'Failed to open database:', err.message);
    process.exit(1);
}

// Create tables if not exist
db.prepare(`CREATE TABLE IF NOT EXISTS sessions (
    userId TEXT,
    phone TEXT,
    token TEXT,
    key TEXT,
    cli TEXT
)`).run();

db.prepare(`CREATE TABLE IF NOT EXISTS users (
    user_id TEXT PRIMARY KEY,
    username TEXT,
    full_name TEXT,
    session_data TEXT
)`).run();

function saveSessions(userId, sessions) {
    const deleteStmt = db.prepare('DELETE FROM sessions WHERE userId = ?');
    deleteStmt.run(userId);

    const insertStmt = db.prepare('INSERT INTO sessions (userId, phone, token, key, cli) VALUES (?, ?, ?, ?, ?)');
    const insertMany = db.transaction((sessions) => {
        for (const sess of sessions) {
            insertStmt.run(userId, sess.phone, sess.token, sess.key, sess.cli);
        }
    });

    insertMany(sessions);
}

function getSessions(userId) {
    const stmt = db.prepare('SELECT phone, token, key, cli FROM sessions WHERE userId = ?');
    try {
        return stmt.all(userId);
    } catch (err) {
        log.error('db', 'Failed to get sessions:', err.message);
        return [];
    }
}

function saveUser(user, sessionData = {}) {
    const fullName = [user.first_name, user.last_name].filter(Boolean).join(' ');
    const stmt = db.prepare(`
        INSERT OR REPLACE INTO users (user_id, username, full_name, session_data)
        VALUES (?, ?, ?, ?)
    `);

    try {
        stmt.run(user.id.toString(), user.username || '', fullName, JSON.stringify(sessionData));
        log.info('db', `User saved: ${user.username || ''} (${user.id})`);
    } catch (err) {
        log.error('db', `Failed to save user ${user.id}:`, err.message);
    }
}

function getSession(userId) {
    const stmt = db.prepare('SELECT session_data FROM users WHERE user_id = ?');
    try {
        const row = stmt.get(userId);
        if (!row) {
            log.info('db', `No session found for ${userId}`);
            return null;
        }
        log.info('db', `Session loaded for ${userId}`);
        return JSON.parse(row.session_data);
    } catch (err) {
        log.error('db', `Failed to get session for ${userId}:`, err.message);
        return null;
    }
}

module.exports = {
    db,
    saveUser,
    getSession,
    saveSessions,
    getSessions
};
