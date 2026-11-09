export function registrationLogistics(details: Record<string, unknown> | null | undefined) {
  const data = details ?? {};
  const transport = data.transporte === true;
  const seats = transport && typeof data.ofreceTransporte === 'number' &&
    Number.isSafeInteger(data.ofreceTransporte) && data.ofreceTransporte >= 0 ? data.ofreceTransporte : 0;
  return {
    transport,
    seats,
    legacySeats: transport && data.ofreceTransporte === true,
    food: typeof data.alimentacion === 'string' ? data.alimentacion.trim() : '',
    other: typeof data.otro === 'string' ? data.otro.trim() : '',
    interested70: data.interes70 === true,
  };
}
