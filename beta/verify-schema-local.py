"""Validate beta invitation quota SQL in an isolated in-memory SQLite database.

This script never accesses Cloudflare, remote D1 or production.
"""
from pathlib import Path
import sqlite3
import time

ROOT = Path(__file__).resolve().parent.parent
SCHEMA = ROOT / "beta" / "schema.sql"
GATE = ROOT / "beta-access.js"
TRIGGER = "beta_claim_invite_for_session"
INSERT = (
    "INSERT INTO beta_access_sessions(session_hash,invite_id,expires_at) "
    "SELECT ?,id,? FROM beta_invites WHERE code_hash=? AND disabled=0 "
    "AND uses<max_uses AND (expires_at IS NULL OR expires_at>unixepoch())"
)


def check(condition, message):
    if not condition:
        raise AssertionError(message)


def claim(db, session_hash, code_hash):
    return db.execute(INSERT, (session_hash, int(time.time()) + 3600, code_hash)).rowcount


def quota(db, code_hash):
    return db.execute("SELECT uses FROM beta_invites WHERE code_hash=?", (code_hash,)).fetchone()[0]


def main():
    gate = GATE.read_text(encoding="utf-8")
    check("BETA_SCHEMA_INCOMPLETE" in gate, "runtime must fail closed when trigger is missing")
    check("INSERT INTO beta_access_sessions(session_hash,invite_id,expires_at)" in gate,
          "runtime and SQLite test must use the same session insert")
    check("name='beta_claim_invite_for_session'" in gate, "runtime must verify trigger name")

    db = sqlite3.connect(":memory:")
    db.execute("PRAGMA foreign_keys=ON")
    db.executescript(SCHEMA.read_text(encoding="utf-8"))

    installed = db.execute(
        "SELECT 1 FROM sqlite_master WHERE type='trigger' AND name=?", (TRIGGER,)
    ).fetchone()
    check(installed is not None, "claim trigger missing from beta schema")

    first, second, blocked, expired = ("a" * 64, "b" * 64, "c" * 64, "d" * 64)
    db.execute("INSERT INTO beta_invites(code_hash,max_uses) VALUES(?,1)", (first,))
    db.execute("INSERT INTO beta_invites(code_hash,max_uses) VALUES(?,1)", (second,))
    db.execute("INSERT INTO beta_invites(code_hash,max_uses,disabled) VALUES(?,1,1)", (blocked,))
    db.execute("INSERT INTO beta_invites(code_hash,max_uses,expires_at) VALUES(?,1,1)", (expired,))

    token = "e" * 64
    check(claim(db, token, first) == 1, "first claim should create one session")
    check(quota(db, first) == 1, "successful session must consume exactly one use")
    check(claim(db, "f" * 64, first) == 0, "single-use invitation was reused")
    check(quota(db, first) == 1, "failed replay changed quota")
    check(claim(db, "1" * 64, blocked) == 0, "disabled invitation was accepted")
    check(claim(db, "2" * 64, expired) == 0, "expired invitation was accepted")

    # A PRIMARY KEY failure must roll back the trigger's quota update.
    try:
        claim(db, token, second)
    except sqlite3.IntegrityError:
        pass
    else:
        raise AssertionError("duplicate session hash was unexpectedly accepted")
    check(quota(db, second) == 0, "failed INSERT consumed invite quota")
    check(claim(db, "3" * 64, second) == 1, "valid second invitation was not recoverable")
    check(quota(db, second) == 1, "retry did not consume exactly one invitation use")

    check(db.execute("PRAGMA integrity_check").fetchone() == ("ok",),
          "local SQLite integrity check failed")
    check(db.execute("PRAGMA foreign_key_check").fetchall() == [],
          "local SQLite foreign-key check failed")
    db.close()
    print("Beta SQLite invitation trigger verified locally; no remote operation performed.")


if __name__ == "__main__":
    main()
