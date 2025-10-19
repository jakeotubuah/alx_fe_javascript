// -----------------------------
// Dynamic Quote Generator with Server Sync & Conflict Handling
// -----------------------------
// Drop this into your HTML page (same page that has #quoteDisplay and #newQuote).
// -----------------------------

// -----------------------------
// Config
// -----------------------------
const SERVER_URL = "https://jsonplaceholder.typicode.com/posts"; // example mock API
const SYNC_INTERVAL_MS = 15_000; // poll server every 15 seconds
const SERVER_WINS_BY_DEFAULT = true; // default conflict policy

// -----------------------------
// Utilities
// -----------------------------
function uid() {
  // simple unique id generator (not cryptographically secure)
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
}

function nowISO() {
  return new Date().toISOString();
}

function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

// -----------------------------
// App state & DOM refs
// -----------------------------
let quotes = []; // each quote: { id, text, category, lastModified (ISO), pendingSync?: boolean }
const quoteDisplay = document.getElementById("quoteDisplay");
const newQuoteBtn = document.getElementById("newQuote");

// UI container for notifications/conflicts
let notificationContainer;
let conflictContainer;

// -----------------------------
// Local Storage Utilities
// -----------------------------
function saveQuotesToLocalStorage() {
  localStorage.setItem("quotes", JSON.stringify(quotes));
}

function loadQuotesFromLocalStorage() {
  const stored = localStorage.getItem("quotes");
  if (stored) {
    try {
      quotes = JSON.parse(stored);
      // Ensure structure: add ids/timestamps if missing
      quotes = quotes.map(q => ({
        id: q.id || uid(),
        text: q.text || "",
        category: q.category || "Uncategorized",
        lastModified: q.lastModified || nowISO(),
        pendingSync: q.pendingSync || false,
      }));
      return;
    } catch (e) {
      console.warn("Failed to parse stored quotes, will reinitialize.", e);
    }
  }
  // default quotes if none
  quotes = [
    { id: uid(), text: "The best way to get started is to quit talking and begin doing.", category: "Motivation", lastModified: nowISO(), pendingSync: false },
    { id: uid(), text: "In the middle of every difficulty lies opportunity.", category: "Inspiration", lastModified: nowISO(), pendingSync: false },
    { id: uid(), text: "Strive not to be a success, but rather to be of value.", category: "Wisdom", lastModified: nowISO(), pendingSync: false },
  ];
  saveQuotesToLocalStorage();
}

// -----------------------------
// Simulated Server (fallback)
// -----------------------------
// This in-memory store simulates server fetch/post behavior for testing
const simulatedServer = {
  store: [],
  initFromLocal(localQuotes) {
    // seed simulated server with local quotes if empty
    if (this.store.length === 0) {
      this.store = localQuotes.map(q => ({
        id: q.id,
        text: q.text,
        category: q.category,
        lastModified: q.lastModified,
      }));
    }
  },
  async fetchQuotes() {
    // simulate network delay
    await new Promise(r => setTimeout(r, 300));
    return deepClone(this.store);
  },
  async postQuote(q) {
    await new Promise(r => setTimeout(r, 300));
    // if id already exists, treat as update
    const idx = this.store.findIndex(s => s.id === q.id);
    if (idx >= 0) {
      this.store[idx] = { id: q.id, text: q.text, category: q.category, lastModified: q.lastModified };
    } else {
      // create
      this.store.push({ id: q.id, text: q.text, category: q.category, lastModified: q.lastModified });
    }
    return { ...q };
  }
};

// -----------------------------
// Server Interaction Helpers
// -----------------------------
async function fetchServerQuotes() {
  // Try real server first
  try {
    const resp = await fetch(SERVER_URL + "?_limit=100"); // try to limit
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();

    // JSONPlaceholder returns posts with { id, title, body, userId }.
    // We'll map those to our quote model for demonstration.
    const mapped = data.map(item => {
      // Use item.id if numeric; but to avoid collisions unify as string.
      return {
        id: item.id ? String(item.id) : uid(),
        text: item.body ? item.body : (item.title || "Untitled"),
        category: item.userId ? `User-${item.userId}` : "Import",
        lastModified: nowISO(),
      };
    });

    return mapped;
  } catch (err) {
    // fallback to simulated server
    console.warn("Fetch to remote server failed; using simulated server.", err);
    simulatedServer.initFromLocal(quotes);
    return simulatedServer.fetchQuotes();
  }
}

