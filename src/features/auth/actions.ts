"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { getSafeRedirectPath } from "@/lib/auth/redirects";
import { getSupabaseEnvironment } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const emailSchema = z.email().max(320).transform((value) => value.toLowerCase());
const passwordSchema = z.string().min(12).max(128);

const credentialsSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});

function field(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

function destination(path: string, key: "error" | "message", value: string) {
  const parameters = new URLSearchParams({ [key]: value });
  return `${path}?${parameters.toString()}`;
}

export async function signInAction(formData: FormData) {
  const parsed = credentialsSchema.safeParse({
    email: field(formData, "email"),
    password: field(formData, "password"),
  });
  const next = getSafeRedirectPath(field(formData, "next"));

  if (!parsed.success) {
    redirect(destination("/login", "error", "Controlla email e password."));
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    redirect(destination("/login", "error", "Credenziali non valide."));
  }

  revalidatePath("/", "layout");
  redirect(next);
}

export async function signUpAction(formData: FormData) {
  const parsed = credentialsSchema.safeParse({
    email: field(formData, "email"),
    password: field(formData, "password"),
  });
  const next = getSafeRedirectPath(field(formData, "next"), "/onboarding");

  if (!parsed.success) {
    redirect(destination("/signup", "error", "Usa un’email valida e una password di almeno 12 caratteri."));
  }

  const environment = getSupabaseEnvironment();
  const callback = new URL("/auth/callback", environment.NEXT_PUBLIC_APP_URL);
  callback.searchParams.set("next", next);

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signUp({
    ...parsed.data,
    options: { emailRedirectTo: callback.toString() },
  });

  if (error) {
    redirect(destination("/signup", "error", "Non è stato possibile creare l’account."));
  }

  if (data.session) {
    revalidatePath("/", "layout");
    redirect(next);
  }

  redirect(destination("/login", "message", "Controlla la tua email per confermare l’account."));
}

export async function requestPasswordResetAction(formData: FormData) {
  const parsed = emailSchema.safeParse(field(formData, "email"));

  if (!parsed.success) {
    redirect(destination("/forgot-password", "error", "Inserisci un indirizzo email valido."));
  }

  const environment = getSupabaseEnvironment();
  const callback = new URL("/auth/callback", environment.NEXT_PUBLIC_APP_URL);
  callback.searchParams.set("next", "/reset-password");

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data, {
    redirectTo: callback.toString(),
  });

  if (error) {
    redirect(destination("/forgot-password", "error", "Riprova tra qualche minuto."));
  }

  redirect(destination("/login", "message", "Se l’account esiste, riceverai un link per reimpostare la password."));
}

export async function resetPasswordAction(formData: FormData) {
  const password = field(formData, "password");
  const confirmation = field(formData, "passwordConfirmation");
  const parsed = passwordSchema.safeParse(password);

  if (!parsed.success || password !== confirmation) {
    redirect(destination("/reset-password", "error", "Le password devono coincidere e contenere almeno 12 caratteri."));
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(destination("/login", "error", "Il link di recupero non è più valido."));
  }

  const { error } = await supabase.auth.updateUser({ password: parsed.data });

  if (error) {
    redirect(destination("/reset-password", "error", "Non è stato possibile aggiornare la password."));
  }

  redirect(destination("/login", "message", "Password aggiornata. Ora puoi accedere."));
}

export async function signOutAction() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}
