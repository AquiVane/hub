# Instrucciones para Claude Code en este repo

Este repo (`AquiVane/hub`) es el frontend del Marketing Hub — panel admin (`admin/index.html`) y panel de cliente (`app/index.html` + `js/app.js`), con datos vía `js/data.js`. Trabajás para Vaneh (COSMART). El backend vive en el repo hermano `AquiVane/cosmart-workers` (worker `marketing-hub`, KV `MH_DATA`/`MH_USERS`).

**Desde el 29/08 es multi-tenant**: COSMART es la agencia "dueña" del sistema, pero cualquier otra agencia puede darse de alta (`signup.html`) y usar el mismo Hub con sus propios clientes, totalmente aislada. Ver la sección "MULTI-TENANCY" al principio de `HANDOFF.md` antes de tocar nada que lea/escriba `_clients`, `_colaboradores`, datos de cliente o archivos — hay una regla dura de seguridad ahí (el `agencyId` sale siempre del usuario autenticado, nunca de la request) que no se puede romper.

## Al empezar cualquier sesión

Leé **`HANDOFF.md`** (raíz de este repo) ANTES de tocar código o responder preguntas sobre el estado del proyecto. Tiene el modelo de datos, las convenciones ya resueltas y lo pendiente real. No vuelvas a derivar esa información desde cero ni le preguntes a Vaneh cosas que ya están contestadas ahí.

También existe `HANDOFF.md` en `AquiVane/cosmart-workers` (backend) — si la tarea toca el worker, cron, emails automáticos o KV, revisalo también.

## Mantener el handoff al día

Antes de terminar la sesión (o apenas hiciste un cambio importante), actualizá vos mismo `HANDOFF.md` con lo que cambió: qué se hizo, qué decisiones nuevas se tomaron, qué quedó pendiente. No hace falta que Vaneh lo pida. Si en una sesión no cambió nada relevante, no hace falta tocarlo. Esto aplica también a cualquier repo nuevo que se sume al ecosistema COSMART — todos deberían tener su propio `HANDOFF.md` con este mismo mecanismo.

## Reglas duras del proyecto

- Vaneh se comunica **solo en español** — nunca respondas en inglés.
- **Nunca hagas cambios no pedidos.** Si algo te parece mejorable, preguntá antes de tocarlo — no asumas.
- Varias sesiones corren en paralelo sobre `main` en ambos repos (`hub` y `cosmart-workers`) — resolvé conflictos con `git fetch origin main && git merge origin/main --no-edit`, nunca force-push.
- Validá siempre antes de commitear: `admin/index.html` tiene un `<script type="module">` inline gigante — extraelo con una regex y corré `node --check` sobre eso, y corré `node --check js/app.js` y `node --check js/data.js` directo.
- `hub` se despliega solo (Cloudflare Pages, auto-deploy al pushear a `main`) — no hace falta ningún paso de deploy manual, a diferencia de `cosmart-workers` que necesita disparar el GitHub Action `deploy.yml` después de pushear.
- Cuidado con IDs de HTML duplicados entre modales hermanos (ya pasó una vez entre `editClientModal` y `editColaboradorModal` — `getElementById` siempre resuelve al primero que aparece en el DOM, rompiendo el otro en silencio). Antes de reusar un prefijo de id corto, gerpeá que no exista ya en otro modal.
