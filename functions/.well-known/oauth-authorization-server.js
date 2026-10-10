import { issuer, authorizeUrl, tokenUrl, oauthJson, CLIENT_ID } from '../../lib/scout-link-oauth.js';
export async function onRequestGet({request}) {
  return oauthJson({
    issuer:issuer(request),
    authorization_response_iss_parameter_supported:true,
    authorization_endpoint:authorizeUrl(request),
    token_endpoint:tokenUrl(request),
    response_types_supported:['code'],
    grant_types_supported:['authorization_code','refresh_token'],
    code_challenge_methods_supported:['S256'],
    token_endpoint_auth_methods_supported:['none'],
    scopes_supported:['scout.read','scout.route','offline_access'],
    client_id_metadata_document_supported:true,
    service_documentation:'https://mongrels-squadron.pages.dev/',
  });
}
