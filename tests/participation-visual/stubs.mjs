export const state = { context: null, effects: [], response: undefined, frame: null, restores: [] };
export const jsx = (type, props) => ({ type, props });
export const jsxs = jsx;
export const Fragment = 'fragment';
export default function Link() {}
export function ActionModal() {}
export function FormField() {}
export async function splitOutingGroup() { return state.response; }
export const createContext = () => ({});
export const useContext = () => state.context;
export const useRef = current => ({ current });
export const useEffect = callback => { state.effects.push(callback); };
export const useMemo = callback => callback();
export const useState = initial => [initial, () => {}];
export const usePathname = () => '/coordinacion';
export const useSearchParams = () => new URLSearchParams();
export const navigationDialogState = () => ({});
export const captureNavigationPosition = () => state.frame;
export const restoreNavigationPosition = frame => { state.restores.push(frame); return true; };
export const resetNavigationPosition = () => true;
