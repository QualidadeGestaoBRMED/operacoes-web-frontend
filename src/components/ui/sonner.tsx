"use client"

import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
} from "lucide-react"
import { Toaster as Sonner, type ToasterProps } from "sonner"
import { QUERY_MOBILE, useMediaQuery } from "@/hooks/useMediaQuery"

// Altura da barra inferior (h-16 + área segura, ver BarraInferior) mais o
// respiro de sempre do aviso.
const ACIMA_DA_BARRA = { bottom: "calc(4rem + 1rem + env(safe-area-inset-bottom))" }

// Sem next-themes: o app ainda não tem alternância de tema (as variáveis
// .dark existem no globals.css mas nada as aplica hoje), então o toast só
// precisa acompanhar o claro que é o único tema em uso.
const Toaster = ({ ...props }: ToasterProps) => {
  const ehMobile = useMediaQuery(QUERY_MOBILE)
  return (
    <Sonner
      theme="light"
      className="toaster group"
      closeButton
      // No celular o aviso sobe acima da barra inferior para não tapar a
      // navegação. O Sonner só usa mobileOffset até 600 px e a barra vai
      // até 767 px, por isso o offset também muda nessa faixa.
      offset={ehMobile ? ACIMA_DA_BARRA : undefined}
      mobileOffset={ACIMA_DA_BARRA}
      icons={{
        success: <CircleCheckIcon className="size-4" />,
        info: <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4" />,
        error: <OctagonXIcon className="size-4" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
        } as React.CSSProperties
      }
      {...props}
    />
  )
}

export { Toaster }
