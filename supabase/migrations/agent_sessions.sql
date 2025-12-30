-- Migration: agent_sessions and agent_conversations tables for persistent agent context
-- Enables multi-turn conversations with session state storage.

-- ============================================================================
-- Table: agent_sessions
-- Stores session metadata and agent outputs
-- ============================================================================
create table if not exists public.agent_sessions (
  id uuid primary key default gen_random_uuid(),
  session_id text not null unique,
  user_id text not null,
  conversation_goal text,
  agent_output text,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint agent_sessions_status_check check (status in ('active', 'completed', 'error'))
);

-- Index for fast session lookups
create index if not exists agent_sessions_session_id_idx
  on public.agent_sessions (session_id);

-- Index for user session queries
create index if not exists agent_sessions_user_id_idx
  on public.agent_sessions (user_id);

-- Index for filtering by status
create index if not exists agent_sessions_status_idx
  on public.agent_sessions (status);

comment on table public.agent_sessions is 'Agent session metadata and outputs for multi-turn conversations.';
comment on column public.agent_sessions.session_id is 'Unique session identifier (UUID v4).';
comment on column public.agent_sessions.user_id is 'User identifier for the session owner.';
comment on column public.agent_sessions.conversation_goal is 'Initial prompt or goal for the session.';
comment on column public.agent_sessions.agent_output is 'Summary output from agent execution.';
comment on column public.agent_sessions.status is 'Session status: active, completed, or error.';

-- ============================================================================
-- Table: agent_conversations
-- Stores individual message exchanges for conversation history
-- ============================================================================
create table if not exists public.agent_conversations (
  id uuid primary key default gen_random_uuid(),
  session_id text not null,
  role text not null,
  content text not null,
  metadata jsonb,
  created_at timestamptz not null default now(),
  constraint agent_conversations_role_check check (role in ('user', 'assistant')),
  constraint agent_conversations_session_fk foreign key (session_id)
    references public.agent_sessions (session_id) on delete cascade
);

-- Index for retrieving conversation history by session
create index if not exists agent_conversations_session_id_idx
  on public.agent_conversations (session_id);

-- Index for chronological ordering within sessions
create index if not exists agent_conversations_session_created_idx
  on public.agent_conversations (session_id, created_at);

comment on table public.agent_conversations is 'Individual message exchanges for agent conversation history.';
comment on column public.agent_conversations.session_id is 'References agent_sessions.session_id.';
comment on column public.agent_conversations.role is 'Message role: user or assistant.';
comment on column public.agent_conversations.content is 'Message content text.';
comment on column public.agent_conversations.metadata is 'Additional metadata (tool calls, events, etc.).';

-- ============================================================================
-- Function: update_updated_at_column
-- Auto-updates updated_at timestamp on row modifications
-- ============================================================================
create or replace function update_agent_sessions_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Trigger for auto-updating updated_at
drop trigger if exists agent_sessions_updated_at_trigger on public.agent_sessions;
create trigger agent_sessions_updated_at_trigger
  before update on public.agent_sessions
  for each row
  execute function update_agent_sessions_updated_at();


