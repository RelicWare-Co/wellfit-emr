import { createFileRoute } from "@tanstack/react-router";
import { HeartPulse, Shield } from "lucide-react";
import { useState } from "react";

import SignInForm from "@/components/sign-in-form";
import SignUpForm from "@/components/sign-up-form";

export const Route = createFileRoute("/login")({
  component: RouteComponent,
});

function RouteComponent() {
  const [showSignIn, setShowSignIn] = useState(false);

  return (
    <div className="flex min-h-svh w-full">
      {/* Left column - Branding */}
      <div className="relative hidden w-1/2 flex-col justify-between bg-slate-900 p-12 text-white lg:flex">
        <div className="z-10">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center bg-white text-slate-900">
              <HeartPulse size={20} strokeWidth={2.5} />
            </div>
            <span className="font-bold text-xl tracking-tight">
              WellFit EMR
            </span>
          </div>
        </div>

        <div className="z-10 max-w-md space-y-6">
          <h2 className="font-semibold text-3xl leading-snug">
            Historia Clínica Electrónica
          </h2>
          <p className="text-base text-slate-300 leading-relaxed">
            Sistema integral para la gestión de registros médicos conforme a la
            normativa colombiana. Diseñado para instituciones de salud que
            buscan eficiencia, seguridad y cumplimiento regulatorio.
          </p>
          <div className="flex items-center gap-2 text-slate-400 text-sm">
            <Shield size={16} />
            <span>Cumplimiento con Resolución 1888 de 2025</span>
          </div>
        </div>

        <div className="z-10 text-slate-500 text-xs">
          © {new Date().getFullYear()} WellFit EMR. Todos los derechos
          reservados.
        </div>

        {/* Subtle pattern overlay */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, white 1px, transparent 0)",
            backgroundSize: "24px 24px",
          }}
        />
      </div>

      {/* Right column - Form */}
      <div className="flex w-full flex-col justify-center bg-background px-6 py-12 lg:w-1/2 lg:px-16 xl:px-24">
        <div className="mx-auto w-full max-w-sm">
          {/* Mobile-only logo */}
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <div className="flex size-9 items-center justify-center bg-slate-900 text-white">
              <HeartPulse size={18} strokeWidth={2.5} />
            </div>
            <span className="font-bold text-lg tracking-tight">
              WellFit EMR
            </span>
          </div>

          {showSignIn ? (
            <SignInForm onSwitchToSignUp={() => setShowSignIn(false)} />
          ) : (
            <SignUpForm onSwitchToSignIn={() => setShowSignIn(true)} />
          )}

          <p className="mt-8 text-center text-muted-foreground text-xs">
            Al continuar, aceptas los términos de uso y la política de
            privacidad de la institución.
          </p>
        </div>
      </div>
    </div>
  );
}
