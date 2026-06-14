-- FreeTrust schema scalability recommendations
-- Generated 2026-06-14 from production Supabase metadata.
-- REVIEW ONLY: do not apply blindly. Run in a maintenance window and validate data first.
-- This file intentionally uses additive indexes and NOT VALID checks where possible.

-- ============================================================
-- 1) Foreign-key support indexes
-- These reduce lock/scan cost on parent updates/deletes and improve joins.
-- Consider running high-traffic indexes one at a time in production.
-- ============================================================
CREATE INDEX IF NOT EXISTS "article_comments_author_id_fk_idx" ON public."article_comments" ("author_id"); -- article_comments_author_id_fkey -> profiles
CREATE INDEX IF NOT EXISTS "article_comments_parent_id_fk_idx" ON public."article_comments" ("parent_id"); -- article_comments_parent_id_fkey -> article_comments
CREATE INDEX IF NOT EXISTS "business_followers_user_id_fk_idx" ON public."business_followers" ("user_id"); -- business_followers_user_id_fkey -> profiles
CREATE INDEX IF NOT EXISTS "business_members_user_id_fk_idx" ON public."business_members" ("user_id"); -- business_members_user_id_fkey -> profiles
CREATE INDEX IF NOT EXISTS "business_reviews_business_id_fk_idx" ON public."business_reviews" ("business_id"); -- business_reviews_business_id_fkey -> businesses
CREATE INDEX IF NOT EXISTS "business_reviews_reviewer_id_fk_idx" ON public."business_reviews" ("reviewer_id"); -- business_reviews_reviewer_id_fkey -> profiles
CREATE INDEX IF NOT EXISTS "businesses_owner_id_fk_idx" ON public."businesses" ("owner_id"); -- businesses_owner_id_fkey -> profiles
CREATE INDEX IF NOT EXISTS "campaign_sends_user_id_fk_idx" ON public."campaign_sends" ("user_id"); -- campaign_sends_user_id_fkey -> auth.users
CREATE INDEX IF NOT EXISTS "campaigns_created_by_fk_idx" ON public."campaigns" ("created_by"); -- campaigns_created_by_fkey -> auth.users
CREATE INDEX IF NOT EXISTS "categories_parent_id_fk_idx" ON public."categories" ("parent_id"); -- categories_parent_id_fkey -> categories
CREATE INDEX IF NOT EXISTS "communities_owner_id_fk_idx" ON public."communities" ("owner_id"); -- communities_owner_id_fkey -> profiles
CREATE INDEX IF NOT EXISTS "community_comments_author_id_fk_idx" ON public."community_comments" ("author_id"); -- community_comments_author_id_fkey -> profiles
CREATE INDEX IF NOT EXISTS "community_comments_post_id_fk_idx" ON public."community_comments" ("post_id"); -- community_comments_post_id_fkey -> community_posts
CREATE INDEX IF NOT EXISTS "community_courses_community_id_fk_idx" ON public."community_courses" ("community_id"); -- community_courses_community_id_fkey -> communities
CREATE INDEX IF NOT EXISTS "community_event_attendees_user_id_fk_idx" ON public."community_event_attendees" ("user_id"); -- community_event_attendees_user_id_fkey -> profiles
CREATE INDEX IF NOT EXISTS "community_events_community_id_fk_idx" ON public."community_events" ("community_id"); -- community_events_community_id_fkey -> communities
CREATE INDEX IF NOT EXISTS "community_lessons_course_id_fk_idx" ON public."community_lessons" ("course_id"); -- community_lessons_course_id_fkey -> community_courses
CREATE INDEX IF NOT EXISTS "community_members_user_id_fk_idx" ON public."community_members" ("user_id"); -- community_members_user_id_fkey -> profiles
CREATE INDEX IF NOT EXISTS "community_post_comments_author_id_fk_idx" ON public."community_post_comments" ("author_id"); -- community_post_comments_author_id_fkey -> profiles
CREATE INDEX IF NOT EXISTS "community_post_comments_post_id_fk_idx" ON public."community_post_comments" ("post_id"); -- community_post_comments_post_id_fkey -> community_posts
CREATE INDEX IF NOT EXISTS "community_post_votes_user_id_fk_idx" ON public."community_post_votes" ("user_id"); -- community_post_votes_user_id_fkey -> profiles
CREATE INDEX IF NOT EXISTS "community_posts_author_id_fk_idx" ON public."community_posts" ("author_id"); -- community_posts_author_id_fkey -> profiles
CREATE INDEX IF NOT EXISTS "community_posts_community_id_fk_idx" ON public."community_posts" ("community_id"); -- community_posts_community_id_fkey -> communities
CREATE INDEX IF NOT EXISTS "conversations_buyer_id_fk_idx" ON public."conversations" ("buyer_id"); -- conversations_buyer_id_fkey -> profiles
CREATE INDEX IF NOT EXISTS "conversations_seller_id_fk_idx" ON public."conversations" ("seller_id"); -- conversations_seller_id_fkey -> profiles
CREATE INDEX IF NOT EXISTS "delivery_sessions_buyer_id_fk_idx" ON public."delivery_sessions" ("buyer_id"); -- delivery_sessions_buyer_id_fkey -> auth.users
CREATE INDEX IF NOT EXISTS "delivery_sessions_seller_id_fk_idx" ON public."delivery_sessions" ("seller_id"); -- delivery_sessions_seller_id_fkey -> auth.users
CREATE INDEX IF NOT EXISTS "disputes_against_user_fk_idx" ON public."disputes" ("against_user"); -- disputes_against_user_fkey -> profiles
CREATE INDEX IF NOT EXISTS "disputes_order_id_fk_idx" ON public."disputes" ("order_id"); -- disputes_order_id_fkey -> orders
CREATE INDEX IF NOT EXISTS "disputes_raised_by_fk_idx" ON public."disputes" ("raised_by"); -- disputes_raised_by_fkey -> profiles
CREATE INDEX IF NOT EXISTS "disputes_resolved_by_fk_idx" ON public."disputes" ("resolved_by"); -- disputes_resolved_by_fkey -> profiles
CREATE INDEX IF NOT EXISTS "feed_comment_likes_user_id_fk_idx" ON public."feed_comment_likes" ("user_id"); -- feed_comment_likes_user_id_fkey -> profiles
CREATE INDEX IF NOT EXISTS "feed_comments_post_id_fk_idx" ON public."feed_comments" ("post_id"); -- feed_comments_post_id_fkey -> feed_posts
CREATE INDEX IF NOT EXISTS "feed_comments_user_id_fk_idx" ON public."feed_comments" ("user_id"); -- feed_comments_user_id_fkey -> profiles
CREATE INDEX IF NOT EXISTS "feed_likes_user_id_fk_idx" ON public."feed_likes" ("user_id"); -- feed_likes_user_id_fkey -> profiles
CREATE INDEX IF NOT EXISTS "feed_post_likes_user_id_fk_idx" ON public."feed_post_likes" ("user_id"); -- feed_post_likes_user_id_fkey -> profiles
CREATE INDEX IF NOT EXISTS "feed_post_saves_user_id_fk_idx" ON public."feed_post_saves" ("user_id"); -- feed_post_saves_user_id_fkey -> profiles
CREATE INDEX IF NOT EXISTS "feed_saves_user_id_fk_idx" ON public."feed_saves" ("user_id"); -- feed_saves_user_id_fkey -> profiles
CREATE INDEX IF NOT EXISTS "impact_donations_project_id_fk_idx" ON public."impact_donations" ("project_id"); -- impact_donations_project_id_fkey -> impact_projects
CREATE INDEX IF NOT EXISTS "impact_donations_user_id_fk_idx" ON public."impact_donations" ("user_id"); -- impact_donations_user_id_fkey -> profiles
CREATE INDEX IF NOT EXISTS "jobs_business_id_fk_idx" ON public."jobs" ("business_id"); -- jobs_business_id_fkey -> businesses
CREATE INDEX IF NOT EXISTS "jobs_organisation_id_fk_idx" ON public."jobs" ("organisation_id"); -- jobs_organisation_id_fkey -> organisations
CREATE INDEX IF NOT EXISTS "jobs_poster_id_fk_idx" ON public."jobs" ("poster_id"); -- jobs_poster_id_fkey -> profiles
CREATE INDEX IF NOT EXISTS "listings_business_id_fk_idx" ON public."listings" ("business_id"); -- listings_business_id_fkey -> businesses
CREATE INDEX IF NOT EXISTS "listings_category_id_fk_idx" ON public."listings" ("category_id"); -- listings_category_id_fkey -> categories
CREATE INDEX IF NOT EXISTS "listings_seller_id_fk_idx" ON public."listings" ("seller_id"); -- listings_seller_id_fkey -> profiles
CREATE INDEX IF NOT EXISTS "message_user_state_conversation_id_fk_idx" ON public."message_user_state" ("conversation_id"); -- message_user_state_conversation_id_fkey -> conversations
CREATE INDEX IF NOT EXISTS "order_activity_actor_id_fk_idx" ON public."order_activity" ("actor_id"); -- order_activity_actor_id_fkey -> auth.users
CREATE INDEX IF NOT EXISTS "orders_business_id_fk_idx" ON public."orders" ("business_id"); -- orders_business_id_fkey -> businesses
CREATE INDEX IF NOT EXISTS "orders_listing_id_fk_idx" ON public."orders" ("listing_id"); -- orders_listing_id_fkey -> listings
CREATE INDEX IF NOT EXISTS "organisation_followers_user_id_fk_idx" ON public."organisation_followers" ("user_id"); -- organisation_followers_user_id_fkey -> profiles
CREATE INDEX IF NOT EXISTS "organisation_follows_user_id_fk_idx" ON public."organisation_follows" ("user_id"); -- organisation_follows_user_id_fkey -> profiles
CREATE INDEX IF NOT EXISTS "organisations_creator_id_fk_idx" ON public."organisations" ("creator_id"); -- organisations_creator_id_fkey -> profiles
CREATE INDEX IF NOT EXISTS "organisations_verified_by_fk_idx" ON public."organisations" ("verified_by"); -- organisations_verified_by_fkey -> profiles
CREATE INDEX IF NOT EXISTS "profiles_verified_by_fk_idx" ON public."profiles" ("verified_by"); -- profiles_verified_by_fkey -> profiles
CREATE INDEX IF NOT EXISTS "rent_share_listings_user_id_fk_idx" ON public."rent_share_listings" ("user_id"); -- rent_share_listings_user_id_fkey -> profiles
CREATE INDEX IF NOT EXISTS "rent_share_requests_listing_id_fk_idx" ON public."rent_share_requests" ("listing_id"); -- rent_share_requests_listing_id_fkey -> rent_share_listings
CREATE INDEX IF NOT EXISTS "rent_share_requests_requester_id_fk_idx" ON public."rent_share_requests" ("requester_id"); -- rent_share_requests_requester_id_fkey -> profiles
CREATE INDEX IF NOT EXISTS "reviews_listing_id_fk_idx" ON public."reviews" ("listing_id"); -- reviews_listing_id_fkey -> listings
CREATE INDEX IF NOT EXISTS "reviews_reviewee_id_fk_idx" ON public."reviews" ("reviewee_id"); -- reviews_reviewee_id_fkey -> profiles
CREATE INDEX IF NOT EXISTS "support_tickets_conversation_id_fk_idx" ON public."support_tickets" ("conversation_id"); -- support_tickets_conversation_id_fkey -> assistant_conversations
CREATE INDEX IF NOT EXISTS "support_tickets_user_id_fk_idx" ON public."support_tickets" ("user_id"); -- support_tickets_user_id_fkey -> profiles
CREATE INDEX IF NOT EXISTS "wallet_transfers_recipient_id_fk_idx" ON public."wallet_transfers" ("recipient_id"); -- wallet_transfers_recipient_id_fkey -> auth.users
CREATE INDEX IF NOT EXISTS "wallet_transfers_sender_id_fk_idx" ON public."wallet_transfers" ("sender_id"); -- wallet_transfers_sender_id_fkey -> auth.users

