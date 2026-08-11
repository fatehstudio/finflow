/**
 * FinFlow Asset Hub - Professional Wealth & Analytics Controller
 * (Preview Mode Engine)
 */

const CATEGORIES = {
  Income: ["Salary", "Freelance", "Investment", "Gift", "Other"],
  Expense: [
    "Food",
    "Transport",
    "Utilities",
    "Entertainment",
    "Shopping",
    "Health",
    "Fateh",
    "Loan",
    "Ummi",
    "Other"
  ],
  Savings: ["Emergency", "Tabung", "Retirement", "Travel", "Other"],
  Investment: ["Stocks", "Crypto", "Real Estate", "Mutual Funds", "Other"]
};

// Global App State
const state = {
  transactions: [],
  budgets: {},
  settings: {
    apiUrl: "",
    currencySymbol: "RM"
  },
  customTags: []
};

// Chart instances
let donutChartInstance = null;
let trendChartInstance = null;
let stackedChartInstance = null;
let tagChartInstance = null;

// =============================================================
// Salary Cycle Helper (25th of month to 24th of next month)
// =============================================================
function formatDateToYMD(date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function getSalaryCycleRange(targetDate = new Date()) {
  const year = targetDate.getFullYear();
  const month = targetDate.getMonth(); // 0-indexed
  const day = targetDate.getDate();

  let startYear, startMonth, endYear, endMonth;

  if (day >= 25) {
    startYear = year;
    startMonth = month;
    if (month === 11) {
      endYear = year + 1;
      endMonth = 0;
    } else {
      endYear = year;
      endMonth = month + 1;
    }
  } else {
    if (month === 0) {
      startYear = year - 1;
      startMonth = 11;
    } else {
      startYear = year;
      startMonth = month - 1;
    }
    endYear = year;
    endMonth = month;
  }

  const startDate = new Date(startYear, startMonth, 25);
  const endDate = new Date(endYear, endMonth, 24);

  return {
    startDate: formatDateToYMD(startDate),
    endDate: formatDateToYMD(endDate),
    startDateObj: startDate,
    endDateObj: endDate
  };
}

function formatReadableDate(dateStr) {
  const dateObj = new Date(dateStr);
  if (isNaN(dateObj)) return dateStr;
  return dateObj.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatCurrency(amount) {
  const sym = state.settings.currencySymbol || "RM";
  return `${sym} ${parseFloat(amount || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
}

function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// =============================================================
// LocalStorage State Management (Shared with Main App)
// =============================================================
function loadLocalData() {
  const localTx = localStorage.getItem("finflow_transactions");
  const localBudgets = localStorage.getItem("finflow_budgets");
  const localSettings = localStorage.getItem("finflow_settings");
  const localCustomTags = localStorage.getItem("finflow_custom_tags");

  if (localTx) {
    const parsed = JSON.parse(localTx);
    state.transactions = parsed.map(tx => {
      const id = tx.id || tx.ID || "tx_" + new Date().getTime();
      return { ...tx, id: id, ID: id };
    });
  }
  if (localBudgets) state.budgets = JSON.parse(localBudgets);
  if (localSettings) state.settings = JSON.parse(localSettings);
  if (localCustomTags) state.customTags = JSON.parse(localCustomTags);
}

function saveStateToLocal() {
  localStorage.setItem("finflow_transactions", JSON.stringify(state.transactions));
  localStorage.setItem("finflow_budgets", JSON.stringify(state.budgets));
  localStorage.setItem("finflow_settings", JSON.stringify(state.settings));
  localStorage.setItem("finflow_custom_tags", JSON.stringify(state.customTags));
}

// =============================================================
// Initialization & Navigation
// =============================================================
document.addEventListener("DOMContentLoaded", () => {
  loadLocalData();
  lucide.createIcons();

  // Initialize tabs navigation
  const tabButtons = document.querySelectorAll(".hub-tab-btn");
  tabButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      tabButtons.forEach(b => b.classList.remove("active"));
      document.querySelectorAll(".hub-tab-content").forEach(tc => tc.classList.remove("active"));

      btn.classList.add("active");
      const targetTab = btn.getAttribute("data-tab");
      const targetContent = document.getElementById(`tab-${targetTab}`);
      if (targetContent) targetContent.classList.add("active");

      // Trigger chart resize / re-render
      if (targetTab === "comparison") {
        renderMoMComparison();
      } else if (targetTab === "tags") {
        renderTagsDeepDive();
      }
    });
  });

  // Cycle label
  const activeCycle = getSalaryCycleRange();
  document.getElementById("hub-cycle-label").textContent = `Salary Cycle: ${formatReadableDate(
    activeCycle.startDate
  )} - ${formatReadableDate(activeCycle.endDate)}`;

  // Initial render
  updateHubUI();

  // Auto-sync with Google Sheets if configured
  if (state.settings.apiUrl) {
    syncWithSheets(false);
  }
});

// Update Entire Hub UI
function updateHubUI() {
  renderExecutiveKPIs();
  renderDonutChart();
  renderCashFlowRunwayChart();
  renderBudgetMeters();
  renderRecentActivity();
  setupMoMSelectors();
  lucide.createIcons();
}

// =============================================================
// 1. Executive 4-KPI Wealth & Cashflow Calculations
// =============================================================
function renderExecutiveKPIs() {
  const cycle = getSalaryCycleRange();

  let totalIncome = 0;
  let totalExpense = 0;
  let totalSavings = 0;
  let totalInvestment = 0;

  let cycleIncome = 0;
  let cycleExpense = 0;
  let cycleSavings = 0;
  let cycleInvestment = 0;
  let cycleIncomeCount = 0;

  // All-time & Cycle metrics
  state.transactions.forEach(tx => {
    const amt = parseFloat(tx.Amount) || 0;

    // All time totals
    if (tx.Type === "Income") totalIncome += amt;
    else if (tx.Type === "Expense") totalExpense += amt;
    else if (tx.Type === "Savings") totalSavings += amt;
    else if (tx.Type === "Investment") totalInvestment += amt;

    // Active salary cycle totals
    if (tx.Date >= cycle.startDate && tx.Date <= cycle.endDate) {
      if (tx.Type === "Income") {
        cycleIncome += amt;
        cycleIncomeCount++;
      } else if (tx.Type === "Expense") cycleExpense += amt;
      else if (tx.Type === "Savings") cycleSavings += amt;
      else if (tx.Type === "Investment") cycleInvestment += amt;
    }
  });

  // Net Balance / Net Worth
  const netWorth = totalIncome - totalExpense;
  const liquidCash = Math.max(netWorth - totalSavings - totalInvestment, 0);
  const investedSaved = totalSavings + totalInvestment;

  document.getElementById("kpi-val-net").textContent = formatCurrency(netWorth);
  document.getElementById("lbl-split-liquid").textContent = formatCurrency(liquidCash);
  document.getElementById("lbl-split-invested").textContent = formatCurrency(investedSaved);

  const totalAssets = liquidCash + investedSaved;
  const liquidPct = totalAssets > 0 ? (liquidCash / totalAssets) * 100 : 50;
  const investedPct = 100 - liquidPct;

  document.getElementById("bar-split-liquid").style.width = `${liquidPct}%`;
  document.getElementById("bar-split-invested").style.width = `${investedPct}%`;

  // Monthly Income (Inflow)
  document.getElementById("kpi-val-income").textContent = formatCurrency(cycleIncome);
  document.getElementById("kpi-income-tx-count").textContent = `${cycleIncomeCount} deposits`;

  // Monthly Expenses & Daily Burn Rate
  document.getElementById("kpi-val-expense").textContent = formatCurrency(cycleExpense);

  const today = new Date();
  const startD = new Date(cycle.startDate);
  const endD = new Date(cycle.endDate);

  const daysElapsed = Math.max(1, Math.ceil((today - startD) / (1000 * 60 * 60 * 24)));
  const totalDaysInCycle = Math.ceil((endD - startD) / (1000 * 60 * 60 * 24)) + 1;
  const daysLeft = Math.max(0, Math.ceil((endD - today) / (1000 * 60 * 60 * 24)));

  const dailyBurn = cycleExpense / daysElapsed;
  document.getElementById("kpi-burn-rate").textContent = `${formatCurrency(dailyBurn)}/day`;
  document.getElementById("kpi-days-left").textContent = `${daysLeft} days left`;

  // Savings & Retention Rate
  const retainedCapital = cycleIncome - cycleExpense;
  const savingsRate = cycleIncome > 0 ? (retainedCapital / cycleIncome) * 100 : 0;

  const savingsRateEl = document.getElementById("kpi-val-savings-rate");
  savingsRateEl.textContent = `${savingsRate.toFixed(1)}%`;
  document.getElementById("kpi-val-retained").textContent = formatCurrency(retainedCapital);

  const statusBadge = document.getElementById("kpi-savings-status");
  if (savingsRate >= 30) {
    statusBadge.textContent = "Excellent (>30%)";
    statusBadge.style.color = "#34d399";
  } else if (savingsRate >= 20) {
    statusBadge.textContent = "On Target (20-30%)";
    statusBadge.style.color = "#38bdf8";
  } else if (savingsRate > 0) {
    statusBadge.textContent = "Moderate (<20%)";
    statusBadge.style.color = "#fbbf24";
  } else {
    statusBadge.textContent = "Deficit";
    statusBadge.style.color = "#fb7185";
  }
}

// =============================================================
// 2. Asset / Expense Allocation Donut Chart
// =============================================================
function renderDonutChart() {
  const ctx = document.getElementById("hub-chart-donut");
  if (!ctx) return;

  const cycle = getSalaryCycleRange();
  const expenseCategories = CATEGORIES.Expense;
  const categoryTotals = {};
  expenseCategories.forEach(cat => {
    categoryTotals[cat] = 0;
  });

  let totalExpense = 0;
  state.transactions.forEach(tx => {
    if (tx.Type === "Expense" && tx.Date >= cycle.startDate && tx.Date <= cycle.endDate) {
      const amt = parseFloat(tx.Amount) || 0;
      categoryTotals[tx.Category] = (categoryTotals[tx.Category] || 0) + amt;
      totalExpense += amt;
    }
  });

  const activeCategories = [];
  const activeAmounts = [];
  const colorPalette = [
    "#6366f1",
    "#ec4899",
    "#f59e0b",
    "#10b981",
    "#3b82f6",
    "#8b5cf6",
    "#14b8a6",
    "#f43f5e",
    "#06b6d4",
    "#a855f7"
  ];

  expenseCategories.forEach(cat => {
    if (categoryTotals[cat] > 0) {
      activeCategories.push(cat);
      activeAmounts.push(categoryTotals[cat]);
    }
  });

  if (activeCategories.length === 0) {
    activeCategories.push("No Expenses Yet");
    activeAmounts.push(1);
  }

  // Calculate percentage labels for interactive slashable legend
  const labelsWithPct = activeCategories.map((cat, idx) => {
    if (cat === "No Expenses Yet") return cat;
    const amt = activeAmounts[idx];
    const pct = totalExpense > 0 ? ((amt / totalExpense) * 100).toFixed(1) : 0;
    return `${cat} (${pct}%)`;
  });

  // Empty pill container as Chart.js interactive legend provides native click-to-slash
  const pillsContainer = document.getElementById("hub-donut-legend-pills");
  if (pillsContainer) {
    pillsContainer.innerHTML = "";
  }

  if (donutChartInstance) {
    donutChartInstance.destroy();
  }

  donutChartInstance = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: labelsWithPct,
      datasets: [
        {
          data: activeAmounts,
          backgroundColor:
            activeCategories[0] === "No Expenses Yet"
              ? ["rgba(255, 255, 255, 0.1)"]
              : colorPalette.slice(0, activeCategories.length),
          borderWidth: 2,
          borderColor: "#111827",
          hoverOffset: 6
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: "68%",
      plugins: {
        legend: {
          display: activeCategories[0] !== "No Expenses Yet",
          position: "bottom",
          labels: {
            boxWidth: 12,
            boxHeight: 12,
            usePointStyle: true,
            pointStyle: "circle",
            padding: 12,
            color: "#cbd5e1",
            font: { family: "'Plus Jakarta Sans', sans-serif", size: 11, weight: "600" }
          }
        },
        tooltip: {
          backgroundColor: "#1e293b",
          titleColor: "#ffffff",
          bodyColor: "#cbd5e1",
          borderColor: "rgba(255, 255, 255, 0.1)",
          borderWidth: 1,
          padding: 12,
          callbacks: {
            label: function (ctx) {
              if (ctx.label === "No Expenses Yet") return "No data";
              const val = ctx.raw || 0;
              const cleanLabel = ctx.label.split(" (")[0];
              const total = ctx.dataset.data.reduce((acc, v, i) => (donutChartInstance && donutChartInstance.getDataVisibility(i)) ? acc + v : acc, 0);
              const pct = total > 0 ? ((val / total) * 100).toFixed(1) : 0;
              return ` ${cleanLabel}: ${formatCurrency(val)} (${pct}%)`;
            }
          }
        }
      }
    }
  });
}

function downloadHubDonutImage() {
  const canvas = document.getElementById("hub-chart-donut");
  if (!canvas) return;

  const tempCanvas = document.createElement("canvas");
  tempCanvas.width = canvas.width;
  tempCanvas.height = canvas.height;
  const tempCtx = tempCanvas.getContext("2d");

  tempCtx.fillStyle = "#111827";
  tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
  tempCtx.drawImage(canvas, 0, 0);

  const link = document.createElement("a");
  link.download = `finflow-expenses-distribution-${formatDateToYMD(new Date())}.png`;
  link.href = tempCanvas.toDataURL("image/png");
  link.click();
  showToast("Expenses Donut chart exported successfully!", "success");
}

// =============================================================
// 3. Cash Flow Runway Trend Chart (Past 6 Cycles)
// =============================================================
function renderCashFlowRunwayChart() {
  const canvas = document.getElementById("hub-chart-trend");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");

  const today = new Date();
  const cycleLabels = [];
  const cycleRanges = [];
  const incomeSeries = [];
  const expenseSeries = [];

  for (let i = 5; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 15);
    const c = getSalaryCycleRange(d);

    const startM = new Date(c.startDate).toLocaleDateString("en-US", { month: "short" });
    const endM = new Date(c.endDate).toLocaleDateString("en-US", { month: "short" });
    cycleLabels.push(`${startM}-${endM}`);
    cycleRanges.push(`${formatReadableDate(c.startDate)} - ${formatReadableDate(c.endDate)}`);

    let income = 0;
    let expense = 0;

    state.transactions.forEach(tx => {
      if (tx.Date >= c.startDate && tx.Date <= c.endDate) {
        const amt = parseFloat(tx.Amount) || 0;
        if (tx.Type === "Income") income += amt;
        else if (tx.Type === "Expense") expense += amt;
      }
    });

    incomeSeries.push(income);
    expenseSeries.push(expense);
  }

  if (trendChartInstance) {
    trendChartInstance.destroy();
  }

  trendChartInstance = new Chart(ctx, {
    type: "bar",
    data: {
      labels: cycleLabels,
      datasets: [
        {
          label: "Inflow (Income)",
          data: incomeSeries,
          backgroundColor: "#10b981",
          borderRadius: 8,
          barPercentage: 0.6,
          categoryPercentage: 0.6
        },
        {
          label: "Outflow (Expense)",
          data: expenseSeries,
          backgroundColor: "#f43f5e",
          borderRadius: 8,
          barPercentage: 0.6,
          categoryPercentage: 0.6
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          grid: { color: "rgba(255, 255, 255, 0.05)" },
          ticks: { color: "#94a3b8", font: { weight: "600" } }
        },
        y: {
          grid: { color: "rgba(255, 255, 255, 0.05)" },
          ticks: {
            color: "#64748b",
            callback: val => formatCurrency(val)
          }
        }
      },
      plugins: {
        legend: {
          position: "top",
          labels: { color: "#cbd5e1", font: { weight: "600" } }
        },
        tooltip: {
          backgroundColor: "#1e293b",
          padding: 12,
          callbacks: {
            title: function (items) {
              const idx = items[0].dataIndex;
              return `${cycleLabels[idx]} (${cycleRanges[idx]})`;
            },
            label: function (ctx) {
              return ` ${ctx.dataset.label}: ${formatCurrency(ctx.raw)}`;
            }
          }
        }
      }
    }
  });
}

// =============================================================
// 4. Category Budget Meters (Lists All Categories With Sub-Tags & Click Drill-Down)
// =============================================================
function renderBudgetMeters() {
  const container = document.getElementById("hub-budget-meters-list");
  if (!container) return;
  container.innerHTML = "";

  const cycle = getSalaryCycleRange();
  const expenseCategories = CATEGORIES.Expense;

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

  let hasCards = false;

  expenseCategories.forEach(cat => {
    const budgetVal = parseFloat(state.budgets[cat]) || 0;
    const actualVal = actuals[cat] || 0;

    hasCards = true;
    const percentage = budgetVal > 0 ? Math.round((actualVal / budgetVal) * 100) : (actualVal > 0 ? 100 : 0);

    let statusClass = "normal";
    let statusText = "On Track";

    if (budgetVal > 0) {
      if (actualVal > budgetVal) {
        statusClass = "danger";
        statusText = "Over Budget";
      } else if (actualVal >= budgetVal * 0.8) {
        statusClass = "warning";
        statusText = "Approaching Limit";
      }
    } else {
      if (actualVal > 0) {
        statusClass = "normal";
        statusText = "Tracked";
      } else {
        statusClass = "normal";
        statusText = "No Spending";
      }
    }

    const card = document.createElement("div");
    card.className = "hub-meter-card";
    card.title = `Click to inspect all ${cat} transactions & sub-tags`;

    // Build Sub-tags chips HTML
    const tagsObj = categoryTagsMap[cat] || {};
    let subTagsHtml = "";
    const tagKeys = Object.keys(tagsObj);

    if (tagKeys.length > 0) {
      const chips = tagKeys.map(tag => {
        const tagAmt = tagsObj[tag];
        const tagPct = actualVal > 0 ? ((tagAmt / actualVal) * 100).toFixed(0) : 0;
        if (tag === "_NO_TAG_") {
          return `<span class="meter-subtag-chip">⚪ No Tag: <b>${formatCurrency(tagAmt)}</b> (${tagPct}%)</span>`;
        }
        return `<span class="meter-subtag-chip">🏷️ ${escapeHtml(tag)}: <b>${formatCurrency(tagAmt)}</b> (${tagPct}%)</span>`;
      }).join("");

      subTagsHtml = `<div class="meter-subtags-row">${chips}</div>`;
    }

    card.innerHTML = `
      <div class="meter-header">
        <span class="meter-category">${cat}</span>
        <span class="meter-status-badge ${statusClass}">${statusText} ${budgetVal > 0 ? `(${percentage}%)` : ""}</span>
      </div>
      <div class="meter-bar-track">
        <div class="meter-bar-fill ${statusClass}" style="width: ${budgetVal > 0 ? Math.min(percentage, 100) : (actualVal > 0 ? 100 : 0)}%"></div>
      </div>
      <div class="meter-footer">
        <span>Spent: <b>${formatCurrency(actualVal)}</b></span>
        <span>Budget: <b>${budgetVal > 0 ? formatCurrency(budgetVal) : "No Limit"}</b></span>
        <span>Remaining: <b>${budgetVal > 0 ? formatCurrency(Math.max(budgetVal - actualVal, 0)) : "-"}</b></span>
      </div>
      ${subTagsHtml}
    `;

    card.addEventListener("click", () => {
      showBudgetDetailsModal(cat, budgetVal, actualVal, cycle);
    });

    container.appendChild(card);
  });

  if (!hasCards) {
    container.innerHTML = `
      <div class="modal-no-tx">
        <p>No category budgets configured or expenses logged yet.</p>
        <p style="font-size: 0.75rem; margin-top: 4px;">Set monthly limits in the Standard App's Budgets tab.</p>
      </div>
    `;
  }
}

// =============================================================
// 5. Recent Activity Live Ledger
// =============================================================
function renderRecentActivity() {
  const container = document.getElementById("hub-recent-tx-list");
  if (!container) return;
  container.innerHTML = "";

  const sortedTxs = [...state.transactions].sort((a, b) => new Date(b.Date) - new Date(a.Date));
  const recent = sortedTxs.slice(0, 5);

  if (recent.length === 0) {
    container.innerHTML = `<div class="modal-no-tx"><p>No transactions logged yet.</p></div>`;
    return;
  }

  recent.forEach(tx => {
    const row = document.createElement("div");
    row.className = "hub-tx-row";

    const typeClass = (tx.Type || "expense").toLowerCase();
    const prefix = tx.Type === "Income" ? "+" : "-";

    const left = document.createElement("div");
    left.className = "hub-tx-left";

    const icon = document.createElement("div");
    icon.className = `hub-tx-icon ${typeClass}`;
    icon.innerHTML = `<i data-lucide="${
      tx.Type === "Income" ? "arrow-down-left" : "arrow-up-right"
    }" style="width: 18px; height: 18px;"></i>`;
    left.appendChild(icon);

    const info = document.createElement("div");
    info.className = "hub-tx-info";
    info.innerHTML = `
      <h5>${escapeHtml(tx.Category)} ${tx.Notes ? `• <span style="font-weight: 500; color: var(--text-secondary);">${escapeHtml(tx.Notes)}</span>` : ""}</h5>
      <p>${formatReadableDate(tx.Date)}</p>
    `;

    if (tx.Tags && tx.Tags.trim()) {
      const tagsRow = document.createElement("div");
      tagsRow.className = "hub-tx-tags";
      tx.Tags.split(",").forEach(t => {
        if (t.trim()) {
          const badge = document.createElement("span");
          badge.className = "hub-tag-badge";
          badge.textContent = t.trim();
          tagsRow.appendChild(badge);
        }
      });
      info.appendChild(tagsRow);
    }
    left.appendChild(info);

    const right = document.createElement("div");
    right.className = "hub-tx-right";

    const amt = document.createElement("span");
    amt.className = `hub-tx-amount ${typeClass}`;
    amt.textContent = `${prefix}${formatCurrency(tx.Amount)}`;
    right.appendChild(amt);

    row.appendChild(left);
    row.appendChild(right);
    container.appendChild(row);
  });
}

