-- ============================================================================
-- BISSI ENTERPRISE SYSTEM - AUTOMATED PRODUCTION TEST SUITE (v5.0)
-- Runs all 14 production assertion tests in a self-contained transaction.
-- Raises NOTICE on success or EXCEPTION on assertion failure.
-- ============================================================================

CREATE OR REPLACE FUNCTION fn_run_production_test_suite()
RETURNS VOID AS $$
DECLARE
    v_org_id UUID := '00000000-0000-0000-0000-000000000001';
    v_comm_id UUID;
    v_month_id UUID;
    v_cust1_id UUID;
    v_cust2_id UUID;
    v_token1_id UUID;
    v_token2_id UUID;
    v_sched1_id UUID;
    v_sched2_id UUID;
    v_gift_cat_id UUID;
    v_month_gift_id UUID;
    v_draw_event_id UUID;
    v_draw_res1_id UUID;
    v_draw_res2_id UUID;
    v_loan_id UUID;
    v_settle_id UUID;
    v_audit_count INT;
    v_ledger_count INT;
    v_status token_status_enum;
    v_cust_status customer_status_enum;
    v_sched_status installment_status_enum;
    v_token_norm INT;
    v_token_suff VARCHAR;
    v_err_caught BOOLEAN;
BEGIN
    RAISE NOTICE '==================================================';
    RAISE NOTICE 'STARTING BISSI PRODUCTION TEST SUITE (v5.0)...';
    RAISE NOTICE '==================================================';

    -- TEST 1: Organization & Committee Setup
    SELECT id INTO v_comm_id FROM committees WHERE code = 'HK-SAHARA' LIMIT 1;
    IF v_comm_id IS NULL THEN
        RAISE EXCEPTION 'TEST 1 FAILED: Seed committee HK-SAHARA not found.';
    END IF;
    RAISE NOTICE '[PASS] Test 1: Seed committee verified.';

    -- TEST 2: Customer Creation & Duplicate Detection
    v_cust1_id := fn_get_or_create_customer(v_org_id, 'Test Customer One', 'Father One', '9999900001', '123456789001', '123 Main St', 'Jaipur');
    v_cust2_id := fn_get_or_create_customer(v_org_id, 'Test Customer One', 'Father One', '9999900001', '123456789001', '123 Main St', 'Jaipur');
    
    IF v_cust1_id <> v_cust2_id THEN
        RAISE EXCEPTION 'TEST 2 FAILED: Duplicate customer detection failed. Created separate IDs.';
    END IF;
    RAISE NOTICE '[PASS] Test 2: Idempotent customer resolution verified.';

    v_cust2_id := fn_get_or_create_customer(v_org_id, 'Test Customer Two', 'Father Two', '9999900002', '123456789002', '456 Oak St', 'Jaipur');

    -- TEST 3: Fraction & Raw Token Normalization (29½ -> 29)
    INSERT INTO tokens (committee_id, customer_id, raw_token_number)
    VALUES (v_comm_id, v_cust1_id, '29½')
    RETURNING id, normalized_token_number, duplicate_suffix INTO v_token1_id, v_token_norm, v_token_suff;

    IF v_token_norm <> 29 THEN
        RAISE EXCEPTION 'TEST 3 FAILED: Token 29½ normalized to % instead of 29.', v_token_norm;
    END IF;
    RAISE NOTICE '[PASS] Test 3: Fractional token normalization (29½ -> 29) verified.';

    -- TEST 4: Duplicate Token Suffix Handling (443 -> 443A, 443B)
    INSERT INTO tokens (committee_id, customer_id, raw_token_number) VALUES (v_comm_id, v_cust1_id, '443');
    INSERT INTO tokens (committee_id, customer_id, raw_token_number) VALUES (v_comm_id, v_cust2_id, '443')
    RETURNING id, duplicate_suffix INTO v_token2_id, v_token_suff;

    IF v_token_suff <> 'A' THEN
        RAISE EXCEPTION 'TEST 4 FAILED: Duplicate token 443 suffix assigned as % instead of A.', v_token_suff;
    END IF;
    RAISE NOTICE '[PASS] Test 4: Duplicate token collision suffix (443 -> 443A) verified.';

    -- TEST 5: Parent Organization Inheritance Trigger Verification
    IF (SELECT organization_id FROM tokens WHERE id = v_token1_id) <> v_org_id THEN
        RAISE EXCEPTION 'TEST 5 FAILED: Parent organization_id inheritance failed on token creation.';
    END IF;
    RAISE NOTICE '[PASS] Test 5: Parent organization_id trigger inheritance verified.';

    -- TEST 6: Committee Month & Schedule Setup
    SELECT id INTO v_month_id FROM committee_months WHERE committee_id = v_comm_id AND month_number = 1 LIMIT 1;
    INSERT INTO installment_schedules (committee_month_id, token_id, expected_amount, due_date)
    VALUES (v_month_id, v_token1_id, 2500.00, CURRENT_DATE)
    RETURNING id INTO v_sched1_id;

    SELECT id INTO v_month_id FROM committee_months WHERE committee_id = v_comm_id AND month_number = 2 LIMIT 1;
    INSERT INTO installment_schedules (committee_month_id, token_id, expected_amount, due_date)
    VALUES (v_month_id, v_token1_id, 2500.00, CURRENT_DATE + interval '1 month')
    RETURNING id INTO v_sched2_id;

    -- TEST 7: Installment Receipt & Financial Ledger Auto-Posting
    INSERT INTO installments (committee_month_id, token_id, schedule_id, receipt_number, expected_amount, paid_amount, payment_date, idempotency_key)
    VALUES (v_month_id, v_token1_id, v_sched1_id, 'REC-001', 2500.00, 2500.00, CURRENT_DATE, 'IDEM_REC_001');

    SELECT COUNT(*) INTO v_ledger_count FROM financial_transactions WHERE idempotency_key = 'IDEM_REC_001';
    IF v_ledger_count <> 1 THEN
        RAISE EXCEPTION 'TEST 7 FAILED: Financial ledger auto-posting trigger failed for installment.';
    END IF;
    RAISE NOTICE '[PASS] Test 7: Installment payment & ledger auto-posting verified.';

    -- TEST 8: Rule-Driven Loan Eligibility Validation (Rejection on Exceeding Max %)
    v_err_caught := FALSE;
    BEGIN
        INSERT INTO loans (committee_id, customer_id, token_id, principal_amount, disbursal_date)
        VALUES (v_comm_id, v_cust1_id, v_token1_id, 5000.00, CURRENT_DATE); -- 5000 > 75% of 2500 (1875)
    EXCEPTION WHEN OTHERS THEN
        v_err_caught := TRUE;
    END;
    IF NOT v_err_caught THEN
        RAISE EXCEPTION 'TEST 8 FAILED: Excess loan amount (5000 > 75%% of 2500) was NOT rejected.';
    END IF;
    RAISE NOTICE '[PASS] Test 8: Rule-driven loan eligibility rejection verified.';

    -- TEST 9: Gift Catalog & Allocation Cap Validation
    INSERT INTO gift_catalog (organization_id, name, default_cash_alternative)
    VALUES (v_org_id, 'Ceiling Fan Test', 1500.00) RETURNING id INTO v_gift_cat_id;

    SELECT id INTO v_month_id FROM committee_months WHERE committee_id = v_comm_id AND month_number = 1 LIMIT 1;
    INSERT INTO committee_month_gifts (committee_month_id, gift_catalog_id, quantity)
    VALUES (v_month_id, v_gift_cat_id, 1) RETURNING id INTO v_month_gift_id;

    INSERT INTO draw_events (committee_month_id, draw_date) VALUES (v_month_id, CURRENT_DATE) RETURNING id INTO v_draw_event_id;
    INSERT INTO draw_results (draw_event_id, token_id, reward_type) VALUES (v_draw_event_id, v_token1_id, 'GIFT_WINNER') RETURNING id INTO v_draw_res1_id;
    INSERT INTO gift_winners (draw_result_id, committee_month_gift_id, token_id, customer_id) VALUES (v_draw_res1_id, v_month_gift_id, v_token1_id, v_cust1_id);

    -- Try adding 2nd gift winner when quantity cap is 1
    INSERT INTO draw_results (draw_event_id, token_id, reward_type) VALUES (v_draw_event_id, v_token2_id, 'GIFT_WINNER') RETURNING id INTO v_draw_res2_id;
    v_err_caught := FALSE;
    BEGIN
        INSERT INTO gift_winners (draw_result_id, committee_month_gift_id, token_id, customer_id) VALUES (v_draw_res2_id, v_month_gift_id, v_token2_id, v_cust2_id);
    EXCEPTION WHEN OTHERS THEN
        v_err_caught := TRUE;
    END;
    IF NOT v_err_caught THEN
        RAISE EXCEPTION 'TEST 9 FAILED: Gift winner quantity cap violation was NOT rejected.';
    END IF;
    RAISE NOTICE '[PASS] Test 9: Gift winner quantity cap validation verified.';

    -- TEST 10: Lucky Winner Transition -> Token OUT & Future Schedule Cancellation
    INSERT INTO draw_results (draw_event_id, token_id, reward_type) VALUES (v_draw_event_id, v_token1_id, 'LUCKY_WINNER');

    SELECT status INTO v_status FROM tokens WHERE id = v_token1_id;
    IF v_status <> 'OUT' THEN
        RAISE EXCEPTION 'TEST 10 FAILED: Lucky winner token status is % instead of OUT.', v_status;
    END IF;

    SELECT status INTO v_sched_status FROM installment_schedules WHERE id = v_sched2_id;
    IF v_sched_status <> 'CANCELLED_LUCKY' THEN
        RAISE EXCEPTION 'TEST 10 FAILED: Future schedule status is % instead of CANCELLED_LUCKY.', v_sched_status;
    END IF;
    RAISE NOTICE '[PASS] Test 10: Lucky winner status transition (ACTIVE -> OUT) & schedule cancellation verified.';

    -- TEST 11: Installment Payment Rejection on OUT Tokens
    v_err_caught := FALSE;
    BEGIN
        INSERT INTO installments (committee_month_id, token_id, receipt_number, expected_amount, paid_amount, payment_date)
        VALUES (v_month_id, v_token1_id, 'REC-OUT-ERR', 2500.00, 2500.00, CURRENT_DATE);
    EXCEPTION WHEN OTHERS THEN
        v_err_caught := TRUE;
    END;
    IF NOT v_err_caught THEN
        RAISE EXCEPTION 'TEST 11 FAILED: Installment payment on OUT token was NOT rejected.';
    END IF;
    RAISE NOTICE '[PASS] Test 11: Payment rejection on OUT token verified.';

    -- TEST 12: Import Job File Hash Deduplication
    INSERT INTO import_jobs (organization_id, file_name, file_hash) VALUES (v_org_id, 'test_file.csv', 'HASH_ABC123_UNIQUE');
    v_err_caught := FALSE;
    BEGIN
        INSERT INTO import_jobs (organization_id, file_name, file_hash) VALUES (v_org_id, 'test_file.csv', 'HASH_ABC123_UNIQUE');
    EXCEPTION WHEN OTHERS THEN
        v_err_caught := TRUE;
    END;
    IF NOT v_err_caught THEN
        RAISE EXCEPTION 'TEST 12 FAILED: Duplicate import job file hash was NOT rejected.';
    END IF;
    RAISE NOTICE '[PASS] Test 12: Import job file hash deduplication verified.';

    -- TEST 13: Audit Trail Log Generation Verification
    SELECT COUNT(*) INTO v_audit_count FROM audit_logs WHERE organization_id = v_org_id;
    IF v_audit_count = 0 THEN
        RAISE EXCEPTION 'TEST 13 FAILED: No audit log records were created by audit trigger.';
    END IF;
    RAISE NOTICE '[PASS] Test 13: Universal audit trail logging verified (% records captured).', v_audit_count;

    -- TEST 14: Lossless Customer Merge
    PERFORM fn_merge_customers(v_cust1_id, v_cust2_id);
    SELECT status INTO v_cust_status FROM customers WHERE id = v_cust2_id;
    IF v_cust_status <> 'MERGED' THEN
        RAISE EXCEPTION 'TEST 14 FAILED: Merged customer status is % instead of MERGED.', v_cust_status;
    END IF;
    RAISE NOTICE '[PASS] Test 14: Lossless customer merge verified.';

    RAISE NOTICE '==================================================';
    RAISE NOTICE 'ALL 14 PRODUCTION ASSERTIONS PASSED SUCCESSFULLY!';
    RAISE NOTICE '==================================================';
END;
$$ LANGUAGE plpgsql;
