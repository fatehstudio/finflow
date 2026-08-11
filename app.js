/**
 * FinFlow - Personal Finance Tracker Frontend Logic
 */

// Category lists by transaction type
const CATEGORIES = {
  Expense: [
    "Food", "Drinks", "Fuel", "Toll / Parking", "Bills", "House", 
    "Shopping", "Personal", "Healthcare", "Education", "Entertainment", "Charity / Zakat", "Fateh", "Loan", "Ummi", "Travel", "Others"
  ],
  Income: [
    "Salary", "Allowance", "Bonus", "Dividend", "Rumah Sewa", "Others"
  ],
  Savings: [
    "ASB", "Tabung Haji", "Bank Savings", "Emergency Fund"
  ],
  Investment: [
    "Bursa Malaysia", "IPO", "Unit Trust", "Gold", "Others"
  ]
};

// Default Tags
const DEFAULT_TAGS = ["Family", "Work", "Travel", "Dining Out", "Hospital", "Study", "Groceries", "Leisure", "Fateh", "Coffee", "Personal"];

// Application State
let state = {
  transactions: [],
  budgets: {},
  settings: {
    apiUrl: "",
    currencySymbol: "RM"
  },
  currentView: "add",
  
  // Transaction Form Temporary State
  form: {
    type: "Expense",
    category: "",
    tags: [],
    editId: null
  },
  
  customTags: [],
  chartInstances: {}
};

// Document Elements
const elements = {
  offlineBanner: document.getElementById("offline-banner"),
  statusIndicator: document.getElementById("status-indicator"),
  toast: document.getElementById("toast"),
  toastMessage: document.getElementById("toast-message"),
  
  // Views
  views: {
    home: document.getElementById("view-home"),
    add: document.getElementById("view-add"),
    history: document.getElementById("view-history"),
    budgets: document.getElementById("view-budgets"),
    settings: document.getElementById("view-settings")
  },
  
  // Nav Links
  navItems: document.querySelectorAll("nav .nav-item"),
  
  // Form Inputs
  formTransaction: document.getElementById("form-transaction"),
  txDate: document.getElementById("tx-date"),
  txAmount: document.getElementById("tx-amount"),
  txNotes: document.getElementById("tx-notes"),
  txCustomTag: document.getElementById("tx-custom-tag"),
  categoryGrid: document.getElementById("category-grid"),
  tagChoices: document.getElementById("tag-choices"),
  typeButtons: document.querySelectorAll(".type-selector .type-btn"),
  btnSaveTransaction: document.getElementById("btn-save-transaction"),
  
  // Dashboard Elements
  valNetBalance: document.getElementById("val-net-balance"),
  valMonthlyIncome: document.getElementById("val-monthly-income"),
  valMonthlyExpenses: document.getElementById("val-monthly-expenses"),
  valMonthlySavings: document.getElementById("val-monthly-savings"),
  valMonthlyInvestments: document.getElementById("val-monthly-investments"),
  lblExpenseTotal: document.getElementById("lbl-expense-total"),
  dashStartDate: document.getElementById("dash-start-date"),
  dashEndDate: document.getElementById("dash-end-date"),
  
  // History View Elements
  historySearch: document.getElementById("history-search"),
  filterButtons: document.querySelectorAll(".filter-bar .filter-btn"),
  historyList: document.getElementById("history-list"),
  
  // Budgets View Elements
  budgetProgressContainer: document.getElementById("budget-progress-container"),
  budgetInputsGrid: document.getElementById("budget-inputs-grid"),
  formBudgets: document.getElementById("form-budgets"),
  
  // Settings View Elements
  settingsApiUrl: document.getElementById("settings-api-url"),
  settingsCurrency: document.getElementById("settings-currency"),
  settingsDefaultView: document.getElementById("settings-default-view"),
  formSettings: document.getElementById("form-settings"),
  btnSyncNow: document.getElementById("btn-sync-now"),
  btnClearLocal: document.getElementById("btn-clear-local")
};

// Initialize Application
document.addEventListener("DOMContentLoaded", () => {
  loadLocalData();

  // If user configured Asset Hub Pro as default, and didn't specify ?mode=standard in URL, redirect
  if (state.settings.defaultView === "assethub" && !window.location.search.includes("mode=standard")) {
    window.location.replace("preview.html");
    return;
  }

  setupNavigation();
  setupFormEventListeners();
  setupHistoryFilters();
  setupBudgetsForm();
  setupSettingsForm();
  
  // Default values
  elements.txDate.value = new Date().toISOString().split("T")[0];
  
  const cycle = getSalaryCycleRange();
  elements.dashStartDate.value = cycle.startDate;
  elements.dashEndDate.value = cycle.endDate;
  
  elements.dashStartDate.addEventListener("change", renderDashboard);
  elements.dashEndDate.addEventListener("change", renderDashboard);
  
  // Start up sync
  if (state.settings.apiUrl) {
    syncWithSheets(true);
  } else {
    showToast("Please configure your Google Sheets URL in Settings.");
    updateUI();
  }
  
  // Render type selector categories initial state
  renderCategoryGrid();
  renderTagChoices();
  
  // Render icons
  lucide.createIcons();
});

// Load data from localStorage
function loadLocalData() {
  const localTx = localStorage.getItem("finflow_transactions");
  const localBudgets = localStorage.getItem("finflow_budgets");
  const localSettings = localStorage.getItem("finflow_settings");
  const localCustomTags = localStorage.getItem("finflow_custom_tags");
  
  if (localTx) {
    const parsed = JSON.parse(localTx);
    state.transactions = parsed.map(tx => {
      const id = tx.id || tx.ID || ("tx_" + new Date().getTime());
      return { ...tx, id: id, ID: id };
    });
  }
  if (localBudgets) state.budgets = JSON.parse(localBudgets);
  if (localSettings) state.settings = JSON.parse(localSettings);
  if (localCustomTags) state.customTags = JSON.parse(localCustomTags);
  
  // Populate settings form inputs
  elements.settingsApiUrl.value = state.settings.apiUrl || "";
  elements.settingsCurrency.value = state.settings.currencySymbol || "RM";
  if (elements.settingsDefaultView) {
    elements.settingsDefaultView.value = state.settings.defaultView || "standard";
  }
}

// Save state to localStorage
function saveStateToLocal() {
  localStorage.setItem("finflow_transactions", JSON.stringify(state.transactions));
  localStorage.setItem("finflow_budgets", JSON.stringify(state.budgets));
  localStorage.setItem("finflow_settings", JSON.stringify(state.settings));
  localStorage.setItem("finflow_custom_tags", JSON.stringify(state.customTags));
}

// Navigation Handler
function setupNavigation() {
  elements.navItems.forEach(item => {
    item.addEventListener("click", () => {
      const viewName = item.getAttribute("data-view");
      switchView(viewName);
    });
  });
}

function switchView(viewName) {
  state.currentView = viewName;
  
  if (viewName !== "add") {
    resetEditFormUI();
  }
  
  // Update views active class
  Object.keys(elements.views).forEach(key => {
    if (key === viewName) {
      elements.views[key].classList.add("active");
    } else {
      elements.views[key].classList.remove("active");
    }
  });
  
  // Update navigation active class
  elements.navItems.forEach(item => {
    if (item.getAttribute("data-view") === viewName) {
      item.classList.add("active");
    } else {
      item.classList.remove("active");
    }
  });
  
  // Trigger specific view renders
  if (viewName === "home") {
    renderDashboard();
  } else if (viewName === "history") {
    renderHistory();
  } else if (viewName === "budgets") {
    renderBudgets();
  }
  
  // Recheck icons
  lucide.createIcons();
}