async function postQuoteToServer(quote) {
  // Try real server POST
  try {
    const resp = await fetch(SERVER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: quote.text.slice(0, 50),
        body: quote.text,
        userId: quote.category,
      }),
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();
    // JSONPlaceholder returns id; we won't rely on it to maintain identity.
    return { ok: true, serverResponse: data };
  } catch (err) {
    // fallback to simulated server post
    try {
      const posted = await simulatedServer.postQuote(quote);
      return { ok: true, serverResponse: posted };
    } catch (e) {
      console.error("Failed to post to simulated server", e);
      return { ok: false, error: e };
    }
  }
}

// -----------------------------
// Sync & Conflict Logic
// -----------------------------
/*
 Strategy:
  - Periodically fetch server quotes.
  - Compare server data with local quotes using 'id'.
  - If a server item exists and local doesn't -> add server item locally (server wins).
  - If both exist and lastModified differs:
      * default: server wins (overwrite local fields with server's).
      * but record the conflict payload so user can manually resolve (option).
  - For local-only quotes (no server id), attempt to POST them (mark pendingSync true until success).
*/

let pendingConflicts = []; // array of { id, local, server }

async function syncWithServer() {
  try {
    const serverQuotes = await fetchServerQuotes();

    // Build index maps
    const localMap = new Map(quotes.map(q => [String(q.id), q]));
    const serverMap = new Map(serverQuotes.map(s => [String(s.id), s]));

    const newLocal = []; // items to add from server
    const conflicts = [];

    // 1) Merge server items into local
    for (const [sid, serverItem] of serverMap) {
      const localItem = localMap.get(sid);
      if (!localItem) {
        // server has new item -> add locally
        newLocal.push({
          id: String(serverItem.id),
          text: serverItem.text,
          category: serverItem.category,
          lastModified: serverItem.lastModified || nowISO(),
          pendingSync: false,
        });
      } else {
        // both exist; check lastModified
        const localLM = new Date(localItem.lastModified).getTime();
        const serverLM = serverItem.lastModified ? new Date(serverItem.lastModified).getTime() : Date.now();

        if (localLM !== serverLM && localItem.text !== serverItem.text) {
          // conflict detected
          conflicts.push({
            id: sid,
            local: deepClone(localItem),
            server: deepClone({ ...serverItem, id: sid, lastModified: serverItem.lastModified || nowISO() }),
          });

          // APPLY server-wins default
          if (SERVER_WINS_BY_DEFAULT) {
            localMap.set(sid, {
              id: sid,
              text: serverItem.text,
              category: serverItem.category,
              lastModified: serverItem.lastModified || nowISO(),
              pendingSync: false,
            });
          }
        }
      }
    }

    // 2) Add server-only items
    for (const item of newLocal) {
      localMap.set(String(item.id), item);
    }

    // 3) Convert localMap back to array
    const merged = Array.from(localMap.values());

    // 4) Attempt to push local-only quotes to server
    const localOnly = merged.filter(l => {
      // consider pendingSync true OR id that doesn't appear numeric (we still attempt)
      const existsOnServer = serverMap.has(String(l.id));
      return !existsOnServer && l.pendingSync !== false;
    });

    // But also attempt to post any items that are pendingSync === true
    const pendingToPost = merged.filter(l => l.pendingSync === true || !serverMap.has(String(l.id)));

    // Post them sequentially to avoid overwhelming
    for (const lq of pendingToPost) {
      const postResult = await postQuoteToServer(lq);
      if (postResult.ok) {
        lq.pendingSync = false;
        // don't change id (we keep local id). If a real backend returned a canonical id you
        // might want to map it here.
      } else {
        lq.pendingSync = true; // still pending
      }
    }

    // Save merged data
    quotes = merged;
    saveQuotesToLocalStorage();

    // Handle conflicts
    if (conflicts.length > 0) {
      pendingConflicts = conflicts;
      notifyUser(`${conflicts.length} conflict(s) detected. Server changes applied. You can manually review/resolution.`, true);
      showConflictPanel();
    } else {
      // only notify if new server items arrived
      if (newLocal.length > 0) {
        notifyUser(`${newLocal.length} new quote(s) synced from server.`, false);
      }
    }
    // refresh categories and display according to saved filter
    populateCategories();
    const categoryFilter = document.getElementById("categoryFilter");
    const currentCategory = categoryFilter ? categoryFilter.value : "All";
    filterQuotes(currentCategory);
  } catch (err) {
    console.error("Sync failed:", err);
    notifyUser("Sync attempt failed (network error). Will retry.", false);
  }
}

