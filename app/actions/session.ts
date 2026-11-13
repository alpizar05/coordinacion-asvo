'use server';
import {readAuthConfiguration,assertDemoHost} from '../../lib/server-config.mjs';
import {cookies,headers} from "next/headers";
import {redirect} from "next/navigation";
import {signIn, signOut} from "../../lib/auth";
import {demo} from "../../lib/db";
import {field} from "../../lib/registration";

export async function login(form: FormData) {
  if (demo) {
    assertDemoHost((await headers()).get('host')||'');
    const value = field(form,'role') === 'admin' ? 'admin' : 'general';
    (await cookies()).set('asvo-demo',value,{ httpOnly:true, sameSite:'lax', path:'/' });
    redirect('/coordinacion');
  }
  readAuthConfiguration();
  await signIn('microsoft-entra-id',{redirectTo:'/coordinacion'});
}

export async function logout() {
  if (demo) {
    assertDemoHost((await headers()).get('host')||'');
    (await cookies()).delete('asvo-demo');
    redirect('/');
  }
  readAuthConfiguration();
  await signOut({redirectTo:'/'});
}
