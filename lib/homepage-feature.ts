import { sql } from './db';

export async function homepageFeature() {
  const [feature] = await sql<{ outing_id: string | null; request_id: string | null }[]>`
    select outing_id,request_id from homepage_feature where singleton`;
  return feature;
}
