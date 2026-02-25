const Database = require('better-sqlite3');
const db = new Database('pivot.db');
console.log('Database connected!');
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
console.log('Tables:', tables);
db.close();
