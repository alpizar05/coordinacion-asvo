import { homepageFeature } from '../../lib/homepage-feature';
import { setHomepageFeature } from '../actions/series';

export async function HomepageFeatureControl({ kind, id, available, error }: {
  kind: 'outing' | 'request';
  id: string;
  available: boolean;
  error?: string;
}) {
  const feature = await homepageFeature();
  const selected = (kind === 'outing' ? feature?.outing_id : feature?.request_id) === id;
  if (!available && !selected && !error) return null;

  return <div id="destacada">
    {error && <p className="note" role="alert">{error}</p>}
    <form action={setHomepageFeature.bind(null,kind,id)} className="actions">
      {selected ? <>
        <span className="pill">{available ? 'Destacada en portada' : 'Selección guardada · Fuera del catálogo'}</span>
        <button name="action" value="retirar">Volver a selección automática</button>
      </> : available && <button name="action" value="destacar">Destacar en portada</button>}
    </form>
  </div>;
}
