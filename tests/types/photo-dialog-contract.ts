import type {PhotoDialogProps} from '../../app/coordinacion/photo-dialog';
const prepare:PhotoDialogProps={operation:'prepare',onSave:()=>({prepared:true})};
const persist:PhotoDialogProps={operation:'persist',onSave:async()=>({saved:true})};
// @ts-expect-error Local preparation must not pretend a commit.
const fakeCommit:PhotoDialogProps={operation:'prepare',onSave:()=>({saved:true})};
// @ts-expect-error No implicit success from void.
const missing:PhotoDialogProps={operation:'prepare',onSave:()=>{}};
// @ts-expect-error A persisted mutation cannot return preparation.
const fakePrepare:PhotoDialogProps={operation:'persist',onSave:async()=>({prepared:true})};
// @ts-expect-error Strings are not results.
const legacy:PhotoDialogProps={operation:'persist',onSave:async()=> 'OK'};
void [prepare,persist,fakeCommit,missing,fakePrepare,legacy];
