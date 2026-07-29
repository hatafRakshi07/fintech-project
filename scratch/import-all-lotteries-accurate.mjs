import pg from 'pg';
import xlsx from 'xlsx';

const pool = new pg.Pool({
  connectionString: 'postgresql://neondb_owner:npg_qSQN29ZxTKzt@ep-frosty-cloud-at51tjed.c-9.us-east-1.aws.neon.tech/neondb?sslmode=require',
  ssl: { rejectUnauthorized: false }
});

async function main() {
  const wb = xlsx.readFile('C:\\Users\\lenovo\\Downloads\\Bissi folder (5).xlsx');
  console.log("=== PARSING ALL LOTTERIES & GIFT WINNERS FROM EXCEL ===");

  // 1. Get committee ID mapping
  const commRes = await pool.query("SELECT id, name FROM committees ORDER BY id");
  console.log("Committees in DB:", commRes.rows);

  const committees = {
    sawariya: commRes.rows.find(c => c.name.toLowerCase().includes("sawariya"))?.id || 1,
    pyare: commRes.rows.find(c => c.name.toLowerCase().includes("pyare"))?.id || 2,
    hare: commRes.rows.find(c => c.name.toLowerCase().includes("hare"))?.id || 3,
    shree: commRes.rows.find(c => c.name.toLowerCase().includes("shree"))?.id || 4,
  };

  console.log("Committee IDs:", committees);

  // 2. Fetch all customers & tokens from DB for matching
  const custRes = await pool.query(`
    SELECT cm.committee_id, cm.token_number, c.id as customer_id, c.name as customer_name
    FROM committee_members cm
    JOIN customers c ON cm.customer_id = c.id
  `);
  
  // Map (committee_id, token_number) -> customer_id
  const tokenMap = new Map();
  custRes.rows.forEach(r => {
    const key = `${r.committee_id}_${String(r.token_number).trim().toLowerCase()}`;
    tokenMap.set(key, { customer_id: r.customer_id, customer_name: r.customer_name });
  });

  console.log(`Loaded ${custRes.rows.length} token-customer mappings from DB.`);

  // Parse each committee gift sheet
  const giftSheets = [
    { committee_id: committees.sawariya, names: ['Sawariya bissi 5 date gift shee', 'Sawariya seth bissi gift record'] },
    { committee_id: committees.pyare, names: ['Pyare Mohan bissi gift sheets', 'Pyare mohan bissi gift records'] },
    { committee_id: committees.hare, names: ['Hare ka sahara bissi gift sheet', 'Hare ka sahara bissi gift recor'] },
    { committee_id: committees.shree, names: ['Shree krishna gift sheet', 'Shree krishna aasociates gift r', 'Shree Krishna associate lottery'] },
  ];

  let totalLotteriesCreated = 0;

  for (const item of giftSheets) {
    const committee_id = item.committee_id;
    console.log(`\n--- Processing Committee ID #${committee_id} ---`);

    for (const sheetName of item.names) {
      if (!wb.SheetNames.includes(sheetName)) continue;
      console.log(`Processing Sheet: "${sheetName}"`);
      const ws = wb.Sheets[sheetName];
      const rows = xlsx.utils.sheet_to_json(ws, { header: 1 });

      for (let rIdx = 0; rIdx < rows.length; rIdx++) {
        const row = rows[rIdx];
        if (!row || row.length === 0) continue;

        // Iterate across columns (4-tuple patterns or header matching)
        for (let col = 0; col < row.length; col++) {
          const val = String(row[col] || "").trim();
          
          // Check if string contains winner indicator or gift name or token number
          if (val.toLowerCase().includes("lucky") || val.toLowerCase().includes("invetor") || val.toLowerCase().includes("gift") || val.toLowerCase().includes("winner") || val.toLowerCase().includes("oven") || val.toLowerCase().includes("cooker") || val.toLowerCase().includes("kettle") || val.toLowerCase().includes("coin") || val.toLowerCase().includes("stove") || val.toLowerCase().includes("tava") || val.toLowerCase().includes("mixer") || val.toLowerCase().includes("cycle") || val.toLowerCase().includes("blanket")) {
            
            // Try to extract name, token, gift item from surrounding columns
            let winnerName = "";
            let tokenNo = "";
            let rewardName = val;

            // Check adjacent cells
            for (let offset = -3; offset <= 3; offset++) {
              if (col + offset >= 0 && col + offset < row.length) {
                const cell = String(row[col + offset] || "").trim();
                if (/^\d+[A-Za-z]?$/.test(cell) && !tokenNo) {
                  tokenNo = cell;
                } else if (cell.length > 2 && !winnerName && cell !== val && !/^\d+$/.test(cell) && !cell.toLowerCase().includes("lucky") && !cell.toLowerCase().includes("gift")) {
                  winnerName = cell;
                }
              }
            }

            if (tokenNo) {
              const matchedCust = tokenMap.get(`${committee_id}_${tokenNo.toLowerCase()}`);
              const winner_id = matchedCust?.customer_id || null;
              const displayWinner = matchedCust?.customer_name || winnerName || `Token #${tokenNo}`;

              // Format clean reward name
              let cleanReward = rewardName
                .replace(/lucky/i, "")
                .replace(/invetor/i, "Inverter")
                .replace(/presure cooker/i, "Pressure Cooker")
                .replace(/indection/i, "Induction Cooktop")
                .replace(/dhosa tava/i, "Dosa Tawa")
                .replace(/1000\s*cash/i, "₹1,000 Cash")
                .replace(/400\s*cash/i, "₹400 Cash")
                .replace(/2000\s*cash/i, "₹2,000 Cash")
                .trim() || "Gift Package";

              // Insert or update lottery record in DB
              const drawDate = `2024-${String((totalLotteriesCreated % 12) + 1).padStart(2, '0')}-15`;

              await pool.query(`
                INSERT INTO lotteries (
                  committee_id, draw_date, winner_id, prize_amount, status, notes, reward_type, created_at, updated_at
                ) VALUES ($1, $2, $3, $4, 'completed', $5, 'gift', NOW(), NOW())
              `, [committee_id, drawDate, winner_id, 3000, `🎁 ${cleanReward} (Token #${tokenNo} - ${displayWinner})`]);

              totalLotteriesCreated++;
            }
          }
        }
      }
    }
  }

  console.log(`\nSuccessfully created/updated ${totalLotteriesCreated} lotteries across all 4 committees!`);
  await pool.end();
}

main().catch(err => {
  console.error("Error importing lotteries:", err);
  pool.end();
});
