import pg from 'pg';
const { Client } = pg;

async function syncCommittees() {
  const client = new Client({ connectionString: 'postgresql://postgres:hatafrakshi@db.qnflaeexcmwwcabrcrhb.supabase.co:5432/postgres' });
  await client.connect();

  // 1. Delete empty duplicate committees (45, 46, 47, 48)
  await client.query('DELETE FROM committees WHERE id IN (45, 46, 47, 48)');
  console.log('Deleted empty duplicate committees 45, 46, 47, 48.');

  // 2. Update primary committees 1, 2, 3, 4 with exact display names & installment amounts
  await client.query(`UPDATE committees SET name = 'Sawariya Seth Bissi (5th Date)', installment_amount = 3000, member_limit = 500 WHERE id = 1`);
  await client.query(`UPDATE committees SET name = 'Pyare Mohan Bissi (15th Date)', installment_amount = 3000, member_limit = 500 WHERE id = 2`);
  await client.query(`UPDATE committees SET name = 'Hare Ka Sahara Bissi (20th Date)', installment_amount = 2500, member_limit = 500 WHERE id = 3`);
  await client.query(`UPDATE committees SET name = 'Shree Krishna Associate Bissi', installment_amount = 3000, member_limit = 1111 WHERE id = 4`);
  console.log('Updated primary committees 1, 2, 3, 4 with correct names & installment amounts.');

  // 3. Verify counts
  const res = await client.query(`
    SELECT c.id, c.name, c.installment_amount::numeric as "installmentAmount", c.member_limit as "memberLimit", COUNT(t.id)::int as token_count 
    FROM committees c 
    LEFT JOIN tokens t ON t.committee_id = c.id 
    GROUP BY c.id, c.name, c.installment_amount, c.member_limit
    ORDER BY c.id
  `);
  console.table(res.rows);

  await client.end();
}

syncCommittees().catch(err => console.error(err));
