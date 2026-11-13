-- Additive revocation metadata only. No retention deletion, state normalization or communications.
alter table links add column revoked_at timestamptz;
alter table outing_invitations add column revoked_at timestamptz;
alter table registration_receipts add column revoked_at timestamptz;
