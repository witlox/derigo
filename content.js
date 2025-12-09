const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('classification.db');
const blockedCategories = JSON.parse(localStorage.getItem("blockedCategories")) || [];

// Function to analyze content and categorize it
function analyzeContent() {
  const content = document.body.innerText.toLowerCase();
  const scores = {};

  // Query database for keywords and calculate scores
  db.serialize(() => {
    db.each(`
      SELECT c.name AS category, k.keyword, k.weight
      FROM keywords k
      JOIN categories c ON k.category_id = c.id
    `, (err, row) => {
      if (err) {
        console.error(err);
        return;
      }

      if (content.includes(row.keyword)) {
        scores[row.category] = (scores[row.category] || 0) + row.weight;
      }
    }, () => {
      // Determine the category with the highest score
      let category = "Neutral";
      let maxScore = 0;
      Object.entries(scores).forEach(([cat, score]) => {
        if (score > maxScore) {
          maxScore = score;
          category = cat;
        }
      });

      // Block content if it matches a blocked category
      if (blockedCategories.includes(category)) {
        document.body.innerHTML = `<h1>Blocked Content</h1><p>This content has been blocked due to its category: ${category}</p>`;
      } else {
        console.log(`Content categorized as: ${category}`);
      }

      // Send the category to the popup
      chrome.runtime.sendMessage({ action: "contentCategorized", category });
    });
  });
}

analyzeContent();