-- ============================================================
-- 2) Frequent-query composite indexes for current app paths
-- Add only after confirming query plans with EXPLAIN on production-like data.
-- ============================================================
CREATE INDEX IF NOT EXISTS "listings_product_type_status_created_idx" ON public."listings" (product_type, status, created_at DESC); -- Marketplace browse/search filters active services/products/grassroots.
CREATE INDEX IF NOT EXISTS "listings_seller_status_created_idx" ON public."listings" (seller_id, status, created_at DESC); -- Seller dashboard and own listings.
-- SKIPPED candidate listings_org_status_created_idx: table already has an index beginning with organisation_id. Re-check before adding.
CREATE INDEX IF NOT EXISTS "feed_posts_type_created_idx" ON public."feed_posts" (type, created_at DESC); -- Feed photo/video/article filters.
CREATE INDEX IF NOT EXISTS "feed_posts_created_idx" ON public."feed_posts" (created_at DESC); -- Discover feed pagination.
CREATE INDEX IF NOT EXISTS "feed_comments_post_created_idx" ON public."feed_comments" (post_id, created_at); -- Post comment threads.
CREATE INDEX IF NOT EXISTS "orders_listing_created_idx" ON public."orders" (listing_id, created_at DESC); -- Order lookup by listing and review/dispute windows.
CREATE INDEX IF NOT EXISTS "orders_business_created_idx" ON public."orders" (business_id, created_at DESC); -- Business/order management views.
-- SKIPPED candidate notifications_user_unread_created_idx: table already has an index beginning with user_id. Re-check before adding.