// -----------------------------
// Conflict UI & Manual Resolve
// -----------------------------
function ensureNotificationUI() {
  if (!notificationContainer) {
    notificationContainer = document.createElement("div");
    notificationContainer.id = "notificationContainer";
    notificationContainer.style.position = "fixed";
    notificationContainer.style.bottom = "20px";
    notificationContainer.style.right = "20px";
    notificationContainer.style.zIndex = "9999";
    document.body.appendChild(notificationContainer);
  }
}

function notifyUser(message, showResolveButton = false) {
  ensureNotificationUI();
  const item = document.createElement("div");
  item.style.background = "#222";
  item.style.color = "#fff";
  item.style.padding = "10px 12px";
  item.style.marginTop = "8px";
  item.style.borderRadius = "6px";
  item.style.boxShadow = "0 2px 6px rgba(0,0,0,0.25)";
  item.textContent = message;

  if (showResolveButton) {
    const btn = document.createElement("button");
    btn.textContent = "Review Conflicts";
    btn.style.marginLeft = "10px";
    btn.onclick = () => showConflictPanel();
    item.appendChild(btn);
  }

  notificationContainer.appendChild(item);

  // auto-dismiss after 8s
  setTimeout(() => {
    item.remove();
  }, 8000);
}

function showConflictPanel() {
  // Build or reveal conflict container
  if (!conflictContainer) {
    conflictContainer = document.createElement("div");
    conflictContainer.id = "conflictContainer";
    conflictContainer.style.position = "fixed";
    conflictContainer.style.left = "50%";
    conflictContainer.style.top = "50%";
    conflictContainer.style.transform = "translate(-50%, -50%)";
    conflictContainer.style.background = "#fff";
    conflictContainer.style.color = "#000";
    conflictContainer.style.padding = "20px";
    conflictContainer.style.border = "1px solid #999";
    conflictContainer.style.zIndex = "10000";
    conflictContainer.style.maxHeight = "70vh";
    conflictContainer.style.overflowY = "auto";
    conflictContainer.style.width = "90vw";
    conflictContainer.style.maxWidth = "900px";

    const title = document.createElement("h3");
    title.textContent = "Sync Conflicts - Manual Review";
    conflictContainer.appendChild(title);

    const closeBtn = document.createElement("button");
    closeBtn.textContent = "Close";
    closeBtn.style.float = "right";
    closeBtn.onclick = () => (conflictContainer.style.display = "none");
    title.appendChild(closeBtn);

    const list = document.createElement("div");
    list.id = "conflictList";
    conflictContainer.appendChild(list);

    const resolveAllServerBtn = document.createElement("button");
    resolveAllServerBtn.textContent = "Accept Server Changes for All";
    resolveAllServerBtn.style.marginRight = "10px";
    resolveAllServerBtn.onclick = () => {
      // server already applied by default; just clear conflicts
      pendingConflicts = [];
      conflictContainer.style.display = "none";
      notifyUser("Server changes accepted for all conflicts.", false);
    };

    const resolveAllLocalBtn = document.createElement("button");
    resolveAllLocalBtn.textContent = "Force Local Changes to Server (Push)";
    resolveAllLocalBtn.onclick = async () => {
      // push local version for all conflicts
      for (const c of pendingConflicts) {
        const localQ = quotes.find(q => String(q.id) === String(c.id));
        if (localQ) {
          localQ.lastModified = nowISO();
          await postQuoteToServer(localQ);
        }
      }
      pendingConflicts = [];
      saveQuotesToLocalStorage();
      conflictContainer.style.display = "none";
      notifyUser("Local changes pushed to server for all conflicts.", false);
    };

    const listBtns = document.createElement("div");
    listBtns.style.marginTop = "12px";
    listBtns.append(resolveAllServerBtn, resolveAllLocalBtn);
    conflictContainer.appendChild(listBtns);

    document.body.appendChild(conflictContainer);
  }

  // Populate conflicts
  const listDiv = document.getElementById("conflictList");
  listDiv.innerHTML = "";

  if (!pendingConflicts || pendingConflicts.length === 0) {
    listDiv.innerHTML = "<p>No conflicts at the moment.</p>";
  } else {
    pendingConflicts.forEach(conf => {
      const block = document.createElement("div");
      block.style.border = "1px solid #ddd";
      block.style.padding = "10px";
      block.style.marginBottom = "8px";

      const idP = document.createElement("p");
      idP.innerHTML = `<strong>ID:</strong> ${conf.id}`;
      block.appendChild(idP);

      const localBlock = document.createElement("div");
      localBlock.innerHTML = `<strong>Local:</strong><br/><em>${escapeHtml(conf.local.text)}</em><br/><small>Category: ${escapeHtml(conf.local.category)} - Modified: ${conf.local.lastModified}</small>`;
      localBlock.style.marginBottom = "6px";
      block.appendChild(localBlock);

      const serverBlock = document.createElement("div");
      serverBlock.innerHTML = `<strong>Server:</strong><br/><em>${escapeHtml(conf.server.text)}</em><br/><small>Category: ${escapeHtml(conf.server.category)} - Modified: ${conf.server.lastModified}</small>`;
      serverBlock.style.marginBottom = "6px";
      block.appendChild(serverBlock);

      const keepServerBtn = document.createElement("button");
      keepServerBtn.textContent = "Accept Server";
      keepServerBtn.style.marginRight = "8px";
      keepServerBtn.onclick = () => {
        // override local with server
        const idx = quotes.findIndex(q => String(q.id) === String(conf.id));
        if (idx >= 0) {
          quotes[idx].text = conf.server.text;
          quotes[idx].category = conf.server.category;
          quotes[idx].lastModified = conf.server.lastModified;
          quotes[idx].pendingSync = false;
          saveQuotesToLocalStorage();
        }
        // remove this conflict
        pendingConflicts = pendingConflicts.filter(pc => pc.id !== conf.id);
        showConflictPanel();
        notifyUser("Server change accepted for one conflict.", false);
      };

      const keepLocalBtn = document.createElement("button");
      keepLocalBtn.textContent = "Keep Local (Push to server)";
      keepLocalBtn.onclick = async () => {
        // push local to server then mark resolved
        const localQ = quotes.find(q => String(q.id) === String(conf.id));
        if (localQ) {
          localQ.lastModified = nowISO();
          const r = await postQuoteToServer(localQ);
          if (r.ok) {
            localQ.pendingSync = false;
            saveQuotesToLocalStorage();
            pendingConflicts = pendingConflicts.filter(pc => pc.id !== conf.id);
            showConflictPanel();
            notifyUser("Local change pushed to server for one conflict.", false);
          } else {
            notifyUser("Failed to push local change to server.", false);
          }
        }
      };

      block.append(keepServerBtn, keepLocalBtn);
      listDiv.appendChild(block);
    });
  }

  conflictContainer.style.display = "block";
}

