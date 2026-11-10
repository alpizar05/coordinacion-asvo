export function compactParticipationDates(starts: string, ends: string) {
  const [year,month,day] = starts.split('-');
  const [endYear,endMonth,endDay] = ends.split('-');
  const months = ['ene.','feb.','mar.','abr.','may.','jun.','jul.','ago.','sep.','oct.','nov.','dic.'];
  if (starts === ends) return `${Number(day)} ${months[Number(month)-1]} ${year}`;
  if (year === endYear && month === endMonth) return `${Number(day)}–${Number(endDay)} ${months[Number(month)-1]} ${year}`;
  return `${Number(day)} ${months[Number(month)-1]}${year !== endYear ? ` ${year}` : ''} – ${Number(endDay)} ${months[Number(endMonth)-1]} ${endYear}`;
}