-- ============================================================
-- 3) Enum-like CHECK constraints for high-risk free-text state columns
-- NOT VALID prevents deployment failure if legacy rows contain other values; clean data then VALIDATE.
-- Confirm allowed values against application code before applying.
-- ============================================================
ALTER TABLE public."profiles" ADD CONSTRAINT "profiles_account_type_check" CHECK (account_type IS NULL OR account_type IN ('individual', 'business', 'organisation')) NOT VALID;
ALTER TABLE public."profiles" ADD CONSTRAINT "profiles_verification_status_check" CHECK (verification_status IN ('none', 'draft', 'submitted', 'pending', 'verified', 'rejected')) NOT VALID;
ALTER TABLE public."listings" ADD CONSTRAINT "listings_product_type_check" CHECK (product_type IS NULL OR product_type IN ('product', 'service', 'grassroots')) NOT VALID;
ALTER TABLE public."listings" ADD CONSTRAINT "listings_service_mode_check" CHECK (service_mode IS NULL OR service_mode IN ('remote', 'local', 'hybrid', 'in_person')) NOT VALID;
ALTER TABLE public."orders" ADD CONSTRAINT "orders_delivery_type_check" CHECK (delivery_type IS NULL OR delivery_type IN ('digital', 'local', 'shipping', 'collection', 'in_person')) NOT VALID;
ALTER TABLE public."trust_ledger" ADD CONSTRAINT "trust_ledger_type_check" CHECK (type IN ('bonus', 'profile_complete', 'post', 'comment', 'purchase', 'sale', 'refund', 'adjustment', 'admin')) NOT VALID;
ALTER TABLE public."feed_posts" ADD CONSTRAINT "feed_posts_type_check" CHECK (type IN ('text', 'photo', 'video', 'article', 'service', 'product', 'music')) NOT VALID;
ALTER TABLE public."feed_posts" ADD CONSTRAINT "feed_posts_media_type_check" CHECK (media_type IS NULL OR media_type IN ('image', 'video', 'audio')) NOT VALID;
ALTER TABLE public."notifications" ADD CONSTRAINT "notifications_type_nonempty_check" CHECK (length(trim(type)) > 0) NOT VALID;
ALTER TABLE public."money_deposits" ADD CONSTRAINT "money_deposits_status_check" CHECK (status IN ('pending', 'completed', 'failed', 'cancelled', 'refunded')) NOT VALID;
ALTER TABLE public."ai_credit_ledger" ADD CONSTRAINT "ai_credit_ledger_reason_nonempty_check" CHECK (length(trim(reason)) > 0) NOT VALID;

