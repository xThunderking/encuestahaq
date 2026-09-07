"use client";

import Image from "next/image";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useState } from "react";
import "survey-core/i18n/spanish";
import "survey-core/survey-core.min.css";
import { createDiagnosticSurvey } from "@/modules/surveys/create-diagnostic-survey";
import "./diagnostic-survey.css";

const Survey = dynamic(
  () => import("survey-react-ui").then((module) => module.Survey),
  {
    ssr: false,
    loading: () => (
      <div className="survey-loading" role="status">
        Cargando cuestionario...
      </div>
    ),
  },
);

const copy = {
  es: {
    title: "Su experiencia nos importa",
    welcome:
      "Gracias por permitirnos cuidar de usted. Su opinión nos ayuda a mejorar.",
    steps: ["Su visita", "Su experiencia", "Para terminar"],
    headings: [
      "Cuéntenos sobre su visita",
      "¿Cómo fue su atención?",
      "Nos gustaría escucharle",
    ],
    descriptions: [
      "Servicios externos de diagnóstico",
      "Evalúe cada aspecto del servicio recibido.",
      "Sus comentarios hacen la diferencia.",
    ],
    step: "Paso",
    of: "de",
    privacy: "Aviso de privacidad",
    optional: "Datos de contacto opcionales",
    progress: "Avance del cuestionario",
    saving: "Estamos guardando sus respuestas...",
    saved: "Su opinión es muy valiosa para Hospital Angeles Querétaro",
    savedDetail:
      "Gracias por compartir su experiencia. Sus comentarios nos ayudan a seguir mejorando la atención que brindamos cada día.",
    saveError: "No pudimos guardar su encuesta",
    saveErrorDetail:
      "Revise su conexión e inténtelo nuevamente. Sus respuestas siguen aquí.",
    retry: "Intentar de nuevo",
  },
  en: {
    title: "Your experience matters",
    welcome:
      "Thank you for trusting us with your care. Your feedback helps us improve.",
    steps: ["Your visit", "Your experience", "To finish"],
    headings: [
      "Tell us about your visit",
      "How was your care?",
      "We would like to hear from you",
    ],
    descriptions: [
      "Outpatient diagnostic services",
      "Rate each aspect of the care you received.",
      "Your feedback makes a difference.",
    ],
    step: "Step",
    of: "of",
    privacy: "Privacy notice",
    optional: "Contact details are optional",
    progress: "Survey progress",
    saving: "We are saving your answers...",
    saved: "Your feedback is valuable to Hospital Angeles Querétaro",
    savedDetail:
      "Thank you for sharing your experience. Your comments help us improve the care we provide every day.",
    saveError: "We could not save your survey",
    saveErrorDetail:
      "Check your connection and try again. Your answers are still here.",
    retry: "Try again",
  },
};

type Submission = {
  submissionId: string;
  surveyCode: "servicios_externos_diagnostico";
  locale: "es" | "en";
  answers: Record<string, string | number | boolean | null>;
};

type SaveState = "idle" | "saving" | "saved" | "error";

export default function DiagnosticSurvey() {
  const [language, setLanguage] = useState<"es" | "en">("es");
  const [survey] = useState(createDiagnosticSurvey);
  const [step, setStep] = useState(0);
  const [complete, setComplete] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [submission, setSubmission] = useState<Submission | null>(null);
  const text = copy[language];

  const saveSubmission = useCallback(async (payload: Submission) => {
    setSaveState("saving");

    try {
      const response = await fetch("/api/survey-responses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) throw new Error("Survey response was not saved");
      setSaveState("saved");
    } catch {
      setSaveState("error");
    }
  }, []);

  useEffect(() => {
    const change = () => {
      setStep(survey.currentPageNo);
      window.scrollTo({ top: 0, behavior: "instant" });
    };
    const finish = () => {
      const payload: Submission = {
        submissionId: crypto.randomUUID(),
        surveyCode: "servicios_externos_diagnostico",
        locale: survey.locale === "en" ? "en" : "es",
        answers: { ...survey.data },
      };
      setSubmission(payload);
      setComplete(true);
      window.scrollTo({ top: 0, behavior: "instant" });
      void saveSubmission(payload);
    };
    survey.onCurrentPageChanged.add(change);
    survey.onComplete.add(finish);
    return () => {
      survey.onCurrentPageChanged.remove(change);
      survey.onComplete.remove(finish);
    };
  }, [saveSubmission, survey]);

  return (
    <main className="diagnostic-survey" lang={language}>
      <header className="survey-brand-header">
        <Image
          src="/hospital-angeles-header.png"
          alt="Hospital Angeles Health System"
          width={390}
          height={80}
          priority
          className="survey-brand"
        />
        <select
          aria-label="Idioma / Language"
          value={language}
          onChange={(event) => {
            const value = event.target.value as "es" | "en";
            setLanguage(value);
            survey.setPropertyValue("locale", value);
          }}
          className="survey-language"
        >
          <option value="es">Español</option>
          <option value="en">English</option>
        </select>
      </header>
      <div className="survey-welcome">
        <div className="survey-container">
          <h1>{text.title}</h1>
          <p>{text.welcome}</p>
        </div>
      </div>
      {!complete && (
        <div
          className="survey-container survey-progress"
          aria-label={text.progress}
        >
          <ol>
            {text.steps.map((label, index) => (
              <li
                key={index}
                aria-current={step === index ? "step" : undefined}
                className={index <= step ? "is-active" : ""}
              >
                <span className="step-number">{index + 1}</span>
                <span>{label}</span>
              </li>
            ))}
          </ol>
          <progress value={step + 1} max={3} aria-label={text.progress} />
        </div>
      )}
      <div className="survey-container survey-surface">
        {!complete && (
          <div className="survey-section-heading" aria-live="polite">
            <p className="survey-step-label">
              {text.step} {step + 1} {text.of} 3
            </p>
            <h2>{text.headings[step]}</h2>
            <p>{text.descriptions[step]}</p>
          </div>
        )}
        {!complete && <Survey model={survey} />}
        {complete && (
          <section
            className={`submission-result submission-result--${saveState}`}
            role="status"
            aria-live="polite"
          >
            {saveState === "saving" && (
              <>
                <span className="saving-indicator" aria-hidden="true" />
                <h2>{text.saving}</h2>
              </>
            )}
            {saveState === "saved" && (
              <>
                <span className="success-mark" aria-hidden="true">
                  ✓
                </span>
                <h2>{text.saved}</h2>
                <p>{text.savedDetail}</p>
              </>
            )}
            {saveState === "error" && (
              <>
                <h2>{text.saveError}</h2>
                <p>{text.saveErrorDetail}</p>
                <button
                  type="button"
                  onClick={() => submission && void saveSubmission(submission)}
                >
                  {text.retry}
                </button>
              </>
            )}
          </section>
        )}
      </div>
      <footer className="survey-container survey-footer">
        <span>{text.optional}</span>
        <a
          href="https://hospitalangeles.com/aviso-de-privacidad"
          target="_blank"
          rel="noopener noreferrer"
        >
          {text.privacy}
        </a>
      </footer>
    </main>
  );
}
