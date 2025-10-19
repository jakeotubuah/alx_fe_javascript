// -----------------------------
//  Dynamic Quote Generator
// -----------------------------

// --- Global Variables ---
let quotes = [];
const quoteDisplay = document.getElementById("quoteDisplay");
const newQuoteBtn = document.getElementById("newQuote");

// -----------------------------
//  Local & Session Storage Utilities
// -----------------------------

function saveQuotesToLocalStorage() {
  localStorage.setItem("quotes", JSON.stringify(quotes));
}

function loadQuotesFromLocalStorage() {
  const storedQuotes = localStorage.getItem("quotes");
  if (storedQuotes) {
    quotes = JSON.parse(storedQuotes);
  } else {
    // Default quotes if none stored
    quotes = [
      { text: "The best way to get started is to quit talking and begin doing.", category: "Motivation" },
      { text: "In the middle of every difficulty lies opportunity.", category: "Inspiration" },
      { text: "Strive not to be a success, but rather to be of value.", category: "Wisdom" },
    ];
    saveQuotesToLocalStorage();
  }
}

// -----------------------------
//  Quote Display Functions
// -----------------------------

function showRandomQuote() {
  if (quotes.length === 0) return;

  const randomIndex = Math.floor(Math.random() * quotes.length);
  const { text, category } = quotes[randomIndex];

  quoteDisplay.innerHTML = `
    <p><strong>Quote:</strong> "${text}"</p>
    <p><em>Category:</em> ${category}</p>
  `;

  // Save last viewed quote to session storage
  sessionStorage.setItem("lastQuote", JSON.stringify(quotes[randomIndex]));
}

function showLastViewedQuote() {
  const lastQuote = sessionStorage.getItem("lastQuote");
  if (lastQuote) {
    const { text, category } = JSON.parse(lastQuote);
    quoteDisplay.innerHTML = `
      <p><strong>Last Viewed Quote:</strong> "${text}"</p>
      <p><em>Category:</em> ${category}</p>
    `;
  }
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
//  JSON Import / Export
// -----------------------------

function createJSONControls() {
  const container = document.createElement("div");
  container.style.marginTop = "30px";

  // --- Export Button ---
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

  // --- Import Input ---
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
          quoteDisplay.innerHTML = `<p>✅ Successfully imported ${importedQuotes.length} quotes!</p>`;
        } else {
          quoteDisplay.innerHTML = `<p>❌ Invalid JSON structure. Expected an array of quotes.</p>`;
        }
      } catch (err) {
        quoteDisplay.innerHTML = `<p>❌ Error parsing JSON file.</p>`;
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

loadQuotesFromLocalStorage();
showLastViewedQuote();
createAddQuoteForm();
createJSONControls();

newQuoteBtn.addEventListener("click", showRandomQuote);
