"use client";

import Image from "next/image";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
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
  },
};

export default function DiagnosticSurvey() {
  const [language, setLanguage] = useState<"es" | "en">("es");
  const [survey] = useState(createDiagnosticSurvey);
  const [step, setStep] = useState(0);
  const [complete, setComplete] = useState(false);
  const text = copy[language];

  useEffect(() => {
    const change = () => {
      setStep(survey.currentPageNo);
      window.scrollTo({ top: 0, behavior: "instant" });
    };
    const finish = () => {
      setComplete(true);
      window.scrollTo({ top: 0, behavior: "instant" });
    };
    survey.onCurrentPageChanged.add(change);
    survey.onComplete.add(finish);
    return () => {
      survey.onCurrentPageChanged.remove(change);
      survey.onComplete.remove(finish);
    };
  }, [survey]);

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
        <Survey model={survey} />
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
