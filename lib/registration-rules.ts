/** Clock and warning window are values supplied by the caller, not ambient credentials/config. */
export function cancellationWarning(starts: string, now: number, windowHours: number) {
  const start = new Date(`${starts}T00:00:00-06:00`).getTime();
  return start - now <= windowHours * 3600000;
}

export function suggestedGroups<T extends {starts: string; ends: string}>(registrations: T[]) {
  const groups: { starts: string; ends: string; people: T[] }[] = [];
  for (const person of [...registrations].sort((a,b) => a.starts.localeCompare(b.starts))) {
    const group = groups.at(-1);
    if (!group || group.ends < person.starts) {
      groups.push({ starts: person.starts, ends: person.ends, people: [person] });
    } else {
      group.people.push(person);
      if (person.ends > group.ends) group.ends = person.ends;
    }
  }
  return groups;
}

export {outingIsEditable} from './workflow-transitions';
