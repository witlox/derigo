const categories = ["Extreme Left", "Extreme Right", "Ambiguous", "Echo Chamber", "Populist", "Anarchist", "Neutral"];
const blockedCategories = JSON.parse(localStorage.getItem("blockedCategories")) || [];

// Function to analyze content and categorize it
function analyzeContent() {
  const content = document.body.innerText.toLowerCase();
  let category = "Neutral";

  if (content.includes("revolution") || content.includes("anarchy")) {
    category = "Anarchist";
  } else if (content.includes("freedom") && content.includes("rights")) {
    category = "Populist";
  } else if (content.includes("leftist") || content.includes("socialism")) {
    category = "Extreme Left";
  } else if (content.includes("conservative") || content.includes("capitalism")) {
    category = "Extreme Right";
  } else if (content.includes("echo chamber")) {
    category = "Echo Chamber";
  }

  if (blockedCategories.includes(category)) {
    document.body.innerHTML = `<h1>Blocked Content</h1><p>This content has been blocked due to its category: ${category}</p>`;
  } else {
    console.log(`Content categorized as: ${category}`);
  }

  return category;
}

// Send the category to the popup
chrome.runtime.sendMessage({ action: "contentCategorized", category: analyzeContent() });
