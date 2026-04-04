const db = require('better-sqlite3')('./dev.db');
console.log('Tables:', db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all());
db.close();
