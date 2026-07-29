import pg from 'pg';

const pool = new pg.Pool({
  connectionString: 'postgresql://neondb_owner:npg_qSQN29ZxTKzt@ep-frosty-cloud-at51tjed.c-9.us-east-1.aws.neon.tech/neondb?sslmode=require',
  ssl: { rejectUnauthorized: false }
});

const monthMap = {
  january: 0, jan: 0,
  february: 1, feb: 1,
  march: 2, mar: 2,
  april: 3, apr: 3,
  may: 4,
  june: 5, jun: 5,
  july: 6, jul: 6,
  august: 7, aug: 7,
  september: 8, sep: 8, sept: 8,
  october: 9, oct: 9,
  november: 10, nov: 10,
  december: 11, dec: 11
};

async function main() {
  console.log("=== CLEANING LOTTERY DATES AND GIFT NAMES ===");

  const res = await pool.query("SELECT id, draw_date, notes FROM lotteries WHERE notes IS NOT NULL");
  let updatedCount = 0;

  for (const row of res.rows) {
    let notes = row.notes || "";
    let drawDate = row.draw_date;

    // Check if notes contain month bracket like [February - 26] or [January - 26]
    const match = notes.match(/\[([A-Za-z]+)\s*-\s*(\d+)\]/);
    if (match) {
      const monthStr = match[1].toLowerCase();
      const yearShort = parseInt(match[2], 10);
      const year = yearShort < 100 ? 2000 + yearShort : yearShort;

      if (monthMap[monthStr] !== undefined) {
        const monthIdx = monthMap[monthStr];
        const dateObj = new Date(year, monthIdx, 15);
        drawDate = dateObj.toISOString().split("T")[0];
      }

      // Clean notes string by removing [Month - YY]
      notes = notes.replace(/\[[A-Za-z]+\s*-\s*\d+\]/, "").trim();
    }

    // Format raw gift names nicely
    notes = notes
      .replace(/1000\s*cash/i, "₹1,000 Cash")
      .replace(/1k\s*cash/i, "₹1,000 Cash")
      .replace(/400\s*cash/i, "₹400 Cash")
      .replace(/1250\s*cash/i, "₹1,250 Cash")
      .replace(/2000\s*cash/i, "₹2,000 Cash")
      .replace(/blanket/i, "Blanket")
      .replace(/electric kettle/i, "Electric Kettle")
      .replace(/gas stove/i, "Gas Stove");

    if (notes !== row.notes || drawDate !== row.draw_date) {
      await pool.query("UPDATE lotteries SET notes = $1, draw_date = $2 WHERE id = $3", [notes, drawDate, row.id]);
      updatedCount++;
    }
  }

  console.log(`Cleaned up ${updatedCount} lottery records!`);
  await pool.end();
}

main().catch(err => {
  console.error("Error cleaning lotteries:", err);
  pool.end();
});
