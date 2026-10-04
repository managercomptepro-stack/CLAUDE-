/**
 * HTML entries of the 28 /ville/{slug} pages (PLAN phase 5: generated, not hand-written). They
 * are all the same file: the shell plugin gives each its own title, description and canonical
 * from src/shell/pages.ts, and src/pages/city.tsx reads the city from the address.
 * `npm run pages:sync` writes them; tests/unit/shell.test.ts checks they are up to date.
 */
export function cityPageHtml(): string {
  return `<!doctype html>
<html lang="fr">
  <head>
    <!--nx:head-->
  </head>
  <body>
    <!--nx:body-->
    <script type="module" src="/src/pages/city.tsx"></script>
  </body>
</html>
`;
}
