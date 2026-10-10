import { resourceUrl, issuer, resourceMetadataUrl, oauthJson } from '../../lib/scout-link-oauth.js';
export async function onRequestGet({request}) {
  return oauthJson({
    resource:resourceUrl(request),
    authorization_servers:[issuer(request)],
    bearer_methods_supported:['header'],
    scopes_supported:['scout.read','scout.route'],
    resource_name:'Mongrel Scout Link',
  });
}
