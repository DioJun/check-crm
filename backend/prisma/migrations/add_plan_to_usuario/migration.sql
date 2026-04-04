-- AddPlanToUsuario
ALTER TABLE "Usuario" ADD COLUMN "plan" TEXT NOT NULL DEFAULT 'free';
