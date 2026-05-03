"""
Treasury Escrow Smart Contract — EARLCoin

Replaces backend mnemonic-based settlement with on-chain atomic swaps.
Users send USDC to the contract, contract releases EARL in the same atomic group.

Security benefits:
- No private keys in env vars
- Atomic swap = no race conditions or double-settlement
- KYC enforced via VNFT holding check
- Price controlled by admin, not client
- All settlement logic verifiable on-chain

Methods:
  - setup(earl_asa, usdc_asa, vnft_asa, price_microusdc): Admin initializes the contract
  - update_price(new_price): Admin updates EARL price in micro-USDC
  - buy_earl(): User buys EARL — atomic group: [app_call, usdc_payment, earl_receive]
  - admin_withdraw(asset_id, amount): Admin withdraws assets from escrow
  - admin_update(): Admin updates contract code
"""

from pyteal import *

# Global state keys
ADMIN_KEY = Bytes("admin")
EARL_ASA_KEY = Bytes("earl_asa")
USDC_ASA_KEY = Bytes("usdc_asa")
VNFT_ASA_KEY = Bytes("vnft_asa")
PRICE_KEY = Bytes("price")  # micro-USDC per 1 EARL (6 decimals each)
PAUSED_KEY = Bytes("paused")

# Scratch space
EARL_AMOUNT = ScratchVar(TealType.uint64)
USDC_AMOUNT = ScratchVar(TealType.uint64)