// helper to prevent HTML injection in conflict listing
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
}

// -----------------------------
// Existing App Functions (display, categories, form, import/export)
// -----------------------------
function getUniqueCategories() {
  const categories = quotes.map(q => q.category);
  return [...new Set(categories)];
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
  if (savedCategory) {
    categoryFilter.value = savedCategory;
    filterQuotes(savedCategory);
  } else {
    categoryFilter.value = "All";
  }
}

function filterQuotes(category) {
  let filteredQuotes = [];
  if (category === "All" || !category) {
    filteredQuotes = quotes;
  } else {
    filteredQuotes = quotes.filter(q => q.category === category);
  }

  if (filteredQuotes.length === 0) {
    quoteDisplay.innerHTML = `<p>No quotes found for category: <strong>${escapeHtml(category)}</strong></p>`;
    return;
  }

  const randomQuote = filteredQuotes[Math.floor(Math.random() * filteredQuotes.length)];
  quoteDisplay.innerHTML = `
    <p><strong>Quote:</strong> "${escapeHtml(randomQuote.text)}"</p>
    <p><em>Category:</em> ${escapeHtml(randomQuote.category)}</p>
  `;

  sessionStorage.setItem("lastQuote", JSON.stringify(randomQuote));
}

function showRandomQuote() {
  const categoryFilter = document.getElementById("categoryFilter");
  const currentCategory = categoryFilter ? categoryFilter.value : "All";
  filterQuotes(currentCategory);
}

