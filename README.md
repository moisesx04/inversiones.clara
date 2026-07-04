# Clara Inversiones

Sistema de prestamos en Next.js, TypeScript, Tailwind CSS, shadcn/ui, Framer Motion y GSAP.

## Ejecutar local

```bash
npm install
npm run dev
```

Abre `http://localhost:3000`.

Login por defecto:

```txt
Usuario: admin
Clave: admin123
```

Puedes cambiarlo en `.env.local`:

```txt
ADMIN_USER=tu_usuario
ADMIN_PASSWORD=tu_clave
```

## Publicar facil

La forma mas simple es Vercel:

```bash
npm install
npm run build
npx vercel
```

Para una base de datos real en produccion conviene conectar Supabase, Neon o Vercel Postgres. Esta version incluye API backend local y respaldo en el navegador para que sea facil de usar y probar.
