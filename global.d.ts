declare module '@mantine/core/styles.css';
declare module "@mantine/notifications/styles.css";
declare module "@mantine/dates/styles.css";
declare module '@mantine/carousel/styles.css';
declare module "@/static/global.scss";
declare module "@/static/mantine.scss";
declare module 'ol/ol.css';

interface CloudflareEnv {
  DB: import('@cloudflare/workers-types').D1Database;
  ASSETS?: import('@cloudflare/workers-types').Fetcher;
}

type D1Database = import('@cloudflare/workers-types').D1Database;