// Setup Form Elements (Add Transaction view)
function setupFormEventListeners() {
  // Transaction type toggle
  elements.typeButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      elements.typeButtons.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      state.form.type = btn.getAttribute("data-type");
      state.form.category = ""; // reset selected category
      renderCategoryGrid();
    });
  });
  
  // Handle adding custom tag
  elements.txCustomTag.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const val = elements.txCustomTag.value.trim();
      if (val) {
        if (!state.customTags.includes(val) && !DEFAULT_TAGS.includes(val)) {
          state.customTags.push(val);
          saveStateToLocal();
          syncCustomTagsToSheets();
        }
        if (!state.form.tags.includes(val)) {
          state.form.tags.push(val);
        }
        elements.txCustomTag.value = "";
        renderTagChoices();
      }
    }
  });

  // Handle toggling recurring panel
  const isRecurringCheckbox = document.getElementById("tx-is-recurring");
  const recurringPanel = document.getElementById("recurring-details-panel");
  if (isRecurringCheckbox && recurringPanel) {
    isRecurringCheckbox.addEventListener("change", () => {
      recurringPanel.style.display = isRecurringCheckbox.checked ? "flex" : "none";
    });
  }
  
  // Form submission
  elements.formTransaction.addEventListener("submit", (e) => {
    e.preventDefault();
    
    const date = elements.txDate.value;
    const amount = parseFloat(elements.txAmount.value);
    const notes = elements.txNotes.value.trim();
    
    if (!state.form.category) {
      showToast("Please select a category.");
      return;
    }
    
    if (isNaN(amount) || amount <= 0) {
      showToast("Please enter a valid amount.");
      return;
    }
    
    const isEdit = state.form.editId !== null;
    
    if (isEdit) {
      const txIndex = state.transactions.findIndex(t => t.id === state.form.editId);
      if (txIndex !== -1) {
        state.transactions[txIndex].Date = date;
        state.transactions[txIndex].Type = state.form.type;
        state.transactions[txIndex].Category = state.form.category;
        state.transactions[txIndex].Amount = amount;
        state.transactions[txIndex].Notes = notes;
        state.transactions[txIndex].Tags = state.form.tags.join(",");
        
        const updatedTx = state.transactions[txIndex];
        saveStateToLocal();
        showToast("Transaction updated locally!");
        
        // Sync to Sheets
        if (state.settings.apiUrl) {
          postToSheets("updateTransaction", updatedTx)
            .then(() => {
              showToast("Sync successful!");
              syncWithSheets(false);
            })
            .catch(err => {
              console.error(err);
              showToast("Failed to sync updates to sheets. Saved locally.");
            });
        }
      }
      resetEditFormUI();
    } else {
      const isRecurring = isRecurringCheckbox && isRecurringCheckbox.checked;
      
      if (isRecurring) {
        const freq = document.getElementById("tx-recurring-freq").value;
        const count = parseInt(document.getElementById("tx-recurring-count").value) || 6;
        
        const recurringDates = calculateRecurringDates(date, freq, count);
        const newTxs = [];
        
        recurringDates.forEach((recDate, index) => {
          const recNotes = notes ? `${notes} (Recur ${index + 1}/${count})` : `(Recur ${index + 1}/${count})`;
          
          const newTx = {
            id: "tx_" + new Date().getTime() + "_" + index + "_" + Math.floor(Math.random() * 1000),
            Date: recDate,
            Type: state.form.type,
            Category: state.form.category,
            Amount: amount,
            Notes: recNotes,
            Tags: state.form.tags.join(",")
          };
          newTxs.push(newTx);
        });
        
        // Add all to state
        state.transactions = [...newTxs, ...state.transactions];
        saveStateToLocal();
        showToast(`Added ${count} recurring bills locally!`);
        
        if (state.settings.apiUrl) {
          postToSheets("addTransaction", newTxs)
            .then(() => {
              showToast("Sync successful!");
              syncWithSheets(false);
            })
            .catch(err => {
              console.error(err);
              showToast("Failed to sync to sheets. Saved locally.");
            });
        }
      } else {
        const newTx = {
          id: "tx_" + new Date().getTime() + "_" + Math.floor(Math.random() * 1000),
          Date: date,
          Type: state.form.type,
          Category: state.form.category,
          Amount: amount,
          Notes: notes,
          Tags: state.form.tags.join(",")
        };
        
        state.transactions.unshift(newTx);
        saveStateToLocal();
        showToast("Transaction saved locally!");
        
        if (state.settings.apiUrl) {
          postToSheets("addTransaction", newTx)
            .then(() => {
              showToast("Sync successful!");
              syncWithSheets(false);
            })
            .catch(err => {
              console.error(err);
              showToast("Failed to sync to sheets. Saved locally.");
            });
        }
      }
    }
    
    // Reset form
    elements.txAmount.value = "";
    elements.txNotes.value = "";
    state.form.tags = [];
    state.form.category = "";
    elements.txDate.value = new Date().toISOString().split("T")[0];
    
    renderCategoryGrid();
    renderTagChoices();
    
    // Redirect
    switchView(isEdit ? "history" : "home");
  });
}

// Render dynamic categories grid
function renderCategoryGrid() {
  elements.categoryGrid.innerHTML = "";
  const categoriesList = CATEGORIES[state.form.type] || [];
  
  categoriesList.forEach(cat => {
    const pill = document.createElement("div");
    pill.className = `category-pill ${state.form.category === cat ? "selected" : ""}`;
    pill.textContent = cat;
    
    pill.addEventListener("click", () => {
      document.querySelectorAll(".category-pill").forEach(p => p.classList.remove("selected"));
      pill.classList.add("selected");
      state.form.category = cat;
    });
    
    elements.categoryGrid.appendChild(pill);
  });
}

// Render tag selections
function renderTagChoices() {
  elements.tagChoices.innerHTML = "";
  const allTags = [...DEFAULT_TAGS, ...state.customTags];
  
  allTags.forEach(tag => {
    const pill = document.createElement("div");
    const isSelected = state.form.tags.includes(tag);
    pill.className = `category-pill ${isSelected ? "selected" : ""}`;
    pill.style.padding = "6px 10px";
    pill.style.fontSize = "0.75rem";
    pill.textContent = tag;
    
    pill.addEventListener("click", () => {
      if (state.form.tags.includes(tag)) {
        state.form.tags = state.form.tags.filter(t => t !== tag);
      } else {
        state.form.tags.push(tag);
      }
      renderTagChoices();
    });
    
    elements.tagChoices.appendChild(pill);
  });
}

// History Filters and Search Setup
function setupHistoryFilters() {
  // Filter buttons click
  elements.filterButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      elements.filterButtons.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      renderHistory();
    });
  });
  
  // Search input change
  elements.historySearch.addEventListener("input", renderHistory);
}

// Budgets Form Setup
function setupBudgetsForm() {
  // Generate inputs dynamic list on load
  const expenseCategories = CATEGORIES["Expense"];
  elements.budgetInputsGrid.innerHTML = "";
  
  expenseCategories.forEach(cat => {
    const row = document.createElement("div");
    row.className = "budget-editor-row";
    
    const label = document.createElement("label");
    label.textContent = cat;
    
    const input = document.createElement("input");
    input.type = "number";
    input.className = "form-control";
    input.style.padding = "8px 12px";
    input.placeholder = "0.00";
    input.step = "0.01";
    input.min = "0";
    input.id = `budget-input-${cat.replace(/\s+/g, "_")}`;
    input.value = state.budgets[cat] || "";
    
    row.appendChild(label);
    row.appendChild(input);
    elements.budgetInputsGrid.appendChild(row);
  });
  
  // Budgets form submit
  elements.formBudgets.addEventListener("submit", (e) => {
    e.preventDefault();
    
    const newBudgets = {};
    expenseCategories.forEach(cat => {
      const input = document.getElementById(`budget-input-${cat.replace(/\s+/g, "_")}`);
      const val = parseFloat(input.value);
      newBudgets[cat] = isNaN(val) ? 0 : val;
    });
    
    state.budgets = newBudgets;
    saveStateToLocal();
    showToast("Budgets saved locally!");
    
    if (state.settings.apiUrl) {
      postToSheets("updateBudgets", { budgets: newBudgets })
        .then(() => {
          showToast("Budgets synced to Sheets!");
          syncWithSheets(false);
        })
        .catch(err => {
          console.error(err);
          showToast("Failed to sync budgets. Cached locally.");
        });
    }
    
    renderBudgets();
  });
}

