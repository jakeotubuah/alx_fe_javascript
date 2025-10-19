// -----------------------------
// Dynamic Quote Generator (Full Version)
// Includes Local Storage, Session Storage, Category Filtering,
// Server Sync, Conflict Handling, Alerts, and JSON Import/Export
// -----------------------------

let quotes = [];
const quoteDisplay = document.getElementById("quoteDisplay");
const newQuoteBtn = document.getElementById("newQuote");
const exportBtn = document.getElementById("exportQuotes");
const importInput = document.getElementById("importQuotes");

let syncInterval = null;
let lastSyncTime = null;

// -----------------------------
// Local & Session Storage
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
      { id: 1, text: "The best way to get started is to quit talking and begin doing.", category: "Motivation" },
      { id: 2, text: "In the middle of every difficulty lies opportunity.", category: "Inspiration" },
      { id: 3, text: "Strive not to be a success, but rather to be of value.", category: "Wisdom" },
    ];
    saveQuotesToLocalStorage();
  }
}

// -----------------------------
// Category Management
// -----------------------------
function getUniqueCategories() {
  return [...new Set(quotes.map(q => q.category))];
}

function populateCategories() {
  let categoryFilter = document.getElementById("categoryFilter");

  if (!categoryFilter) {
    categoryFilter = document.createElement("select");
    categoryFilter.id = "categoryFilter";
    categoryFilter.style.marginTop = "20px";
    categoryFilter.style.marginLeft = "10px";

    const label = document.createElement("label");
    label.textContent = "Filter by Category: ";
    label.setAttribute("for", "categoryFilter");

    document.body.insertBefore(label, newQuoteBtn.nextSibling);
    document.body.insertBefore(categoryFilter, label.nextSibling);

    categoryFilter.addEventListener("change", () => {
      const selectedCategory = categoryFilter.value;
      localStorage.setItem("selectedCategory", selectedCategory);
      filterQuotes(selectedCategory);
    });
  }

  categoryFilter.innerHTML = "";
  const defaultOption = document.createElement("option");
  defaultOption.value = "All";
  defaultOption.textContent = "All";
  categoryFilter.appendChild(defaultOption);

  getUniqueCategories().forEach(cat => {
    const option = document.createElement("option");
    option.value = cat;
    option.textContent = cat;
    categoryFilter.appendChild(option);
  });

  const savedCategory = localStorage.getItem("selectedCategory");
  categoryFilter.value = savedCategory || "All";
}

// -----------------------------
// Quote Display & Filtering
// -----------------------------
function filterQuotes(category) {
  let filtered = category === "All" ? quotes : quotes.filter(q => q.category === category);
  if (filtered.length === 0) {
    quoteDisplay.innerHTML = `<p>No quotes found for category: <strong>${category}</strong></p>`;
    return;
  }
  const randomQuote = filtered[Math.floor(Math.random() * filtered.length)];
  quoteDisplay.innerHTML = `
    <p><strong>Quote:</strong> "${randomQuote.text}"</p>
    <p><em>Category:</em> ${randomQuote.category}</p>
  `;
  sessionStorage.setItem("lastQuote", JSON.stringify(randomQuote));
}

function showRandomQuote() {
  const categoryFilter = document.getElementById("categoryFilter");
  const category = categoryFilter ? categoryFilter.value : "All";
  filterQuotes(category);
}

// -----------------------------
// Add New Quote Form
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

  form.addEventListener("submit", e => {
    e.preventDefault();
    const text = quoteInput.value.trim();
    const category = categoryInput.value.trim();
    if (text && category) {
      const newQuote = { id: Date.now(), text, category };
      quotes.push(newQuote);
      saveQuotesToLocalStorage();
      populateCategories();
      quoteDisplay.innerHTML = `<p><strong>New Quote Added:</strong> "${text}"</p><p><em>Category:</em> ${category}</p>`;
      simulatePostToServer(newQuote);
    }
    quoteInput.value = "";
    categoryInput.value = "";
  });
}

