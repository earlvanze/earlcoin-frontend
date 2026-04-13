-- Atomic debit: decrements balance only if sufficient funds exist.
-- Returns the row on success, NULL if insufficient.
create or replace function public.debit_custody_balance(
  p_custody_account_id uuid,
  p_asset_id bigint,
  p_amount bigint
)
returns json
language plpgsql
security definer
as $$
declare
  result record;
begin
  update public.custody_balances
  set available_base_units = available_base_units - p_amount,
      updated_at = now()
  where custody_account_id = p_custody_account_id
    and asset_id = p_asset_id
    and available_base_units >= p_amount
  returning id, available_base_units
  into result;

  if not found then
    return null;
  end if;

  return row_to_json(result);
end;
$$;

-- Atomic credit: increments balance in a single statement.
create or replace function public.credit_custody_balance(
  p_balance_id uuid,
  p_amount bigint
)
returns void
language plpgsql
security definer
as $$
begin
  update public.custody_balances
  set available_base_units = available_base_units + p_amount,
      updated_at = now()
  where id = p_balance_id;
end;
$$;
