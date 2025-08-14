
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const log = require('npmlog');
const { DB_PATH } = require('./config');
const absDbPath = path.resolve(DB_PATH);
const db = new sqlite3.Database(absDbPath, (err) => {
    if (err) log.error('db', 'Failed to open database:', err.message);
    else log.info('db', 'Database opened');
});

// Create tables if not exist
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS sessions (
        userId TEXT,
        phone TEXT,
        token TEXT,
        key TEXT,
        cli TEXT
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS users (
        user_id TEXT PRIMARY KEY,
        username TEXT,
        full_name TEXT,
        session_data TEXT
    )`);
});

function saveSessions(userId, sessions, callback) {
    db.run('DELETE FROM sessions WHERE userId = ?', [userId], function() {
        const stmt = db.prepare('INSERT INTO sessions (userId, phone, token, key, cli) VALUES (?, ?, ?, ?, ?)');
        sessions.forEach(sess => {
            stmt.run(userId, sess.phone, sess.token, sess.key, sess.cli);
        });
        stmt.finalize(callback);
    });
}

function getSessions(userId, callback) {
    db.all('SELECT phone, token, key, cli FROM sessions WHERE userId = ?', [userId], (err, rows) => {
        if (err) return callback([]);
        callback(rows);
    });
}

function saveUser(user, sessionData = {}) {
    const fullName = [user.first_name, user.last_name].filter(Boolean).join(' ');
    db.run(
        'INSERT OR REPLACE INTO users (user_id, username, full_name, session_data) VALUES (?, ?, ?, ?)',
        [user.id.toString(), user.username || '', fullName, JSON.stringify(sessionData)],
        (err) => {
            if (err) log.error('db', `Failed to save user ${user.id}:`, err.message);
            else log.info('db', `User saved: ${user.username || ''} (${user.id})`);
        }
    );
}

function getSession(userId, cb) {
    db.get('SELECT session_data FROM users WHERE user_id = ?', [userId], (err, row) => {
        if (err) {
            log.error('db', `Failed to get session for ${userId}:`, err.message);
            return cb(null);
        }
        if (!row) {
            log.info('db', `No session found for ${userId}`);
            return cb(null);
        }
        log.info('db', `Session loaded for ${userId}`);
        cb(JSON.parse(row.session_data));
    });
}

module.exports = {
    db,
    saveUser,
    getSession,
    saveSessions,
    getSessions
};
