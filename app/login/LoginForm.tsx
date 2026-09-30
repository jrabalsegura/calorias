"use client";

import { useActionState } from "react";
import { loginUser, type LoginFormState } from "./actions";

const INITIAL_STATE: LoginFormState = {
  status: "idle",
  message: "",
  username: ""
};

export function LoginForm({ nextPath }: { nextPath: string }) {
  const [state, formAction, isPending] = useActionState(
    loginUser,
    INITIAL_STATE
  );

  return (
    <form action={formAction} className="grid gap-4">
      <input name="next" type="hidden" value={nextPath} />

      <label className="field-label">
        Usuario
        <input
          autoCapitalize="none"
          autoComplete="username"
          autoCorrect="off"
          className="field-input"
          defaultValue={state.username}
          name="username"
          required
          type="text"
        />
      </label>

      <label className="field-label">
        Contraseña
        <input
          autoComplete="current-password"
          className="field-input"
          name="password"
          required
          type="password"
        />
      </label>

      {state.status === "error" ? (
        <p
          className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700"
          role="alert"
        >
          {state.message}
        </p>
      ) : null}

      <button className="primary-button w-full" disabled={isPending} type="submit">
        {isPending ? "Comprobando..." : "Entrar"}
      </button>
    </form>
  );
}
