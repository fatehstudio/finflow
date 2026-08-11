/**
 * Personal Finance Dashboard - Google Apps Script Backend
 * 
 * Instructions:
 * 1. Create a Google Sheet.
 * 2. Open Extensions -> Apps Script.
 * 3. Delete any code in the editor and paste this code.
 * 4. Save and click "Deploy" -> "New deployment".
 * 5. Select type "Web app".
 * 6. Set "Execute as" to "Me" and "Who has access" to "Anyone".
 * 7. Deploy, copy the Web App URL, and paste it into the Web App's Settings panel.
 */

// Initialize sheets if they do not exist
function initSheets() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // 1. Transactions Sheet
  var transSheet = ss.getSheetByName("Transactions");
  if (!transSheet) {
    transSheet = ss.insertSheet("Transactions");
    transSheet.appendRow(["ID", "Date", "Type", "Category", "Amount", "Notes", "Tags"]);
    // Format headers
    transSheet.getRange("A1:G1").setFontWeight("bold").setBackground("#F3F4F6");
    transSheet.setFrozenRows(1);
  }
  
  // 2. Budgets Sheet
  var budgetSheet = ss.getSheetByName("Budgets");
  if (!budgetSheet) {
    budgetSheet = ss.insertSheet("Budgets");
    budgetSheet.appendRow(["Category", "Amount"]);
    budgetSheet.getRange("A1:B1").setFontWeight("bold").setBackground("#F3F4F6");
    budgetSheet.setFrozenRows(1);
  }
  
  // 3. Settings Sheet
  var settingsSheet = ss.getSheetByName("Settings");
  if (!settingsSheet) {
    settingsSheet = ss.insertSheet("Settings");
    settingsSheet.appendRow(["Key", "Value"]);
    settingsSheet.getRange("A1:B1").setFontWeight("bold").setBackground("#F3F4F6");
    settingsSheet.setFrozenRows(1);
    
    // Seed default settings
    settingsSheet.appendRow(["currencySymbol", "RM"]);
  }
}

// GET Handler
function doGet(e) {
  try {
    initSheets();
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var action = e.parameter.action || "getDashboardData";
    
    var responseData = {};
    
    if (action === "getDashboardData" || action === "getHistory") {
      responseData.transactions = getTransactionsData(ss);
      responseData.budgets = getBudgetsData(ss);
      responseData.settings = getSettingsData(ss);
    } else if (action === "getBudgets") {
      responseData.budgets = getBudgetsData(ss);
    } else if (action === "getSettings") {
      responseData.settings = getSettingsData(ss);
    } else {
      throw new Error("Unknown GET action: " + action);
    }
    
    return createJsonResponse({ success: true, data: responseData });
  } catch (err) {
    return createJsonResponse({ success: false, error: err.toString() });
  }
}

// POST Handler (Uses Content-Type: text/plain to avoid CORS preflight options check)
function doPost(e) {
  try {
    initSheets();
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    
    if (!e.postData || !e.postData.contents) {
      throw new Error("No post data received");
    }
    
    var request = JSON.parse(e.postData.contents);
    var action = request.action;
    var data = request.data;
    
    var result;
    
    if (action === "addTransaction") {
      result = addTransaction(ss, data);
    } else if (action === "updateTransaction") {
      result = updateTransaction(ss, request.id, data);
    } else if (action === "deleteTransaction") {
      result = deleteTransaction(ss, request.id);
    } else if (action === "updateBudgets") {
      result = updateBudgets(ss, request.budgets);
    } else if (action === "saveSettings") {
      result = saveSettings(ss, request.settings);
    } else {
      throw new Error("Unknown POST action: " + action);
    }
    
    return createJsonResponse({ success: true, data: result });
  } catch (err) {
    return createJsonResponse({ success: false, error: err.toString() });
  }
}

// JSON Output Helper
function createJsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// Data Retrieval Helpers
function getTransactionsData(ss) {
  var sheet = ss.getSheetByName("Transactions");
  var rows = sheet.getDataRange().getValues();
  var headers = rows[0];
  var list = [];
  
  for (var i = 1; i < rows.length; i++) {
    var row = rows[i];
    var item = {};
    for (var j = 0; j < headers.length; j++) {
      var headerVal = headers[j];
      var cellVal = row[j];
      
      // Date formatting for JSON
      if (cellVal instanceof Date) {
        // Formatted as YYYY-MM-DD
        var yyyy = cellVal.getFullYear();
        var mm = String(cellVal.getMonth() + 1).padStart(2, '0');
        var dd = String(cellVal.getDate()).padStart(2, '0');
        item[headerVal] = yyyy + "-" + mm + "-" + dd;
      } else {
        item[headerVal] = cellVal;
      }
    }
    list.push(item);
  }
  
  // Return transactions sorted by date descending (newest first)
  list.sort(function(a, b) {
    return new Date(b.Date) - new Date(a.Date);
  });
  
  return list;
}

