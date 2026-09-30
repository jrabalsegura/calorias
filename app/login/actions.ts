"use server";

import { redirect } from "next/navigation";
import { getSafeRedirectPath } from "@/domain/redirect";
import { clearUserSession, createUserSession } from "@/lib/auth";
import { verifyPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";

export type LoginFormState = {
  message: string;
  status: "idle" | "error";
  username: string;
};

export async function loginUser(
  _previousState: LoginFormState,
  formData: FormData
): Promise<LoginFormState> {
  const rawUsername = formData.get("username");
  const password = formData.get("password");
  const nextPath = getSafeRedirectPath(formData.get("next"));

  if (typeof rawUsername !== "string" || typeof password !== "string") {
    return {
      status: "error",
      message: "Introduce usuario y contraseña.",
      username: ""
    };
  }

  const user = await prisma.appUser.findUnique({
    where: { username: rawUsername.trim().toLowerCase() },
    select: { id: true, passwordHash: true }
  });

  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return {
      status: "error",
      message: "Usuario o contraseña incorrectos.",
      username: rawUsername
    };
  }

  await createUserSession(user.id);
  redirect(nextPath);
}

export async function logoutUser(): Promise<void> {
  await clearUserSession();
  redirect("/login");
}
