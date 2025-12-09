const sqlite3 = require('sqlite3').verbose();

// Initialize SQLite database
const db = new sqlite3.Database('classification.db');

// Create table for categories and keywords
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS keywords (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category_id INTEGER NOT NULL,
      keyword TEXT NOT NULL,
      weight INTEGER NOT NULL,
      FOREIGN KEY (category_id) REFERENCES categories (id)
    )
  `);

  // Insert categories and keywords
  const categories = [
    { name: "Extreme Left", keywords: [{ word: "socialism", weight: 2 }, { word: "marx", weight: 2 }] },
    { name: "Extreme Right", keywords: [{ word: "capitalism", weight: 2 }, { word: "fascism", weight: 2 }] },
    { name: "Populist", keywords: [{ word: "freedom", weight: 1 }, { word: "rights", weight: 1 }] },
    { name: "Anarchist", keywords: [{ word: "revolution", weight: 3 }, { word: "anarchy", weight: 3 }] },
    { name: "Echo Chamber", keywords: [{ word: "bias", weight: 1 }, { word: "filter bubble", weight: 1 }] },
    { name: "Ambiguous", keywords: [{ word: "neutral", weight: 1 }, { word: "vague", weight: 1 }] }
  ];

  const insertCategory = db.prepare("INSERT OR IGNORE INTO categories (name) VALUES (?)");
  const insertKeyword = db.prepare("INSERT INTO keywords (category_id, keyword, weight) VALUES (?, ?, ?)");

  categories.forEach(category => {
    insertCategory.run(category.name, function () {
      const categoryId = this.lastID;
      category.keywords.forEach(({ word, weight }) => {
        insertKeyword.run(categoryId, word, weight);
      });
    });
  });

  insertCategory.finalize();
  insertKeyword.finalize();
});

db.close();
