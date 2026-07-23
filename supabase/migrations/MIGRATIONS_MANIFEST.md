# Migration manifest — snapshot 2026-07-17

This is the full, ordered list of every migration applied to the live Supabase
project `ldmmphwivnnboyhlxipl` (theatre4u-marketplace) as of July 17, 2026.
It is the human-readable index of the database's build history.

The full SQL body of each migration lives in the live project's
`supabase_migrations.schema_migrations` table. To pull every migration down as
individual `.sql` files into this folder (the canonical layout), run once from a
machine with the Supabase CLI installed and logged in:

```
supabase link --project-ref ldmmphwivnnboyhlxipl
supabase db pull            # writes timestamped .sql files into supabase/migrations/
```

See ../README.md for the full backup checklist (DB backups, storage, PITR).

Total migrations: 188

| # | Version | Name |
|---|---------|------|
| 1 | 20260312225631 | district_multischool |
| 2 | 20260313221521 | production_lists |
| 3 | 20260314024156 | fix_items_privacy_policy |
| 4 | 20260318185318 | fix_recursive_rls_policies |
| 5 | 20260318185843 | auto_create_org_on_signup |
| 6 | 20260319182346 | org_location_fields |
| 7 | 20260319184320 | add_loan_fields |
| 8 | 20260319185405 | messaging_system |
| 9 | 20260320183658 | availability_calendar |
| 10 | 20260320185332 | admin_set_plan_function |
| 11 | 20260320190541 | rental_requests |
| 12 | 20260320220119 | items_id_default |
| 13 | 20260320220235 | add_description_to_items |
| 14 | 20260320224424 | get_invite_by_token |
| 15 | 20260320225617 | platform_admin_god_mode |
| 16 | 20260321010551 | prop28_compliance |
| 17 | 20260321030319 | theatre_credits_system |
| 18 | 20260321045652 | credits_earn_on_full_price |
| 19 | 20260321145330 | community_board |
| 20 | 20260321150820 | proximity_location_columns |
| 21 | 20260322045703 | transaction_documents |
| 22 | 20260322173834 | public_org_profiles |
| 23 | 20260322193233 | beta_invites_and_feedback |
| 24 | 20260322194237 | rename_founding_member_to_leading_player |
| 25 | 20260322225652 | security_hardening |
| 26 | 20260323025908 | add_dept_id_for_artstracker |
| 27 | 20260323051215 | fix_beta_code_signup_access |
| 28 | 20260323150331 | fix_old_accounts_leading_players |
| 29 | 20260323192631 | fix_district_invites_cascade |
| 30 | 20260323203402 | add_leadingplayer_beta_code |
| 31 | 20260323203922 | add_community_photos_bucket |
| 32 | 20260324174246 | fix_missing_orgs_and_messaging |
| 33 | 20260324235941 | mark_westminster_leading_player |
| 34 | 20260326050125 | performance_indexes_and_fixes |
| 35 | 20260327194446 | create_org_team_system |
| 36 | 20260329161601 | fix_items_rls_admin_read |
| 37 | 20260329163105 | fix_items_rls_clean_slate |
| 38 | 20260329201713 | fix_items_rls_remove_recursion |
| 39 | 20260329211907 | community_marketplace_optin_and_funding |
| 40 | 20260403211630 | district_invites_public_token_read |
| 41 | 20260405154730 | add_stripe_subscription_columns |
| 42 | 20260406043804 | rls_security_audit_fixes |
| 43 | 20260406144351 | add_onboarding_step_to_orgs |
| 44 | 20260406155324 | add_item_number_per_org |
| 45 | 20260406160253 | add_storage_locations_and_item_display_id |
| 46 | 20260407001326 | add_site_analytics |
| 47 | 20260407051639 | strip_org_fields_from_items_update |
| 48 | 20260409154713 | add_purchase_cost_to_items |
| 49 | 20260409201445 | fix_org_invites_rls_security |
| 50 | 20260410012458 | add_leading_player_free_until |
| 51 | 20260410031929 | fix_join_code_default_and_rls |
| 52 | 20260410050051 | allow_member_self_join_via_invite |
| 53 | 20260410050107 | accept_team_invite_rpc |
| 54 | 20260418151659 | increase_district_max_schools |
| 55 | 20260418152913 | revert_district_max_schools_to_6 |
| 56 | 20260420183720 | add_district_m_l_plans |
| 57 | 20260421180330 | migrate_legacy_item_ids_to_uuid |
| 58 | 20260421181405 | add_public_item_lookup_policy |
| 59 | 20260421181434 | add_public_org_name_lookup_policy |
| 60 | 20260421183641 | add_qr_privacy_settings |
| 61 | 20260422192157 | add_missing_org_profile_columns |
| 62 | 20260423013955 | redesign_points_system |
| 63 | 20260423192111 | points_eligibility_and_annual_benefits |
| 64 | 20260423192744 | grandfathered_pricing_flag |
| 65 | 20260424173927 | storage_locations_table |
| 66 | 20260424182209 | account_lifecycle_and_admin_controls |
| 67 | 20260424224303 | hard_delete_org_function |
| 68 | 20260425160658 | district_permissions_and_absorption |
| 69 | 20260425184519 | feedback_rewards_and_beta_tracking |
| 70 | 20260425235348 | program_impact_and_platform_usage_views |
| 71 | 20260427224134 | page_views_and_signup_notifications |
| 72 | 20260428152516 | signup_notify_trigger |
| 73 | 20260428152609 | signup_notifications_unique_org |
| 74 | 20260428171757 | remove_pgnet_trigger_fix_signup |
| 75 | 20260428214459 | extend_join_code_expiry |
| 76 | 20260428214926 | set_views_security_invoker |
| 77 | 20260430032246 | beta_leads_table_only |
| 78 | 20260502151555 | add_director_contact_fields |
| 79 | 20260503161510 | label_orders_table |
| 80 | 20260503181947 | label_pool_system |
| 81 | 20260503182042 | label_claim_functions |
| 82 | 20260503183705 | update_label_pricing_and_logo |
| 83 | 20260503184758 | label_checkout_sessions |
| 84 | 20260504031726 | email_sequence_tracking |
| 85 | 20260504031959 | email_sequence_cron |
| 86 | 20260504033305 | beta_leads_email_tracking |
| 87 | 20260504043848 | enable_pg_net |
| 88 | 20260506025828 | org_signup_notify_trigger |
| 89 | 20260506025846 | org_signup_notify_trigger_v2 |
| 90 | 20260506025916 | fix_signup_notify_trigger_v3 |
| 91 | 20260507215658 | production_needs_table |
| 92 | 20260507221515 | production_needs_crew_access |
| 93 | 20260507222931 | login_events_table |
| 94 | 20260508051657 | add_updated_at_to_productions |
| 95 | 20260508192501 | add_label_type_to_items_and_pool |
| 96 | 20260508213802 | add_label_prefix_restructure_pool |
| 97 | 20260508221758 | merge_leslie_chris_rename_ovhs |
| 98 | 20260508222053 | assign_label_prefixes_all_programs |
| 99 | 20260508224545 | add_temp_pro_beta_flag |
| 100 | 20260508225338 | add_beta_incentive_tracking |
| 101 | 20260509150223 | create_stripe_payments_log |
| 102 | 20260509162342 | cleanup_closed_account_status |
| 103 | 20260509191242 | create_social_shares_table |
| 104 | 20260509215927 | add_referral_tracking |
| 105 | 20260510165752 | add_ref_code_to_page_views |
| 106 | 20260511181229 | fix_display_id_uniqueness |
| 107 | 20260511181454 | fix_display_id_generation_with_org_prefix |
| 108 | 20260511182841 | label_orders_tracking_v2 |
| 109 | 20260511182901 | generate_label_order_function |
| 110 | 20260513040809 | enable_rls_email_sequence_label_packs |
| 111 | 20260513140032 | fix_team_invite_system |
| 112 | 20260513143234 | org_invites_public_token_lookup |
| 113 | 20260513154808 | trigger_signup_notify_team_member_aware |
| 114 | 20260513172254 | get_admin_org_overview_rpc |
| 115 | 20260514223522 | fix_org_invites_rls_and_insert |
| 116 | 20260515152426 | migrate_coppell_items_to_main_org |
| 117 | 20260515152459 | migrate_copp1_items_to_glenn_org |
| 118 | 20260515153139 | reverse_coppell_item_migration |
| 119 | 20260515153613 | beta_terms_and_founding_member_fields |
| 120 | 20260515171245 | migrate_ias9770_items_to_glenn_and_update_district |
| 121 | 20260515171331 | add_co_director_to_invite_role_check |
| 122 | 20260515171819 | create_coppell_district |
| 123 | 20260515171837 | link_coppell_org_to_district |
| 124 | 20260515172425 | create_jsterling_district_invite_v2 |
| 125 | 20260515184757 | security_fixes_critical_may2026 |
| 126 | 20260515190746 | default_qr_privacy_to_public_for_own_items |
| 127 | 20260515190802 | set_qr_privacy_public_default |
| 128 | 20260518045506 | sync_glenn_stripe_data |
| 129 | 20260518050223 | fix_stripe_payments_unique_constraint |
| 130 | 20260518180227 | artstracker_vertical_columns_orgs |
| 131 | 20260518180238 | artstracker_vertical_column_items |
| 132 | 20260519025707 | item_photos_bucket_settings |
| 133 | 20260519025748 | item_photos_add_heic_support |
| 134 | 20260521021834 | fix_signup_notify_trigger_after_insert |
| 135 | 20260521174635 | fix_handle_new_user_team_member |
| 136 | 20260521175403 | fix_org_invites_public_token_lookup |
| 137 | 20260521175623 | tighten_org_invites_rls_token_only |
| 138 | 20260522183855 | fix_glenn_price_payment_refund_and_pause |
| 139 | 20260522214536 | storage_locations_add_map_and_rack_columns |
| 140 | 20260522214923 | room_photos_bucket_policies |
| 141 | 20260522235140 | items_add_pin_id_and_rack_slot |
| 142 | 20260524024632 | fix_signup_notify_trigger_timeout |
| 143 | 20260526033643 | fix_beta_feedback_update_policy |
| 144 | 20260526051516 | fix_beta_feedback_status_constraint |
| 145 | 20260526190557 | production_items_add_qty_checked_out |
| 146 | 20260526212227 | create_district_loans_table |
| 147 | 20260527031149 | create_partner_coupons_table |
| 148 | 20260527031913 | orgs_add_partner_coupon_code |
| 149 | 20260527163455 | founding_member_rate_tracking |
| 150 | 20260529161836 | disable_signup_notify_trigger |
| 151 | 20260531013402 | signup_notify_durable_pending_row |
| 152 | 20260531013416 | signup_notify_retry_sweep |
| 153 | 20260606211211 | modelA_step1_vertical_scoping_and_facilitators |
| 154 | 20260606223214 | fix_anon_items_exposure_scope_to_listed |
| 155 | 20260606224846 | modelA_step2_vertical_scoping_helpers |
| 156 | 20260606224920 | allow_program_director_role_in_org_members |
| 157 | 20260606225025 | modelA_step2_vertical_scoping_policies |
| 158 | 20260606225705 | custom_inventory_categories |
| 159 | 20260607000919 | district_members_policies_step3b |
| 160 | 20260607004332 | facilitator_browse_read_policies |
| 161 | 20260607162211 | close_anon_read_on_internal_pii_surfaces |
| 162 | 20260607181613 | lock_admin_pii_tables_to_platform_admin |
| 163 | 20260607182936 | add_get_public_org_function |
| 164 | 20260607183315 | lock_anon_orgs_columns |
| 165 | 20260607184507 | add_external_loans_table |
| 166 | 20260615212248 | community_posts_per_vertical |
| 167 | 20260616020938 | productions_per_vertical |
| 168 | 20260617153302 | funding_storage_per_vertical |
| 169 | 20260618160326 | messaging_org_member_access |
| 170 | 20260618161432 | retire_marketplace_inquiries_messages_twin |
| 171 | 20260618162123 | retire_legacy_schema_cluster |
| 172 | 20260618172921 | rental_requests_org_member_access |
| 173 | 20260618173202 | productions_org_member_access |
| 174 | 20260618173732 | member_access_remaining_tables |
| 175 | 20260618175232 | lock_down_stripe_views |
| 176 | 20260618175304 | stripe_views_security_invoker |
| 177 | 20260618184606 | drop_duplicate_indexes |
| 178 | 20260623181211 | lock_down_ovhs_backup_tables |
| 179 | 20260623192657 | add_item_images_gallery |
| 180 | 20260711165242 | phase8_add_orgs_owner_id_and_helper |
| 181 | 20260711171637 | phase8_rls_switch_to_is_org_owner |
| 182 | 20260713173549 | phase8_content_brand_editor_tables |
| 183 | 20260713200306 | phase8_content_draft_layer |
| 184 | 20260713214012 | phase8_site_assets_bucket |
| 185 | 20260713233449 | phase8_app_sessions_heartbeat |
| 186 | 20260714024958 | fix_org_platform_usage_include_paused |
| 187 | 20260714031919 | phase8_record_login_rpc |
| 188 | 20260716011044 | phase8_business_ledger |
| 189 | 20260723172224 | fix_signup_notify_durable_row_and_sweeper_backfill |
| 190 | 20260723175521 | district_facilitator_full_partner_access |
