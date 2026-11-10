import { outingLogisticsFields, type OutingLogistics as Logistics } from '../lib/outing-logistics';

export function OutingLogistics({ outing, fields }: { outing: Logistics; fields?: (keyof Logistics)[] }) {
  return <dl className="outing-logistics-details">{outingLogisticsFields.filter(item => !fields || fields.includes(item.name)).map(item => <div key={item.name}>
    <dt>{item.label}</dt><dd className="copy">{outing[item.name]?.trim() || 'Por confirmar con Coordinación.'}</dd>
  </div>)}</dl>;
}
