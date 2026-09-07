"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import styles from "@/app/admin/admin.module.css";

export default function AdminLogin() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);
    const form = new FormData(event.currentTarget);

    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: form.get("username"),
          password: form.get("password"),
        }),
      });
      if (!response.ok) {
        setError("Usuario o contraseña incorrectos.");
        return;
      }
      router.refresh();
    } catch {
      setError("No fue posible iniciar sesión. Inténtelo nuevamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className={styles.loginPage}>
      <section className={styles.loginPanel}>
        <Image
          src="/hospital-angeles-header.png"
          alt="Hospital Angeles Health System"
          width={310}
          height={64}
          priority
          className={styles.loginLogo}
        />
        <div>
          <p className={styles.eyebrow}>Administración</p>
          <h1>Panel de encuestas</h1>
          <p className={styles.loginIntro}>
            Ingrese sus credenciales para consultar las encuestas contestadas.
          </p>
        </div>
        <form onSubmit={handleSubmit} className={styles.loginForm}>
          <label htmlFor="username">Usuario</label>
          <input
            id="username"
            name="username"
            type="text"
            autoComplete="username"
            required
            autoFocus
          />
          <label htmlFor="password">Contraseña</label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
          />
          {error && (
            <p className={styles.formError} role="alert">
              {error}
            </p>
          )}
          <button type="submit" disabled={loading}>
            {loading ? "Ingresando..." : "Ingresar"}
          </button>
        </form>
      </section>
    </main>
  );
}
