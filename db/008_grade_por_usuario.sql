-- =====================================================
-- 008_grade_por_usuario.sql
-- Move a grade e ordenação da grade de shared_data para user_data
-- para permitir que múltiplos operadores trabalhem com grades
-- de semanas diferentes sem sobrescrever o trabalho alheio.
-- =====================================================

ALTER TABLE public.user_data
  ADD COLUMN IF NOT EXISTS grade JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS grade_by_day JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS grade_order JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS grade_order_by_day JSONB DEFAULT '{}'::jsonb;

-- Opcional: migrar o snapshot atual de shared_data para quem já tem registro em user_data sem grade
UPDATE public.user_data u
SET
  grade = COALESCE(NULLIF(u.grade, '{}'::jsonb), s.grade, '{}'::jsonb),
  grade_by_day = COALESCE(NULLIF(u.grade_by_day, '{}'::jsonb), s.grade_by_day, '{}'::jsonb),
  grade_order = COALESCE(NULLIF(u.grade_order, '{}'::jsonb), s.grade_order, '{}'::jsonb),
  grade_order_by_day = COALESCE(NULLIF(u.grade_order_by_day, '{}'::jsonb), s.grade_order_by_day, '{}'::jsonb)
FROM public.shared_data s
WHERE s.id = 'canaledu-shared'
  AND (u.grade_by_day IS NULL OR u.grade_by_day = '{}'::jsonb);

COMMENT ON COLUMN public.user_data.grade_by_day IS 'Grade semanal do usuário indexada por dia da semana (0..6)';
COMMENT ON COLUMN public.user_data.grade_order_by_day IS 'Ordem dos programas na grade semanal do usuário por dia da semana';