// =============================================================
// 6. Month-over-Month (MoM) Analytics Engine
// =============================================================
function setupMoMSelectors() {
  const currSelect = document.getElementById("mom-select-current");
  const prevSelect = document.getElementById("mom-select-previous");
  if (!currSelect || !prevSelect) return;

  currSelect.innerHTML = "";
  prevSelect.innerHTML = "";

  const today = new Date();
  const availableCycles = [];

  for (let i = 0; i < 6; i++) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, today.getDate());
    const cycle = getSalaryCycleRange(d);
    const label = `${cycle.endDateObj.toLocaleString("en-US", { month: "short", year: "numeric" })} (${formatReadableDate(cycle.startDate)} - ${formatReadableDate(cycle.endDate)})`;
    availableCycles.push({ label, ...cycle });
  }

  availableCycles.forEach((c, idx) => {
    const opt1 = document.createElement("option");
    opt1.value = idx;
    opt1.textContent = c.label;
    currSelect.appendChild(opt1);

    const opt2 = document.createElement("option");
    opt2.value = idx;
    opt2.textContent = c.label;
    prevSelect.appendChild(opt2);
  });

  // Default: Current = index 0 (Active Cycle), Previous = index 1 (Last Cycle)
  currSelect.value = "0";
  prevSelect.value = "1";

  currSelect.addEventListener("change", () => renderMoMComparison());
  prevSelect.addEventListener("change", () => renderMoMComparison());

  renderMoMComparison();
}

