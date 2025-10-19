// -----------------------------
//  Dynamic Quote Generator with Filtering
// -----------------------------

let quotes = [];
const quoteDisplay = document.getElementById("quoteDisplay");
const newQuoteBtn = document.getElementById("newQuote");

// -----------------------------
//  Web Storage Utilities
// -----------------------------

function saveQuotesToLocalStorage() {
  localStorage.setItem("quotes", JSON.stringify(quotes));
}

function loadQuotesFromLocalStorage() {
  const storedQuotes = localStorage.getItem("quotes");
  if (storedQuotes) {
    quotes = JSON.parse(storedQuotes);
  } else {
    quotes = [
      { text: "The best way to get started is to quit talking and begin doing.", category: "Motivation" },
      { text: "In the middle of every difficulty lies opportunity.", category: "Inspiration" },
      { text: "Strive not to be a success, but rather to be of value.", category: "Wisdom" },
      { text: "Your limitation—it's only your imagination.", category: "Motivation" },
    ];
    saveQuotesToLocalStorage();
  }
}

// -----------------------------
//  Category Management
// -----------------------------

function getUniqueCategories() {
  const categories = quotes.map(q => q.category);
  return [...new Set(categories)];
}

function populateCategories() {
  let categoryFilter = document.getElementById("categoryFilter");

  // If dropdown doesn't exist yet, create it
  if (!categoryFilter) {
    categoryFilter = document.createElement("select");
    categoryFilter.id = "categoryFilter";
    categoryFilter.style.marginTop = "20px";
    categoryFilter.style.marginLeft = "10px";

    // Label
    const label = document.createElement("label");
    label.textContent = "Filter by Category: ";
    label.setAttribute("for", "categoryFilter");

    document.body.insertBefore(label, newQuoteBtn.nextSibling);
    document.body.insertBefore(categoryFilter, label.nextSibling);

    // Add event listener
    categoryFilter.addEventListener("change", () => {
      const selectedCategory = categoryFilter.value;
      localStorage.setItem("selectedCategory", selectedCategory);
      filterQuotes(selectedCategory);
    });
  }

  // Clear existing options
  categoryFilter.innerHTML = "";

  // Add default "All" option
  const defaultOption = document.createElement("option");
  defaultOption.value = "All";
  defaultOption.textContent = "All";
  categoryFilter.appendChild(defaultOption);

  // Add unique categories
  getUniqueCategories().forEach(cat => {
    const option = document.createElement("option");
    option.value = cat;
    option.textContent = cat;
    categoryFilter.appendChild(option);
  });

  // Restore last selected filter
  const savedCategory = localStorage.getItem("selectedCategory");
  if (savedCategory) {
    categoryFilter.value = savedCategory;
    filterQuotes(savedCategory);
  } else {
    categoryFilter.value = "All";
  }
}

// -----------------------------
//  Filtering Logic
// -----------------------------

function filterQuotes(category) {
  let filteredQuotes = [];
  if (category === "All" || !category) {
    filteredQuotes = quotes;
  } else {
    filteredQuotes = quotes.filter(q => q.category === category);
  }

  if (filteredQuotes.length === 0) {
    quoteDisplay.innerHTML = `<p>No quotes found for category: <strong>${category}</strong></p>`;
    return;
  }

  const randomQuote = filteredQuotes[Math.floor(Math.random() * filteredQuotes.length)];
  quoteDisplay.innerHTML = `
    <p><strong>Quote:</strong> "${randomQuote.text}"</p>
    <p><em>Category:</em> ${randomQuote.category}</p>
  `;

  // Save last viewed quote for the session
  sessionStorage.setItem("lastQuote", JSON.stringify(randomQuote));
}

// -----------------------------
//  Show Random Quote (Unfiltered)
// -----------------------------

function showRandomQuote() {
  const categoryFilter = document.getElementById("categoryFilter");
  const currentCategory = categoryFilter ? categoryFilter.value : "All";
  filterQuotes(currentCategory);
}

// -----------------------------
//  Add New Quote Form
// -----------------------------

function createAddQuoteForm() {
  const form = document.createElement("form");
  form.id = "addQuoteForm";
  form.style.marginTop = "20px";

  const quoteInput = document.createElement("input");
  quoteInput.type = "text";
  quoteInput.placeholder = "Enter your quote...";
  quoteInput.required = true;
  quoteInput.style.width = "300px";

  const categoryInput = document.createElement("input");
  categoryInput.type = "text";
  categoryInput.placeholder = "Category...";
  categoryInput.required = true;
  categoryInput.style.marginLeft = "10px";

  const submitBtn = document.createElement("button");
  submitBtn.type = "submit";
  submitBtn.textContent = "Add Quote";
  submitBtn.style.marginLeft = "10px";

  form.append(quoteInput, categoryInput, submitBtn);
  document.body.appendChild(form);

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const text = quoteInput.value.trim();
    const category = categoryInput.value.trim();
    if (text && category) {
      quotes.push({ text, category });
      saveQuotesToLocalStorage();
      populateCategories(); // refresh dropdown if new category introduced

      quoteInput.value = "";
      categoryInput.value = "";

      quoteDisplay.innerHTML = `
        <p><strong>New Quote Added:</strong> "${text}"</p>
        <p><em>Category:</em> ${category}</p>
      `;
    }
  });
}

// -----------------------------
//  JSON Import / Export Controls
// -----------------------------

function createJSONControls() {
  const container = document.createElement("div");
  container.style.marginTop = "30px";

  const exportBtn = document.createElement("button");
  exportBtn.textContent = "Export Quotes (JSON)";
  exportBtn.style.marginRight = "10px";

  exportBtn.addEventListener("click", () => {
    const blob = new Blob([JSON.stringify(quotes, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "quotes.json";
    a.click();
    URL.revokeObjectURL(url);
  });

  const importInput = document.createElement("input");
  importInput.type = "file";
  importInput.accept = "application/json";

  importInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const importedQuotes = JSON.parse(event.target.result);
        if (Array.isArray(importedQuotes)) {
          quotes = importedQuotes;
          saveQuotesToLocalStorage();
          populateCategories();
          quoteDisplay.innerHTML = `<p>✅ Successfully imported ${importedQuotes.length} quotes!</p>`;
        } else {
          quoteDisplay.innerHTML = `<p>❌ Invalid JSON format. Expected an array of quotes.</p>`;
        }
      } catch {
        quoteDisplay.innerHTML = `<p>❌ Error reading JSON file.</p>`;
      }
    };
    reader.readAsText(file);
  });

  container.append(exportBtn, importInput);
  document.body.appendChild(container);
}

// -----------------------------
//  Initialization
// -----------------------------

function init() {
  loadQuotesFromLocalStorage();
  populateCategories();
  createAddQuoteForm();
  createJSONControls();

  newQuoteBtn.addEventListener("click", showRandomQuote);

  // Load last viewed quote from session if exists
  const lastQuote = sessionStorage.getItem("lastQuote");
  if (lastQuote) {
    const { text, category } = JSON.parse(lastQuote);
    quoteDisplay.innerHTML = `
      <p><strong>Last Viewed Quote:</strong> "${text}"</p>
      <p><em>Category:</em> ${category}</p>
    `;
  } else {
    showRandomQuote();
  }
}

init();