// Settings Form Setup
function setupSettingsForm() {
  elements.formSettings.addEventListener("submit", (e) => {
    e.preventDefault();
    
    const url = elements.settingsApiUrl.value.trim();
    const currency = elements.settingsCurrency.value.trim();
    const defaultView = elements.settingsDefaultView ? elements.settingsDefaultView.value : "standard";
    
    state.settings.apiUrl = url;
    state.settings.currencySymbol = currency;
    state.settings.defaultView = defaultView;
    
    saveStateToLocal();
    showToast("Settings saved!");
    
    if (url) {
      // Sync settings & custom tags
      const settingsToSave = {
        currencySymbol: currency,
        customTags: state.customTags.join(","),
        defaultView: defaultView
      };
      postToSheets("saveSettings", { settings: settingsToSave })
        .then(() => syncWithSheets(true))
        .catch(err => {
          console.error("Failed to save settings to sheet:", err);
          syncWithSheets(true);
        });
    } else {
      updateUI();
    }
  });
  
  // Manual sync button
  elements.btnSyncNow.addEventListener("click", () => {
    if (!state.settings.apiUrl) {
      showToast("Please enter a Google Apps Script URL first.");
      return;
    }
    syncWithSheets(true);
  });
  
  // Clear local cache
  elements.btnClearLocal.addEventListener("click", () => {
    if (confirm("Are you sure you want to clear all local data? This cannot be undone.")) {
      localStorage.clear();
      state = {
        transactions: [],
        budgets: {},
        settings: {
          apiUrl: "",
          currencySymbol: "RM"
        },
        currentView: "home",
        form: { type: "Expense", category: "", tags: [] },
        customTags: [],
        chartInstances: {}
      };
      elements.settingsApiUrl.value = "";
      elements.settingsCurrency.value = "RM";
      saveStateToLocal();
      location.reload();
    }
  });
}

// Helper: Format Currencies
function formatCurrency(val) {
  const sym = state.settings.currencySymbol || "RM";
  return `${sym} ${parseFloat(val).toFixed(2)}`;
}

// Helper: Calculate Salary Cycle Range (25th of month to 24th of next month)
function getSalaryCycleRange(refDate = new Date()) {
  const year = refDate.getFullYear();
  const month = refDate.getMonth();
  const day = refDate.getDate();

  if (day >= 25) {
    // Current month 25th to next month 24th
    const start = new Date(year, month, 25);
    const end = new Date(year, month + 1, 24);
    return {
      startDate: formatDateToYMD(start),
      endDate: formatDateToYMD(end),
      label: end.toLocaleDateString("en-US", { month: "short" })
    };
  } else {
    // Previous month 25th to current month 24th
    const start = new Date(year, month - 1, 25);
    const end = new Date(year, month, 24);
    return {
      startDate: formatDateToYMD(start),
      endDate: formatDateToYMD(end),
      label: end.toLocaleDateString("en-US", { month: "short" })
    };
  }
}

function formatDateToYMD(d) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

// Update UI views
function updateUI() {
  renderDashboard();
  renderHistory();
  renderBudgets();
}

// -------------------------------------------------------------
// View Render: Home / Dashboard View
// -------------------------------------------------------------
function renderDashboard() {
  const startDate = elements.dashStartDate.value;
  const endDate = elements.dashEndDate.value;
  
  let incomeTotal = 0;
  let expenseTotal = 0;
  let savingsTotal = 0;
  let investmentTotal = 0;
  
  // Calculate dashboard totals for selected date range
  state.transactions.forEach(tx => {
    if (tx.Date >= startDate && tx.Date <= endDate) {
      const amt = parseFloat(tx.Amount) || 0;
      if (tx.Type === "Income") incomeTotal += amt;
      else if (tx.Type === "Expense") expenseTotal += amt;
      else if (tx.Type === "Savings") savingsTotal += amt;
      else if (tx.Type === "Investment") investmentTotal += amt;
    }
  });
  
  const netBalance = incomeTotal - expenseTotal - savingsTotal - investmentTotal;
  
  elements.valNetBalance.textContent = formatCurrency(netBalance);
  elements.valMonthlyIncome.textContent = formatCurrency(incomeTotal);
  elements.valMonthlyExpenses.textContent = formatCurrency(expenseTotal);
  elements.valMonthlySavings.textContent = formatCurrency(savingsTotal);
  elements.valMonthlyInvestments.textContent = formatCurrency(investmentTotal);
  elements.lblExpenseTotal.textContent = `Total: ${formatCurrency(expenseTotal)}`;
  
  // Render charts
  renderExpenseCategoryChart(startDate, endDate);
  renderCashFlowTrendChart();
}

function renderExpenseCategoryChart(startDate, endDate) {
  const canvas = document.getElementById("chart-expenses-category");
  if (!canvas) return;
  
  // Destroy previous chart
  if (state.chartInstances.expenses) {
    state.chartInstances.expenses.destroy();
  }
  
  // Group expenses by category
  const expenseGroups = {};
  CATEGORIES.Expense.forEach(cat => { expenseGroups[cat] = 0; });
  
  state.transactions.forEach(tx => {
    if (tx.Type === "Expense" && tx.Date >= startDate && tx.Date <= endDate) {
      const amt = parseFloat(tx.Amount) || 0;
      expenseGroups[tx.Category] = (expenseGroups[tx.Category] || 0) + amt;
    }
  });
  
  const labels = [];
  const data = [];
  const colors = [
    "#f472b6", "#fb923c", "#fcd34d", "#4ade80", "#2dd4bf", "#60a5fa", 
    "#c084fc", "#f43f5e", "#fb7185", "#fbbf24", "#34d399", "#818cf8"
  ];
  
  let hasData = false;
  Object.keys(expenseGroups).forEach(cat => {
    const val = expenseGroups[cat];
    if (val > 0) {
      labels.push(cat);
      data.push(val);
      hasData = true;
    }
  });
  
  // Visual fallback if no data
  if (!hasData) {
    labels.push("No Expenses logged");
    data.push(1);
    colors.splice(0, colors.length, "#e2e8f0");
  }
  
  // Calculate percentage for legend display
  const totalExpense = hasData ? data.reduce((sum, val) => sum + val, 0) : 0;
  const labelsWithPct = labels.map((label, idx) => {
    if (!hasData) return label;
    const val = data[idx];
    const pct = totalExpense > 0 ? ((val / totalExpense) * 100).toFixed(1) : 0;
    return `${label} (${pct}%)`;
  });
  
  const ctx = canvas.getContext("2d");
  state.chartInstances.expenses = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: labelsWithPct,
      datasets: [{
        data: data,
        backgroundColor: colors,
        borderWidth: 2,
        borderColor: '#ffffff'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          position: 'right',
          labels: {
            boxWidth: 12,
            font: { family: 'Quicksand', size: 11, weight: '600' },
            color: '#475569'
          }
        },
        tooltip: {
          enabled: hasData,
          callbacks: {
            label: function(context) {
              const val = context.raw;
              const total = context.dataset.data.reduce((a, b) => a + b, 0);
              const pct = total > 0 ? ((val / total) * 100).toFixed(1) : 0;
              // Strip out the percentage suffix when rendering tooltip label
              const cleanLabel = context.label.split(" (")[0];
              return ` ${cleanLabel}: ${formatCurrency(val)} (${pct}%)`;
            }
          }
        }
      },
      cutout: '65%'
    }
  });
}

