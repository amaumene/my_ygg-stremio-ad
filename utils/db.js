const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Initialize the database
const db = new sqlite3.Database(path.join('/data', 'streams.db'));

// Create the tables if they don't exist
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS tmdb_cache (
      imdb_id TEXT PRIMARY KEY,
      type TEXT,
      title TEXT,
      french_title TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS magnets (
      id TEXT PRIMARY KEY NOT NULL,
      hash TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      added_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
});

// Retrieve TMDB data from the cache
function getCachedTmdb(imdbId) {
  return new Promise((resolve, reject) => {
    db.get(
      `SELECT type, title, french_title FROM tmdb_cache WHERE imdb_id = ?`,
      [imdbId],
      (err, row) => {
        if (err) {
          return reject(err);
        }
        resolve(row || null);
      }
    );
  });
}

// Store TMDB data in the cache
function storeTmdb(imdbId, type, title, frenchTitle) {
  return new Promise((resolve, reject) => {
    db.run(
      `INSERT OR REPLACE INTO tmdb_cache (imdb_id, type, title, french_title) VALUES (?, ?, ?, ?)`,
      [imdbId, type, title, frenchTitle],
      function (err) {
        if (err) {
          return reject(err);
        }
        resolve();
      }
    );
  });
}

// Store a magnet
function storeMagnet(id, hash, name) {
  return new Promise((resolve, reject) => {
    if (!id || !hash || !name) {
      return reject(new Error('id, hash, and name must not be null or empty'));
    }
    db.run(
      `INSERT OR REPLACE INTO magnets (id, hash, name, added_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)`,
      [id, hash, name],
      function (err) {
        if (err) return reject(err);
        resolve();
      }
    );
  });
}

// Get all magnets sorted by oldest first
function getAllMagnets() {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT * FROM magnets ORDER BY added_at ASC`,
      [],
      (err, rows) => {
        if (err) return reject(err);
        resolve(rows);
      }
    );
  });
}

// Delete a magnet by id
function deleteMagnet(id) {
  return new Promise((resolve, reject) => {
    db.run(
      `DELETE FROM magnets WHERE id = ?`,
      [id],
      function (err) {
        if (err) return reject(err);
        resolve();
      }
    );
  });
}

module.exports = {
  db,
  getCachedTmdb,
  storeTmdb,
  storeMagnet,
  getAllMagnets,
  deleteMagnet
};
