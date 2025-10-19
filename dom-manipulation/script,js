// --- Initial Quotes Array ---
const quotes = [
  { text: "The best way to get started is to quit talking and begin doing.", category: "Motivation" },
  { text: "In the middle of every difficulty lies opportunity.", category: "Inspiration" },
  { text: "Strive not to be a success, but rather to be of value.", category: "Wisdom" },
  { text: "Your limitation—it's only your imagination.", category: "Motivation" },
];

// --- DOM References ---
const quoteDisplay = document.getElementById("quoteDisplay");
const newQuoteBtn = document.getElementById("newQuote");

// --- Function: Show Random Quote ---
function showRandomQuote() {
  const randomIndex = Math.floor(Math.random() * quotes.length);
  const { text, category } = quotes[randomIndex];
  quoteDisplay.innerHTML = `
    <p><strong>Quote:</strong> "${text}"</p>
    <p><em>Category:</em> ${category}</p>
  `;
}

// --- Function: Create Form for Adding Quotes ---
function createAddQuoteForm() {
  // Create form elements
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

  // Append elements to form
  form.appendChild(quoteInput);
  form.appendChild(categoryInput);
  form.appendChild(submitBtn);

  // Add form below the quote display
  document.body.appendChild(form);

  // Handle form submission
  form.addEventListener("submit", function (e) {
    e.preventDefault();

    const newQuoteText = quoteInput.value.trim();
    const newCategory = categoryInput.value.trim();

    if (newQuoteText && newCategory) {
      // Add new quote to array
      quotes.push({ text: newQuoteText, category: newCategory });

      // Clear inputs
      quoteInput.value = "";
      categoryInput.value = "";

      // Display confirmation and latest quote
      quoteDisplay.innerHTML = `
        <p><strong>New Quote Added:</strong> "${newQuoteText}"</p>
        <p><em>Category:</em> ${newCategory}</p>
      `;
    }
  });
}

// --- Event Listener for Random Quote Button ---
newQuoteBtn.addEventListener("click", showRandomQuote);

// --- Initialize ---
showRandomQuote();
createAddQuoteForm();

