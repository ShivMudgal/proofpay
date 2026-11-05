// Resets the demo database. The app re-seeds automatically on next start.
import fs from "node:fs";
import path from "node:path";
const p = path.join(process.cwd(), "data", "db.json");
if (fs.existsSync(p)) fs.unlinkSync(p);
console.log("Demo data reset. Start the app to re-seed.");