function getBudgetsData(ss) {
  var sheet = ss.getSheetByName("Budgets");
  var rows = sheet.getDataRange().getValues();
  var budgets = {};
  
  for (var i = 1; i < rows.length; i++) {
    var category = rows[i][0];
    var amount = parseFloat(rows[i][1]);
    if (category) {
      budgets[category] = isNaN(amount) ? 0 : amount;
    }
  }
  return budgets;
}

function getSettingsData(ss) {
  var sheet = ss.getSheetByName("Settings");
  var rows = sheet.getDataRange().getValues();
  var settings = {};
  
  for (var i = 1; i < rows.length; i++) {
    var key = rows[i][0];
    var val = rows[i][1];
    if (key) {
      settings[key] = val;
    }
  }
  return settings;
}

function addTransaction(ss, data) {
  var sheet = ss.getSheetByName("Transactions");
  
  if (Array.isArray(data)) {
    var results = [];
    for (var i = 0; i < data.length; i++) {
      var tx = data[i];
      var newId = tx.id || "tx_" + new Date().getTime() + "_" + Math.floor(Math.random() * 1000) + "_" + i;
      sheet.appendRow([
        newId,
        tx.Date || tx.date,
        tx.Type || tx.type,
        tx.Category || tx.category,
        parseFloat(tx.Amount !== undefined ? tx.Amount : tx.amount) || 0,
        tx.Notes || tx.notes || "",
        tx.Tags || tx.tags || ""
      ]);
      results.push({ id: newId });
    }
    return results;
  } else {
    var newId = data.id || "tx_" + new Date().getTime() + "_" + Math.floor(Math.random() * 1000);
    sheet.appendRow([
      newId,
      data.Date || data.date,
      data.Type || data.type,
      data.Category || data.category,
      parseFloat(data.Amount !== undefined ? data.Amount : data.amount) || 0,
      data.Notes || data.notes || "",
      data.Tags || data.tags || ""
    ]);
    return { id: newId };
  }
}

function deleteTransaction(ss, id) {
  var sheet = ss.getSheetByName("Transactions");
  var rows = sheet.getDataRange().getValues();
  
  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) === String(id)) {
      sheet.deleteRow(i + 1); // +1 because row indices are 1-based, and i is index in 0-based array
      return { id: id, deleted: true };
    }
  }
  throw new Error("Transaction ID not found: " + id);
}

function updateBudgets(ss, budgets) {
  var sheet = ss.getSheetByName("Budgets");
  sheet.clearContents();
  sheet.appendRow(["Category", "Amount"]);
  sheet.getRange("A1:B1").setFontWeight("bold").setBackground("#F3F4F6");
  
  for (var category in budgets) {
    if (budgets.hasOwnProperty(category)) {
      sheet.appendRow([category, parseFloat(budgets[category]) || 0]);
    }
  }
  return budgets;
}

function saveSettings(ss, settings) {
  var sheet = ss.getSheetByName("Settings");
  sheet.clearContents();
  sheet.appendRow(["Key", "Value"]);
  sheet.getRange("A1:B1").setFontWeight("bold").setBackground("#F3F4F6");
  
  for (var key in settings) {
    if (settings.hasOwnProperty(key)) {
      sheet.appendRow([key, settings[key]]);
    }
  }
  return settings;
}

function updateTransaction(ss, id, data) {
  var sheet = ss.getSheetByName("Transactions");
  var rows = sheet.getDataRange().getValues();
  
  for (var i = 1; i < rows.length; i++) {
    if (rows[i][0] === id) {
      // Columns: ID, Date, Type, Category, Amount, Notes, Tags
      // Index is i + 1 because Sheets is 1-based, and i is 0-based.
      // Column index 2 is Date. We write 6 columns: Date, Type, Category, Amount, Notes, Tags.
      sheet.getRange(i + 1, 2, 1, 6).setValues([[
        data.Date || data.date,
        data.Type || data.type,
        data.Category || data.category,
        parseFloat(data.Amount !== undefined ? data.Amount : data.amount) || 0,
        data.Notes || data.notes || "",
        data.Tags || data.tags || ""
      ]]);
      return { id: id, updated: true };
    }
  }
  throw new Error("Transaction ID not found: " + id);
}
