-- sent_at remains a compatibility marker for acceptance, never proof of delivery.
alter table registration_mail_outbox add column delivery_state text not null default 'pending'
 check(delivery_state in ('pending','reserved','sending','accepted','uncertain','cancelled'));
alter table registration_mail_outbox add column active_attempt uuid;
create table registration_mail_attempts (
 id uuid primary key, mail_id bigint not null references registration_mail_outbox(id) on delete cascade,
 number integer not null check(number>0),
 state text not null check(state in ('reserved','sending','rejected','accepted','uncertain','cancelled')),
 started_at timestamptz not null default clock_timestamp(), lease_until timestamptz not null,
 dispatched_at timestamptz, finished_at timestamptz, accepted_at timestamptz,
 client_request_id uuid not null unique, graph_request_id uuid,
 http_status integer check(http_status between 100 and 599),
 outcome_code text, acceptance_source text check(acceptance_source in ('graph','review')),
 unique(mail_id,number)
);
alter table registration_mail_outbox add foreign key(active_attempt) references registration_mail_attempts(id) deferrable initially deferred;
create table registration_mail_reviews (
 attempt_id uuid primary key references registration_mail_attempts(id) on delete cascade,
 decision text not null check(decision in ('accepted','retry','cancel')),
 actor text not null check(length(actor) between 1 and 100),
 reason text not null check(reason in ('acceptance_evidence','duplicate_risk_acknowledged','cancel_after_review')),
 evidence uuid, reviewed_at timestamptz not null default clock_timestamp(),
 check((decision='accepted' and reason='acceptance_evidence' and evidence is not null)
    or(decision='retry' and reason='duplicate_risk_acknowledged')
    or(decision='cancel' and reason='cancel_after_review'))
);
create index registration_mail_attempt_lease on registration_mail_attempts(lease_until) where state in ('reserved','sending');
create index registration_mail_dispatch on registration_mail_outbox(retry_at,id) where delivery_state='pending' and sent_at is null and cancelled_at is null;
update registration_mail_outbox set delivery_state=case when sent_at is not null then 'accepted'
 when cancelled_at is not null then 'cancelled' when attempts>0 then 'uncertain' else 'pending' end;
-- Legacy attempts have no reliable send evidence. Quarantine rather than silently resend.
insert into registration_mail_attempts(id,mail_id,number,state,lease_until,finished_at,client_request_id,outcome_code)
 select gen_random_uuid(),id,attempts,'uncertain',clock_timestamp(),clock_timestamp(),gen_random_uuid(),'legacy_untracked'
 from registration_mail_outbox where delivery_state='uncertain';
update registration_mail_outbox m set active_attempt=a.id from registration_mail_attempts a where a.mail_id=m.id;
