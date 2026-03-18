-- Habilitar extensão para UUID se necessário
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- TABELA DE ANÁLISES
CREATE TABLE IF NOT EXISTS public.analises (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz DEFAULT now(),
  user_id uuid, -- Para futura autenticação
  mentoria text NOT NULL,
  mentorado text NOT NULL,
  nicho text,
  filename text,
  data_analise date,
  total_duvidas int DEFAULT 0,
  com_resposta int DEFAULT 0,
  sem_resposta int DEFAULT 0,
  categorias jsonb DEFAULT '{}'::jsonb,
  duvida_por_data jsonb DEFAULT '{}'::jsonb
);

-- TABELA DE PERGUNTAS E RESPOSTAS
CREATE TABLE IF NOT EXISTS public.perguntas_respostas (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  analise_id uuid REFERENCES public.analises(id) ON DELETE CASCADE,
  categoria text,
  data_pergunta text,
  hora_pergunta text,
  remetente text,
  pergunta text,
  resposta text,
  created_at timestamptz DEFAULT now()
);

-- Habilitar RLS (Row Level Security) - Opcional para dev
ALTER TABLE public.analises ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.perguntas_respostas ENABLE ROW LEVEL SECURITY;

-- Criar política de acesso público para teste (CUIDADO EM PRODUÇÃO)
CREATE POLICY "Permitir inserção e leitura pública" ON public.analises FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permitir inserção e leitura pública" ON public.perguntas_respostas FOR ALL USING (true) WITH CHECK (true);
