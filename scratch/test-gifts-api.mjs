import pg from 'pg';
const { Pool } = pg;
const p = new Pool({connectionString:'postgresql://neondb_owner:npg_qSQN29ZxTKzt@ep-frosty-cloud-at51tjed.c-9.us-east-1.aws.neon.tech/neondb?sslmode=require',ssl:{rejectUnauthorized:false}});

// Test the monthly schedule query
const schedule = await p.query(`
  SELECT
    TO_CHAR(gd.distribution_date, 'YYYY-MM') AS month,
    TO_CHAR(gd.distribution_date, 'Month YYYY') AS month_label,
    gd.distribution_date AS draw_date,
    gd.committee_uuid::text AS committee_id,
    comm.name AS committee_name,
    COUNT(*)::int AS total,
    COUNT(*) FILTER(WHERE gd.gift_name ILIKE '%lucky%')::int AS lucky_count,
    COUNT(*) FILTER(WHERE gd.status = 'distributed')::int AS delivered_count,
    COUNT(*) FILTER(WHERE gd.status = 'given')::int AS pending_count
  FROM gift_distributions gd
  LEFT JOIN committees comm ON comm.id = gd.committee_uuid
  WHERE gd.committee_uuid IS NOT NULL
  GROUP BY month, month_label, gd.distribution_date, gd.committee_uuid, comm.name
  ORDER BY gd.distribution_date ASC
  LIMIT 10
`);
console.log('Monthly schedule (first 10):');
schedule.rows.forEach(r => console.log(`  ${r.month} | ${r.committee_name} | total=${r.total} lucky=${r.lucky_count} pending=${r.pending_count}`));

// Test the bissi-winners query for current month
const currentMonth = '2026-08';
const winners = await p.query(`
  SELECT
    gd.id,
    gd.committee_uuid::text AS committee_id,
    comm.name AS committee_name,
    COALESCE(gd.customer_name, cust.name) AS "winnerName",
    gd.token_number AS "tokenNumber",
    gd.distribution_date::text AS "drawDate",
    gd.gift_name AS "giftName",
    gd.status::text AS status
  FROM gift_distributions gd
  LEFT JOIN committees comm ON comm.id = gd.committee_uuid
  LEFT JOIN customers cust ON cust.id = gd.customer_uuid
  WHERE gd.committee_uuid IS NOT NULL
    AND DATE_TRUNC('month', gd.distribution_date) = DATE_TRUNC('month', '${currentMonth}-01'::date)
  ORDER BY gd.distribution_date DESC
  LIMIT 10
`);
console.log('\nCurrent month (Aug 2026) gifts:', winners.rows.length, 'records');
winners.rows.forEach(r => console.log(`  Token#${r.tokenNumber} | ${r.winnerName} | ${r.giftName} | ${r.committee_name}`));

await p.end();
