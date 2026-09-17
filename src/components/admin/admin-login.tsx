"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  GoogleAuthProvider,
  getAuth,
  getRedirectResult,
  signInWithPopup,
  signOut,
} from "firebase/auth";
import { FormEvent, useCallback, useEffect, useState } from "react";
import styles from "@/app/admin/admin.module.css";
import { firebaseApp } from "@/lib/firebase/client";

type LoginResponse = {
  authenticated?: boolean;
  codeSent?: boolean;
  error?: string;
};

export default function AdminLogin() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [codeRequested, setCodeRequested] = useState(false);
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const sendRequest = useCallback(async (body: unknown) => {
    const response = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await response.json()) as LoginResponse;
    return { data, response };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const auth = getAuth(firebaseApp);

    void getRedirectResult(auth)
      .then(async (result) => {
        if (!result || cancelled) return;
        setLoading(true);
        const idToken = await result.user.getIdToken();
        const { data, response } = await sendRequest({
          action: "request-code",
          idToken,
        });
        if (!response.ok || !data.codeSent || !result.user.email) {
          await signOut(auth);
          if (!cancelled) {
            setError(data.error ?? "No fue posible enviar el código.");
          }
          return;
        }
        if (!cancelled) {
          setEmail(result.user.email);
          setCodeRequested(true);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError(
            "No fue posible iniciar sesión con Google. Inténtelo nuevamente.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [sendRequest]);

  async function handleGoogleSignIn() {
    setError("");
    setLoading(true);

    try {
      const auth = getAuth(firebaseApp);
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });
      const result = await signInWithPopup(auth, provider);
      const idToken = await result.user.getIdToken();
      const { data, response } = await sendRequest({
        action: "request-code",
        idToken,
      });
      if (!response.ok || !data.codeSent || !result.user.email) {
        await signOut(auth);
        setError(data.error ?? "No fue posible enviar el código.");
        return;
      }
      setEmail(result.user.email);
      setCodeRequested(true);
    } catch {
      setError(
        "No fue posible iniciar sesión con Google. Inténtelo nuevamente.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleCodeVerification(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const auth = getAuth(firebaseApp);
      const user = auth.currentUser;
      if (!user) {
        setError(
          "La sesión de Google ya no está disponible. Vuelva a iniciar sesión.",
        );
        return;
      }

      const { data, response } = await sendRequest({
        action: "verify-code",
        code,
        idToken: await user.getIdToken(),
      });
      if (!response.ok || !data.authenticated) {
        setError(data.error ?? "No fue posible validar el código.");
        return;
      }
      router.refresh();
    } catch {
      setError("No fue posible completar la solicitud. Inténtelo nuevamente.");
    } finally {
      setLoading(false);
    }
  }

  async function changeGoogleAccount() {
    setCode("");
    setCodeRequested(false);
    setEmail("");
    setError("");
    await signOut(getAuth(firebaseApp));
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
            {codeRequested
              ? `Ingrese el código de seis dígitos enviado a ${email}.`
              : "Inicie sesión con Google para recibir un código de acceso."}
          </p>
        </div>
        {!codeRequested ? (
          <div className={styles.loginForm}>
            {error && (
              <p className={styles.formError} role="alert">
                {error}
              </p>
            )}
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={loading}
            >
              {loading ? "Conectando..." : "Continuar con Google"}
            </button>
          </div>
        ) : (
          <form onSubmit={handleCodeVerification} className={styles.loginForm}>
            <label htmlFor="code">Código de verificación</label>
            <input
              id="code"
              name="code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              maxLength={6}
              value={code}
              onChange={(event) =>
                setCode(event.target.value.replace(/\D/g, ""))
              }
              required
              autoFocus
            />
            <button
              className={styles.changeEmailButton}
              type="button"
              onClick={changeGoogleAccount}
              disabled={loading}
            >
              Usar otra cuenta de Google
            </button>
            {error && (
              <p className={styles.formError} role="alert">
                {error}
              </p>
            )}
            <button type="submit" disabled={loading}>
              {loading ? "Verificando..." : "Verificar código"}
            </button>
          </form>
        )}
      </section>
    </main>
  );
}
