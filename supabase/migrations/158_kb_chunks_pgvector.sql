-- Knowledge-base chunks for RAG over Help/FAQ + future doc sources.
-- Feeds the AI Respond draft on /admin/inbox so replies can quote real
-- product copy instead of inventing answers.
--
-- Embedding model: OpenAI text-embedding-3-small (1536 dims). Chosen
-- for cost (~$0.02 per 1M tokens) + quality tradeoff at our volume.
-- Switching models later means a re-index, but the table shape stays
-- the same.
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS public.kb_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Source identifier so the indexer can wipe + re-add per-source
  -- (e.g. 'faq', later 'page:about', 'page:businesses-architects').
  source text NOT NULL,
  -- Stable key within a source so re-indexing upserts in place.
  -- For FAQ this is the i18n key (e.g. 'browsing_q1'); for page chunks
  -- this could be a slug:section identifier.
  source_key text NOT NULL,
  -- 'en' | 'nl'. Retrieval filters by language so a Dutch reply only
  -- pulls Dutch context and vice versa.
  language text NOT NULL,
  -- Heading / question text shown in the prompt so the model knows
  -- what each chunk is. Optional but recommended.
  title text,
  -- The actual chunk content the model sees.
  content text NOT NULL,
  embedding vector(1536) NOT NULL,
  -- Free-form metadata for things like ordering, parent-section, URLs.
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT kb_chunks_unique UNIQUE (source, source_key, language)
);

-- HNSW for cosine similarity — handles tens-of-thousands of chunks
-- with low-latency ANN search. Sufficient for our content scale by
-- a wide margin.
CREATE INDEX IF NOT EXISTS kb_chunks_embedding_hnsw
  ON public.kb_chunks USING hnsw (embedding vector_cosine_ops);

CREATE INDEX IF NOT EXISTS kb_chunks_source_lang
  ON public.kb_chunks (source, language);