// Add Quote Form (also marks new local quotes pendingSync)
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

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const text = quoteInput.value.trim();
    const category = categoryInput.value.trim();
    if (text && category) {
      const newQ = {
        id: uid(),
        text,
        category,
        lastModified: nowISO(),
        pendingSync: true, // mark to attempt to push to server
      };
      quotes.push(newQ);
      saveQuotesToLocalStorage();
      populateCategories();

      // optimistic UI: show it immediately
      quoteDisplay.innerHTML = `
        <p><strong>New Quote Added:</strong> "${escapeHtml(text)}"</p>
        <p><em>Category:</em> ${escapeHtml(category)}</p>
        <p style="font-size:0.9em;color:gray;">(will sync to server in background)</p>
      `;
      quoteInput.value = "";
      categoryInput.value = "";

      // try to send it to server immediately
      const r = await postQuoteToServer(newQ);
      if (r.ok) {
        newQ.pendingSync = false;
        saveQuotesToLocalStorage();
        notifyUser("New quote synced to server.", false);
      } else {
        notifyUser("New quote saved locally but failed to sync.", false);
      }
    }
  });
}

// JSON import/export
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
          // Validate & normalize import
          const normalized = importedQuotes.map(q => ({
            id: q.id || uid(),
            text: q.text || "",
            category: q.category || "Uncategorized",
            lastModified: q.lastModified || nowISO(),
            pendingSync: false,
          }));
          quotes = normalized;
          saveQuotesToLocalStorage();
          populateCategories();
          quoteDisplay.innerHTML = `<p>✅ Successfully imported ${normalized.length} quotes!</p>`;
        } else {
          quoteDisplay.innerHTML = `<p>❌ Invalid JSON format. Expected an array of quotes.</p>`;
        }
      } catch (err) {
        quoteDisplay.innerHTML = `<p>❌ Error reading JSON file.</p>`;
      }
    };
    reader.readAsText(file);
  });

  container.append(exportBtn, importInput);
  document.body.appendChild(container);
}

// -----------------------------
// Initialization & periodic sync
// -----------------------------
function initSyncing() {
  // initial load
  loadQuotesFromLocalStorage();
  simulatedServer.initFromLocal(quotes); // seed simulated server if used

  // UI setup
  populateCategories();
  createAddQuoteForm();
  createJSONControls();

  newQuoteBtn.addEventListener("click", showRandomQuote);

  // show last viewed quote if available
  const lastQuote = sessionStorage.getItem("lastQuote");
  if (lastQuote) {
    const { text, category } = JSON.parse(lastQuote);
    quoteDisplay.innerHTML = `
      <p><strong>Last Viewed Quote:</strong> "${escapeHtml(text)}"</p>
      <p><em>Category:</em> ${escapeHtml(category)}</p>
    `;
  } else {
    showRandomQuote();
  }

  // initial sync
  syncWithServer();

  // periodic sync
  setInterval(syncWithServer, SYNC_INTERVAL_MS);
}

// Start
initSyncing();
