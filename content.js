const categories = ["Extreme Left", "Extreme Right", "Ambiguous", "Echo Chamber", "Populist", "Anarchist", "Neutral"];
const blockedCategories = JSON.parse(localStorage.getItem("blockedCategories")) || [];

// Define keywords and weights for each category
const categoryKeywords = {
  "Extreme Left": { keywords: ["leftist", "socialism", "marx"], weight: 2 },
  "Extreme Right": { keywords: ["conservative", "capitalism", "fascism"], weight: 2 },
  "Populist": { keywords: ["freedom", "rights", "people"], weight: 1 },
  "Anarchist": { keywords: ["revolution", "anarchy", "chaos"], weight: 3 },
  "Echo Chamber": { keywords: ["echo chamber", "bias", "filter bubble"], weight: 1 },
  "Ambiguous": { keywords: ["unclear", "vague", "neutral"], weight: 1 }
};

// Function to analyze content and categorize it
function analyzeContent() {
  const content = document.body.innerText.toLowerCase();
  const scores = {};

  // Initialize scores for each category
  Object.keys(categoryKeywords).forEach(category => {
    scores[category] = 0;
  });

  // Calculate scores based on keyword matches
  Object.entries(categoryKeywords).forEach(([category, { keywords, weight }]) => {
    keywords.forEach(keyword => {
      if (content.includes(keyword)) {
        scores[category] += weight;
      }
    });
  });

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

  return category;
}

// Send the category to the popup
chrome.runtime.sendMessage({ action: "contentCategorized", category: analyzeContent() });
