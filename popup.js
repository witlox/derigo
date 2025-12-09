const categories = ["Extreme Left", "Extreme Right", "Ambiguous", "Echo Chamber", "Populist", "Anarchist", "Neutral"];
const blockedCategories = JSON.parse(localStorage.getItem("blockedCategories")) || [];

// Display categories with checkboxes
const categoriesDiv = document.getElementById("categories");
categories.forEach(category => {
  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.id = category;
  checkbox.checked = blockedCategories.includes(category);
  checkbox.addEventListener("change", () => {
    if (checkbox.checked) {
      blockedCategories.push(category);
    } else {
      const index = blockedCategories.indexOf(category);
      if (index > -1) blockedCategories.splice(index, 1);
    }
    localStorage.setItem("blockedCategories", JSON.stringify(blockedCategories));
  });

  const label = document.createElement("label");
  label.htmlFor = category;
  label.innerText = category;

  categoriesDiv.appendChild(checkbox);
  categoriesDiv.appendChild(label);
  categoriesDiv.appendChild(document.createElement("br"));
});

// Update category display
chrome.runtime.onMessage.addListener((message) => {
  if (message.action === "contentCategorized") {
    document.getElementById("category").innerText = `Content Category: ${message.category}`;
  }
});
