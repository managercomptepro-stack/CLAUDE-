import { EmptyState } from '../components/EmptyState';
import { fr } from '../i18n/fr';
import { mountPage } from '../shell/mount';

mountPage(
  <div class="page">
    <h1 class="page__title">{fr.headings.notFound}</h1>
    <EmptyState title={fr.notFound.title} body={fr.notFound.body}>
      <a class="button button--primary" href="/">
        {fr.notFound.action}
      </a>
    </EmptyState>
  </div>,
);