function renderCashFlowTrendChart() {
  const canvas = document.getElementById("chart-cashflow-trend");
  if (!canvas) return;
  
  if (state.chartInstances.trend) {
    state.chartInstances.trend.destroy();
  }
  
  // Calculate past 6 salary cycles (each starting on 25th and ending on 24th)
  const cycles = [];
  const now = new Date();
  const endMonthOffset = now.getDate() >= 25 ? 1 : 0;
  
  for (let i = 5; i >= 0; i--) {
    const endMonthDate = new Date(now.getFullYear(), now.getMonth() + endMonthOffset - i, 24);
    const startMonthDate = new Date(endMonthDate.getFullYear(), endMonthDate.getMonth() - 1, 25);
    
    cycles.push({
      start: formatDateToYMD(startMonthDate),
      end: formatDateToYMD(endMonthDate),
      label: endMonthDate.toLocaleDateString("en-US", { month: "short" })
    });
  }
  
  const chartData = {
    Income: Array(6).fill(0),
    Expense: Array(6).fill(0)
  };
  
  state.transactions.forEach(tx => {
    cycles.forEach((cycle, idx) => {
      if (tx.Date >= cycle.start && tx.Date <= cycle.end) {
        const amt = parseFloat(tx.Amount) || 0;
        if (tx.Type === "Income") {
          chartData.Income[idx] += amt;
        } else if (tx.Type === "Expense") {
          chartData.Expense[idx] += amt;
        }
      }
    });
  });
  
  const monthLabels = cycles.map(c => c.label);
  
  const ctx = canvas.getContext("2d");
  state.chartInstances.trend = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: monthLabels,
      datasets: [
        {
          label: 'Income',
          data: chartData.Income,
          backgroundColor: '#34d399',
          borderRadius: 8,
          maxBarThickness: 16
        },
        {
          label: 'Expenses',
          data: chartData.Expense,
          backgroundColor: '#f472b6',
          borderRadius: 8,
          maxBarThickness: 16
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          grid: { display: false },
          ticks: { font: { family: 'Quicksand', size: 10, weight: '600' }, color: '#64748b' }
        },
        y: {
          grid: { color: '#f1f5f9' },
          ticks: { font: { family: 'Quicksand', size: 10, weight: '600' }, color: '#64748b' }
        }
      },
      plugins: {
        legend: {
          position: 'top',
          labels: {
            boxWidth: 10,
            font: { family: 'Quicksand', size: 11, weight: '600' },
            color: '#475569'
          }
        },
        tooltip: {
          callbacks: {
            title: function(context) {
              const idx = context[0].dataIndex;
              const c = cycles[idx];
              return `${c.label} (${c.start} to ${c.end})`;
            },
            label: function(context) {
              return ` ${context.dataset.label}: ${formatCurrency(context.raw)}`;
            }
          }
        }
      }
    }
  });
}

// -------------------------------------------------------------
// View Render: History View
// -------------------------------------------------------------
function renderHistory() {
  elements.historyList.innerHTML = "";
  
  const activeFilterBtn = document.querySelector(".filter-bar .filter-btn.active");
  const filter = activeFilterBtn ? activeFilterBtn.getAttribute("data-filter") : "all";
  const searchVal = elements.historySearch.value.trim().toLowerCase();
  
  const filteredTxs = state.transactions.filter(tx => {
    // 1. Filter by Type
    if (filter !== "all" && tx.Type !== filter) return false;
    
    // 2. Filter by search query (notes, categories, tags)
    if (searchVal) {
      const matchCat = tx.Category.toLowerCase().includes(searchVal);
      const matchNotes = tx.Notes.toLowerCase().includes(searchVal);
      const matchTags = tx.Tags.toLowerCase().includes(searchVal);
      return matchCat || matchNotes || matchTags;
    }
    
    return true;
  });
  
  if (filteredTxs.length === 0) {
    elements.historyList.innerHTML = `<div class="no-transactions">No transactions found.</div>`;
    return;
  }
  
  filteredTxs.forEach(tx => {
    const item = document.createElement("div");
    item.className = "transaction-item";
    
    const info = document.createElement("div");
    info.className = "tx-info";
    
    // Title row (Category)
    const categoryEl = document.createElement("div");
    categoryEl.className = "tx-category";
    categoryEl.textContent = tx.Category;
    
    // Mini Indicator dot for transaction type
    const typeIndicator = document.createElement("span");
    typeIndicator.style.width = "8px";
    typeIndicator.style.height = "8px";
    typeIndicator.style.borderRadius = "50%";
    typeIndicator.style.backgroundColor = `var(--${tx.Type.toLowerCase()})`;
    typeIndicator.style.display = "inline-block";
    categoryEl.prepend(typeIndicator);
    
    info.appendChild(categoryEl);
    
    // Notes row
    if (tx.Notes) {
      const notesEl = document.createElement("div");
      notesEl.className = "tx-notes";
      notesEl.textContent = tx.Notes;
      info.appendChild(notesEl);
    }
    
    // Meta row (Date + Tags)
    const metaEl = document.createElement("div");
    metaEl.className = "tx-meta";
    
    const dateText = document.createTextNode(formatReadableDate(tx.Date));
    metaEl.appendChild(dateText);
    
    if (tx.Tags) {
      tx.Tags.split(",").forEach(t => {
        if (t.trim()) {
          const tag = document.createElement("span");
          tag.className = "tag-badge";
          tag.textContent = t.trim();
          metaEl.appendChild(tag);
        }
      });
    }
    info.appendChild(metaEl);
    
    item.appendChild(info);
    
    // Right side column (Amount & Delete button)
    const right = document.createElement("div");
    right.className = "tx-right";
    
    const amountEl = document.createElement("div");
    amountEl.className = `tx-amount ${tx.Type}`;
    
    // Prefix minus to expense/savings/investments to display outflow visual
    const prefix = tx.Type === "Income" ? "+" : "-";
    amountEl.textContent = `${prefix}${formatCurrency(tx.Amount)}`;
    right.appendChild(amountEl);
    
    const actionsRow = document.createElement("div");
    actionsRow.style.display = "flex";
    actionsRow.style.gap = "8px";
    actionsRow.style.alignItems = "center";
    
    const editBtn = document.createElement("button");
    editBtn.className = "tx-delete-btn";
    editBtn.style.color = "var(--primary)";
    editBtn.innerHTML = `<i data-lucide="pencil" style="width: 16px; height: 16px;"></i>`;
    editBtn.addEventListener("click", () => {
      startEditTransaction(tx);
    });
    actionsRow.appendChild(editBtn);
    
    const deleteBtn = document.createElement("button");
    deleteBtn.className = "tx-delete-btn";
    deleteBtn.innerHTML = `<i data-lucide="trash-2" style="width: 16px; height: 16px;"></i>`;
    deleteBtn.addEventListener("click", () => {
      const txId = tx.id || tx.ID;
      if (confirm("Delete this transaction?")) {
        deleteTransaction(txId);
      }
    });
    actionsRow.appendChild(deleteBtn);
    
    right.appendChild(actionsRow);
    
    item.appendChild(right);
    elements.historyList.appendChild(item);
  });
  
  // Process lucide icons inside dynamically added lists
  lucide.createIcons();
}

