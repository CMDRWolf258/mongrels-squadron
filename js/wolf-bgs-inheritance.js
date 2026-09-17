(() => {
  const nativeFetch = window.fetch.bind(window);

  window.fetch = async function wolfBgsInheritanceFetch(input, init = undefined) {
    const request = input instanceof Request ? input : null;
    const method = String(init?.method || request?.method || 'GET').toUpperCase();
    let url;
    try { url = new URL(request?.url || input, window.location.href); }
    catch { return nativeFetch(input, init); }

    if (method !== 'PUT' || url.pathname !== '/api/operations/wolf-bgs') {
      return nativeFetch(input, init);
    }

    const writeInit = init ? { ...init } : {};
    const writeResponse = await nativeFetch('/api/operations/wolf-bgs-write', writeInit);
    if (!writeResponse.ok) return writeResponse;

    return nativeFetch(`/api/operations/wolf-bgs?_=${Date.now()}`, {
      method: 'GET',
      credentials: 'same-origin',
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    });
  };
})();