// -----------------------------
// JSON Import/Export
// -----------------------------
function exportQuotes() {
  const jsonData = JSON.stringify(quotes, null, 2);
  const blob = new Blob([jsonData], { type: "application/json" }); // ✅ Blob used here
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement("a");
  a.href = url;
  a.download = "quotes.json";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function importQuotes(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = e => {
    try {
      const importedQuotes = JSON.parse(e.target.result);
      if (Array.isArray(importedQuotes)) {
        quotes = [...quotes, ...importedQuotes];
        saveQuotesToLocalStorage();
        populateCategories();
        showNotification("✅ Quotes imported successfully!");
      } else {
        showNotification("⚠️ Invalid JSON format.");
      }
    } catch {
      showNotification("⚠️ Failed to import quotes.");
    }
  };
  reader.readAsText(file);
}

// -----------------------------
// Server Simulation
// -----------------------------
async function fetchQuotesFromServer() {
  try {
    const response = await fetch("https://jsonplaceholder.typicode.com/posts?_limit=5");
    const data = await response.json();
    const serverQuotes = data.map(item => ({
      id: item.id,
      text: item.title,
      category: "Server"
    }));
    return serverQuotes;
  } catch (error) {
    console.error("Server fetch failed:", error);
    return [];
  }
}

async function simulatePostToServer(quote) {
  try {
    await fetch("https://jsonplaceholder.typicode.com/posts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(quote)
    });
    console.log("Quote synced with server:", quote);
  } catch (error) {
    console.error("Failed to sync with server:", error);
  }
}

// -----------------------------
// Sync and Conflict Handling
// -----------------------------
async function syncQuotes() {
  const serverQuotes = await fetchQuotesFromServer();
  if (serverQuotes.length === 0) {
    showNotification("⚠️ No data fetched from server. Using local data only.");
    return;
  }

  const merged = [...quotes];
  const localIds = quotes.map(q => q.id);

  serverQuotes.forEach(serverQuote => {
    const index = merged.findIndex(q => q.id === serverQuote.id);
    if (index >= 0) {
      merged[index] = serverQuote;
      showNotification("⚠️ Conflict resolved: Server quote replaced local version.");
    } else {
      merged.push(serverQuote);
    }
  });

  quotes = merged;
  saveQuotesToLocalStorage();
  populateCategories();
  lastSyncTime = new Date().toLocaleTimeString();

  showNotification(`✅ Quotes synced with server at ${lastSyncTime}`);
  alert("Quotes synced with server!"); // ✅ Added alert
}

// Periodic sync wrapper
function startPeriodicSync() {
  syncQuotes(); // Run once at start
  syncInterval = setInterval(syncQuotes, 30000); // every 30 seconds
}

// -----------------------------
// Notifications
// -----------------------------
function showNotification(message) {
  let note = document.getElementById("notification");
  if (!note) {
    note = document.createElement("div");
    note.id = "notification";
    note.style.background = "#f0f8ff";
    note.style.border = "1px solid #ccc";
    note.style.padding = "10px";
    note.style.marginTop = "15px";
    note.style.borderRadius = "8px";
    document.body.insertBefore(note, quoteDisplay);
  }
  note.textContent = message;
}

// -----------------------------
// Initialization
// -----------------------------
function init() {
  loadQuotesFromLocalStorage();
  populateCategories();
  createAddQuoteForm();
  newQuoteBtn.addEventListener("click", showRandomQuote);
  showRandomQuote();

  // Manual sync button
  const syncBtn = document.createElement("button");
  syncBtn.textContent = "Sync Now";
  syncBtn.style.marginLeft = "10px";
  syncBtn.addEventListener("click", syncQuotes);
  document.body.insertBefore(syncBtn, newQuoteBtn.nextSibling);

  // JSON Export / Import
  exportBtn.addEventListener("click", exportQuotes);
  importInput.addEventListener("change", importQuotes);

  startPeriodicSync();
}

init();
