-- Schema Yanti MVP local (R00-R02). Fiel a doc/03 y doc/06.
-- SQLite: FKs + transacciones atómicas síncronas. Importes en unidades menores enteras.
PRAGMA foreign_keys = ON;

-- ---------------------------------------------------------------------------
-- Identidad y sesiones
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS account (
  account_id        TEXT PRIMARY KEY,
  display_name      TEXT NOT NULL,
  email_canonical   TEXT NOT NULL UNIQUE,
  locale            TEXT NOT NULL DEFAULT 'es',
  country           TEXT,
  timezone          TEXT NOT NULL DEFAULT 'UTC',
  status            TEXT NOT NULL DEFAULT 'ACTIVE', -- ACTIVE | LIMITED | SUSPENDED | BLOCKED
  is_admin          INTEGER NOT NULL DEFAULT 0,     -- rol local de prueba (R02), nunca productivo
  created_at        TEXT NOT NULL,                  -- UTC ISO
  updated_at        TEXT NOT NULL,
  version           INTEGER NOT NULL DEFAULT 1      -- optimistic concurrency
);

CREATE TABLE IF NOT EXISTS email (
  email_id          TEXT PRIMARY KEY,
  account_id        TEXT,                            -- NULL si aún no existe cuenta (invitación)
  to_email          TEXT NOT NULL,
  subject           TEXT NOT NULL,
  body_html         TEXT NOT NULL,
  body_text         TEXT NOT NULL,
  purpose           TEXT NOT NULL,                   -- magic_link | operation_notice | dispute | ...
  operation_id      TEXT,
  status            TEXT NOT NULL DEFAULT 'SENT',    -- SENT | DELIVERED | BOUNCED | FAILED
  created_at        TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_email_to ON email(to_email, created_at DESC);

CREATE TABLE IF NOT EXISTS magic_link_token (
  token_hash        TEXT PRIMARY KEY,                -- SHA-256 del token; nunca el token
  account_id        TEXT,
  email             TEXT NOT NULL,
  purpose           TEXT NOT NULL,                   -- login | consent | operation_invite
  return_path       TEXT,                            -- ruta relativa validada
  operation_id      TEXT,
  expires_at        TEXT NOT NULL,
  consumed_at       TEXT,
  created_at        TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ml_email ON magic_link_token(email, created_at DESC);

CREATE TABLE IF NOT EXISTS session (
  session_id        TEXT PRIMARY KEY,
  account_id        TEXT NOT NULL REFERENCES account(account_id),
  token_hash        TEXT NOT NULL UNIQUE,            -- hash del bearer cookie
  expires_at        TEXT NOT NULL,
  created_at        TEXT NOT NULL,
  last_seen_at      TEXT NOT NULL,
  revoked_at        TEXT
);
CREATE INDEX IF NOT EXISTS idx_session_account ON session(account_id);

CREATE TABLE IF NOT EXISTS consent_record (
  consent_id        TEXT PRIMARY KEY,
  account_id        TEXT NOT NULL REFERENCES account(account_id),
  consent_type      TEXT NOT NULL,                   -- terms | privacy
  version           TEXT NOT NULL,
  locale            TEXT NOT NULL,
  accepted_at       TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_consent_unique ON consent_record(account_id, consent_type, version);

-- ---------------------------------------------------------------------------
-- Catálogo y políticas (configurables, no constantes)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS country_catalog (
  country_code      TEXT PRIMARY KEY,
  name_es           TEXT NOT NULL,
  name_pt           TEXT,
  currency_codes    TEXT NOT NULL,                   -- JSON array
  enabled           INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS category_catalog (
  category_code     TEXT PRIMARY KEY,
  label_es          TEXT NOT NULL,
  label_pt          TEXT,
  enabled           INTEGER NOT NULL DEFAULT 1
);

-- Política de comisiones por país/moneda/categoría (ámbito). FeePolicy del doc 07.
CREATE TABLE IF NOT EXISTS fee_policy_version (
  policy_id         TEXT PRIMARY KEY,
  country_code      TEXT NOT NULL,
  currency          TEXT NOT NULL,
  category_code     TEXT NOT NULL,
  status            TEXT NOT NULL DEFAULT 'DRAFT',   -- DRAFT | ACTIVE | RETIRED (SM-POL simplificado)
  version           INTEGER NOT NULL,
  buyer_rate_num    INTEGER NOT NULL,                -- tasa racional comprador
  buyer_rate_den    INTEGER NOT NULL,
  buyer_fixed_minor INTEGER NOT NULL DEFAULT 0,
  buyer_min_minor   INTEGER,
  buyer_max_minor   INTEGER,
  seller_rate_num   INTEGER NOT NULL,
  seller_rate_den   INTEGER NOT NULL,
  seller_fixed_minor INTEGER NOT NULL DEFAULT 0,
  seller_min_minor  INTEGER,
  seller_max_minor  INTEGER,
  effective_from    TEXT NOT NULL,
  effective_to      TEXT,
  created_by        TEXT,
  created_at        TEXT NOT NULL,
  reason            TEXT,
  UNIQUE (country_code, currency, category_code, version)
);
CREATE INDEX IF NOT EXISTS idx_fee_scope ON fee_policy_version(country_code, currency, category_code, status);

-- Snapshot congelado por operación (INV-OPS-005): copia inmutable de la política aplicable.
CREATE TABLE IF NOT EXISTS frozen_policy_snapshot (
  snapshot_id       TEXT PRIMARY KEY,
  operation_id      TEXT NOT NULL,
  country_code      TEXT NOT NULL,
  currency          TEXT NOT NULL,
  category_code     TEXT NOT NULL,
  policy_id         TEXT NOT NULL,
  policy_version    INTEGER NOT NULL,
  payload_json      TEXT NOT NULL,                   -- FeePolicy completa en el momento de congelar
  frozen_at         TEXT NOT NULL
);

-- ---------------------------------------------------------------------------
-- Operaciones y acuerdo
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS operation (
  operation_id      TEXT PRIMARY KEY,                -- opaco op_xxx
  support_code      TEXT NOT NULL,                   -- legible para soporte, p.ej. YT-4F7K2
  title             TEXT NOT NULL,
  description       TEXT NOT NULL,                   -- condición/material
  country_code      TEXT NOT NULL,
  currency          TEXT NOT NULL,
  base_amount_minor INTEGER NOT NULL,                -- unidades menores; nunca float
  category_code     TEXT NOT NULL,
  external_link     TEXT,
  state             TEXT NOT NULL,                   -- SM-OPS
  state_reason      TEXT,
  seller_id         TEXT NOT NULL,                   -- proyección; fuente en operation_party
  buyer_id          TEXT,                            -- proyección; se fija al aceptar/invitar
  buyer_email       TEXT,                            -- correo invitado
  expected_delivery_days INTEGER NOT NULL DEFAULT 10, -- de política (prueba local)
  version           INTEGER NOT NULL DEFAULT 1,
  created_at        TEXT NOT NULL,
  updated_at        TEXT NOT NULL,
  expires_at        TEXT,                            -- vencimiento de solicitud no pagada
  paid_at           TEXT,
  shipped_at        TEXT,
  completed_at      TEXT
);
CREATE INDEX IF NOT EXISTS idx_operation_seller ON operation(seller_id, state);
CREATE INDEX IF NOT EXISTS idx_operation_buyer ON operation(buyer_id, state);
CREATE INDEX IF NOT EXISTS idx_operation_state ON operation(state);

CREATE TABLE IF NOT EXISTS operation_party (
  operation_id      TEXT NOT NULL REFERENCES operation(operation_id),
  role              TEXT NOT NULL,                   -- BUYER | SELLER
  account_id        TEXT NOT NULL,
  linked_at         TEXT NOT NULL,
  PRIMARY KEY (operation_id, role),
  UNIQUE (operation_id, account_id)
);
CREATE INDEX IF NOT EXISTS idx_oparty_account ON operation_party(account_id);

CREATE TABLE IF NOT EXISTS agreement_version (
  agreement_id      TEXT PRIMARY KEY,
  operation_id      TEXT NOT NULL REFERENCES operation(operation_id),
  version           INTEGER NOT NULL,
  title             TEXT NOT NULL,
  description       TEXT NOT NULL,
  country_code      TEXT NOT NULL,
  currency          TEXT NOT NULL,
  base_amount_minor INTEGER NOT NULL,
  category_code     TEXT NOT NULL,
  external_link     TEXT,
  seller_fee_minor  INTEGER NOT NULL,
  buyer_fee_minor   INTEGER NOT NULL,
  buyer_total_minor INTEGER NOT NULL,
  seller_net_minor  INTEGER NOT NULL,
  seller_id         TEXT NOT NULL,
  buyer_id          TEXT,
  sealed_at         TEXT,                            -- al aceptar el comprador: inmutable
  created_by        TEXT NOT NULL,
  created_at        TEXT NOT NULL,
  UNIQUE (operation_id, version)
);
CREATE INDEX IF NOT EXISTS idx_agreement_op ON agreement_version(operation_id, version DESC);

-- ---------------------------------------------------------------------------
-- Pagos: intentos + observaciones de proveedor + webhook_inbox
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS payment_attempt (
  attempt_id        TEXT PRIMARY KEY,
  operation_id      TEXT NOT NULL REFERENCES operation(operation_id),
  provider          TEXT NOT NULL DEFAULT 'fake',
  provider_ref      TEXT,                            -- referencia externa
  state             TEXT NOT NULL,                   -- SM-PAG
  requested_total_minor INTEGER NOT NULL,            -- = buyer_total del desglose
  currency          TEXT NOT NULL,
  observed_total_minor INTEGER,                      -- monto que reporta el proveedor
  observed_currency TEXT,
  external_account  TEXT,
  idempotency_key   TEXT NOT NULL,
  created_by        TEXT NOT NULL,
  created_at        TEXT NOT NULL,
  updated_at        TEXT NOT NULL,
  accredited_at     TEXT
);
CREATE INDEX IF NOT EXISTS idx_pa_op ON payment_attempt(operation_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_pa_idem ON payment_attempt(idempotency_key);
CREATE INDEX IF NOT EXISTS idx_pa_state ON payment_attempt(state);

CREATE TABLE IF NOT EXISTS webhook_inbox (
  inbox_id          TEXT PRIMARY KEY,
  provider          TEXT NOT NULL,
  event_id          TEXT NOT NULL,                   -- idempotencia (provider, event)
  event_type        TEXT NOT NULL,
  payload_json      TEXT NOT NULL,
  received_at       TEXT NOT NULL,
  processed_at      TEXT,
  status            TEXT NOT NULL DEFAULT 'RECEIVED' -- RECEIVED | PROCESSED | FAILED
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_webhook_dedup ON webhook_inbox(provider, event_id);

-- ---------------------------------------------------------------------------
-- Ledger de doble entrada (append-only)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ledger_entry (
  entry_id          TEXT PRIMARY KEY,
  operation_id      TEXT NOT NULL REFERENCES operation(operation_id),
  entry_type        TEXT NOT NULL,                   -- CHARGE | RELEASE | REFUND | FEE | ADJUSTMENT
  currency          TEXT NOT NULL,
  state             TEXT NOT NULL DEFAULT 'POSTED',  -- POSTED (append-only)
  cause             TEXT NOT NULL,                   -- confirm | expiry | resolution | ...
  cause_ref         TEXT,
  policy_version    TEXT,
  author            TEXT NOT NULL,                   -- actor o 'system'
  posted_at         TEXT NOT NULL,
  hash_prev         TEXT,                            -- encadenado para integridad
  hash_entry        TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS ledger_posting (
  posting_id        TEXT PRIMARY KEY,
  entry_id          TEXT NOT NULL REFERENCES ledger_entry(entry_id),
  logical_account   TEXT NOT NULL,                   -- PROTECTED_PRINCIPAL, SELLER_PAYABLE, ...
  side              TEXT NOT NULL,                   -- DEBIT | CREDIT
  amount_minor      INTEGER NOT NULL,                -- positivo
  currency          TEXT NOT NULL,
  component         TEXT,                            -- PRINCIPAL | BUYER_FEE | SELLER_FEE | ...
  CHECK (side IN ('DEBIT','CREDIT'))
);
CREATE INDEX IF NOT EXISTS idx_posting_entry ON ledger_posting(entry_id);
CREATE INDEX IF NOT EXISTS idx_posting_acct ON ledger_posting(logical_account);

-- ---------------------------------------------------------------------------
-- Retenciones (conjunto de holds por operación)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS hold (
  hold_id           TEXT PRIMARY KEY,
  operation_id      TEXT NOT NULL REFERENCES operation(operation_id),
  hold_type         TEXT NOT NULL,                   -- HOLD_TYPES
  blocked_actions   TEXT NOT NULL,                   -- JSON array [LIBERAR,...]
  origin            TEXT NOT NULL,                   -- dispute | risk | chargeback | admin | ...
  origin_ref        TEXT,
  status            TEXT NOT NULL DEFAULT 'ACTIVE',  -- ACTIVE | RELEASED
  created_at        TEXT NOT NULL,
  released_at       TEXT,
  released_by       TEXT,
  released_reason   TEXT
);
CREATE INDEX IF NOT EXISTS idx_hold_op ON hold(operation_id, status);

-- ---------------------------------------------------------------------------
-- Órdenes financieras
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS financial_order (
  order_id          TEXT PRIMARY KEY,
  operation_id      TEXT NOT NULL REFERENCES operation(operation_id),
  order_type        TEXT NOT NULL,                   -- RELEASE | REFUND | AUTHORIZED_ADJUSTMENT
  amount_minor      INTEGER NOT NULL,
  currency          TEXT NOT NULL,
  state             TEXT NOT NULL,                   -- SM-FIN
  cause             TEXT NOT NULL,
  cause_ref         TEXT,
  idempotency_key   TEXT NOT NULL UNIQUE,
  provider_ref      TEXT,
  attempts          INTEGER NOT NULL DEFAULT 0,
  error_code        TEXT,
  created_at        TEXT NOT NULL,
  updated_at        TEXT NOT NULL,
  confirmed_at      TEXT
);
CREATE INDEX IF NOT EXISTS idx_fo_op ON financial_order(operation_id);

-- ---------------------------------------------------------------------------
-- Envío y evidencia
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS shipment (
  shipment_id       TEXT PRIMARY KEY,
  operation_id      TEXT NOT NULL UNIQUE REFERENCES operation(operation_id),
  state             TEXT NOT NULL DEFAULT 'NOT_STARTED', -- SM-ENV
  carrier           TEXT,
  tracking_code     TEXT,
  tracking_url      TEXT,
  dispatch_date     TEXT,
  estimated_delivery_date TEXT,
  declared_at       TEXT,
  declared_by       TEXT
);

CREATE TABLE IF NOT EXISTS tracking_version (
  tracking_id       TEXT PRIMARY KEY,
  shipment_id       TEXT NOT NULL REFERENCES shipment(shipment_id),
  version           INTEGER NOT NULL,
  carrier           TEXT,
  tracking_code     TEXT,
  tracking_url      TEXT,
  changed_at        TEXT NOT NULL,
  changed_by        TEXT NOT NULL,
  UNIQUE (shipment_id, version)
);

CREATE TABLE IF NOT EXISTS evidence_item (
  evidence_id       TEXT PRIMARY KEY,
  operation_id      TEXT NOT NULL REFERENCES operation(operation_id),
  purpose           TEXT NOT NULL,                   -- REFERENCE | PACKAGING | DISPATCH | DISPUTE | RETURN
  author_id         TEXT NOT NULL,
  visibility        TEXT NOT NULL DEFAULT 'PARTIES', -- PARTIES | OPS_ONLY | ADMIN_ONLY | RESTRICTED
  original_name     TEXT,
  mime_type         TEXT,
  size_bytes        INTEGER,
  sha256            TEXT,
  storage_key       TEXT,                            -- opaca; no sirve de autorización
  status            TEXT NOT NULL DEFAULT 'ACCEPTED',-- pending|scanning|accepted|rejected|restricted
  created_at        TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ev_op ON evidence_item(operation_id);

-- ---------------------------------------------------------------------------
-- Disputas, resoluciones, devoluciones
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS dispute (
  dispute_id        TEXT PRIMARY KEY,
  operation_id      TEXT NOT NULL UNIQUE REFERENCES operation(operation_id),
  opened_by         TEXT NOT NULL,
  reason            TEXT NOT NULL,                   -- DISPUTE_REASONS
  description       TEXT NOT NULL,
  state             TEXT NOT NULL,                   -- SM-DIS
  opened_at         TEXT NOT NULL,
  reviewer_id       TEXT,
  resolution_id     TEXT,
  resolved_at       TEXT
);
CREATE INDEX IF NOT EXISTS idx_dispute_state ON dispute(state);

CREATE TABLE IF NOT EXISTS dispute_submission (
  submission_id     TEXT PRIMARY KEY,
  dispute_id        TEXT NOT NULL REFERENCES dispute(dispute_id),
  author_id         TEXT NOT NULL,
  body              TEXT NOT NULL,
  visibility        TEXT NOT NULL DEFAULT 'PARTIES',
  created_at        TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_dsub_dispute ON dispute_submission(dispute_id);

CREATE TABLE IF NOT EXISTS resolution (
  resolution_id     TEXT PRIMARY KEY,
  dispute_id        TEXT NOT NULL REFERENCES dispute(dispute_id),
  outcome           TEXT NOT NULL,                   -- RESOLUTION_OUTCOMES
  rationale         TEXT NOT NULL,
  principal_to      TEXT NOT NULL,                   -- SELLER | BUYER
  buyer_fee_to      TEXT NOT NULL,
  seller_fee_to     TEXT NOT NULL,
  refund_required   INTEGER NOT NULL DEFAULT 0,      -- si outcome=REQUIRE_RETURN
  return_deadline_days INTEGER,
  version           INTEGER NOT NULL DEFAULT 1,
  state             TEXT NOT NULL DEFAULT 'PROPOSED',-- PROPOSED | PENDING_SECOND_APPROVAL | CONFIRMED
  author_id         TEXT NOT NULL,
  approver_id       TEXT,
  confirmed_at      TEXT,
  created_at        TEXT NOT NULL,
  UNIQUE (dispute_id, version)
);

CREATE TABLE IF NOT EXISTS return_case (
  return_id         TEXT PRIMARY KEY,
  resolution_id     TEXT NOT NULL REFERENCES resolution(resolution_id),
  operation_id      TEXT NOT NULL REFERENCES operation(operation_id),
  state             TEXT NOT NULL DEFAULT 'INSTRUCTIONS_ISSUED', -- SM-DEV
  refund_hit_milestone TEXT NOT NULL,                -- SHIPPED | DELIVERED | MANUAL_VALIDATION
  deadline          TEXT,
  carrier           TEXT,
  tracking_code     TEXT,
  dispatched_at     TEXT,
  received_at       TEXT,
  created_at        TEXT NOT NULL
);

-- ---------------------------------------------------------------------------
-- Parámetros operativos administrables (config simple persistida de plazos)
-- Valores de negocio versionados en el tiempo por escritura; el dominio LEE con
-- fallback al default local. No retroactivo: solo afecta lecturas posteriores.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS admin_setting (
  setting_key   TEXT PRIMARY KEY,          -- ej: 'delivery_days', 'request_expiry_days', ...
  value_json    TEXT NOT NULL,             -- valor actual (número/objeto) en JSON
  description   TEXT,
  updated_by    TEXT,                      -- account_id del admin que lo cambió
  reason        TEXT,                      -- motivo obligatorio del cambio
  updated_at    TEXT NOT NULL
);

-- ---------------------------------------------------------------------------
-- Calificaciones
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS rating (
  rating_id         TEXT PRIMARY KEY,
  operation_id      TEXT NOT NULL REFERENCES operation(operation_id),
  author_id         TEXT NOT NULL,
  target_id         TEXT NOT NULL,
  role              TEXT NOT NULL,                   -- rol del autor en esa operación
  stars             INTEGER NOT NULL CHECK (stars BETWEEN 1 AND 5),
  comment           TEXT NOT NULL,
  state             TEXT NOT NULL DEFAULT 'SUBMITTED_HIDDEN', -- SM-REP (ventana ciega)
  created_at        TEXT NOT NULL,
  published_at      TEXT,
  UNIQUE (operation_id, author_id, role)
);
CREATE INDEX IF NOT EXISTS idx_rating_target ON rating(target_id);

-- ---------------------------------------------------------------------------
-- Infraestructura transaccional: idempotencia, outbox, auditoría, timeline
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS idempotency_record (
  scope_key         TEXT PRIMARY KEY,                -- actor:endpoint:padre:idemKey
  request_hash      TEXT NOT NULL,
  status_code       INTEGER NOT NULL,
  response_json     TEXT,
  expires_at        TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS outbox (
  outbox_id         TEXT PRIMARY KEY,
  aggregate_type    TEXT NOT NULL,                   -- operation | account | ...
  aggregate_id      TEXT NOT NULL,
  event_type        TEXT NOT NULL,                   -- pago_acreditado | solicitud_enviada | ...
  payload_json      TEXT NOT NULL,
  correlation_id    TEXT,
  status            TEXT NOT NULL DEFAULT 'PENDING', -- PENDING | DISPATCHED | FAILED
  created_at        TEXT NOT NULL,
  dispatched_at     TEXT
);
CREATE INDEX IF NOT EXISTS idx_outbox_status ON outbox(status, created_at);

CREATE TABLE IF NOT EXISTS audit_record (
  audit_id          TEXT PRIMARY KEY,
  actor_id          TEXT,                            -- account_id o 'system' o 'anonymous'
  role_effective    TEXT,
  action            TEXT NOT NULL,                   -- p.ej. operation.send
  resource_type     TEXT NOT NULL,
  resource_id       TEXT NOT NULL,
  result            TEXT NOT NULL,                   -- SUCCESS | FAILURE
  reason            TEXT,
  before_json       TEXT,
  after_json        TEXT,
  correlation_id    TEXT,
  created_at        TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_audit_resource ON audit_record(resource_type, resource_id);

CREATE TABLE IF NOT EXISTS operation_event (
  event_id          TEXT PRIMARY KEY,
  operation_id      TEXT NOT NULL REFERENCES operation(operation_id),
  actor_id          TEXT,
  event_type        TEXT NOT NULL,                   -- operation.created, payment.accredited, ...
  label            TEXT,                             -- texto legible en timeline
  state_from        TEXT,
  state_to          TEXT,
  metadata_json     TEXT,
  created_at        TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_opevent_op ON operation_event(operation_id, created_at);

-- ---------------------------------------------------------------------------
-- Notificaciones in-app
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notification (
  notification_id   TEXT PRIMARY KEY,
  account_id        TEXT NOT NULL REFERENCES account(account_id),
  operation_id      TEXT,
  event_type        TEXT NOT NULL,
  body              TEXT NOT NULL,
  action_required   INTEGER NOT NULL DEFAULT 0,
  deadline          TEXT,
  read_at           TEXT,
  created_at        TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_notif_account ON notification(account_id, read_at, created_at DESC);