function renderMoMComparison() {
  const currSelect = document.getElementById("mom-select-current");
  const prevSelect = document.getElementById("mom-select-previous");
  if (!currSelect || !prevSelect) return;

  const today = new Date();
  const currIdx = parseInt(currSelect.value, 10) || 0;
  const prevIdx = parseInt(prevSelect.value, 10) || 1;

  const currDate = new Date(today.getFullYear(), today.getMonth() - currIdx, today.getDate());
  const prevDate = new Date(today.getFullYear(), today.getMonth() - prevIdx, today.getDate());

  const currentCycle = getSalaryCycleRange(currDate);
  const prevCycle = getSalaryCycleRange(prevDate);

  const expenseCategories = CATEGORIES.Expense;
  const currentActuals = {};
  const prevActuals = {};

  expenseCategories.forEach(cat => {
    currentActuals[cat] = 0;
    prevActuals[cat] = 0;
  });

  let totalCurrent = 0;
  let totalPrev = 0;

  state.transactions.forEach(tx => {
    if (tx.Type === "Expense") {
      const amt = parseFloat(tx.Amount) || 0;
      if (tx.Date >= currentCycle.startDate && tx.Date <= currentCycle.endDate) {
        currentActuals[tx.Category] = (currentActuals[tx.Category] || 0) + amt;
        totalCurrent += amt;
      }
      if (tx.Date >= prevCycle.startDate && tx.Date <= prevCycle.endDate) {
        prevActuals[tx.Category] = (prevActuals[tx.Category] || 0) + amt;
        totalPrev += amt;
      }
    }
  });

  // High-Level Delta Cards
  const totalDelta = totalCurrent - totalPrev;
  const totalPct = totalPrev > 0 ? ((totalDelta / totalPrev) * 100).toFixed(1) : "0.0";

  const totalDeltaEl = document.getElementById("mom-val-total-delta");
  totalDeltaEl.textContent = `${totalDelta >= 0 ? "+" : ""}${formatCurrency(totalDelta)}`;
  totalDeltaEl.className = `delta-value ${totalDelta > 0 ? "text-expense" : "text-income"}`;

  document.getElementById("mom-val-pct-delta").textContent = `${totalDelta >= 0 ? "+" : ""}${totalPct}% vs previous cycle`;

  // Find Top Increase & Top Saved
  let maxIncreaseCat = null;
  let maxIncreaseAmt = 0;
  let maxSavedCat = null;
  let maxSavedAmt = 0;

  expenseCategories.forEach(cat => {
    const diff = currentActuals[cat] - prevActuals[cat];
    if (diff > maxIncreaseAmt) {
      maxIncreaseAmt = diff;
      maxIncreaseCat = cat;
    }
    if (diff < maxSavedAmt) {
      maxSavedAmt = diff;
      maxSavedCat = cat;
    }
  });

  if (maxIncreaseCat && maxIncreaseAmt > 0) {
    document.getElementById("mom-val-top-increase").textContent = `${maxIncreaseCat} (+${formatCurrency(maxIncreaseAmt)})`;
    document.getElementById("mom-sub-top-increase").textContent = `Increased from ${formatCurrency(prevActuals[maxIncreaseCat])} to ${formatCurrency(currentActuals[maxIncreaseCat])}`;
  } else {
    document.getElementById("mom-val-top-increase").textContent = "None";
    document.getElementById("mom-sub-top-increase").textContent = "No category increased";
  }

  if (maxSavedCat && maxSavedAmt < 0) {
    document.getElementById("mom-val-top-saved").textContent = `${maxSavedCat} (-${formatCurrency(Math.abs(maxSavedAmt))})`;
    document.getElementById("mom-sub-top-saved").textContent = `Reduced from ${formatCurrency(prevActuals[maxSavedCat])} to ${formatCurrency(currentActuals[maxSavedCat])}`;
  } else {
    document.getElementById("mom-val-top-saved").textContent = "None";
    document.getElementById("mom-sub-top-saved").textContent = "No category reduced";
  }

  // Populate Table
  const tbody = document.getElementById("mom-table-body");
  tbody.innerHTML = "";

  expenseCategories.forEach(cat => {
    const curr = currentActuals[cat];
    const prev = prevActuals[cat];
    if (curr === 0 && prev === 0) return; // skip empty

    const delta = curr - prev;
    const pct = prev > 0 ? ((delta / prev) * 100).toFixed(1) : curr > 0 ? "+100%" : "0.0%";

    let badgeClass = "neutral";
    let statusLabel = "Unchanged";

    if (delta < 0) {
      badgeClass = "improved";
      statusLabel = `Saved ${formatCurrency(Math.abs(delta))}`;
    } else if (delta > 0) {
      badgeClass = "increased";
      statusLabel = `Up ${formatCurrency(delta)}`;
    }

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><b>${cat}</b></td>
      <td>${formatCurrency(prev)}</td>
      <td>${formatCurrency(curr)}</td>
      <td style="color: ${delta > 0 ? "#fb7185" : delta < 0 ? "#34d399" : "#94a3b8"}; font-weight: 700;">
        ${delta > 0 ? "+" : ""}${formatCurrency(delta)}
      </td>
      <td>${delta > 0 ? "+" : ""}${pct}${typeof pct === "number" ? "%" : ""}</td>
      <td><span class="badge-variance ${badgeClass}">${statusLabel}</span></td>
    `;
    tbody.appendChild(tr);
  });

  renderStackedCategoriesChart();
}

function renderStackedCategoriesChart() {
  const ctx = document.getElementById("hub-chart-stacked-categories");
  if (!ctx) return;

  const cycleLabels = [];
  const today = new Date();
  const expenseCategories = CATEGORIES.Expense;
  const datasetsMap = {};

  const colors = [
    "#6366f1",
    "#ec4899",
    "#f59e0b",
    "#10b981",
    "#3b82f6",
    "#8b5cf6",
    "#14b8a6",
    "#f43f5e",
    "#06b6d4",
    "#a855f7"
  ];

  expenseCategories.forEach((cat, idx) => {
    datasetsMap[cat] = {
      label: cat,
      data: [],
      backgroundColor: colors[idx % colors.length]
    };
  });

  for (let i = 5; i >= 0; i--) {
    const cycleDate = new Date(today.getFullYear(), today.getMonth() - i, today.getDate());
    const cycle = getSalaryCycleRange(cycleDate);
    cycleLabels.push(cycle.endDateObj.toLocaleString("en-US", { month: "short" }));

    const categorySums = {};
    expenseCategories.forEach(c => {
      categorySums[c] = 0;
    });

    state.transactions.forEach(tx => {
      if (tx.Type === "Expense" && tx.Date >= cycle.startDate && tx.Date <= cycle.endDate) {
        categorySums[tx.Category] = (categorySums[tx.Category] || 0) + (parseFloat(tx.Amount) || 0);
      }
    });

    expenseCategories.forEach(cat => {
      datasetsMap[cat].data.push(categorySums[cat]);
    });
  }

  // Filter out datasets with zero spending across all 6 cycles
  const activeDatasets = Object.values(datasetsMap).filter(ds => ds.data.some(val => val > 0));

  if (stackedChartInstance) {
    stackedChartInstance.destroy();
  }

  stackedChartInstance = new Chart(ctx, {
    type: "bar",
    data: {
      labels: cycleLabels,
      datasets: activeDatasets
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          stacked: true,
          grid: { color: "rgba(255, 255, 255, 0.05)" },
          ticks: { color: "#94a3b8" }
        },
        y: {
          stacked: true,
          grid: { color: "rgba(255, 255, 255, 0.05)" },
          ticks: {
            color: "#64748b",
            callback: val => formatCurrency(val)
          }
        }
      },
      plugins: {
        legend: {
          position: "top",
          labels: { color: "#cbd5e1" }
        },
        tooltip: {
          backgroundColor: "#1e293b",
          padding: 12,
          callbacks: {
            label: function (ctx) {
              return ` ${ctx.dataset.label}: ${formatCurrency(ctx.raw)}`;
            }
          }
        }
      }
    }
  });
}

// =============================================================
// 7. Tag Deep-Dive Analytics
// =============================================================
function renderTagsDeepDive() {
  const container = document.getElementById("hub-tag-cards-grid");
  if (!container) return;
  container.innerHTML = "";

  const cycle = getSalaryCycleRange();
  const tagsMap = {};
  let untaggedTotal = 0;
  let untaggedCount = 0;
  let totalCycleExpense = 0;

  state.transactions.forEach(tx => {
    if (tx.Type === "Expense" && tx.Date >= cycle.startDate && tx.Date <= cycle.endDate) {
      const amt = parseFloat(tx.Amount) || 0;
      totalCycleExpense += amt;

      if (!tx.Tags || !tx.Tags.trim()) {
        untaggedTotal += amt;
        untaggedCount++;
      } else {
        const list = tx.Tags.split(",").map(t => t.trim()).filter(Boolean);
        if (list.length === 0) {
          untaggedTotal += amt;
          untaggedCount++;
        } else {
          list.forEach(t => {
            if (!tagsMap[t]) tagsMap[t] = { total: 0, count: 0 };
            tagsMap[t].total += amt;
            tagsMap[t].count++;
          });
        }
      }
    }
  });

  const chartLabels = [];
  const chartValues = [];

  // Individual tags
  Object.keys(tagsMap).sort().forEach(tag => {
    const data = tagsMap[tag];
    const pct = totalCycleExpense > 0 ? ((data.total / totalCycleExpense) * 100).toFixed(1) : 0;

    chartLabels.push(tag);
    chartValues.push(data.total);

    const card = document.createElement("div");
    card.className = "hub-tag-stat-card";
    card.innerHTML = `
      <div class="tag-stat-header">
        <h4>🏷️ ${escapeHtml(tag)}</h4>
        <span class="tag-stat-count">${data.count} items</span>
      </div>
      <div class="tag-stat-amount">${formatCurrency(data.total)}</div>
      <div class="tag-stat-pct">${pct}% of cycle expenses</div>
    `;
    container.appendChild(card);
  });

  // Untagged
  if (untaggedCount > 0) {
    const untaggedPct = totalCycleExpense > 0 ? ((untaggedTotal / totalCycleExpense) * 100).toFixed(1) : 0;
    chartLabels.push("No Tag");
    chartValues.push(untaggedTotal);

    const card = document.createElement("div");
    card.className = "hub-tag-stat-card";
    card.innerHTML = `
      <div class="tag-stat-header">
        <h4>⚪ No Tag</h4>
        <span class="tag-stat-count">${untaggedCount} items</span>
      </div>
      <div class="tag-stat-amount">${formatCurrency(untaggedTotal)}</div>
      <div class="tag-stat-pct">${untaggedPct}% of cycle expenses</div>
    `;
    container.appendChild(card);
  }

  // Render Horizontal Bar Chart
  const ctx = document.getElementById("hub-chart-tags");
  if (!ctx) return;

  if (tagChartInstance) tagChartInstance.destroy();

  tagChartInstance = new Chart(ctx, {
    type: "bar",
    data: {
      labels: chartLabels,
      datasets: [
        {
          label: "Total Spent",
          data: chartValues,
          backgroundColor: "#8b5cf6",
          borderRadius: 8
        }
      ]
    },
    options: {
      indexAxis: "y",
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          grid: { color: "rgba(255, 255, 255, 0.05)" },
          ticks: {
            color: "#64748b",
            callback: val => formatCurrency(val)
          }
        },
        y: {
          grid: { color: "rgba(255, 255, 255, 0.05)" },
          ticks: { color: "#cbd5e1", font: { weight: "600" } }
        }
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: "#1e293b",
          padding: 12,
          callbacks: {
            label: function (ctx) {
              return ` Total: ${formatCurrency(ctx.raw)}`;
            }
          }
        }
      }
    }
  });
}

// =============================================================
// 8. Budget Drill-Down Modal Logic (With Tag Filters & Quick Edit/Delete)
// =============================================================
let activeBudgetTagFilter = "ALL";

function showBudgetDetailsModal(category, budgetVal, actualVal, cycle, selectedTag = "ALL") {
  const modal = document.getElementById("budget-modal");
  if (!modal) return;

  activeBudgetTagFilter = selectedTag;

  const allCategoryTxs = state.transactions.filter(
    tx =>
      tx.Type === "Expense" &&
      tx.Category === category &&
      tx.Date >= cycle.startDate &&
      tx.Date <= cycle.endDate
  );

  const tagsMap = {};
  let untaggedTotal = 0;
  let untaggedCount = 0;

  allCategoryTxs.forEach(tx => {
    const amt = parseFloat(tx.Amount) || 0;
    if (!tx.Tags || !tx.Tags.trim()) {
      untaggedTotal += amt;
      untaggedCount++;
    } else {
      const tagsList = tx.Tags.split(",")
        .map(t => t.trim())
        .filter(Boolean);
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

  document.getElementById("modal-budget-category").textContent = `${category} Expenses`;
  document.getElementById("modal-budget-cycle").textContent = `Cycle: ${formatReadableDate(
    cycle.startDate
  )} - ${formatReadableDate(cycle.endDate)}`;

  document.getElementById("modal-budget-spent").textContent = formatCurrency(actualVal);
  document.getElementById("modal-budget-limit").textContent = formatCurrency(budgetVal);
  document.getElementById("modal-budget-remaining").textContent = formatCurrency(
    Math.max(budgetVal - actualVal, 0)
  );

  const tagsPillsContainer = document.getElementById("modal-budget-tags-pills");
  if (tagsPillsContainer) {
    tagsPillsContainer.innerHTML = "";

    const allPill = document.createElement("button");
    allPill.className = `modal-tag-pill ${activeBudgetTagFilter === "ALL" ? "active" : ""}`;
    allPill.innerHTML = `All (${allCategoryTxs.length}) • ${formatCurrency(actualVal)}`;
    allPill.addEventListener("click", () => {
      showBudgetDetailsModal(category, budgetVal, actualVal, cycle, "ALL");
    });
    tagsPillsContainer.appendChild(allPill);

    Object.keys(tagsMap)
      .sort()
      .forEach(tag => {
        const tagData = tagsMap[tag];
        const pill = document.createElement("button");
        pill.className = `modal-tag-pill ${activeBudgetTagFilter === tag ? "active" : ""}`;
        pill.innerHTML = `🏷️ ${escapeHtml(tag)} (${tagData.count}) • ${formatCurrency(tagData.total)}`;
        pill.addEventListener("click", () => {
          showBudgetDetailsModal(category, budgetVal, actualVal, cycle, tag);
        });
        tagsPillsContainer.appendChild(pill);
      });

    if (untaggedCount > 0) {
      const noTagPill = document.createElement("button");
      noTagPill.className = `modal-tag-pill ${activeBudgetTagFilter === "_NO_TAG_" ? "active" : ""}`;
      noTagPill.innerHTML = `⚪ No Tag (${untaggedCount}) • ${formatCurrency(untaggedTotal)}`;
      noTagPill.addEventListener("click", () => {
        showBudgetDetailsModal(category, budgetVal, actualVal, cycle, "_NO_TAG_");
      });
      tagsPillsContainer.appendChild(noTagPill);
    }
  }

  let filteredTxs = allCategoryTxs;
  let filteredSubtotal = actualVal;

  if (activeBudgetTagFilter === "_NO_TAG_") {
    filteredTxs = allCategoryTxs.filter(tx => !tx.Tags || !tx.Tags.trim());
    filteredSubtotal = untaggedTotal;
  } else if (activeBudgetTagFilter !== "ALL") {
    filteredTxs = allCategoryTxs.filter(tx => {
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
    listContainer.innerHTML = `<div class="modal-no-tx"><p>No transactions found for this tag.</p></div>`;
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
        noTagBadge.textContent = "No Tag";
        left.appendChild(noTagBadge);
      }

      const right = document.createElement("div");
      right.className = "modal-tx-right";

      const amtEl = document.createElement("span");
      amtEl.className = "modal-tx-amount";
      amtEl.textContent = `-${formatCurrency(tx.Amount)}`;
      right.appendChild(amtEl);

      const deleteBtn = document.createElement("button");
      deleteBtn.className = "tx-delete-btn";
      deleteBtn.title = "Delete Transaction";
      deleteBtn.innerHTML = `<i data-lucide="trash-2" style="width: 15px; height: 15px;"></i>`;
      deleteBtn.addEventListener("click", e => {
        e.stopPropagation();
        const txId = tx.id || tx.ID;
        if (!txId) return;
        if (confirm("Delete this transaction?")) {
          deleteTransaction(txId);
          const updatedCycle = getSalaryCycleRange();
          let updatedActual = 0;
          state.transactions.forEach(t => {
            if (
              t.Type === "Expense" &&
              t.Category === category &&
              t.Date >= updatedCycle.startDate &&
              t.Date <= updatedCycle.endDate
            ) {
              updatedActual += parseFloat(t.Amount) || 0;
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

function closeBudgetModal() {
  const modal = document.getElementById("budget-modal");
  if (modal) modal.classList.remove("show");
}

let activeTypeModalCategory = "ALL";
let activeTypeModalTag = "ALL";

function showCategoryTypeDetailsModal(txType = "Expense", cycle = getSalaryCycleRange(), selectedCategory = "ALL", selectedTag = "ALL") {
  const modal = document.getElementById("budget-modal");
  if (!modal) return;

  activeTypeModalCategory = selectedCategory;
  activeTypeModalTag = selectedTag;

  // Filter all transactions for this Type in active salary cycle
  const allTypeTxs = state.transactions.filter(
    tx => tx.Type === txType && tx.Date >= cycle.startDate && tx.Date <= cycle.endDate
  );

  // Group by category to build Category Filter Bar
  const categoryMap = {};
  let grandTotal = 0;

  allTypeTxs.forEach(tx => {
    const amt = parseFloat(tx.Amount) || 0;
    grandTotal += amt;
    const cat = tx.Category || "Uncategorized";

    if (!categoryMap[cat]) {
      categoryMap[cat] = { total: 0, count: 0, tags: {}, untaggedTotal: 0, untaggedCount: 0 };
    }
    categoryMap[cat].total += amt;
    categoryMap[cat].count++;

    if (!tx.Tags || !tx.Tags.trim()) {
      categoryMap[cat].untaggedTotal += amt;
      categoryMap[cat].untaggedCount++;
    } else {
      const tagsList = tx.Tags.split(",").map(t => t.trim()).filter(Boolean);
      if (tagsList.length === 0) {
        categoryMap[cat].untaggedTotal += amt;
        categoryMap[cat].untaggedCount++;
      } else {
        tagsList.forEach(t => {
          categoryMap[cat].tags[t] = (categoryMap[cat].tags[t] || 0) + amt;
        });
      }
    }
  });

  // Set modal headers and summary cards
  const typeTitle = txType === "Expense" ? "Monthly Expenses (Outflow)" :
                    txType === "Income" ? "Monthly Income (Inflow)" :
                    txType === "Savings" ? "Monthly Savings" : "Monthly Investments";

  document.getElementById("modal-budget-category").textContent = typeTitle;
  document.getElementById("modal-budget-cycle").textContent = `Cycle: ${formatReadableDate(cycle.startDate)} - ${formatReadableDate(cycle.endDate)}`;

  document.getElementById("modal-budget-spent").textContent = formatCurrency(grandTotal);

  const spentPill = document.querySelector(".modal-pill.spent .pill-label");
  if (spentPill) spentPill.textContent = txType === "Income" ? "Total Inflow" : "Total Outflow";

  const targetPill = document.querySelector(".modal-pill.target .pill-label");
  if (targetPill) targetPill.textContent = "Total Items";
  document.getElementById("modal-budget-limit").textContent = `${allTypeTxs.length} items`;

  const remainingPill = document.querySelector(".modal-pill.remaining .pill-label");
  if (remainingPill) remainingPill.textContent = "Average / Item";
  const avgAmt = allTypeTxs.length > 0 ? (grandTotal / allTypeTxs.length) : 0;
  document.getElementById("modal-budget-remaining").textContent = formatCurrency(avgAmt);

  // 1. Render Category Filter Bar (1st Level)
  const categoryFilterContainer = document.getElementById("modal-budget-category-pills");
  if (categoryFilterContainer) {
    categoryFilterContainer.innerHTML = "";

    const allCatBtn = document.createElement("button");
    allCatBtn.className = `modal-category-pill ${activeTypeModalCategory === "ALL" ? "active" : ""}`;
    allCatBtn.innerHTML = `All Categories (${allTypeTxs.length}) • ${formatCurrency(grandTotal)}`;
    allCatBtn.addEventListener("click", () => {
      showCategoryTypeDetailsModal(txType, cycle, "ALL", "ALL");
    });
    categoryFilterContainer.appendChild(allCatBtn);

    Object.keys(categoryMap).sort().forEach(cat => {
      const catData = categoryMap[cat];
      const catBtn = document.createElement("button");
      catBtn.className = `modal-category-pill ${activeTypeModalCategory === cat ? "active" : ""}`;
      catBtn.innerHTML = `${cat} (${catData.count}) • ${formatCurrency(catData.total)}`;
      catBtn.addEventListener("click", () => {
        showCategoryTypeDetailsModal(txType, cycle, cat, "ALL");
      });
      categoryFilterContainer.appendChild(catBtn);
    });
  }

  // Filter by Category first
  let categoryFilteredTxs = allTypeTxs;
  let categorySubtotal = grandTotal;
  if (activeTypeModalCategory !== "ALL") {
    categoryFilteredTxs = allTypeTxs.filter(tx => tx.Category === activeTypeModalCategory);
    categorySubtotal = categoryMap[activeTypeModalCategory] ? categoryMap[activeTypeModalCategory].total : 0;
  }

  // 2. Compute available tags within categoryFilteredTxs to render Tag Filter Bar (2nd Level)
  const tagsMap = {};
  let untaggedTotal = 0;
  let untaggedCount = 0;

  categoryFilteredTxs.forEach(tx => {
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
        tagsList.forEach(t => {
          if (!tagsMap[t]) tagsMap[t] = { total: 0, count: 0 };
          tagsMap[t].total += amt;
          tagsMap[t].count++;
        });
      }
    }
  });

  // Render Tag Filter Bar
  const tagsPillsContainer = document.getElementById("modal-budget-tags-pills");
  if (tagsPillsContainer) {
    tagsPillsContainer.innerHTML = "";

    const allTagBtn = document.createElement("button");
    allTagBtn.className = `modal-tag-pill ${activeTypeModalTag === "ALL" ? "active" : ""}`;
    allTagBtn.innerHTML = `All Tags (${categoryFilteredTxs.length}) • ${formatCurrency(categorySubtotal)}`;
    allTagBtn.addEventListener("click", () => {
      showCategoryTypeDetailsModal(txType, cycle, activeTypeModalCategory, "ALL");
    });
    tagsPillsContainer.appendChild(allTagBtn);

    Object.keys(tagsMap).sort().forEach(tag => {
      const tagData = tagsMap[tag];
      const tagBtn = document.createElement("button");
      tagBtn.className = `modal-tag-pill ${activeTypeModalTag === tag ? "active" : ""}`;
      tagBtn.innerHTML = `🏷️ ${escapeHtml(tag)} (${tagData.count}) • ${formatCurrency(tagData.total)}`;
      tagBtn.addEventListener("click", () => {
        showCategoryTypeDetailsModal(txType, cycle, activeTypeModalCategory, tag);
      });
      tagsPillsContainer.appendChild(tagBtn);
    });

    if (untaggedCount > 0) {
      const noTagBtn = document.createElement("button");
      noTagBtn.className = `modal-tag-pill ${activeTypeModalTag === "_NO_TAG_" ? "active" : ""}`;
      noTagBtn.innerHTML = `⚪ No Tag (${untaggedCount}) • ${formatCurrency(untaggedTotal)}`;
      noTagBtn.addEventListener("click", () => {
        showCategoryTypeDetailsModal(txType, cycle, activeTypeModalCategory, "_NO_TAG_");
      });
      tagsPillsContainer.appendChild(noTagBtn);
    }
  }

  // Filter by Tag second
  let finalTxs = categoryFilteredTxs;
  let finalSubtotal = categorySubtotal;

  if (activeTypeModalTag === "_NO_TAG_") {
    finalTxs = categoryFilteredTxs.filter(tx => !tx.Tags || !tx.Tags.trim());
    finalSubtotal = untaggedTotal;
  } else if (activeTypeModalTag !== "ALL") {
    finalTxs = categoryFilteredTxs.filter(tx => {
      if (!tx.Tags) return false;
      const list = tx.Tags.split(",").map(t => t.trim().toLowerCase());
      return list.includes(activeTypeModalTag.toLowerCase());
    });
    finalSubtotal = tagsMap[activeTypeModalTag] ? tagsMap[activeTypeModalTag].total : 0;
  }

  finalTxs.sort((a, b) => new Date(b.Date) - new Date(a.Date));

  const countEl = document.getElementById("modal-budget-count");
  if (countEl) countEl.textContent = finalTxs.length;

  const subtotalEl = document.getElementById("modal-budget-subtotal");
  if (subtotalEl) {
    const catLabel = activeTypeModalCategory !== "ALL" ? `${activeTypeModalCategory} ` : "";
    const tagLabel = activeTypeModalTag !== "ALL" ? (activeTypeModalTag === "_NO_TAG_" ? "• No Tag" : `• 🏷️ ${activeTypeModalTag}`) : "";
    subtotalEl.textContent = `Subtotal: ${formatCurrency(finalSubtotal)}`;
  }

  const listContainer = document.getElementById("modal-budget-tx-list");
  listContainer.innerHTML = "";

  if (finalTxs.length === 0) {
    listContainer.innerHTML = `<div class="modal-no-tx"><p>No transactions match the selected Category & Tag filters.</p></div>`;
  } else {
    finalTxs.forEach(tx => {
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
      catBadge.style.color = txType === "Income" ? "var(--income)" : "#a5b4fc";
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
      amtEl.style.color = txType === "Income" ? "var(--income)" : "#fb7185";
      amtEl.textContent = `${txType === "Income" ? "+" : "-"}${formatCurrency(tx.Amount)}`;
      right.appendChild(amtEl);

      const deleteBtn = document.createElement("button");
      deleteBtn.className = "tx-delete-btn";
      deleteBtn.title = "Delete Transaction";
      deleteBtn.innerHTML = `<i data-lucide="trash-2" style="width: 15px; height: 15px;"></i>`;
      deleteBtn.addEventListener("click", e => {
        e.stopPropagation();
        const txId = tx.id || tx.ID;
        if (!txId) return;
        if (confirm("Delete this transaction?")) {
          deleteTransaction(txId);
          showCategoryTypeDetailsModal(txType, cycle, activeTypeModalCategory, activeTypeModalTag);
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
  showCategoryTypeDetailsModal("Income", cycle, "ALL", "ALL");
}

function showOutflowDetailsModal(cycle) {
  showCategoryTypeDetailsModal("Expense", cycle, "ALL", "ALL");
}

function showSavingsDetailsModal(cycle = getSalaryCycleRange(), selectedCategory = "ALL", selectedTag = "ALL") {
  const modal = document.getElementById("budget-modal");
  if (!modal) return;

  activeTypeModalCategory = selectedCategory;
  activeTypeModalTag = selectedTag;

  // Calculate Monthly Income for this cycle to compute Savings Retention Rate
  let monthlyIncome = 0;
  state.transactions.forEach(tx => {
    if (tx.Type === "Income" && tx.Date >= cycle.startDate && tx.Date <= cycle.endDate) {
      monthlyIncome += (parseFloat(tx.Amount) || 0);
    }
  });

  // Filter all Savings transactions in this cycle
  const allSavingsTxs = state.transactions.filter(
    tx => tx.Type === "Savings" && tx.Date >= cycle.startDate && tx.Date <= cycle.endDate
  );

  // Group by category to build Category Filter Bar
  const categoryMap = {};
  let totalSavings = 0;

  allSavingsTxs.forEach(tx => {
    const amt = parseFloat(tx.Amount) || 0;
    totalSavings += amt;
    const cat = tx.Category || "General Savings";

    if (!categoryMap[cat]) {
      categoryMap[cat] = { total: 0, count: 0, tags: {}, untaggedTotal: 0, untaggedCount: 0 };
    }
    categoryMap[cat].total += amt;
    categoryMap[cat].count++;

    if (!tx.Tags || !tx.Tags.trim()) {
      categoryMap[cat].untaggedTotal += amt;
      categoryMap[cat].untaggedCount++;
    } else {
      const tagsList = tx.Tags.split(",").map(t => t.trim()).filter(Boolean);
      if (tagsList.length === 0) {
        categoryMap[cat].untaggedTotal += amt;
        categoryMap[cat].untaggedCount++;
      } else {
        tagsList.forEach(t => {
          categoryMap[cat].tags[t] = (categoryMap[cat].tags[t] || 0) + amt;
        });
      }
    }
  });

  // Header & Title
  document.getElementById("modal-budget-category").textContent = "💰 Savings & Capital Retention";
  document.getElementById("modal-budget-cycle").textContent = `Cycle: ${formatReadableDate(cycle.startDate)} - ${formatReadableDate(cycle.endDate)}`;

  // Summary Top Cards
  const savingsRate = monthlyIncome > 0 ? ((totalSavings / monthlyIncome) * 100).toFixed(1) : "0.0";

  document.getElementById("modal-budget-spent").textContent = formatCurrency(totalSavings);
  const spentPill = document.querySelector(".modal-pill.spent .pill-label");
  if (spentPill) spentPill.textContent = "Total Saved";

  document.getElementById("modal-budget-limit").textContent = `${savingsRate}%`;
  const targetPill = document.querySelector(".modal-pill.target .pill-label");
  if (targetPill) targetPill.textContent = "Retention Rate";

  document.getElementById("modal-budget-remaining").textContent = `${allSavingsTxs.length} deposits`;
  const remainingPill = document.querySelector(".modal-pill.remaining .pill-label");
  if (remainingPill) remainingPill.textContent = "Total Deposits";

  // 1. Render Category Filter Bar (1st Level)
  const categoryFilterContainer = document.getElementById("modal-budget-category-pills");
  if (categoryFilterContainer) {
    categoryFilterContainer.innerHTML = "";

    const allCatBtn = document.createElement("button");
    allCatBtn.className = `modal-category-pill ${activeTypeModalCategory === "ALL" ? "active" : ""}`;
    allCatBtn.innerHTML = `All Savings (${allSavingsTxs.length}) • ${formatCurrency(totalSavings)}`;
    allCatBtn.addEventListener("click", () => {
      showSavingsDetailsModal(cycle, "ALL", "ALL");
    });
    categoryFilterContainer.appendChild(allCatBtn);

    Object.keys(categoryMap).sort().forEach(cat => {
      const catData = categoryMap[cat];
      const catBtn = document.createElement("button");
      catBtn.className = `modal-category-pill ${activeTypeModalCategory === cat ? "active" : ""}`;
      catBtn.innerHTML = `🏦 ${cat} (${catData.count}) • ${formatCurrency(catData.total)}`;
      catBtn.addEventListener("click", () => {
        showSavingsDetailsModal(cycle, cat, "ALL");
      });
      categoryFilterContainer.appendChild(catBtn);
    });
  }

  // Filter by Category
  let categoryFilteredTxs = allSavingsTxs;
  let categorySubtotal = totalSavings;
  if (activeTypeModalCategory !== "ALL") {
    categoryFilteredTxs = allSavingsTxs.filter(tx => tx.Category === activeTypeModalCategory);
    categorySubtotal = categoryMap[activeTypeModalCategory] ? categoryMap[activeTypeModalCategory].total : 0;
  }

  // 2. Compute available tags within categoryFilteredTxs to render Tag Filter Bar (2nd Level)
  const tagsMap = {};
  let untaggedTotal = 0;
  let untaggedCount = 0;

  categoryFilteredTxs.forEach(tx => {
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
        tagsList.forEach(t => {
          if (!tagsMap[t]) tagsMap[t] = { total: 0, count: 0 };
          tagsMap[t].total += amt;
          tagsMap[t].count++;
        });
      }
    }
  });

  // Render Tag Filter Bar
  const tagsPillsContainer = document.getElementById("modal-budget-tags-pills");
  if (tagsPillsContainer) {
    tagsPillsContainer.innerHTML = "";

    const allTagBtn = document.createElement("button");
    allTagBtn.className = `modal-tag-pill ${activeTypeModalTag === "ALL" ? "active" : ""}`;
    allTagBtn.innerHTML = `All Tags (${categoryFilteredTxs.length}) • ${formatCurrency(categorySubtotal)}`;
    allTagBtn.addEventListener("click", () => {
      showSavingsDetailsModal(cycle, activeTypeModalCategory, "ALL");
    });
    tagsPillsContainer.appendChild(allTagBtn);

    Object.keys(tagsMap).sort().forEach(tag => {
      const tagData = tagsMap[tag];
      const tagBtn = document.createElement("button");
      tagBtn.className = `modal-tag-pill ${activeTypeModalTag === tag ? "active" : ""}`;
      tagBtn.innerHTML = `🏷️ ${escapeHtml(tag)} (${tagData.count}) • ${formatCurrency(tagData.total)}`;
      tagBtn.addEventListener("click", () => {
        showSavingsDetailsModal(cycle, activeTypeModalCategory, tag);
      });
      tagsPillsContainer.appendChild(tagBtn);
    });

    if (untaggedCount > 0) {
      const noTagBtn = document.createElement("button");
      noTagBtn.className = `modal-tag-pill ${activeTypeModalTag === "_NO_TAG_" ? "active" : ""}`;
      noTagBtn.innerHTML = `⚪ No Tag (${untaggedCount}) • ${formatCurrency(untaggedTotal)}`;
      noTagBtn.addEventListener("click", () => {
        showSavingsDetailsModal(cycle, activeTypeModalCategory, "_NO_TAG_");
      });
      tagsPillsContainer.appendChild(noTagBtn);
    }
  }

  // Filter by Tag
  let finalTxs = categoryFilteredTxs;
  let finalSubtotal = categorySubtotal;

  if (activeTypeModalTag === "_NO_TAG_") {
    finalTxs = categoryFilteredTxs.filter(tx => !tx.Tags || !tx.Tags.trim());
    finalSubtotal = untaggedTotal;
  } else if (activeTypeModalTag !== "ALL") {
    finalTxs = categoryFilteredTxs.filter(tx => {
      if (!tx.Tags) return false;
      const list = tx.Tags.split(",").map(t => t.trim().toLowerCase());
      return list.includes(activeTypeModalTag.toLowerCase());
    });
    finalSubtotal = tagsMap[activeTypeModalTag] ? tagsMap[activeTypeModalTag].total : 0;
  }

  finalTxs.sort((a, b) => new Date(b.Date) - new Date(a.Date));

  const countEl = document.getElementById("modal-budget-count");
  if (countEl) countEl.textContent = finalTxs.length;

  const subtotalEl = document.getElementById("modal-budget-subtotal");
  if (subtotalEl) {
    subtotalEl.textContent = `Subtotal: ${formatCurrency(finalSubtotal)}`;
  }

  const listContainer = document.getElementById("modal-budget-tx-list");
  listContainer.innerHTML = "";

  if (finalTxs.length === 0) {
    listContainer.innerHTML = `<div class="modal-no-tx"><p>No savings deposits match the selected Category & Tag filters.</p></div>`;
  } else {
    finalTxs.forEach(tx => {
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
      catBadge.style.color = "#38bdf8";
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
      amtEl.style.color = "#38bdf8";
      amtEl.textContent = `+${formatCurrency(tx.Amount)}`;
      right.appendChild(amtEl);

      const deleteBtn = document.createElement("button");
      deleteBtn.className = "tx-delete-btn";
      deleteBtn.title = "Delete Transaction";
      deleteBtn.innerHTML = `<i data-lucide="trash-2" style="width: 15px; height: 15px;"></i>`;
      deleteBtn.addEventListener("click", e => {
        e.stopPropagation();
        const txId = tx.id || tx.ID;
        if (!txId) return;
        if (confirm("Delete this savings deposit?")) {
          deleteTransaction(txId);
          showSavingsDetailsModal(cycle, activeTypeModalCategory, activeTypeModalTag);
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

function showInvestmentDetailsModal(cycle = getSalaryCycleRange(), selectedCategory = "ALL", selectedTag = "ALL") {
  showCategoryTypeDetailsModal("Investment", cycle, selectedCategory, selectedTag);
}

window.showBudgetDetailsModal = showBudgetDetailsModal;
window.showInflowDetailsModal = showInflowDetailsModal;
window.showOutflowDetailsModal = showOutflowDetailsModal;
window.showSavingsDetailsModal = showSavingsDetailsModal;
window.showInvestmentDetailsModal = showInvestmentDetailsModal;
window.showCategoryTypeDetailsModal = showCategoryTypeDetailsModal;
window.closeBudgetModal = closeBudgetModal;

document.addEventListener("keydown", e => {
  if (e.key === "Escape") closeBudgetModal();
});

// =============================================================
// 9. Google Sheets Synchronization & Delete Handler
// =============================================================
function syncWithSheets(interactive = false) {
  if (!state.settings.apiUrl) return;

  if (interactive) showToast("Syncing with Google Sheets...");

  const statusPill = document.getElementById("hub-status-pill");
  const statusText = document.getElementById("hub-status-text");
  statusPill.className = "hub-status-pill disconnected";
  statusText.textContent = "Syncing...";

  fetch(`${state.settings.apiUrl}?action=getDashboardData`)
    .then(res => res.json())
    .then(response => {
      if (response.status === "success") {
        const serverData = response.data;

        if (serverData.settings) {
          state.settings.currencySymbol =
            serverData.settings.currencySymbol || state.settings.currencySymbol;
          if (serverData.settings.customTags) {
            const serverCustomTags = serverData.settings.customTags
              .split(",")
              .filter(t => t.trim());
            state.customTags = Array.from(new Set([...state.customTags, ...serverCustomTags]));
          }
        }

        if (serverData.budgets) state.budgets = serverData.budgets;

        if (serverData.transactions) {
          state.transactions = serverData.transactions.map(tx => {
            const id = tx.id || tx.ID || "tx_" + new Date().getTime();
            return { ...tx, id: id, ID: id };
          });
        }

        saveStateToLocal();
        updateHubUI();

        statusPill.className = "hub-status-pill connected";
        statusText.textContent = "Live Synced";

        if (interactive) showToast("Sync complete!");
      }
    })
    .catch(err => {
      console.error("Sync error:", err);
      statusPill.className = "hub-status-pill disconnected";
      statusText.textContent = "Offline Cache";
      if (interactive) showToast("Could not reach Google Sheets. Showing offline cache.");
    });
}

function deleteTransaction(id) {
  if (!id) return;

  state.transactions = state.transactions.filter(tx => (tx.id || tx.ID) !== id);
  saveStateToLocal();
  updateHubUI();

  if (state.settings.apiUrl) {
    postToSheets("deleteTransaction", { id: id })
      .then(() => {
        showToast("Transaction deleted from Sheet.");
        syncWithSheets(false);
      })
      .catch(err => {
        console.error(err);
        showToast("Deleted from local cache.");
      });
  } else {
    showToast("Deleted locally.");
  }
}

function postToSheets(action, payload) {
  if (!state.settings.apiUrl) return Promise.reject("No API URL configured");

  return fetch(state.settings.apiUrl, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ action: action, ...payload })
  }).then(res => res.json());
}

function showToast(message) {
  const toast = document.getElementById("toast");
  const msgEl = document.getElementById("toast-message");
  if (toast && msgEl) {
    msgEl.textContent = message;
    toast.classList.add("show");
    setTimeout(() => toast.classList.remove("show"), 3000);
  }
}