def approval_program():
    # --- Helpers ---

    is_admin = Txn.sender() == App.globalGet(ADMIN_KEY)

    earl_asa = App.globalGet(EARL_ASA_KEY)
    usdc_asa = App.globalGet(USDC_ASA_KEY)
    vnft_asa = App.globalGet(VNFT_ASA_KEY)
    price = App.globalGet(PRICE_KEY)
    paused = App.globalGet(PAUSED_KEY)

    vnft_balance = AssetHolding.balance(Txn.sender(), vnft_asa)

    def check_vnft():
        """Check if sender holds at least 1 VNFT token."""
        return Seq([
            vnft_balance,
            Assert(vnft_balance.hasValue()),
            Assert(vnft_balance.value() > Int(0)),
        ])

    # --- App Creation ---
    on_create = Seq([
        App.globalPut(ADMIN_KEY, Txn.sender()),
        App.globalPut(PAUSED_KEY, Int(0)),
        Approve(),
    ])

    # --- Setup: admin initializes ASA IDs and price ---
    setup = Seq([
        Assert(is_admin),
        App.globalPut(EARL_ASA_KEY, Btoi(Txn.application_args[1])),
        App.globalPut(USDC_ASA_KEY, Btoi(Txn.application_args[2])),
        App.globalPut(VNFT_ASA_KEY, Btoi(Txn.application_args[3])),
        App.globalPut(PRICE_KEY, Btoi(Txn.application_args[4])),
        Approve(),
    ])

    # --- Update price ---
    update_price = Seq([
        Assert(is_admin),
        Assert(Btoi(Txn.application_args[1]) > Int(0)),
        App.globalPut(PRICE_KEY, Btoi(Txn.application_args[1])),
        Approve(),
    ])

    # --- Pause/unpause ---
    toggle_pause = Seq([
        Assert(is_admin),
        App.globalPut(PAUSED_KEY, Int(1) - paused),
        Approve(),
    ])

    # --- Buy EARL: atomic group of 3 transactions ---
    # Txn 0: Application call (this)
    # Txn 1: USDC payment from buyer to escrow
    # Txn 2: EARL transfer from escrow to buyer (inner txn)
    buy_earl = Seq([
        # Contract must not be paused
        Assert(paused == Int(0)),

        # Must be in an atomic group of exactly 2 transactions
        # (app call + USDC payment; EARL release is an inner transaction)
        Assert(Global.group_size() == Int(2)),

        # Verify the USDC payment (Txn index 1)
        Assert(Gtxn[1].type_enum() == TxnType.AssetTransfer),
        Assert(Gtxn[1].xfer_asset() == usdc_asa),
        Assert(Gtxn[1].asset_receiver() == Global.current_application_address()),
        Assert(Gtxn[1].asset_amount() > Int(0)),
        Assert(Gtxn[1].sender() == Txn.sender()),  # buyer pays

        # Verify buyer holds VNFT (KYC check)
        check_vnft(),

        # Calculate EARL amount: usdc_paid * 10^6 / price
        # price is micro-USDC per 1 EARL token (both 6 decimals)
        # earl_base_units = usdc_base_units * 10^6 / price
        USDC_AMOUNT.store(Gtxn[1].asset_amount()),
        EARL_AMOUNT.store(
            WideRatio(
                [USDC_AMOUNT.load(), Int(1_000_000)],
                [price],
            )
        ),

        # Must result in at least 1 base unit of EARL
        Assert(EARL_AMOUNT.load() > Int(0)),

        # Send EARL to buyer via inner transaction
        InnerTxnBuilder.Begin(),
        InnerTxnBuilder.SetFields({
            TxnField.type_enum: TxnType.AssetTransfer,
            TxnField.xfer_asset: earl_asa,
            TxnField.asset_amount: EARL_AMOUNT.load(),
            TxnField.asset_receiver: Txn.sender(),
            TxnField.fee: Int(0),
        }),
        InnerTxnBuilder.Submit(),

        Approve(),
    ])

    # --- Admin withdraw: pull assets from escrow ---
    admin_withdraw = Seq([
        Assert(is_admin),
        InnerTxnBuilder.Begin(),
        InnerTxnBuilder.SetFields({
            TxnField.type_enum: TxnType.AssetTransfer,
            TxnField.xfer_asset: Btoi(Txn.application_args[1]),
            TxnField.asset_amount: Btoi(Txn.application_args[2]),
            TxnField.asset_receiver: Txn.sender(),
            TxnField.fee: Int(0),
        }),
        InnerTxnBuilder.Submit(),
        Approve(),
    ])

    # --- Admin opt-in escrow to an ASA ---
    admin_optin = Seq([
        Assert(is_admin),
        InnerTxnBuilder.Begin(),
        InnerTxnBuilder.SetFields({
            TxnField.type_enum: TxnType.AssetTransfer,
            TxnField.xfer_asset: Btoi(Txn.application_args[1]),
            TxnField.asset_amount: Int(0),
            TxnField.asset_receiver: Global.current_application_address(),
            TxnField.fee: Int(0),
        }),
        InnerTxnBuilder.Submit(),
        Approve(),
    ])

    # --- Router ---
    method = Txn.application_args[0]
    on_call = Cond(
        [method == Bytes("setup"), setup],
        [method == Bytes("update_price"), update_price],
        [method == Bytes("toggle_pause"), toggle_pause],
        [method == Bytes("buy_earl"), buy_earl],
        [method == Bytes("admin_withdraw"), admin_withdraw],
        [method == Bytes("admin_optin"), admin_optin],
    )

    program = Cond(
        [Txn.application_id() == Int(0), on_create],
        [Txn.on_completion() == OnComplete.NoOp, on_call],
        [Txn.on_completion() == OnComplete.UpdateApplication, Seq([Assert(is_admin), Approve()])],
        [Txn.on_completion() == OnComplete.DeleteApplication, Seq([Assert(is_admin), Approve()])],
        [Txn.on_completion() == OnComplete.OptIn, Approve()],
        [Txn.on_completion() == OnComplete.CloseOut, Approve()],
    )

    return program


def clear_state_program():
    return Approve()


if __name__ == "__main__":
    import os, json

    out_dir = os.path.join(os.path.dirname(__file__), "build")
    os.makedirs(out_dir, exist_ok=True)

    approval_teal = compileTeal(approval_program(), mode=Mode.Application, version=8)
    clear_teal = compileTeal(clear_state_program(), mode=Mode.Application, version=8)

    with open(os.path.join(out_dir, "treasury_escrow_approval.teal"), "w") as f:
        f.write(approval_teal)

    with open(os.path.join(out_dir, "treasury_escrow_clear.teal"), "w") as f:
        f.write(clear_teal)

    print(f"Compiled to {out_dir}/")
    print(f"Approval: {len(approval_teal)} bytes")
    print(f"Clear: {len(clear_teal)} bytes")