function formatReadableDate(dateStr) {
  // input: YYYY-MM-DD
  const dateObj = new Date(dateStr);
  if (isNaN(dateObj)) return dateStr;
  return dateObj.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// -------------------------------------------------------------
// View Render: Budgets View
// -------------------------------------------------------------
function renderBudgets() {
  elements.budgetProgressContainer.innerHTML = "";
  
  const cycle = getSalaryCycleRange();
  const expenseCategories = CATEGORIES["Expense"];
  
  // Calculate expenses and sub-tags grouped by category for current salary cycle (25th to 24th)
  const actuals = {};
  const categoryTagsMap = {};

  expenseCategories.forEach(cat => { 
    actuals[cat] = 0; 
    categoryTagsMap[cat] = {};
  });
  
  state.transactions.forEach(tx => {
    if (tx.Type === "Expense" && tx.Date >= cycle.startDate && tx.Date <= cycle.endDate) {
      const amt = parseFloat(tx.Amount) || 0;
      actuals[tx.Category] = (actuals[tx.Category] || 0) + amt;

      if (!categoryTagsMap[tx.Category]) categoryTagsMap[tx.Category] = {};

      if (!tx.Tags || !tx.Tags.trim()) {
        categoryTagsMap[tx.Category]["_NO_TAG_"] = (categoryTagsMap[tx.Category]["_NO_TAG_"] || 0) + amt;
      } else {
        const tagsList = tx.Tags.split(",").map(t => t.trim()).filter(Boolean);
        if (tagsList.length === 0) {
          categoryTagsMap[tx.Category]["_NO_TAG_"] = (categoryTagsMap[tx.Category]["_NO_TAG_"] || 0) + amt;
        } else {
          tagsList.forEach(tag => {
            categoryTagsMap[tx.Category][tag] = (categoryTagsMap[tx.Category][tag] || 0) + amt;
          });
        }
      }
    }
  });
  
  let hasBudgetsConfigured = false;
  
  expenseCategories.forEach(cat => {
    const budgetVal = parseFloat(state.budgets[cat]) || 0;
    if (budgetVal <= 0) return; // skip showing categories without a budget
    
    hasBudgetsConfigured = true;
    
    const actualVal = actuals[cat] || 0;
    const ratio = Math.min((actualVal / budgetVal), 1);
    const percentage = Math.round((actualVal / budgetVal) * 100);
    
    // Choose color code
    let colorClass = "normal";
    if (ratio >= 1.0) colorClass = "danger";
    else if (ratio >= 0.8) colorClass = "warning";
    
    const budgetItem = document.createElement("div");
    budgetItem.className = "budget-item";
    budgetItem.title = `Click to view all ${cat} transactions & sub-tags`;

    // Build Sub-tags chips HTML
    const tagsObj = categoryTagsMap[cat] || {};
    let subTagsHtml = "";
    const tagKeys = Object.keys(tagsObj);

    if (tagKeys.length > 0) {
      const chips = tagKeys.map(tag => {
        const tagAmt = tagsObj[tag];
        const tagPct = actualVal > 0 ? ((tagAmt / actualVal) * 100).toFixed(0) : 0;
        if (tag === "_NO_TAG_") {
          return `<span class="budget-subtag-pill">⚪ No Tag: <b>${formatCurrency(tagAmt)}</b> (${tagPct}%)</span>`;
        }
        return `<span class="budget-subtag-pill">🏷️ ${escapeHtml(tag)}: <b>${formatCurrency(tagAmt)}</b> (${tagPct}%)</span>`;
      }).join("");

      subTagsHtml = `<div class="budget-subtags-row">${chips}</div>`;
    }
    
    budgetItem.innerHTML = `
      <div class="budget-header">
        <span class="budget-category">${cat}</span>
        <span class="budget-amounts">${formatCurrency(actualVal)} / ${formatCurrency(budgetVal)}</span>
      </div>
      <div class="budget-bar-bg">
        <div class="budget-bar-fill ${colorClass}" style="width: ${percentage}%"></div>
      </div>
      <div class="budget-footer">
        <span>${percentage}% spent</span>
        <span style="display: flex; align-items: center; gap: 4px;">
          ${formatCurrency(Math.max(budgetVal - actualVal, 0))} remaining 
          <i data-lucide="chevron-right" style="width: 14px; height: 14px; stroke-width: 2.5; color: var(--primary);"></i>
        </span>
      </div>
      ${subTagsHtml}
    `;
    
    budgetItem.addEventListener("click", () => {
      showBudgetDetailsModal(cat, budgetVal, actualVal, cycle);
    });
    
    elements.budgetProgressContainer.appendChild(budgetItem);
  });
  
  if (!hasBudgetsConfigured) {
    elements.budgetProgressContainer.innerHTML = `
      <div class="no-transactions" style="padding: 24px 0;">
        <i data-lucide="info" style="margin-bottom: 8px; opacity: 0.6;"></i>
        <p>No budgets configured yet.</p>
        <p style="font-size: 0.75rem; color: var(--text-muted); margin-top: 4px;">Use the editor below to set category budgets.</p>
      </div>
    `;
    lucide.createIcons();
  }
}

// -------------------------------------------------------------
// Transaction Data Operations
// -------------------------------------------------------------
function startEditTransaction(tx) {
  state.form.editId = tx.id || tx.ID;
  state.form.type = tx.Type;
  state.form.category = tx.Category;
  state.form.tags = tx.Tags ? tx.Tags.split(",") : [];
  
  elements.txDate.value = tx.Date;
  elements.txAmount.value = tx.Amount;
  elements.txNotes.value = tx.Notes || "";
  
  elements.typeButtons.forEach(btn => {
    if (btn.getAttribute("data-type") === tx.Type) {
      btn.classList.add("active");
    } else {
      btn.classList.remove("active");
    }
  });
  
  renderCategoryGrid();
  renderTagChoices();
  
  const titleEl = document.getElementById("add-view-title");
  if (titleEl) titleEl.textContent = "Edit Transaction";
  
  const textEl = document.getElementById("btn-save-tx-text");
  if (textEl) textEl.textContent = "Update Transaction";
  
  const iconEl = document.getElementById("btn-save-tx-icon");
  if (iconEl) {
    iconEl.setAttribute("data-lucide", "check-circle");
  }
  
  // Hide recurring controls when editing
  const recCheckbox = document.getElementById("tx-is-recurring");
  if (recCheckbox) {
    recCheckbox.parentNode.style.display = "none";
    recCheckbox.checked = false;
    document.getElementById("recurring-details-panel").style.display = "none";
  }
  
  switchView("add");
}

function resetEditFormUI() {
  state.form.editId = null;
  const titleEl = document.getElementById("add-view-title");
  if (titleEl) titleEl.textContent = "New Transaction";
  
  const textEl = document.getElementById("btn-save-tx-text");
  if (textEl) textEl.textContent = "Save Transaction";
  
  const iconEl = document.getElementById("btn-save-tx-icon");
  if (iconEl) {
    iconEl.setAttribute("data-lucide", "plus-circle");
  }
  
  // Show and reset recurring controls
  const recCheckbox = document.getElementById("tx-is-recurring");
  if (recCheckbox) {
    recCheckbox.parentNode.style.display = "flex";
    recCheckbox.checked = false;
    document.getElementById("recurring-details-panel").style.display = "none";
  }
}

function calculateRecurringDates(startDateStr, frequency, occurrences) {
  const dates = [];
  const start = new Date(startDateStr);
  
  for (let i = 0; i < occurrences; i++) {
    const d = new Date(start);
    if (frequency === "Monthly") {
      d.setMonth(start.getMonth() + i);
    } else if (frequency === "Weekly") {
      d.setDate(start.getDate() + (i * 7));
    } else if (frequency === "Yearly") {
      d.setFullYear(start.getFullYear() + i);
    }
    
    // Format to YYYY-MM-DD
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    dates.push(`${yyyy}-${mm}-${dd}`);
  }
  return dates;
}

function syncCustomTagsToSheets() {
  if (state.settings.apiUrl) {
    const settingsToSave = {
      currencySymbol: state.settings.currencySymbol,
      customTags: state.customTags.join(",")
    };
    postToSheets("saveSettings", { settings: settingsToSave })
      .catch(err => console.error("Failed to sync custom tags to Sheets:", err));
  }
}

function deleteTransaction(id) {
  if (!id) {
    console.error("deleteTransaction called with invalid/empty id:", id);
    showToast("Error: Transaction ID not found.");
    return;
  }

  // Remove locally (handle both tx.id and tx.ID)
  state.transactions = state.transactions.filter(tx => {
    const txId = tx.id || tx.ID;
    return txId !== id;
  });
  saveStateToLocal();
  updateUI();
  
  // Submit delete operation to Sheets
  if (state.settings.apiUrl) {
    postToSheets("deleteTransaction", { id: id })
      .then(() => {
        showToast("Transaction deleted from Sheet.");
        syncWithSheets(false);
      })
      .catch(err => {
        console.error(err);
        showToast("Error deleting online. Deleted from local cache.");
      });
  } else {
    showToast("Deleted locally.");
  }
}

// -------------------------------------------------------------
// Google Sheets Integration (REST API calls)
// -------------------------------------------------------------

// Sync all data from sheets
function syncWithSheets(interactive = false) {
  if (!state.settings.apiUrl) return;
  
  if (interactive) {
    showToast("Syncing with Google Sheets...");
  }
  
  elements.statusIndicator.className = "status-indicator disconnected";
  elements.offlineBanner.style.display = "none";
  
  fetch(`${state.settings.apiUrl}?action=getDashboardData`)
    .then(res => {
      if (!res.ok) throw new Error("Network response not OK");
      return res.json();
    })
    .then(response => {
      if (response.success && response.data) {
        const serverData = response.data;
        
        // Merge settings
        if (serverData.settings) {
          state.settings.currencySymbol = serverData.settings.currencySymbol || state.settings.currencySymbol;
          elements.settingsCurrency.value = state.settings.currencySymbol;
          
          if (serverData.settings.customTags) {
            const serverCustomTags = serverData.settings.customTags.split(",").filter(t => t.trim());
            // Merge unique tags
            state.customTags = Array.from(new Set([...state.customTags, ...serverCustomTags]));
          }
        }
        
        // Merge budgets
        if (serverData.budgets) {
          state.budgets = serverData.budgets;
          // Repopulate form budget input values
          CATEGORIES.Expense.forEach(cat => {
            const input = document.getElementById(`budget-input-${cat.replace(/\s+/g, "_")}`);
            if (input) input.value = state.budgets[cat] || "";
          });
        }
        
        // Merge transactions
        if (serverData.transactions) {
          state.transactions = serverData.transactions.map(tx => {
            const id = tx.id || tx.ID || ("tx_" + new Date().getTime());
            return {
              ...tx,
              id: id,
              ID: id
            };
          });
        }
        
        saveStateToLocal();
        updateUI();
        
        elements.statusIndicator.className = "status-indicator connected";
        if (interactive) {
          showToast("Sync complete!");
        }
      } else {
        throw new Error(response.error || "Unknown server error");
      }
    })
    .catch(err => {
      console.error("Sheets Sync Error:", err);
      elements.statusIndicator.className = "status-indicator disconnected";
      elements.offlineBanner.style.display = "block";
      if (interactive) {
        showToast("Sync failed. Operating in offline mode.");
      }
    });
}

// Post action helper
function postToSheets(action, payload) {
  if (!state.settings.apiUrl) {
    return Promise.reject("API URL not configured");
  }
  
  // Use text/plain POST to bypass preflight OPTIONS CORS check on Apps Script
  const bodyData = {
    action: action,
    data: payload
  };
  
  // Special cases for parameters that are expected at root
  if (action === "deleteTransaction") {
    bodyData.id = payload.id;
  } else if (action === "updateTransaction") {
    bodyData.id = payload.id;
  } else if (action === "updateBudgets") {
    bodyData.budgets = payload.budgets;
  } else if (action === "saveSettings") {
    bodyData.settings = payload.settings;
  }
  
  return fetch(state.settings.apiUrl, {
    method: "POST",
    mode: "cors",
    headers: {
      "Content-Type": "text/plain"
    },
    body: JSON.stringify(bodyData)
  })
  .then(res => {
    if (!res.ok) throw new Error("HTTP POST request failed");
    return res.json();
  })
  .then(response => {
    if (!response.success) {
      throw new Error(response.error || "Operations failed on sheet");
    }
    return response.data;
  });
}

// -------------------------------------------------------------
// Toast Banner Handler
// -------------------------------------------------------------
let toastTimer = null;
function showToast(msg) {
  elements.toastMessage.textContent = msg;
  elements.toast.classList.add("show");
  
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    elements.toast.classList.remove("show");
  }, 4000);
}

