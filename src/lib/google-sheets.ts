import { google } from "googleapis";

import * as fs from "fs";

// Fallback manual .env loading for external scripts
if (!process.env.GOOGLE_SPREADSHEET_ID && fs.existsSync(".env")) {
  const envContent = fs.readFileSync(".env", "utf8");
  envContent.split("\n").forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;
    const [key, ...valueParts] = trimmed.split("=");
    if (key && valueParts.length > 0) {
      const val = valueParts.join("=").trim().replace(/^["'](.*)["']$/, "$1").replace(/\\n/g, "\n");
      process.env[key.trim()] = val;
    }
  });
}

function getAuth() {
  const SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID;
  const CLIENT_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  
  let PRIVATE_KEY = process.env.GOOGLE_PRIVATE_KEY;
  if (PRIVATE_KEY) {
    PRIVATE_KEY = PRIVATE_KEY.trim();
    // Strip surrounding single or double quotes
    PRIVATE_KEY = PRIVATE_KEY.replace(/^["'](.*)["']$/, "$1");
    // Convert literal \n back to real newlines
    PRIVATE_KEY = PRIVATE_KEY.replace(/\\n/g, "\n");
  }

  if (!CLIENT_EMAIL || !PRIVATE_KEY || !SPREADSHEET_ID) {
    throw new Error("Missing Google Sheets credentials in environment variables.");
  }
  return new google.auth.JWT({
    email: CLIENT_EMAIL,
    key: PRIVATE_KEY,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
}


export function getSheetsClient() {
  const auth = getAuth();
  return google.sheets({ version: "v4", auth });
}

export async function getSheetRows(sheetName: string): Promise<Record<string, any>[]> {
  const sheets = getSheetsClient();
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: process.env.GOOGLE_SPREADSHEET_ID,
    range: `${sheetName}!A:Z`,
  });

  const rows = response.data.values;
  if (!rows || rows.length === 0) return [];

  const headers = rows[0];
  return rows.slice(1).map((row) => {
    const obj: Record<string, any> = {};
    headers.forEach((header, index) => {
      let val = row[index] !== undefined ? row[index] : "";
      // Parse JSON if applicable, boolean or numbers
      if (val === "true") val = true;
      else if (val === "false") val = false;
      else if (!isNaN(Number(val)) && val !== "") val = Number(val);
      obj[header] = val;
    });
    return obj;
  });
}

export async function writeSheetRow(
  sheetName: string,
  action: "CREATE" | "UPDATE" | "DELETE",
  record: any
) {
  const sheets = getSheetsClient();
  
  // 1. Fetch headers and current data to find row index
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: process.env.GOOGLE_SPREADSHEET_ID,
    range: `${sheetName}!A:Z`,
  });

  const rows = response.data.values || [];
  const headers = rows[0] || [];
  const idIndex = headers.indexOf("id");

  if (idIndex === -1) {
    throw new Error(`Sheet ${sheetName} must have an "id" column in the header row.`);
  }

  // 2. Find row index matching record.id
  let rowIndex = -1;
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][idIndex] === record.id) {
      rowIndex = i + 1; // 1-indexed for Sheets row range
      break;
    }
  }

  // Map record keys to match the headers layout
  const rowValues = headers.map((header) => {
    const val = record[header];
    if (val === null || val === undefined) return "";
    if (typeof val === "object") return JSON.stringify(val);
    return String(val);
  });

  if (action === "DELETE") {
    if (rowIndex !== -1) {
      // Clear values of the row (or we can use batchUpdate to delete row entirely, but clear is safer/easier)
      await sheets.spreadsheets.values.clear({
        spreadsheetId: process.env.GOOGLE_SPREADSHEET_ID,
        range: `${sheetName}!A${rowIndex}:Z${rowIndex}`,
      });
    }
    return;
  }

  if (action === "CREATE" || (action === "UPDATE" && rowIndex === -1)) {
    // Append to end of sheet
    await sheets.spreadsheets.values.append({
      spreadsheetId: process.env.GOOGLE_SPREADSHEET_ID,
      range: `${sheetName}!A:A`,
      valueInputOption: "RAW",
      requestBody: {
        values: [rowValues],
      },
    });
  } else if (action === "UPDATE" && rowIndex !== -1) {
    // Update specific row
    await sheets.spreadsheets.values.update({
      spreadsheetId: process.env.GOOGLE_SPREADSHEET_ID,
      range: `${sheetName}!A${rowIndex}:Z${rowIndex}`,
      valueInputOption: "RAW",
      requestBody: {
        values: [rowValues],
      },
    });
  }
}
