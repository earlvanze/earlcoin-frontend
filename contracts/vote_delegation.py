"""
Vote Delegation Smart Contract — EARLCoin

On-chain vote delegation. Users opt into the app and set a delegate address
in their local state. Vote tallying reads local state directly from the chain
— no database needed, fully auditable.

Methods:
  - delegate(address): Set or update delegation to another address
  - revoke(): Clear delegation
  - (local state read): Anyone can read delegation state via indexer

Security benefits:
- Delegation state is tamper-proof (no DB admin can edit)
- On-chain audit trail with block timestamps
- Self-sovereign: only the account holder can change their delegation
"""

from pyteal import *

# Global state
ADMIN_KEY = Bytes("admin")
VNFT_ASA_KEY = Bytes("vnft_asa")

# Local state (per user)
DELEGATE_KEY = Bytes("delegate")       # 32-byte address of delegate
DELEGATED_AT_KEY = Bytes("delegated_at")  # round number when delegated


def approval_program():
    is_admin = Txn.sender() == App.globalGet(ADMIN_KEY)
    vnft_asa = App.globalGet(VNFT_ASA_KEY)

    vnft_balance = AssetHolding.balance(Txn.sender(), vnft_asa)

    def check_vnft():
        return Seq([
            vnft_balance,
            Assert(vnft_balance.hasValue()),
            Assert(vnft_balance.value() > Int(0)),
        ])

    # --- Creation ---
    on_create = Seq([
        App.globalPut(ADMIN_KEY, Txn.sender()),
        Approve(),
    ])

    # --- Setup: set VNFT ASA for KYC gating ---
    setup = Seq([
        Assert(is_admin),
        App.globalPut(VNFT_ASA_KEY, Btoi(Txn.application_args[1])),
        Approve(),
    ])

    # --- Delegate: user sets delegate address ---
    delegate = Seq([
        # Must hold VNFT (KYC)
        check_vnft(),
        # Delegate address is arg[1] (raw 32 bytes)
        Assert(Len(Txn.application_args[1]) == Int(32)),
        # Cannot delegate to self
        Assert(Txn.application_args[1] != Txn.sender()),
        # Store in local state
        App.localPut(Txn.sender(), DELEGATE_KEY, Txn.application_args[1]),
        App.localPut(Txn.sender(), DELEGATED_AT_KEY, Global.round()),
        Approve(),
    ])

    # --- Revoke: user clears delegation ---
    revoke = Seq([
        App.localDel(Txn.sender(), DELEGATE_KEY),
        App.localDel(Txn.sender(), DELEGATED_AT_KEY),
        Approve(),
    ])

    # --- Router ---
    method = Txn.application_args[0]
    on_call = Cond(
        [method == Bytes("setup"), setup],
        [method == Bytes("delegate"), delegate],
        [method == Bytes("revoke"), revoke],
    )

    program = Cond(
        [Txn.application_id() == Int(0), on_create],
        [Txn.on_completion() == OnComplete.NoOp, on_call],
        [Txn.on_completion() == OnComplete.OptIn, Approve()],
        [Txn.on_completion() == OnComplete.CloseOut, Approve()],
        [Txn.on_completion() == OnComplete.UpdateApplication, Seq([Assert(is_admin), Approve()])],
        [Txn.on_completion() == OnComplete.DeleteApplication, Seq([Assert(is_admin), Approve()])],
    )

    return program


def clear_state_program():
    return Approve()


if __name__ == "__main__":
    import os

    out_dir = os.path.join(os.path.dirname(__file__), "build")
    os.makedirs(out_dir, exist_ok=True)

    approval_teal = compileTeal(approval_program(), mode=Mode.Application, version=8)
    clear_teal = compileTeal(clear_state_program(), mode=Mode.Application, version=8)

    with open(os.path.join(out_dir, "vote_delegation_approval.teal"), "w") as f:
        f.write(approval_teal)

    with open(os.path.join(out_dir, "vote_delegation_clear.teal"), "w") as f:
        f.write(clear_teal)

    print(f"Compiled to {out_dir}/")
    print(f"Approval: {len(approval_teal)} bytes")
    print(f"Clear: {len(clear_teal)} bytes")
