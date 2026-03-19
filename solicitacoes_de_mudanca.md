# Registro de Solicitações de Mudança - Whats-Fast

Este arquivo contém todas as mudanças solicitadas pelo usuário ao assistente.

## Solicitações

### [2026-03-18] Criação do Registro de Mudanças
- [x] Criar arquivo `.md` para salvar todas as solicitações de mudança.

### [2026-03-18] Migração para o Supabase
- [x] Configurar integração com Supabase para salvar histórico de análises.
- [x] Criar tabelas no banco de dados e refatorar o frontend.

### [2026-03-18] Scripts Supabase
- [x] Salvar scripts SQL (`schema.sql`) na pasta `supabase`.

### [2026-03-18] Migração para Edge Functions
- [x] Migrar endpoint de transcrição (Whisper) do `server.js` (Express) para Deno no Supabase.
- [x] Remover servidor Node.js e tornar a aplicação 100% serverless/frontend.

- [x] Unificar busca e seleção em um único componente premium (Searchable Dropdown), remover placeholder desnecessário e garantir legibilidade (preto).
- [x] Implementar indicadores avançados no histórico: separação por mês, tipo de dúvida e nicho (Insights Estratégicos).
- [x] Garantir suporte total e independente para "Mentoria Cleiton" e "Mentoria Julia" no histórico e no seletor de cache (migrado para Supabase).
- [x] Remover completamente o salvamento em cache local (`localStorage`) e o seletor unificado, utilizando agora exclusivamente o Supabase para o histórico.
