import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useConvexAuth } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTitle } from "../hooks/useTitle";

const schema = z.object({
  email: z.email("Informe um e-mail válido."),
  password: z.string().min(8, "A senha deve ter pelo menos 8 caracteres."),
});
type FormValues = z.infer<typeof schema>;

export default function SignIn() {
  const [mode, setMode] = useState<"signIn" | "signUp">("signIn");
  useTitle(mode === "signIn" ? "Entrar" : "Criar conta");
  const { isAuthenticated } = useConvexAuth();
  const { signIn } = useAuthActions();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  if (isAuthenticated) return <Navigate to="/conta" replace />;

  async function onSubmit(values: FormValues) {
    setError(null);
    try {
      await signIn("password", { email: values.email, password: values.password, flow: mode });
      navigate("/conta");
    } catch {
      setError(
        mode === "signIn"
          ? "E-mail ou senha incorretos."
          : "Não foi possível criar a conta. Verifique os dados ou tente entrar.",
      );
    }
  }

  return (
    <section className="mx-auto max-w-sm space-y-6">
      <h1 className="text-3xl font-bold">{mode === "signIn" ? "Entrar" : "Criar conta"}</h1>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <div className="space-y-1">
          <label htmlFor="email" className="text-sm font-medium">E-mail</label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            aria-invalid={errors.email ? true : undefined}
            aria-describedby={errors.email ? "email-erro" : undefined}
            {...register("email")}
            className="w-full rounded-lg border border-slate-300 px-3 py-2"
          />
          {errors.email && <p id="email-erro" className="text-sm text-red-700">{errors.email.message}</p>}
        </div>

        <div className="space-y-1">
          <label htmlFor="senha" className="text-sm font-medium">Senha</label>
          <input
            id="senha"
            type="password"
            autoComplete={mode === "signIn" ? "current-password" : "new-password"}
            aria-invalid={errors.password ? true : undefined}
            aria-describedby={errors.password ? "senha-erro" : undefined}
            {...register("password")}
            className="w-full rounded-lg border border-slate-300 px-3 py-2"
          />
          {errors.password && <p id="senha-erro" className="text-sm text-red-700">{errors.password.message}</p>}
        </div>

        {error && <p className="text-sm text-red-700" role="alert">{error}</p>}

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-lg bg-indigo-600 px-4 py-3 font-medium text-white hover:bg-indigo-700 disabled:bg-slate-300"
        >
          {isSubmitting ? "Aguarde…" : mode === "signIn" ? "Entrar" : "Criar conta"}
        </button>
      </form>

      <p className="text-sm text-slate-600">
        {mode === "signIn" ? "Ainda não tem conta?" : "Já tem conta?"}{" "}
        <button
          type="button"
          className="text-indigo-700 underline"
          onClick={() => {
            setMode(mode === "signIn" ? "signUp" : "signIn");
            setError(null);
          }}
        >
          {mode === "signIn" ? "Criar conta" : "Entrar"}
        </button>
      </p>
    </section>
  );
}
