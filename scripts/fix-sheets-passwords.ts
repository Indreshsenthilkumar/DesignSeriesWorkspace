import { getSheetsClient } from "../src/lib/google-sheets";

async function main() {
  const sheets = getSheetsClient();
  const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID;

  console.log("Reading Users sheet...");
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: "Users!A:Z",
  });

  const rows = response.data.values;
  if (!rows || rows.length === 0) {
    console.log("No users found.");
    return;
  }

  const headers = rows[0];
  const passwordHashIdx = headers.indexOf("passwordHash");
  if (passwordHashIdx === -1) {
    console.error("passwordHash column not found.");
    return;
  }

  // Hash of "designseries@2026"
  const correctHash = "$2a$10$rF6lJCedOjyCbMKwduh0YuFtjCd6AP5komOkwXGlOAikoDkFS9QUm";

  console.log(`Found passwordHash column at index ${passwordHashIdx}. Updating all users...`);
  
  for (let i = 1; i < rows.length; i++) {
    rows[i][passwordHashIdx] = correctHash;
  }

  console.log("Writing back to Google Sheets...");
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: "Users!A:Z",
    valueInputOption: "RAW",
    requestBody: {
      values: rows,
    },
  });

  console.log("✅ Google Sheets users updated successfully!");
}

main().catch(console.error);