-- After cleaning/confirming legacy rows, validate selected constraints individually, e.g.:
-- ALTER TABLE public.listings VALIDATE CONSTRAINT listings_product_type_check;

-- ============================================================
-- 4) RLS policy gaps requiring manual product decisions
-- RLS is enabled but no policies exist on these tables. With Supabase, that generally means browser clients cannot read/write them; service-role routes can still access them. Add explicit least-privilege policies only where client access is intended.
-- ============================================================
-- TODO RLS policy review: public."assistant_messages" has RLS enabled and 0 policies.
-- TODO RLS policy review: public."business_followers" has RLS enabled and 0 policies.
-- TODO RLS policy review: public."business_members" has RLS enabled and 0 policies.
-- TODO RLS policy review: public."business_reviews" has RLS enabled and 0 policies.
-- TODO RLS policy review: public."businesses" has RLS enabled and 0 policies.
-- TODO RLS policy review: public."categories" has RLS enabled and 0 policies.
-- TODO RLS policy review: public."cron_fanout_log" has RLS enabled and 0 policies.
-- TODO RLS policy review: public."digest_run_checkpoints" has RLS enabled and 0 policies.
-- TODO RLS policy review: public."disputes" has RLS enabled and 0 policies.
-- TODO RLS policy review: public."feed_comment_likes" has RLS enabled and 0 policies.
-- TODO RLS policy review: public."onboarding_sequence_log" has RLS enabled and 0 policies.
-- TODO RLS policy review: public."orders" has RLS enabled and 0 policies.
-- TODO RLS policy review: public."support_tickets" has RLS enabled and 0 policies.
-- TODO RLS policy review: public."user_badges" has RLS enabled and 0 policies.

-- Examples to adapt; intentionally commented because ownership rules vary by table:
-- CREATE POLICY "Members read own orders" ON public.orders FOR SELECT USING (auth.uid() = buyer_id OR auth.uid() = seller_id);
-- CREATE POLICY "Members read own disputes" ON public.disputes FOR SELECT USING (auth.uid() IN (raised_by, against_user));
-- CREATE POLICY "Public read categories" ON public.categories FOR SELECT USING (true);
