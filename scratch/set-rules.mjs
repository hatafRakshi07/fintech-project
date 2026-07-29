import pg from 'pg';

const pool = new pg.Pool({
  connectionString: 'postgresql://neondb_owner:npg_qSQN29ZxTKzt@ep-frosty-cloud-at51tjed.c-9.us-east-1.aws.neon.tech/neondb?sslmode=require',
  ssl: { rejectUnauthorized: false }
});

async function main() {
  const rulesMap = [
    { id: 1, rules: "1. Monthly installment due on 5th of every month.\n2. Winner token must complete remaining installments on time.\n3. Late payment fee applicable after 3-day grace period." },
    { id: 2, rules: "1. Monthly installment due on 15th of every month.\n2. Winner token must complete remaining installments on time.\n3. Late payment fee applicable after 3-day grace period." },
    { id: 3, rules: "1. Monthly installment due on 20th of every month.\n2. Winner token must complete remaining installments on time.\n3. Late payment fee applicable after 3-day grace period." },
    { id: 4, rules: "1. Monthly lottery draw on 1st of every month.\n2. Winner receives gift item or cash alternative.\n3. All members must be clear of dues prior to draw date." },
  ];

  for (const item of rulesMap) {
    await pool.query("UPDATE committees SET rules = $1 WHERE id = $2", [item.rules, item.id]);
  }
  console.log("Successfully set default rules for all 4 committees!");
  await pool.end();
}

main().catch(err => {
  console.error(err);
  pool.end();
});
