# Carpintería ERP

Sistema de gestión de inventario, requisiciones y almacén para taller de carpintería.

## Stack

- **Frontend:** React + Vite
- **Deploy:** Vercel
- **Backend (próximo):** Supabase (PostgreSQL + Auth + Storage + Edge Functions)
- **Bot:** OpenClaw (Telegram) + n8n (workflows)
- **AI:** OpenRouter (visión para facturas, clasificación de mensajes)

## Desarrollo local

```bash
npm install
npm run dev
```

## Deploy a Vercel

1. Push este repo a GitHub
2. En [vercel.com](https://vercel.com), importa el repositorio
3. Framework: Vite
4. Build command: `npm run build`
5. Output directory: `dist`
6. Deploy

## Módulos

| Módulo | Estado | Descripción |
|--------|--------|-------------|
| Dashboard | ✅ UI | Vista general con KPIs |
| Inventario | ✅ UI | 229 artículos reales, búsqueda, filtros, paginación |
| Facturas | ✅ UI | Procesamiento AI de facturas fotografiadas |
| Requisiciones | ✅ UI | Kanban + flujo híbrido catálogo/texto libre |
| Vales de Salida | ✅ UI | Despacho de almacén con preview Telegram |
| Órdenes de Compra | ✅ UI | Tabla de OCs |
| Proveedores | ✅ UI | 15 proveedores reales |
| Reportes | ✅ UI | Valor por categoría, consumo mensual |
| Backend Supabase | 🔲 | Tablas, RLS, Edge Functions |
| Bot Telegram | 🔲 | Clasificador AI + sub-flujos |
| Integración n8n | 🔲 | Workflows de requisición, vale, factura |

## Estructura

```
src/
├── data.js     # Datos: 229 items, proveedores, requisiciones, vales
├── App.jsx     # Componentes UI y páginas
└── main.jsx    # Entry point
```

## Inventario Master

229 artículos en 6 categorías:
- Madera Sólida (19) — Poplar, Pino, Encino, Tzalam, Parota, etc.
- Madera (50) — Triplay, MDF, Cubrecanto
- Herrajes (55) — Bisagras, correderas, jaladores, cerraduras
- Ferretería (14) — Tornillos, clavos, anclas
- Barniz y Pintura (90) — Barnices, esmaltes, lijas, brochas, tintes
- Otros (1) — Vidrio

15 proveedores: Pinturas Martínez, Hardsan, Vic, Tamahe, Kumaru, Truper, Tenerife, Triplay Market, Maderatec, Home Depot, etc.
