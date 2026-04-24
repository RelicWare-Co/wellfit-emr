import { useForm } from "@tanstack/react-form";
import { useNavigate } from "@tanstack/react-router";
import { Button } from "@wellfit-emr/ui/components/button";
import { Input } from "@wellfit-emr/ui/components/input";
import { Label } from "@wellfit-emr/ui/components/label";
import { toast } from "sonner";
import z from "zod";

import { authClient } from "@/lib/auth-client";

import Loader from "./loader";

export default function SignInForm({
  onSwitchToSignUp,
}: {
  onSwitchToSignUp: () => void;
}) {
  const navigate = useNavigate({
    from: "/",
  });
  const { isPending } = authClient.useSession();

  const form = useForm({
    defaultValues: {
      email: "",
      password: "",
    },
    onSubmit: async ({ value }) => {
      await authClient.signIn.email(
        {
          email: value.email,
          password: value.password,
        },
        {
          onSuccess: () => {
            navigate({
              to: "/",
            });
            toast.success("Inicio de sesión exitoso");
          },
          onError: (error) => {
            toast.error(
              error.error.message ||
                error.error.statusText ||
                "Error al iniciar sesión"
            );
          },
        }
      );
    },
    validators: {
      onSubmit: z.object({
        email: z.email("Correo electrónico inválido"),
        password: z
          .string()
          .min(8, "La contraseña debe tener al menos 8 caracteres"),
      }),
    },
  });

  if (isPending) {
    return <Loader />;
  }

  return (
    <div className="w-full max-w-sm">
      <h1 className="mb-2 text-left font-bold text-2xl tracking-tight">
        Iniciar sesión
      </h1>
      <p className="mb-6 text-left text-muted-foreground text-sm">
        Ingresa tus credenciales para acceder al sistema.
      </p>

      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          e.stopPropagation();
          form.handleSubmit();
        }}
      >
        <div>
          <form.Field name="email">
            {(field) => (
              <div className="space-y-2">
                <Label htmlFor={field.name}>Correo electrónico</Label>
                <Input
                  id={field.name}
                  name={field.name}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  placeholder="usuario@ejemplo.com"
                  type="email"
                  value={field.state.value}
                />
                {field.state.meta.errors.map((error) => (
                  <p className="text-red-500 text-xs" key={error?.message}>
                    {error?.message}
                  </p>
                ))}
              </div>
            )}
          </form.Field>
        </div>

        <div>
          <form.Field name="password">
            {(field) => (
              <div className="space-y-2">
                <Label htmlFor={field.name}>Contraseña</Label>
                <Input
                  id={field.name}
                  name={field.name}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  placeholder="••••••••"
                  type="password"
                  value={field.state.value}
                />
                {field.state.meta.errors.map((error) => (
                  <p className="text-red-500 text-xs" key={error?.message}>
                    {error?.message}
                  </p>
                ))}
              </div>
            )}
          </form.Field>
        </div>

        <form.Subscribe
          selector={(state) => ({
            canSubmit: state.canSubmit,
            isSubmitting: state.isSubmitting,
          })}
        >
          {({ canSubmit, isSubmitting }) => (
            <Button
              className="w-full"
              disabled={!canSubmit || isSubmitting}
              type="submit"
            >
              {isSubmitting ? "Iniciando sesión..." : "Iniciar sesión"}
            </Button>
          )}
        </form.Subscribe>
      </form>

      <div className="mt-6 text-center">
        <Button
          className="text-muted-foreground hover:text-foreground"
          onClick={onSwitchToSignUp}
          variant="link"
        >
          ¿No tienes una cuenta? Regístrate
        </Button>
      </div>
    </div>
  );
}
