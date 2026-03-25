


const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');

const DB_PATH = path.resolve(__dirname, '../../database/renteasy.db');
const SCHEMA_PATH = path.resolve(__dirname, '../../database/schema.sqlite.sql');
const SEED_PATH = path.resolve(__dirname, '../../database/seed.sqlite.sql');

let _db = null;


function saveDb() {
    const data = _db.export();
    fs.writeFileSync(DB_PATH, Buffer.from(data));
}


function stmtToRows(stmt) {
    const rows = [];
    while (stmt.step()) {
        rows.push(stmt.getAsObject());
    }
    stmt.free();
    return rows;
}


const ready = (async () => {
    const SQL = await initSqlJs();

    if (fs.existsSync(DB_PATH)) {
        _db = new SQL.Database(fs.readFileSync(DB_PATH));
        console.log('[DB] SQLite database loaded:', DB_PATH);
    } else {
        _db = new SQL.Database();


console.log('[DB] Initialising database schema...');
        _db.exec(fs.readFileSync(SCHEMA_PATH, 'utf8'));
        console.log('[DB] Schema created.');


console.log('[DB] Seeding sample data...');
        _db.exec(fs.readFileSync(SEED_PATH, 'utf8'));
        console.log('[DB] Seed data inserted.');

        saveDb();
    }


try {
        _db.run('ALTER TABLE payments ADD COLUMN mpesa_checkout_id TEXT');
        console.log('[DB] Migration: mpesa_checkout_id added to payments.');
        saveDb();
    } catch (_) {  }

    try {
        _db.run('ALTER TABLE properties ADD COLUMN total_rooms INTEGER DEFAULT 1');
        console.log('[DB] Migration: total_rooms added to properties.');
        saveDb();
    } catch (_) {  }


_db.run('PRAGMA foreign_keys = ON');
    console.log('[DB] SQLite ready.');
})();


const db = {
    async execute(sql, params = []) {
        await ready;       

        try {
            const upper = sql.trimStart().toUpperCase();

            if (upper.startsWith('SELECT') || upper.startsWith('WITH')) {
                const stmt = _db.prepare(sql);
                if (params.length) stmt.bind(params);
                const rows = stmtToRows(stmt);
                return [rows];
            } else {
                _db.run(sql, params);

                const idRes = _db.exec('SELECT last_insert_rowid()');
                const chgRes = _db.exec('SELECT changes()');
                const insertId = idRes[0]?.values[0][0] ?? 0;
                const affectedRows = chgRes[0]?.values[0][0] ?? 0;

                saveDb();   
                return [{ insertId, affectedRows }];
            }
        } catch (err) {
            throw err;
        }
    },

    query(sql, params = []) {
        return this.execute(sql, params);
    }
};

module.exports = db;
