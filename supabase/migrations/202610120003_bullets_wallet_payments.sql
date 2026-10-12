-- 003: Bullet wallet, immutable ledger, gift catalog, purchases, earnings, and cashouts.
create table if not exists public.wallets (
  user_profile_id uuid primary key references public.user_profiles(id) on delete restrict,
  spendable_bullets bigint not null default 0 check (spendable_bullets >= 0),
  purchased_bullets_lifetime bigint not null default 0 check (purchased_bullets_lifetime >= 0),
  eligible_earnings_bullets bigint not null default 0 check (eligible_earnings_bullets >= 0),
  reserved_cashout_bullets bigint not null default 0 check (reserved_cashout_bullets >= 0),
  updated_at timestamptz not null default now()
);

create table if not exists public.bullet_packages (
  id uuid primary key default gen_random_uuid(),
  package_key text not null unique,
  display_name text not null,
  bullets integer not null check (bullets > 0),
  price_usd numeric(10,2) not null check (price_usd > 0),
  provider_product_id text,
  active boolean not null default false,
  requires_admin_confirmation boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
insert into public.bullet_packages(package_key,display_name,bullets,price_usd,active,requires_admin_confirmation) values
 ('starter-125','Starter Pack',125,1.00,false,false),
 ('battle-500','Battle Starter',500,4.00,false,false),
 ('creator-1250','Creator Boost',1250,10.00,false,false),
 ('arena-2500','Arena Pack',2500,20.00,false,false),
 ('vault-6500','Arena Vault',6500,52.00,false,false),
 ('executive-31500','Executive Pack',31500,2500.00,false,true)
on conflict(package_key) do nothing;

create table if not exists public.gift_catalog (
  id uuid primary key default gen_random_uuid(),
  gift_key text not null unique,
  display_name text not null,
  icon_key text not null,
  bullet_cost integer not null check (bullet_cost > 0),
  battle_points integer not null check (battle_points >= 0),
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
insert into public.gift_catalog(gift_key,display_name,icon_key,bullet_cost,battle_points,sort_order) values
 ('pulse','Pulse','spark',10,10,1),('boost','Boost','bolt',50,50,2),('crown','Crown','crown',125,125,3),('nova','Nova','star',500,500,4)
on conflict(gift_key) do nothing;

create table if not exists public.wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  user_profile_id uuid not null references public.user_profiles(id) on delete restrict,
  transaction_type text not null check (transaction_type in ('purchase_credit','gift_spend','creator_earning','cashout_reserve','cashout_release','cashout_paid','refund_debit','chargeback_debit','admin_adjustment','reversal')),
  bullets_delta bigint not null,
  balance_after bigint,
  related_purchase_id uuid,
  related_gift_transaction_id uuid,
  related_cashout_id uuid,
  idempotency_key text not null unique,
  provider_reference text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists wallet_transactions_profile_idx on public.wallet_transactions(user_profile_id,created_at desc);

create table if not exists public.purchase_orders (
  id uuid primary key default gen_random_uuid(),
  user_profile_id uuid not null references public.user_profiles(id) on delete restrict,
  package_id uuid not null references public.bullet_packages(id) on delete restrict,
  provider text not null default 'paypal' check (provider in ('paypal','apple_iap','google_play')),
  provider_order_id text,
  provider_capture_id text unique,
  amount_usd numeric(10,2) not null check (amount_usd > 0),
  bullets integer not null check (bullets > 0),
  status text not null default 'created' check (status in ('created','approved','captured','credited','failed','refunded','chargeback')),
  idempotency_key text not null unique,
  created_at timestamptz not null default now(),
  captured_at timestamptz,
  credited_at timestamptz
);
create index if not exists purchase_orders_profile_idx on public.purchase_orders(user_profile_id,created_at desc);

create table if not exists public.gift_transactions (
  id uuid primary key default gen_random_uuid(),
  battle_id uuid not null references public.battles(id) on delete restrict,
  sender_profile_id uuid not null references public.user_profiles(id) on delete restrict,
  recipient_profile_id uuid not null references public.user_profiles(id) on delete restrict,
  gift_id uuid not null references public.gift_catalog(id) on delete restrict,
  bullet_cost integer not null check (bullet_cost > 0),
  battle_points integer not null check (battle_points >= 0),
  status text not null default 'settled' check (status in ('pending','settled','reversed','refunded')),
  idempotency_key text not null unique,
  created_at timestamptz not null default now()
);
create index if not exists gift_transactions_battle_idx on public.gift_transactions(battle_id,created_at);

create table if not exists public.creator_earnings (
  id uuid primary key default gen_random_uuid(),
  user_profile_id uuid not null references public.user_profiles(id) on delete restrict,
  battle_id uuid references public.battles(id) on delete set null,
  gift_transaction_id uuid references public.gift_transactions(id) on delete restrict,
  gross_bullets bigint not null check (gross_bullets >= 0),
  fee_bullets bigint not null default 0 check (fee_bullets >= 0),
  net_eligible_bullets bigint not null check (net_eligible_bullets >= 0),
  status text not null default 'eligible' check (status in ('pending','eligible','reserved','paid','reversed','held')),
  idempotency_key text not null unique,
  created_at timestamptz not null default now()
);
create index if not exists creator_earnings_profile_idx on public.creator_earnings(user_profile_id,status,created_at desc);

create table if not exists public.cashout_requests (
  id uuid primary key default gen_random_uuid(),
  user_profile_id uuid not null references public.user_profiles(id) on delete restrict,
  amount_bullets bigint not null check (amount_bullets >= 3500),
  amount_usd numeric(10,2) not null check (amount_usd > 0),
  provider text not null default 'paypal' check (provider = 'paypal'),
  paypal_payout_batch_id text,
  paypal_payout_item_id text,
  recipient_reference text,
  status text not null default 'pending' check (status in ('pending','approved','processing','paid','rejected','failed','cancelled')),
  scheduled_processing_date date,
  reviewed_by_profile_id uuid references public.user_profiles(id) on delete set null,
  reviewed_at timestamptz,
  rejection_reason text,
  idempotency_key text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  paid_at timestamptz
);
create index if not exists cashout_requests_queue_idx on public.cashout_requests(status,created_at);
create index if not exists cashout_requests_profile_idx on public.cashout_requests(user_profile_id,created_at desc);
drop trigger if exists cashout_requests_set_updated_at on public.cashout_requests;
create trigger cashout_requests_set_updated_at before update on public.cashout_requests for each row execute function public.set_updated_at();

create table if not exists public.payment_webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  provider_event_id text not null,
  event_type text not null,
  payload_hash text,
  processed boolean not null default false,
  processing_error text,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  unique(provider,provider_event_id)
);

alter table public.wallets enable row level security;
alter table public.bullet_packages enable row level security;
alter table public.gift_catalog enable row level security;
alter table public.wallet_transactions enable row level security;
alter table public.purchase_orders enable row level security;
alter table public.gift_transactions enable row level security;
alter table public.creator_earnings enable row level security;
alter table public.cashout_requests enable row level security;
alter table public.payment_webhook_events enable row level security;
create policy "wallet owner read" on public.wallets for select using (user_profile_id = public.current_user_profile_id() or public.is_lw_admin());
create policy "active bullet packages visible" on public.bullet_packages for select using (active = true or public.is_lw_admin());
create policy "active gifts visible" on public.gift_catalog for select using (active = true or public.is_lw_admin());
create policy "wallet transaction owner read" on public.wallet_transactions for select using (user_profile_id = public.current_user_profile_id() or public.is_lw_admin());
create policy "purchase owner read" on public.purchase_orders for select using (user_profile_id = public.current_user_profile_id() or public.is_lw_admin());
create policy "gift transaction participant read" on public.gift_transactions for select using (sender_profile_id = public.current_user_profile_id() or recipient_profile_id = public.current_user_profile_id() or public.is_lw_admin());
create policy "creator earnings owner read" on public.creator_earnings for select using (user_profile_id = public.current_user_profile_id() or public.is_lw_admin());
create policy "cashout owner read" on public.cashout_requests for select using (user_profile_id = public.current_user_profile_id() or public.is_lw_admin());
-- No client write policies for wallet balances, purchases, gift transactions, earnings, cashouts, or webhooks.