window.downloadChartImage = function() {
  const canvas = document.getElementById("chart-expenses-category");
  const startDate = elements.dashStartDate.value;
  const endDate = elements.dashEndDate.value;
  if (canvas) {
    // Render onto temporary canvas to apply a solid white background (preventing transparent black in default viewers)
    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;
    const tempCtx = tempCanvas.getContext("2d");
    
    tempCtx.fillStyle = "#ffffff";
    tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
    tempCtx.drawImage(canvas, 0, 0);
    
    const url = tempCanvas.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url;
    a.download = `expense_chart_${startDate}_to_${endDate}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    showToast("Chart image downloaded!");
  }
};

window.downloadChartCSV = function() {
  const startDate = elements.dashStartDate.value;
  const endDate = elements.dashEndDate.value;
  const expenseGroups = {};
  CATEGORIES.Expense.forEach(cat => { expenseGroups[cat] = 0; });
  let total = 0;
  
  state.transactions.forEach(tx => {
    if (tx.Type === "Expense" && tx.Date >= startDate && tx.Date <= endDate) {
      const amt = parseFloat(tx.Amount) || 0;
      expenseGroups[tx.Category] += amt;
      total += amt;
    }
  });
  
  let csvContent = "\ufeffCategory,Amount (RM),Percentage (%)\n"; // UTF-8 BOM for Excel support
  
  CATEGORIES.Expense.forEach(cat => {
    const amt = expenseGroups[cat];
    if (amt > 0) {
      const pct = total > 0 ? ((amt / total) * 100).toFixed(1) : 0;
      csvContent += `"${cat}",${amt.toFixed(2)},${pct}%\n`;
    }
  });
  
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `expense_breakdown_${startDate}_to_${endDate}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  showToast("CSV data downloaded!");
};

function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// -------------------------------------------------------------
// Budget Drill-Down Modal Logic (With Tag Breakdown & Filters)
// -------------------------------------------------------------
let activeBudgetTagFilter = "ALL";

function showBudgetDetailsModal(category, budgetVal, actualVal, cycle, selectedTag = "ALL") {
  const modal = document.getElementById("budget-modal");
  if (!modal) return;

  activeBudgetTagFilter = selectedTag;

  // Filter all transactions for this category in active salary cycle
  const allCategoryTxs = state.transactions.filter(tx => 
    tx.Type === "Expense" && 
    tx.Category === category && 
    tx.Date >= cycle.startDate && 
    tx.Date <= cycle.endDate
  );

  // Calculate tag totals and counts
  const tagsMap = {};
  let untaggedTotal = 0;
  let untaggedCount = 0;

  allCategoryTxs.forEach(tx => {
    const amt = parseFloat(tx.Amount) || 0;
    if (!tx.Tags || !tx.Tags.trim()) {
      untaggedTotal += amt;
      untaggedCount++;
    } else {
      const tagsList = tx.Tags.split(",").map(t => t.trim()).filter(Boolean);
      if (tagsList.length === 0) {
        untaggedTotal += amt;
        untaggedCount++;
      } else {
        tagsList.forEach(tag => {
          if (!tagsMap[tag]) {
            tagsMap[tag] = { total: 0, count: 0 };
          }
          tagsMap[tag].total += amt;
          tagsMap[tag].count++;
        });
      }
    }
  });

  // Set modal headers and top summary pills
  document.getElementById("modal-budget-category").textContent = `${category} Expenses`;
  document.getElementById("modal-budget-cycle").textContent = `Cycle: ${formatReadableDate(cycle.startDate)} - ${formatReadableDate(cycle.endDate)}`;
  
  document.getElementById("modal-budget-spent").textContent = formatCurrency(actualVal);
  document.getElementById("modal-budget-limit").textContent = formatCurrency(budgetVal);
  document.getElementById("modal-budget-remaining").textContent = formatCurrency(Math.max(budgetVal - actualVal, 0));

  // Build Tag Breakdown Pills
  const tagsPillsContainer = document.getElementById("modal-budget-tags-pills");
  if (tagsPillsContainer) {
    tagsPillsContainer.innerHTML = "";

    // 1. "All" Pill
    const allPill = document.createElement("button");
    allPill.className = `modal-tag-pill ${activeBudgetTagFilter === "ALL" ? "active" : ""}`;
    allPill.innerHTML = `All <span class="pill-count-badge">${allCategoryTxs.length}</span> • ${formatCurrency(actualVal)}`;
    allPill.addEventListener("click", () => {
      showBudgetDetailsModal(category, budgetVal, actualVal, cycle, "ALL");
    });
    tagsPillsContainer.appendChild(allPill);

    // 2. Individual Tag Pills
    Object.keys(tagsMap).sort().forEach(tag => {
      const tagData = tagsMap[tag];
      const pill = document.createElement("button");
      pill.className = `modal-tag-pill ${activeBudgetTagFilter === tag ? "active" : ""}`;
      pill.innerHTML = `🏷️ ${escapeHtml(tag)} <span class="pill-count-badge">${tagData.count}</span> • ${formatCurrency(tagData.total)}`;
      pill.addEventListener("click", () => {
        showBudgetDetailsModal(category, budgetVal, actualVal, cycle, tag);
      });
      tagsPillsContainer.appendChild(pill);
    });

    // 3. "No Tag" / Untagged Pill (if any untagged transactions exist)
    if (untaggedCount > 0) {
      const noTagPill = document.createElement("button");
      noTagPill.className = `modal-tag-pill ${activeBudgetTagFilter === "_NO_TAG_" ? "active" : ""}`;
      noTagPill.innerHTML = `⚪ No Tag <span class="pill-count-badge">${untaggedCount}</span> • ${formatCurrency(untaggedTotal)}`;
      noTagPill.addEventListener("click", () => {
        showBudgetDetailsModal(category, budgetVal, actualVal, cycle, "_NO_TAG_");
      });
      tagsPillsContainer.appendChild(noTagPill);
    }
  }

  // Filter transactions based on active tag filter
  let filteredTxs = allCategoryTxs;
  let filteredSubtotal = actualVal;

  if (activeBudgetTagFilter === "_NO_TAG_") {
    filteredTxs = allCategoryTxs.filter(tx => !tx.Tags || !tx.Tags.trim());
    filteredSubtotal = untaggedTotal;
  } else if (activeBudgetTagFilter !== "ALL") {
    filteredTxs = allCategoryTxs.filter(tx => {
      if (!tx.Tags) return false;
      const tagsList = tx.Tags.split(",").map(t => t.trim().toLowerCase());
      return tagsList.includes(activeBudgetTagFilter.toLowerCase());
    });
    filteredSubtotal = tagsMap[activeBudgetTagFilter] ? tagsMap[activeBudgetTagFilter].total : 0;
  }

  // Sort by date descending
  filteredTxs.sort((a, b) => new Date(b.Date) - new Date(a.Date));

  const countEl = document.getElementById("modal-budget-count");
  if (countEl) countEl.textContent = filteredTxs.length;

  const subtotalEl = document.getElementById("modal-budget-subtotal");
  if (subtotalEl) subtotalEl.textContent = `Subtotal: ${formatCurrency(filteredSubtotal)}`;

  const listContainer = document.getElementById("modal-budget-tx-list");
  listContainer.innerHTML = "";

  if (filteredTxs.length === 0) {
    listContainer.innerHTML = `
      <div class="modal-no-tx">
        <p>No transactions found for tag <b>${activeBudgetTagFilter === "_NO_TAG_" ? "No Tag" : escapeHtml(activeBudgetTagFilter)}</b>.</p>
      </div>
    `;
  } else {
    filteredTxs.forEach(tx => {
      const item = document.createElement("div");
      item.className = "modal-tx-item";

      const left = document.createElement("div");
      left.className = "modal-tx-left";

      const dateEl = document.createElement("div");
      dateEl.className = "modal-tx-date";
      dateEl.textContent = formatReadableDate(tx.Date);
      left.appendChild(dateEl);

      if (tx.Notes) {
        const notesEl = document.createElement("div");
        notesEl.className = "modal-tx-notes";
        notesEl.textContent = tx.Notes;
        left.appendChild(notesEl);
      }

      if (tx.Tags && tx.Tags.trim()) {
        const tagsContainer = document.createElement("div");
        tagsContainer.className = "modal-tx-tags";
        tx.Tags.split(",").forEach(t => {
          if (t.trim()) {
            const badge = document.createElement("span");
            badge.className = "tag-badge";
            badge.textContent = t.trim();
            tagsContainer.appendChild(badge);
          }
        });
        left.appendChild(tagsContainer);
      } else {
        const noTagBadge = document.createElement("span");
        noTagBadge.className = "tag-badge";
        noTagBadge.style.opacity = "0.6";
        noTagBadge.style.fontStyle = "italic";
        noTagBadge.textContent = "No Tag";
        left.appendChild(noTagBadge);
      }

      const right = document.createElement("div");
      right.className = "modal-tx-right";

      const amtEl = document.createElement("span");
      amtEl.className = "modal-tx-amount";
      amtEl.textContent = `-${formatCurrency(tx.Amount)}`;
      right.appendChild(amtEl);

      const editBtn = document.createElement("button");
      editBtn.className = "tx-delete-btn";
      editBtn.style.color = "var(--primary)";
      editBtn.title = "Edit Transaction";
      editBtn.innerHTML = `<i data-lucide="pencil" style="width: 15px; height: 15px;"></i>`;
      editBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        closeBudgetModal();
        startEditTransaction(tx);
      });
      right.appendChild(editBtn);

      const deleteBtn = document.createElement("button");
      deleteBtn.className = "tx-delete-btn";
      deleteBtn.title = "Delete Transaction";
      deleteBtn.innerHTML = `<i data-lucide="trash-2" style="width: 15px; height: 15px;"></i>`;
      deleteBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        const txId = tx.id || tx.ID;
        if (!txId) {
          showToast("Error: Transaction ID missing.");
          return;
        }
        if (confirm("Delete this transaction?")) {
          deleteTransaction(txId);
          // Recalculate actual spent for this category and refresh modal
          const updatedCycle = getSalaryCycleRange();
          let updatedActual = 0;
          state.transactions.forEach(t => {
            if (t.Type === "Expense" && t.Category === category && t.Date >= updatedCycle.startDate && t.Date <= updatedCycle.endDate) {
              updatedActual += (parseFloat(t.Amount) || 0);
            }
          });
          showBudgetDetailsModal(category, budgetVal, updatedActual, updatedCycle, activeBudgetTagFilter);
        }
      });
      right.appendChild(deleteBtn);

      item.appendChild(left);
      item.appendChild(right);
      listContainer.appendChild(item);
    });
  }

  modal.classList.add("show");
  lucide.createIcons();
}

