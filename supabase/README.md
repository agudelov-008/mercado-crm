# Supabase — mercado-crm

## Documentación

| Tema | Archivo |
|------|---------|
| Crear asesores (rol `Agent`) | [docs/provisioning-asesores.md](./docs/provisioning-asesores.md) |

## Migraciones

| Archivo | Descripción |
|---------|-------------|
| `migrations/20260601130000_create_agent_with_user.sql` | RPC `create_agent_with_user` para User Management |

```bash
supabase db push
```

## Edge Functions

| Función | Carpeta | Uso |
|---------|---------|-----|
| `create-affiliate` | `functions/create-affiliate/` | Creación legacy de afiliadora (Auth admin) |
| `create-agent` | `functions/create-agent/` | Respaldo si el RPC de asesores no está desplegado |

```bash
supabase functions deploy create-agent
```
