-- 016: complete the wallet ledger's optional relationship foreign keys after target tables exist.
do $$ begin
  alter table public.wallet_transactions add constraint wallet_transactions_purchase_fk foreign key (related_purchase_id) references public.purchase_orders(id) on delete set null;
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.wallet_transactions add constraint wallet_transactions_gift_fk foreign key (related_gift_transaction_id) references public.gift_transactions(id) on delete set null;
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.wallet_transactions add constraint wallet_transactions_cashout_fk foreign key (related_cashout_id) references public.cashout_requests(id) on delete set null;
exception when duplicate_object then null; end $$;