function showCategoryTypeDetailsModal(txType = "Income", cycle = getSalaryCycleRange(), selectedTag = "ALL") {
  const modal = document.getElementById("budget-modal");
  if (!modal) return;

  activeBudgetTagFilter = selectedTag;

  // Filter all transactions for this Type in active salary cycle
  const allTxs = state.transactions.filter(
    tx => tx.Type === txType && tx.Date >= cycle.startDate && tx.Date <= cycle.endDate
  );

  // Calculate totals and sub-tags
  const tagsMap = {};
  let untaggedTotal = 0;
  let untaggedCount = 0;
  let totalAmount = 0;

  allTxs.forEach(tx => {
    const amt = parseFloat(tx.Amount) || 0;
    totalAmount += amt;

    if (!tx.Tags || !tx.Tags.trim()) {
      untaggedTotal += amt;
      untaggedCount++;
    } else {
      const tagsList = tx.Tags.split(",").map(t => t.trim()).filter(Boolean);
      if (tagsList.length === 0) {
        untaggedTotal += amt;
        untaggedCount++;
      } else {
        tagsList.forEach(tag => {
          if (!tagsMap[tag]) tagsMap[tag] = { total: 0, count: 0 };
          tagsMap[tag].total += amt;
          tagsMap[tag].count++;
        });
      }
    }
  });

  // Set modal headers and top summary pills
  const typeTitle = txType === "Income" ? "Monthly Inflow (Income)" : 
                    txType === "Expense" ? "Monthly Outflow (Expenses)" : 
                    txType === "Savings" ? "Monthly Savings" : "Monthly Investments";

  document.getElementById("modal-budget-category").textContent = typeTitle;
  document.getElementById("modal-budget-cycle").textContent = `Cycle: ${formatReadableDate(cycle.startDate)} - ${formatReadableDate(cycle.endDate)}`;

  document.getElementById("modal-budget-spent").textContent = formatCurrency(totalAmount);
  
  // Set labels
  const spentPill = document.querySelector(".modal-pill.spent .pill-label");
  if (spentPill) spentPill.textContent = txType === "Income" ? "Total Inflow" : "Total Amount";

  const targetPill = document.querySelector(".modal-pill.target .pill-label");
  if (targetPill) targetPill.textContent = "Deposits / Items";
  document.getElementById("modal-budget-limit").textContent = `${allTxs.length} items`;

  const remainingPill = document.querySelector(".modal-pill.remaining .pill-label");
  if (remainingPill) remainingPill.textContent = "Average / Item";
  const avgAmt = allTxs.length > 0 ? (totalAmount / allTxs.length) : 0;
  document.getElementById("modal-budget-remaining").textContent = formatCurrency(avgAmt);

  // Build Tag Breakdown Pills
  const tagsPillsContainer = document.getElementById("modal-budget-tags-pills");
  if (tagsPillsContainer) {
    tagsPillsContainer.innerHTML = "";

    const allPill = document.createElement("button");
    allPill.className = `modal-tag-pill ${activeBudgetTagFilter === "ALL" ? "active" : ""}`;
    allPill.innerHTML = `All (${allTxs.length}) • ${formatCurrency(totalAmount)}`;
    allPill.addEventListener("click", () => {
      showCategoryTypeDetailsModal(txType, cycle, "ALL");
    });
    tagsPillsContainer.appendChild(allPill);

    Object.keys(tagsMap).sort().forEach(tag => {
      const tagData = tagsMap[tag];
      const pill = document.createElement("button");
      pill.className = `modal-tag-pill ${activeBudgetTagFilter === tag ? "active" : ""}`;
      pill.innerHTML = `🏷️ ${escapeHtml(tag)} (${tagData.count}) • ${formatCurrency(tagData.total)}`;
      pill.addEventListener("click", () => {
        showCategoryTypeDetailsModal(txType, cycle, tag);
      });
      tagsPillsContainer.appendChild(pill);
    });

    if (untaggedCount > 0) {
      const noTagPill = document.createElement("button");
      noTagPill.className = `modal-tag-pill ${activeBudgetTagFilter === "_NO_TAG_" ? "active" : ""}`;
      noTagPill.innerHTML = `⚪ No Tag (${untaggedCount}) • ${formatCurrency(untaggedTotal)}`;
      noTagPill.addEventListener("click", () => {
        showCategoryTypeDetailsModal(txType, cycle, "_NO_TAG_");
      });
      tagsPillsContainer.appendChild(noTagPill);
    }
  }

  // Filter transactions
  let filteredTxs = allTxs;
  let filteredSubtotal = totalAmount;

  if (activeBudgetTagFilter === "_NO_TAG_") {
    filteredTxs = allTxs.filter(tx => !tx.Tags || !tx.Tags.trim());
    filteredSubtotal = untaggedTotal;
  } else if (activeBudgetTagFilter !== "ALL") {
    filteredTxs = allTxs.filter(tx => {
      if (!tx.Tags) return false;
      const list = tx.Tags.split(",").map(t => t.trim().toLowerCase());
      return list.includes(activeBudgetTagFilter.toLowerCase());
    });
    filteredSubtotal = tagsMap[activeBudgetTagFilter] ? tagsMap[activeBudgetTagFilter].total : 0;
  }

  filteredTxs.sort((a, b) => new Date(b.Date) - new Date(a.Date));

  const countEl = document.getElementById("modal-budget-count");
  if (countEl) countEl.textContent = filteredTxs.length;

  const subtotalEl = document.getElementById("modal-budget-subtotal");
  if (subtotalEl) subtotalEl.textContent = `Subtotal: ${formatCurrency(filteredSubtotal)}`;

  const listContainer = document.getElementById("modal-budget-tx-list");
  listContainer.innerHTML = "";

  if (filteredTxs.length === 0) {
    listContainer.innerHTML = `<div class="modal-no-tx"><p>No ${txType.toLowerCase()} transactions logged for this tag.</p></div>`;
  } else {
    filteredTxs.forEach(tx => {
      const item = document.createElement("div");
      item.className = "modal-tx-item";

      const left = document.createElement("div");
      left.className = "modal-tx-left";

      const headerLine = document.createElement("div");
      headerLine.style.display = "flex";
      headerLine.style.alignItems = "center";
      headerLine.style.gap = "8px";

      const dateEl = document.createElement("span");
      dateEl.className = "modal-tx-date";
      dateEl.textContent = formatReadableDate(tx.Date);
      headerLine.appendChild(dateEl);

      const catBadge = document.createElement("span");
      catBadge.style.fontSize = "0.72rem";
      catBadge.style.fontWeight = "700";
      catBadge.style.color = txType === "Income" ? "var(--income)" : "var(--primary)";
      catBadge.textContent = `[${tx.Category}]`;
      headerLine.appendChild(catBadge);

      left.appendChild(headerLine);

      if (tx.Notes) {
        const notesEl = document.createElement("div");
        notesEl.className = "modal-tx-notes";
        notesEl.textContent = tx.Notes;
        left.appendChild(notesEl);
      }

      if (tx.Tags && tx.Tags.trim()) {
        const tagsContainer = document.createElement("div");
        tagsContainer.className = "modal-tx-tags";
        tx.Tags.split(",").forEach(t => {
          if (t.trim()) {
            const badge = document.createElement("span");
            badge.className = "tag-badge";
            badge.textContent = t.trim();
            tagsContainer.appendChild(badge);
          }
        });
        left.appendChild(tagsContainer);
      } else {
        const noTagBadge = document.createElement("span");
        noTagBadge.className = "tag-badge";
        noTagBadge.style.opacity = "0.6";
        noTagBadge.textContent = "No Tag";
        left.appendChild(noTagBadge);
      }

      const right = document.createElement("div");
      right.className = "modal-tx-right";

      const amtEl = document.createElement("span");
      amtEl.className = "modal-tx-amount";
      amtEl.style.color = txType === "Income" ? "var(--income)" : "var(--expense)";
      amtEl.textContent = `${txType === "Income" ? "+" : "-"}${formatCurrency(tx.Amount)}`;
      right.appendChild(amtEl);

      const editBtn = document.createElement("button");
      editBtn.className = "tx-delete-btn";
      editBtn.style.color = "var(--primary)";
      editBtn.title = "Edit Transaction";
      editBtn.innerHTML = `<i data-lucide="pencil" style="width: 15px; height: 15px;"></i>`;
      editBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        closeBudgetModal();
        startEditTransaction(tx);
      });
      right.appendChild(editBtn);

      const deleteBtn = document.createElement("button");
      deleteBtn.className = "tx-delete-btn";
      deleteBtn.title = "Delete Transaction";
      deleteBtn.innerHTML = `<i data-lucide="trash-2" style="width: 15px; height: 15px;"></i>`;
      deleteBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        const txId = tx.id || tx.ID;
        if (!txId) return;
        if (confirm("Delete this transaction?")) {
          deleteTransaction(txId);
          showCategoryTypeDetailsModal(txType, cycle, activeBudgetTagFilter);
        }
      });
      right.appendChild(deleteBtn);

      item.appendChild(left);
      item.appendChild(right);
      listContainer.appendChild(item);
    });
  }

  modal.classList.add("show");
  lucide.createIcons();
}

function showInflowDetailsModal(cycle) {
  showCategoryTypeDetailsModal("Income", cycle);
}

function showOutflowDetailsModal(cycle) {
  showCategoryTypeDetailsModal("Expense", cycle);
}

window.showBudgetDetailsModal = showBudgetDetailsModal;
window.showInflowDetailsModal = showInflowDetailsModal;
window.showOutflowDetailsModal = showOutflowDetailsModal;
window.showCategoryTypeDetailsModal = showCategoryTypeDetailsModal;
window.closeBudgetModal = closeBudgetModal;

// Keyboard accessibility: ESC key to close modal
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    closeBudgetModal();
  }
});

